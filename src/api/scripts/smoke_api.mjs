import { spawn, spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
import Database from "better-sqlite3";

const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(API_DIR, "..", "..");
const RUNTIME_PUBLIC = resolve(REPO_ROOT, "runtime", "public");
const STATUS_DIR = resolve(RUNTIME_PUBLIC, "job_status");
const PORT = 8123;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = process.env.DATABASE_URL?.replace("sqlite:///", "") ?? resolve(API_DIR, "hermes.db");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasKeys(obj, keys) {
  return keys.every((key) => Object.prototype.hasOwnProperty.call(obj, key));
}

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("API did not become healthy before timeout");
}

async function jsonRequest(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body };
}

let server = null;

async function startServer() {
  server = spawn(process.execPath, ["server.js"], {
    cwd: API_DIR,
    env: {
      ...process.env,
      HERMES_API_PORT: String(PORT),
      HERMES_JOB_MODE: "fixture",
    },
    stdio: "ignore",
  });
  await waitForHealth();
}

function stopServer() {
  if (server) {
    server.kill();
    server = null;
  }
}

function openDb() {
  const db = new Database(DB_PATH);
  db.defaultSafeIntegers(false);
  return db;
}

function seedSyntheticJobs() {
  const completedJobId = "job_smoke_completed";
  const resultPath = resolve(RUNTIME_PUBLIC, "learning_findings", "smoke_fixture_result.json");
  mkdirSync(dirname(resultPath), { recursive: true });
  mkdirSync(STATUS_DIR, { recursive: true });

  const now = new Date().toISOString();
  const result = {
    contract: "learning_findings",
    contract_version: "1.0",
    finding_batch_id: "smoke_fixture_batch",
    student_id: "student_demo",
    subject: "math",
    subject_label: "数学",
    generated_by: "smoke",
    generated_at: now,
    source_refs: [],
    findings: [],
  };
  writeFileSync(resultPath, JSON.stringify(result, null, 2));

  writeFileSync(
    join(STATUS_DIR, `${completedJobId}.json`),
    JSON.stringify(
      {
        job_id: completedJobId,
        job_type: "weekly_report",
        status: "completed",
        mode: "fixture",
        result_path: resultPath,
        created_at: now,
        started_at: now,
        completed_at: now,
      },
      null,
      2
    )
  );

  const staleJobId = "job_smoke_stale_pending";
  const staleCreatedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const db = openDb();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO hermes_jobs
     (job_id, job_type, status, payload_json, result_json, result_path, error_message, mode, created_at, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insert.run(completedJobId, "weekly_report", "completed", "{}", null, resultPath, null, "fixture", now, now, now);
  insert.run(staleJobId, "weekly_report", "pending", "{}", null, null, null, "fixture", staleCreatedAt, null, null);
  db.close();
}

async function main() {
  console.log("Initializing and seeding SQLite...");
  run(process.execPath, ["db/init.js"], API_DIR);
  run(process.execPath, ["db/seed.js"], API_DIR);
  seedSyntheticJobs();

  console.log(`Starting API on port ${PORT}...`);
  await startServer();

  // Health and contract envelopes
  const health = await jsonRequest("/api/health");
  assert(health.status === 200, `GET /api/health returned ${health.status}`);
  assert(health.body.status === "ok", "health status mismatch");
  assert(health.body.database === "sqlite", "health database mismatch");
  console.log("PASS GET /api/health");

  const hermesHealth = await jsonRequest("/api/hermes/health");
  assert(hermesHealth.status === 200, `GET /api/hermes/health returned ${hermesHealth.status}`);
  console.log("PASS GET /api/hermes/health");

  // Sessions
  const sessions = await jsonRequest("/api/sessions");
  assert(sessions.status === 200, `GET /api/sessions returned ${sessions.status}`);
  assert(sessions.body.contract === "question_sessions_index", "session index contract mismatch");
  assert(sessions.body.contract_version === "1.0", "session index version mismatch");
  assert(sessions.body.total_sessions >= 2, "expected at least 2 sessions");
  assert(sessions.body.sessions.every((s) => hasKeys(s, ["upload_id", "subject", "subject_label", "question_count", "confirmed_count"])), "session summary required keys missing");
  console.log("PASS GET /api/sessions");

  const emptyStudent = await jsonRequest("/api/sessions?student_id=student_does_not_exist");
  assert(emptyStudent.status === 200, "empty student session query failed");
  assert(emptyStudent.body.total_sessions === 0, "empty student total_sessions should be 0");
  assert(emptyStudent.body.total_questions === 0, "empty student total_questions should be 0");
  assert(emptyStudent.body.total_confirmed === 0, "empty student total_confirmed should be 0");
  console.log("PASS session student filter statistics");

  const uploadId = "upload_20260518_001";

  const meta = await jsonRequest(`/api/sessions/${uploadId}`);
  assert(meta.status === 200, `GET upload meta returned ${meta.status}`);
  assert(meta.body.contract === "upload_meta", "upload meta contract mismatch");
  assert(meta.body.contract_version === "1.1", "upload meta version mismatch");
  assert(hasKeys(meta.body, ["upload_id", "student_id", "subject", "subject_label", "source_type", "source_title", "ocr_status", "original_files"]), "upload meta required keys missing");
  console.log("PASS GET /api/sessions/:upload_id");

  const split = await jsonRequest(`/api/sessions/${uploadId}/split`);
  assert(split.status === 200, `GET split returned ${split.status}`);
  assert(split.body.contract === "question_split_result", "split contract mismatch");
  assert(split.body.contract_version === "1.1", "split version mismatch");
  assert(hasKeys(split.body, ["subject", "subject_label", "questions", "errors"]), "split required keys missing");
  assert(split.body.questions.length === 3, "expected 3 split questions");
  assert(split.body.questions.every((q) => hasKeys(q, ["question_id", "question_index", "page", "bbox", "question_text", "related_knowledge_point_ids", "raw_ocr_ref"])), "split question required keys missing");
  console.log("PASS GET /api/sessions/:upload_id/split");

  const before = await jsonRequest(`/api/sessions/${uploadId}/confirmation`);
  assert(before.status === 200, `GET confirmation returned ${before.status}`);
  assert(before.body.contract === "question_confirmation_result", "confirmation contract mismatch");
  assert(before.body.contract_version === "1.1", "confirmation version mismatch");
  assert(hasKeys(before.body, ["subject", "subject_label", "confirmations"]), "confirmation required keys missing");
  assert(before.body.confirmations.every((c) => hasKeys(c, ["question_id", "selected", "subject", "subject_label", "knowledge_point", "review_priority", "tags"])), "confirmation item required keys missing");

  // Atomic failure for confirmation
  const validConfirmation = { ...before.body.confirmations[0], note: "atomic invalid should not persist" };
  const invalidConfirmation = { question_id: "q_not_in_upload", selected: true };
  const atomicConfirmation = await jsonRequest(`/api/sessions/${uploadId}/confirmation`, {
    method: "POST",
    body: JSON.stringify({ confirmations: [validConfirmation, invalidConfirmation] }),
  });
  assert(atomicConfirmation.status === 400, `mixed confirmation should return 400, got ${atomicConfirmation.status}`);
  const afterAtomicConfirmation = await jsonRequest(`/api/sessions/${uploadId}/confirmation`);
  assert(jsonEqual(before.body.confirmations, afterAtomicConfirmation.body.confirmations), "confirmation atomic failure left partial data");
  console.log("PASS confirmation atomic failure");

  const nextConfirmations = before.body.confirmations.map((item, index) =>
    index === 0 ? { ...item, note: "smoke test update", review_priority: "高" } : item
  );
  const saved = await jsonRequest(`/api/sessions/${uploadId}/confirmation`, {
    method: "POST",
    body: JSON.stringify({ confirmations: nextConfirmations }),
  });
  assert(saved.status === 200, `POST confirmation returned ${saved.status}`);
  assert(saved.body.confirmations.some((item) => item.note === "smoke test update"), "confirmation note not saved");
  console.log("PASS POST /api/sessions/:upload_id/confirmation");

  // Findings
  const findingIndex = await jsonRequest("/api/findings");
  assert(findingIndex.status === 200, `GET /api/findings returned ${findingIndex.status}`);
  assert(findingIndex.body.contract === "learning_findings_index", "findings index contract mismatch");
  assert(findingIndex.body.contract_version === "1.0", "findings index version mismatch");
  assert(findingIndex.body.batches.length >= 2, "expected at least 2 finding batches");
  assert(findingIndex.body.batches.every((b) => hasKeys(b, ["finding_batch_id", "student_id", "subject", "subject_label", "generated_by", "generated_at", "finding_count"])), "finding batch required keys missing");
  console.log("PASS GET /api/findings");

  const findingBatch = await jsonRequest("/api/findings/findings_20260518_math");
  assert(findingBatch.status === 200, `GET finding batch returned ${findingBatch.status}`);
  assert(findingBatch.body.contract === "learning_findings", "finding detail contract mismatch");
  assert(findingBatch.body.contract_version === "1.0", "finding detail version mismatch");
  assert(Array.isArray(findingBatch.body.source_refs), "finding source_refs missing");
  assert(findingBatch.body.findings.length >= 2, "expected at least 2 findings");
  assert(findingBatch.body.findings.every((f) => hasKeys(f, ["finding_id", "scope", "finding_type", "statement", "evidence_summary", "concept_links", "mistake_reasons", "confidence", "is_recurring", "memory_candidates", "action_candidates", "weekly_context_candidates"])), "finding required keys missing");
  console.log("PASS GET /api/findings/:batch_id");

  // Memories
  const memoriesBefore = await jsonRequest("/api/memories?subject=math");
  assert(memoriesBefore.status === 200, `GET /api/memories returned ${memoriesBefore.status}`);
  assert(memoriesBefore.body.contract === "memory_decisions", "memory contract mismatch");
  assert(memoriesBefore.body.contract_version === "1.0", "memory version mismatch");
  assert(memoriesBefore.body.memories.length >= 2, "expected at least 2 memories");
  assert(memoriesBefore.body.memories.every((m) => hasKeys(m, ["memory_id", "finding_id", "finding_batch_id", "student_id", "subject", "subject_label", "statement", "status", "accepted_at"])), "memory required keys missing");
  console.log("PASS GET /api/memories");

  const atomicMemory = await jsonRequest("/api/memories", {
    method: "POST",
    body: JSON.stringify({
      memories: [
        { finding_id: "finding_math_001", finding_batch_id: "findings_20260518_math", note: "atomic memory invalid should not persist" },
        { finding_id: "finding_not_found", finding_batch_id: "findings_20260518_math" },
      ],
    }),
  });
  assert(atomicMemory.status === 400, `mixed memory should return 400, got ${atomicMemory.status}`);
  const memoriesAfterAtomic = await jsonRequest("/api/memories?subject=math");
  assert(jsonEqual(memoriesBefore.body.memories, memoriesAfterAtomic.body.memories), "memory atomic failure left partial data");
  console.log("PASS memory atomic failure");

  const derivedMemory = await jsonRequest("/api/memories", {
    method: "POST",
    body: JSON.stringify({
      memories: [{ finding_id: "finding_math_001", finding_batch_id: "findings_20260518_math", note: "derived metadata", status: "accepted" }],
    }),
  });
  assert(derivedMemory.status === 200, `minimal memory POST returned ${derivedMemory.status}`);
  assert(derivedMemory.body.memories[0].subject === "math", "memory subject was not derived from finding");
  assert(derivedMemory.body.memories[0].statement, "memory statement was not derived from finding");
  assert(derivedMemory.body.memories[0].student_id === "student_demo", "memory student was not derived from finding");
  console.log("PASS memory metadata derivation");

  // Notes
  const notesIndex = await jsonRequest("/api/notes");
  assert(notesIndex.status === 200, `GET /api/notes returned ${notesIndex.status}`);
  assert(notesIndex.body.contract === "text_notes", "notes index contract mismatch");
  assert(notesIndex.body.contract_version === "1.1", "notes index version mismatch");
  assert(notesIndex.body.notes.length >= 2, "expected at least 2 notes");
  console.log("PASS GET /api/notes");

  const noteDetail = await jsonRequest("/api/notes/note_20260518_001");
  assert(noteDetail.status === 200, `GET note detail returned ${noteDetail.status}`);
  assert(noteDetail.body.contract === "text_note", "note detail contract mismatch");
  assert(noteDetail.body.contract_version === "1.1", "note detail version mismatch");
  console.log("PASS GET /api/notes/:note_id");

  const createdNote = await jsonRequest("/api/notes", {
    method: "POST",
    body: JSON.stringify({
      subject: "math",
      content: "smoke note content",
      note_type: "学生问题",
      tags: ["smoke"],
    }),
  });
  assert(createdNote.status === 201, `POST /api/notes returned ${createdNote.status}`);
  assert(createdNote.body.note_id.startsWith("note_"), "generated note_id has invalid prefix");
  assert(createdNote.body.visibility === "private", "new note should default to private");
  console.log("PASS POST /api/notes");

  // Reports
  const reportsIndex = await jsonRequest("/api/reports");
  assert(reportsIndex.status === 200, `GET /api/reports returned ${reportsIndex.status}`);
  assert(reportsIndex.body.contract === "week_reports_index", "reports index contract mismatch");
  assert(reportsIndex.body.contract_version === "1.1", "reports index version mismatch");
  assert(reportsIndex.body.reports.length >= 2, "expected at least 2 reports");
  assert(reportsIndex.body.reports.every((r) => hasKeys(r, ["weekly_report_id", "week_start", "week_end", "title", "summary", "subjects", "report_url", "status"])), "report summary required keys missing");
  console.log("PASS GET /api/reports");

  const reportDetail = await jsonRequest("/api/reports/week_20260518_20260524");
  assert(reportDetail.status === 200, `GET report detail returned ${reportDetail.status}`);
  assert(reportDetail.body.contract === "weekly_report", "report detail contract mismatch");
  assert(reportDetail.body.contract_version === "1.1", "report detail version mismatch");
  console.log("PASS GET /api/reports/:report_id");

  // Job endpoints and final states
  const syntheticJob = await jsonRequest("/api/hermes/jobs/job_smoke_completed");
  assert(syntheticJob.status === 200, `GET synthetic job returned ${syntheticJob.status}`);
  assert(syntheticJob.body.status === "completed", "synthetic job should be completed");
  const syntheticResult = await jsonRequest("/api/hermes/jobs/job_smoke_completed/result");
  assert(syntheticResult.status === 200, `GET synthetic result returned ${syntheticResult.status}`);
  assert(syntheticResult.body.contract === "learning_findings", "synthetic result contract mismatch");
  console.log("PASS Hermes completed job and result");

  const staleJob = await jsonRequest("/api/hermes/jobs/job_smoke_stale_pending");
  assert(staleJob.status === 200, `GET stale job returned ${staleJob.status}`);
  assert(staleJob.body.status === "timeout", `stale job should be reconciled to timeout, got ${staleJob.body.status}`);
  console.log("PASS job startup reconciliation timeout");

  const createdJob = await jsonRequest("/api/hermes/jobs", {
    method: "POST",
    body: JSON.stringify({
      job_type: "weekly_report",
      week_start: "2026-05-18",
      week_end: "2026-05-24",
    }),
  });
  assert(createdJob.status === 202, `POST /api/hermes/jobs returned ${createdJob.status}`);
  assert(createdJob.body.job_id, "job_id was not returned");
  const createdJobId = createdJob.body.job_id;
  const jobStatus = await jsonRequest(`/api/hermes/jobs/${createdJobId}`);
  assert(jobStatus.status === 200, `GET created job returned ${jobStatus.status}`);
  assert(["pending", "running", "completed", "failed", "timeout"].includes(jobStatus.body.status), "unexpected job status");
  console.log("PASS Hermes job creation and status");

  console.log("\nPhase 1 passed. Restarting API to verify persistence and reconciliation...");
  stopServer();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await startServer();

  const reloadedConfirmation = await jsonRequest(`/api/sessions/${uploadId}/confirmation`);
  assert(reloadedConfirmation.body.confirmations.some((item) => item.note === "smoke test update"), "confirmation did not survive restart");
  console.log("PASS confirmation survives restart");

  const reloadedMemory = await jsonRequest("/api/memories?subject=math");
  assert(reloadedMemory.body.memories.some((item) => item.note === "derived metadata"), "memory did not survive restart");
  console.log("PASS memory survives restart");

  const reloadedNote = await jsonRequest(`/api/notes/${createdNote.body.note_id}`);
  assert(reloadedNote.status === 200, "created note did not survive restart");
  assert(reloadedNote.body.content === "smoke note content", "created note content mismatch after restart");
  console.log("PASS note survives restart");

  const reloadedSyntheticJob = await jsonRequest("/api/hermes/jobs/job_smoke_completed");
  assert(reloadedSyntheticJob.body.status === "completed", "synthetic job did not survive restart");
  const reloadedSyntheticResult = await jsonRequest("/api/hermes/jobs/job_smoke_completed/result");
  assert(reloadedSyntheticResult.status === 200, "synthetic result did not survive restart");
  console.log("PASS completed job survives restart");

  const reloadedCreatedJob = await jsonRequest(`/api/hermes/jobs/${createdJobId}`);
  assert(reloadedCreatedJob.status === 200, "created job did not survive restart");
  assert(["completed", "failed", "timeout", "pending", "running"].includes(reloadedCreatedJob.body.status), "unexpected created job status after restart");
  console.log("PASS created job state survives restart");

  console.log("\nAll API smoke tests passed.");
}

main().finally(() => stopServer());
