#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_DIR = resolve(__dirname, "..");
const DB_PATH = resolve(API_DIR, `e5_smoke_${Date.now()}.db`).replaceAll("\\", "/");
const DATABASE_URL = `sqlite:///${DB_PATH}`;
process.env.DATABASE_URL = DATABASE_URL;
const PRIVATE_DIR = resolve(API_DIR, `e5_smoke_private_${Date.now()}`);
const PORT = 8127;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let server = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // not ready
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error("API did not become healthy");
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

async function waitForJob(jobId, timeoutMs = 30000) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    const result = await jsonRequest(`/api/hermes/jobs/${jobId}`);
    last = result.body;
    if (result.status === 200 && ["completed", "failed", "timeout"].includes(result.body.status)) {
      return result.body;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Job ${jobId} did not reach terminal state; last=${JSON.stringify(last)}`);
}

async function assertSerialJobs(firstId, secondId) {
  const deadline = Date.now() + 30000;
  let bothRunning = false;
  let firstFinal = null;
  let secondFinal = null;
  while (Date.now() < deadline) {
    const first = (await jsonRequest(`/api/hermes/jobs/${firstId}`)).body;
    const second = (await jsonRequest(`/api/hermes/jobs/${secondId}`)).body;
    if (first.status === "running" && second.status === "running") {
      bothRunning = true;
      break;
    }
    firstFinal = ["completed", "failed", "timeout"].includes(first.status) ? first.status : null;
    secondFinal = ["completed", "failed", "timeout"].includes(second.status) ? second.status : null;
    if (firstFinal && secondFinal) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  assert(!bothRunning, "two jobs ran concurrently");
  assert(firstFinal === "completed", `first serial job should complete, got ${firstFinal}`);
  assert(secondFinal === "completed", `second serial job should complete, got ${secondFinal}`);
}

function startServer() {
  mkdirSync(PRIVATE_DIR, { recursive: true });
  server = spawn(process.execPath, ["server.js"], {
    cwd: API_DIR,
    env: {
      ...process.env,
      HERMES_API_PORT: String(PORT),
      HERMES_JOB_MODE: "fixture",
      HERMES_E5_TEST_MODE: "fixture",
      HERMES_E5_FIXTURE_DELAY_MS: "1200",
      HERMES_PRIVATE_UPLOADS_DIR: PRIVATE_DIR,
      DATABASE_URL,
    },
    stdio: "ignore",
  });
}

async function stopServer() {
  if (server) {
    const child = server;
    server = null;
    child.kill();
    await new Promise((resolvePromise) => child.once("exit", resolvePromise));
  }
}

function cleanup() {
  for (const suffix of ["", "-shm", "-wal"]) {
    const file = `${DB_PATH}${suffix}`;
    if (existsSync(file)) rmSync(file);
  }
  if (existsSync(PRIVATE_DIR)) rmSync(PRIVATE_DIR, { recursive: true, force: true });
}

async function main() {
  run(process.execPath, ["db/init.js"], API_DIR, { DATABASE_URL });
  run(process.execPath, ["db/seed.js"], API_DIR, { DATABASE_URL });
  startServer();
  await waitForHealth();

  const sessions = await jsonRequest("/api/sessions");
  assert(sessions.status === 200, "sessions should be 200");
  const uploadId = sessions.body.sessions.find((item) => item.question_count > 0)?.upload_id;
  assert(uploadId, "seeded upload not found");

  const split = await jsonRequest(`/api/sessions/${uploadId}/split`);
  const questionIds = split.body.questions.slice(0, 2).map((item) => item.question_id);
  const confirmation = await jsonRequest(`/api/sessions/${uploadId}/confirmation`, {
    method: "POST",
    body: JSON.stringify({
      confirmations: questionIds.map((question_id) => ({
        question_id,
        selected: true,
        note: "E5 smoke",
      })),
    }),
  });
  assert(confirmation.status === 200, `confirmation should be 200, got ${confirmation.status}`);

  const analysis = await jsonRequest("/api/hermes/jobs", {
    method: "POST",
    body: JSON.stringify({
      job_type: "confirmed_mistake_analysis",
      source_ids: [uploadId],
    }),
  });
  assert(analysis.status === 202, `analysis create should be 202, got ${analysis.status}`);
  const analysisJob = await waitForJob(analysis.body.job_id);
  assert(analysisJob.status === "completed", `analysis job should complete, got ${analysisJob.status}: ${analysisJob.error_message ?? ""}`);

  const [serialA, serialB] = await Promise.all([
    jsonRequest("/api/hermes/jobs", {
      method: "POST",
      body: JSON.stringify({ job_type: "confirmed_mistake_analysis", source_ids: [uploadId] }),
    }),
    jsonRequest("/api/hermes/jobs", {
      method: "POST",
      body: JSON.stringify({ job_type: "confirmed_mistake_analysis", source_ids: [uploadId] }),
    }),
  ]);
  assert(serialA.status === 202 && serialB.status === 202, "serial job creation should be 202");
  await assertSerialJobs(serialA.body.job_id, serialB.body.job_id);

  const findings = await jsonRequest("/api/findings");
  assert(findings.body.batches.some((batch) => batch.subject === "math"), "analysis batch not saved");
  const memoryList = await jsonRequest("/api/memories");
  const pending = memoryList.body.memories.find((memory) => memory.status === "pending");
  assert(pending, "analysis should produce a pending memory candidate");

  const accept = await jsonRequest("/api/memories", {
    method: "POST",
    body: JSON.stringify({
      memories: [
        {
          finding_id: pending.finding_id,
          finding_batch_id: pending.finding_batch_id,
          status: "accepted",
          note: "smoke accepted",
        },
      ],
    }),
  });
  assert(accept.status === 200, "memory accept should be 200");

  const report = await jsonRequest("/api/hermes/jobs", {
    method: "POST",
    body: JSON.stringify({ job_type: "weekly_learning_report" }),
  });
  assert(report.status === 202, `weekly report create should be 202, got ${report.status}`);
  const reportJob = await waitForJob(report.body.job_id);
  assert(reportJob.status === "completed", `weekly report job should complete, got ${reportJob.status}: ${reportJob.error_message ?? ""}`);

  const reports = await jsonRequest("/api/reports");
  assert(reports.body.reports.length > 0, "weekly report should be indexed");
  const reportDetail = await jsonRequest(`/api/reports/${reports.body.reports[0].weekly_report_id}`);
  assert(reportDetail.status === 200, "weekly report detail should be 200");
  assert(reportDetail.body.analysis?.overall_summary, "weekly report should contain overall_summary");

  const { getDb } = await import("../db/init.js");
  const { getWeeklyContext, hasUsableWeeklyData } = await import("../lib/e5Context.js");
  const contextDb = getDb();
  const now = new Date().toISOString();
  const insertQuestion = contextDb.prepare(
    `INSERT OR REPLACE INTO questions
     (question_id, upload_id, page, question_index, question_text, student_answer_text, question_type, ocr_confidence, bbox_json, raw_ocr_json_url, created_at, updated_at)
     VALUES (?, ?, 1, ?, ?, NULL, NULL, NULL, '{"x":0,"y":0,"width":100,"height":50}', NULL, ?, ?)`,
  );
  const insertBatch = contextDb.prepare(
    `INSERT OR REPLACE INTO learning_findings
     (finding_batch_id, student_id, subject, subject_label, generated_by, generated_at, source_refs_json, created_at, updated_at)
     VALUES (?, 'student_demo', 'math', '数学', 'sunday-boundary-test', ?, '[]', ?, ?)`,
  );
  const insertFinding = contextDb.prepare(
    `INSERT OR REPLACE INTO findings
     (finding_batch_id, finding_id, question_id, upload_id, scope, finding_type, statement, evidence_summary, confidence, is_recurring, mistake_reasons_json, concept_links_json, source_memory_ids_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'local', 'unknown', ?, 'boundary', 'low', 0, '[]', '[]', '[]', ?, ?)`,
  );

  insertQuestion.run("sunday_boundary_q", "sunday_boundary_upload", 1, "周日边界题", now, now);
  insertQuestion.run("monday_boundary_q", "monday_boundary_upload", 1, "周一边界题", now, now);

  // Sunday 23:00 Asia/Shanghai = 2026-09-06T15:00:00Z; must be included.
  insertBatch.run("sunday_included_batch", "2026-09-06T15:00:00.000Z", now, now);
  insertFinding.run(
    "sunday_included_batch",
    "sunday_included_finding",
    "sunday_boundary_q",
    "sunday_boundary_upload",
    "周日 23:00 上海时间应包含",
    now,
    now,
  );

  // Monday 00:00 Asia/Shanghai = 2026-09-06T16:00:00Z; must be excluded.
  insertBatch.run("monday_excluded_batch", "2026-09-06T16:00:00.000Z", now, now);
  insertFinding.run(
    "monday_excluded_batch",
    "monday_excluded_finding",
    "monday_boundary_q",
    "monday_boundary_upload",
    "周一 00:00 上海时间应排除",
    now,
    now,
  );

  const context = getWeeklyContext({
    studentId: "student_demo",
    subject: "math",
    weekStart: "2026-08-31",
    weekEnd: "2026-09-06",
  });
  assert(
    context.findings.some((finding) => finding.question?.question_id === "sunday_boundary_q"),
    "Sunday 23:00 Asia/Shanghai should be included in the weekly range",
  );
  assert(
    context.findings.every((finding) => finding.question?.question_id !== "monday_boundary_q"),
    "Monday 00:00 Asia/Shanghai should be outside the half-open weekly range",
  );
  const contextQuestionIds = context.findings.map((finding) => finding.question?.question_id).filter(Boolean);
  assert(new Set(contextQuestionIds).size === contextQuestionIds.length, "weekly context should deduplicate repeated analyses");
  assert(hasUsableWeeklyData("student_demo", "math", "2026-08-31", "2026-09-06"), "weekly data should be usable");
  contextDb.close();

  console.log("E5 fixture analysis/memory/report smoke passed");
}

try {
  await main();
} finally {
  await stopServer();
  cleanup();
}
