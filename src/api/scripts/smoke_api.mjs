import { spawn, spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8123;
const BASE_URL = `http://127.0.0.1:${PORT}`;

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

try {
  console.log("Initializing and seeding SQLite...");
  run(process.execPath, ["db/init.js"], API_DIR);
  run(process.execPath, ["db/seed.js"], API_DIR);

  console.log(`Starting API on port ${PORT}...`);
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

  const health = await jsonRequest("/api/health");
  assert(health.status === 200, `GET /api/health returned ${health.status}`);
  assert(health.body.status === "ok", "GET /api/health status field is not ok");
  assert(health.body.database === "sqlite", "GET /api/health database field is not sqlite");
  console.log("PASS GET /api/health");

  const hermesHealth = await jsonRequest("/api/hermes/health");
  assert(hermesHealth.status === 200, `GET /api/hermes/health returned ${hermesHealth.status}`);
  console.log("PASS GET /api/hermes/health");

  const sessions = await jsonRequest("/api/sessions");
  assert(sessions.status === 200, `GET /api/sessions returned ${sessions.status}`);
  assert(sessions.body.contract === "question_sessions_index", "session index contract mismatch");
  assert(sessions.body.total_sessions >= 2, "expected at least 2 seeded sessions");
  console.log(`PASS GET /api/sessions (${sessions.body.total_sessions} sessions)`);

  const uploadId = "upload_20260518_001";

  const meta = await jsonRequest(`/api/sessions/${uploadId}`);
  assert(meta.status === 200, `GET upload meta returned ${meta.status}`);
  assert(meta.body.upload_id === uploadId, "upload meta upload_id mismatch");
  console.log("PASS GET /api/sessions/:upload_id");

  const split = await jsonRequest(`/api/sessions/${uploadId}/split`);
  assert(split.status === 200, `GET split returned ${split.status}`);
  assert(split.body.questions.length === 3, "expected 3 split questions");
  console.log("PASS GET /api/sessions/:upload_id/split");

  const before = await jsonRequest(`/api/sessions/${uploadId}/confirmation`);
  assert(before.status === 200, `GET confirmation returned ${before.status}`);
  assert(before.body.confirmations.length === 3, "expected 3 seeded confirmations");

  const nextConfirmations = before.body.confirmations.map((item, index) =>
    index === 0 ? { ...item, note: "smoke test update", review_priority: "高" } : item
  );

  const saved = await jsonRequest(`/api/sessions/${uploadId}/confirmation`, {
    method: "POST",
    body: JSON.stringify({ confirmations: nextConfirmations }),
  });
  assert(saved.status === 200, `POST confirmation returned ${saved.status}`);
  assert(saved.body.confirmations.length === 3, "expected 3 saved confirmations");
  assert(
    saved.body.confirmations.some((item) => item.note === "smoke test update"),
    "saved confirmation note was not persisted"
  );
  console.log("PASS POST /api/sessions/:upload_id/confirmation");

  const reloaded = await jsonRequest(`/api/sessions/${uploadId}/confirmation`);
  assert(
    reloaded.body.confirmations.some((item) => item.note === "smoke test update"),
    "reloaded confirmation note mismatch"
  );
  console.log("PASS confirmation persists after reload");

  const invalid = await jsonRequest(`/api/sessions/${uploadId}/confirmation`, {
    method: "POST",
    body: JSON.stringify({ confirmations: [{ question_id: "q_not_in_upload", selected: true }] }),
  });
  assert(invalid.status === 400, `invalid question should return 400, got ${invalid.status}`);
  console.log("PASS invalid confirmation returns 400");

  const missing = await jsonRequest("/api/sessions/not_found_upload");
  assert(missing.status === 404, `missing upload should return 404, got ${missing.status}`);
  console.log("PASS missing upload returns 404");

  const findingIndex = await jsonRequest("/api/findings");
  assert(findingIndex.status === 200, `GET /api/findings returned ${findingIndex.status}`);
  assert(findingIndex.body.batches.length >= 2, "expected at least 2 finding batches");
  console.log(`PASS GET /api/findings (${findingIndex.body.batches.length} batches)`);

  const findingBatch = await jsonRequest("/api/findings/findings_20260518_math");
  assert(findingBatch.status === 200, `GET finding batch returned ${findingBatch.status}`);
  assert(findingBatch.body.findings.length >= 2, "expected at least 2 findings");
  assert(
    findingBatch.body.findings.every((item) => Array.isArray(item.memory_candidates)),
    "finding memory_candidates should be an array"
  );
  assert(
    findingBatch.body.findings.some((item) => item.action_candidates.length > 0),
    "expected action candidates in findings"
  );
  console.log("PASS GET /api/findings/:batch_id");

  const memoriesBefore = await jsonRequest("/api/memories?subject=math");
  assert(memoriesBefore.status === 200, `GET /api/memories returned ${memoriesBefore.status}`);
  assert(memoriesBefore.body.memories.length >= 2, "expected at least 2 math memories");
  console.log("PASS GET /api/memories");

  const firstMemory = memoriesBefore.body.memories[0];
  const memoryUpdate = await jsonRequest("/api/memories", {
    method: "POST",
    body: JSON.stringify({
      memories: [
        {
          ...firstMemory,
          note: "smoke memory update",
          priority: "高",
          status: "accepted",
        },
      ],
    }),
  });
  assert(memoryUpdate.status === 200, `POST /api/memories returned ${memoryUpdate.status}`);
  assert(
    memoryUpdate.body.memories[0]?.note === "smoke memory update",
    "memory decision note was not persisted"
  );
  console.log("PASS POST /api/memories");

  const memoriesAfter = await jsonRequest("/api/memories?subject=math");
  assert(
    memoriesAfter.body.memories.some((item) => item.note === "smoke memory update"),
    "reloaded memory decision note mismatch"
  );
  console.log("PASS memory decision persists after reload");

  const invalidMemory = await jsonRequest("/api/memories", {
    method: "POST",
    body: JSON.stringify({
      memories: [{ finding_id: "finding_not_found", finding_batch_id: "findings_20260518_math" }],
    }),
  });
  assert(invalidMemory.status === 400, `invalid memory should return 400, got ${invalidMemory.status}`);
  console.log("PASS invalid memory decision returns 400");

  const notesIndex = await jsonRequest("/api/notes");
  assert(notesIndex.status === 200, `GET /api/notes returned ${notesIndex.status}`);
  assert(notesIndex.body.notes.length >= 2, "expected at least 2 seeded notes");
  console.log(`PASS GET /api/notes (${notesIndex.body.notes.length} notes)`);

  const noteDetail = await jsonRequest("/api/notes/note_20260518_001");
  assert(noteDetail.status === 200, `GET note detail returned ${noteDetail.status}`);
  assert(noteDetail.body.note_id === "note_20260518_001", "note detail id mismatch");
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
  const createdNoteReload = await jsonRequest(`/api/notes/${createdNote.body.note_id}`);
  assert(createdNoteReload.status === 200, "created note was not reloadable");
  assert(createdNoteReload.body.content === "smoke note content", "created note content mismatch");
  console.log("PASS POST /api/notes and reload");

  const reportsIndex = await jsonRequest("/api/reports");
  assert(reportsIndex.status === 200, `GET /api/reports returned ${reportsIndex.status}`);
  assert(reportsIndex.body.reports.length >= 2, "expected at least 2 weekly reports");
  console.log(`PASS GET /api/reports (${reportsIndex.body.reports.length} reports)`);

  const reportDetail = await jsonRequest("/api/reports/week_20260518_20260524");
  assert(reportDetail.status === 200, `GET report detail returned ${reportDetail.status}`);
  assert(reportDetail.body.contract === "weekly_report", "report detail contract mismatch");
  console.log("PASS GET /api/reports/:report_id");

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
  const jobStatus = await jsonRequest(`/api/hermes/jobs/${createdJob.body.job_id}`);
  assert(jobStatus.status === 200, `GET job status returned ${jobStatus.status}`);
  assert(["pending", "running", "completed", "failed", "timeout"].includes(jobStatus.body.status), "unexpected job status");
  console.log("PASS Hermes job status reads from SQLite");

  console.log("\nAll API smoke tests passed.");
} finally {
  if (server) {
    server.kill();
  }
}
