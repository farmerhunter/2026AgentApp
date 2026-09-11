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

function assertThrows(fn, expectedMessage) {
  try {
    fn();
  } catch (error) {
    assert(
      String(error.message).includes(expectedMessage),
      `expected error containing "${expectedMessage}", got "${error.message}"`,
    );
    return;
  }
  throw new Error(`expected function to throw "${expectedMessage}"`);
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

async function assertTimeoutQueue(firstId, secondId) {
  const deadline = Date.now() + 30000;
  let firstFinal = null;
  let secondFinal = null;
  let secondStartedBeforeFirst = false;
  while (Date.now() < deadline) {
    const first = (await jsonRequest(`/api/hermes/jobs/${firstId}`)).body;
    const second = (await jsonRequest(`/api/hermes/jobs/${secondId}`)).body;
    firstFinal = ["completed", "failed", "timeout"].includes(first.status) ? first.status : null;
    secondFinal = ["completed", "failed", "timeout"].includes(second.status) ? second.status : null;
    if (second.status === "running" && firstFinal === null) {
      secondStartedBeforeFirst = true;
      break;
    }
    if (first.status === "running" && second.status === "running") {
      secondStartedBeforeFirst = true;
      break;
    }
    if (firstFinal && secondFinal) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  assert(!secondStartedBeforeFirst, "second job started before first timed out");
  assert(firstFinal === "timeout", `first timeout queue job should time out, got ${firstFinal}`);
  assert(secondFinal === "timeout", `second timeout queue job should time out, got ${secondFinal}`);
}

function startServer(overrides = {}) {
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
      ...overrides,
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
    if (existsSync(file)) {
      try {
        rmSync(file);
      } catch {
        // A detached runner may still be closing on Windows; leave a temp file.
      }
    }
  }
  if (existsSync(PRIVATE_DIR)) {
    try {
      rmSync(PRIVATE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup races.
    }
  }
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
  assert(reportDetail.body.contract_version === "2.0", "new weekly report should use contract 2.0");
  assert(reportDetail.body.overview?.headline, "weekly report should contain an overview headline");
  assert(reportDetail.body.key_insights?.length >= 1, "weekly report should contain at least one key insight");
  assert(reportDetail.body.next_actions?.length >= 1, "weekly report should contain at least one next action");
  assert(reportDetail.body.report_scope?.upload_count === 1, "weekly report upload count should come from context");
  assert(
    reportDetail.body.report_scope?.confirmed_question_count === questionIds.length,
    "weekly report confirmed question count should come from deduplicated context",
  );
  const firstReportEvidenceRef = reportDetail.body.key_insights[0].evidence_refs[0];
  assert(
    reportDetail.body.evidence_details.some((item) => item.evidence_ref === firstReportEvidenceRef),
    "weekly report should attach details for referenced evidence",
  );

  const legacyReport = reports.body.reports.find(
    (item) => item.weekly_report_id !== reports.body.reports[0].weekly_report_id,
  );
  assert(legacyReport, "seeded legacy weekly report should remain indexed");
  const legacyDetail = await jsonRequest(`/api/reports/${legacyReport.weekly_report_id}`);
  assert(legacyDetail.status === 200, "legacy weekly report should remain readable");
  assert(legacyDetail.body.analysis?.overall_summary, "legacy weekly report should preserve its summary");

  const savedReportIds = reports.body.reports.map((item) => item.weekly_report_id);
  const emptyFutureReport = await jsonRequest("/api/hermes/jobs", {
    method: "POST",
    body: JSON.stringify({
      job_type: "weekly_learning_report",
      week_start: "2099-01-05",
      week_end: "2099-01-11",
    }),
  });
  assert(emptyFutureReport.status === 202, "empty future week report creation should be 202");
  const emptyFutureJob = await waitForJob(emptyFutureReport.body.job_id);
  assert(emptyFutureJob.status === "completed", "empty future week job should complete without calling Hermes");
  const emptyFutureResult = await jsonRequest(`/api/hermes/jobs/${emptyFutureReport.body.job_id}/result`);
  assert(emptyFutureResult.body.status === "no_data", "empty future week should return an explicit no_data result");
  assert(emptyFutureResult.body.contract_version === "2.0", "empty future week should use the current report contract version");
  const reportsAfterEmptyWeek = await jsonRequest("/api/reports");
  assert(
    savedReportIds.every((reportId) =>
      reportsAfterEmptyWeek.body.reports.some((item) => item.weekly_report_id === reportId)),
    "generating an empty later week must preserve previously saved reports",
  );

  const { getDb } = await import("../db/init.js");
  const { getAnalysisContext, getWeeklyContext, hasUsableWeeklyData } = await import("../lib/e5Context.js");
  const { compactWeeklyReportCopy, validateWeeklyReportOutput } = await import("../lib/e5Store.js");
  const { extractJsonObject } = await import("../lib/hermesBridge.js");

  const noisyHermesOutput = [
    "I will draft an overview first: {\"headline\":\"draft\",\"summary\":\"draft\"}",
    JSON.stringify({
      contract: "weekly_learning_report",
      contract_version: "2.0",
      overview: { headline: "contract draft", summary: "contract draft" },
      key_insights: [],
      watch_item: null,
      next_actions: [],
    }),
    JSON.stringify({
      contract: "weekly_learning_report",
      contract_version: "2.0",
      overview: { headline: "final", summary: "final" },
      key_insights: [],
      watch_item: null,
      next_actions: [],
    }),
  ].join("\n");
  assert(
    extractJsonObject(noisyHermesOutput)?.overview?.headline === "final",
    "Hermes bridge should select the final complete contract object after noisy analysis text",
  );
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

  contextDb.prepare(
    `INSERT OR REPLACE INTO uploads
     (upload_id, student_id, subject, subject_label, source_type, source_title, uploaded_at, storage_provider, ocr_status, status, created_at, updated_at)
     VALUES ('upload_no_memory_test', 'student_demo', 'math', '数学', 'exercise', 'no memory test', ?, 'local', 'succeeded', 'active', ?, ?)`,
  ).run(now, now, now);
  insertQuestion.run("no_memory_q", "upload_no_memory_test", 1, "龘靐齉测试无关", now, now);
  contextDb.prepare(
    `INSERT OR REPLACE INTO question_confirmations
     (question_id, selected, created_at, updated_at)
     VALUES ('no_memory_q', 1, ?, ?)`,
  ).run(now, now);

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
  assert(context.report_scope.confirmed_question_count === 1, "weekly report scope should count deduplicated questions");
  assert(context.report_scope.upload_count === 1, "weekly report scope should count source uploads");
  assert(context.evidence_catalog.length === 1, "weekly context should provide one evidence catalog entry");
  assert(context.evidence_catalog[0].display_name, "weekly evidence should have a user-readable display name");

  const baseOutput = {
    contract: "weekly_learning_report",
    contract_version: "2.0",
    overview: {
      headline: "本周记录需要继续核对",
      summary: "现有证据可以支持一个局部观察，更多学习结论仍需结合后续作答确认。",
    },
    key_insights: [
      {
        type: "needs_attention",
        title: "检查当前解题过程",
        summary: "当前题目已经形成一条有来源的分析，适合作为后续复习和比较的起点。",
        why_it_matters: "保留完整步骤有助于下一次准确比较。",
        limitation: null,
        evidence_refs: ["E1"],
      },
    ],
    watch_item: null,
    next_actions: [
      {
        title: "重看当前题目",
        steps: ["核对题目和作答", "写下关键计算步骤"],
        success_check: "确认每一步都能够从原题和作答中找到。",
        reason: "当前只有一条可用证据，需要先保证过程完整。",
        evidence_refs: ["E1"],
      },
    ],
  };
  const normalizedReport = validateWeeklyReportOutput(baseOutput, context);
  assert(normalizedReport.contract_version === "2.0", "valid report should normalize to contract 2.0");
  assert(normalizedReport.report_scope.confirmed_question_count === 1, "normalized report should use trusted scope");
  assert(normalizedReport.evidence_details.length === 1, "normalized report should attach used evidence details");

  const verboseCopyOutput = {
    ...baseOutput,
    overview: {
      headline: "负号处理与二次根式合并是本周重点，已有进步仍有残留",
      summary: "本周先核对有直接步骤支持的问题，再把已经出现变化的步骤单独说明，后面的重复解释应由服务端在完整分句处收短。",
    },
    key_insights: [{
      ...baseOutput.key_insights[0],
      title: "二次根式加法已会先化简，但合并系数出错",
      summary: "作答已经先化简为 4√3+5√3，这个关键算式和数字必须原样保留，后面的重复说明可以省略以保证版面紧凑。",
      why_it_matters: "这一步已有直接变化，后续只需检查合并系数是否正确，不需要再次复述全部题目。",
      limitation: "当前只观察到一道后续题目，不能据此断定所有二次根式题都已经稳定掌握。",
    }],
  };
  const compactedCopy = compactWeeklyReportCopy(verboseCopyOutput);
  assert(compactedCopy.overview.headline === "负号处理与二次根式合并是本周重点", "headline should compact at a clause boundary");
  assert(compactedCopy.key_insights[0].title === "二次根式加法已会先化简", "insight title should compact at a clause boundary");
  assert(compactedCopy.key_insights[0].summary.includes("4√3+5√3"), "copy compaction must preserve retained math expressions");
  assert(compactedCopy.key_insights[0].evidence_refs[0] === "E1", "copy compaction must preserve evidence references");
  const compactedReport = validateWeeklyReportOutput(verboseCopyOutput, context);
  assert(
    [
      compactedReport.key_insights[0].title,
      compactedReport.key_insights[0].summary,
      compactedReport.key_insights[0].why_it_matters,
      compactedReport.key_insights[0].limitation,
    ].join("").length <= 160,
    "verbose but separable report copy should compact below the visible limit",
  );

  const comparisonContext = {
    ...context,
    report_scope: {
      ...context.report_scope,
      upload_count: 2,
      confirmed_question_count: 2,
    },
    evidence_catalog: [
      context.evidence_catalog[0],
      {
        ...context.evidence_catalog[0],
        evidence_ref: "E2",
        upload_id: "comparison_upload",
        question_id: "comparison_question",
        finding_id: "comparison_finding",
        display_name: "后续练习 · 第1题",
        generated_at: "2026-09-06T15:30:00.000Z",
      },
    ],
  };
  const improvingOutput = {
    ...baseOutput,
    key_insights: [
      {
        ...baseOutput.key_insights[0],
        type: "improving",
        title: "具体步骤有所变化",
        summary: "后一次作答已经补全此前缺少的步骤，但其他计算仍需继续核对。",
        limitation: "这里只能确认这个步骤发生变化。",
        evidence_refs: ["E1", "E2"],
      },
    ],
  };
  assert(
    validateWeeklyReportOutput(improvingOutput, comparisonContext).key_insights[0].type === "improving",
    "improving insight should pass with two time-ordered questions",
  );

  const storedBeforeInvalid = contextDb
    .prepare("SELECT report_json FROM weekly_reports WHERE weekly_report_id = ?")
    .get(reports.body.reports[0].weekly_report_id)?.report_json;
  assert(storedBeforeInvalid, "saved weekly report JSON should exist before invalid validation");

  assertThrows(
    () => validateWeeklyReportOutput({
      ...baseOutput,
      key_insights: [{ ...baseOutput.key_insights[0], evidence_refs: ["missing"] }],
    }, context),
    "unknown evidence",
  );
  assertThrows(
    () => validateWeeklyReportOutput({
      ...baseOutput,
      key_insights: [{ ...baseOutput.key_insights[0], type: "recurring" }],
    }, context),
    "at least 2 different questions",
  );
  assertThrows(
    () => validateWeeklyReportOutput({
      ...baseOutput,
      key_insights: [{
        ...baseOutput.key_insights[0],
        type: "insufficient_evidence",
        limitation: null,
      }],
    }, context),
    "must explain its limitation",
  );
  assertThrows(
    () => validateWeeklyReportOutput({
      ...baseOutput,
      next_actions: [{ ...baseOutput.next_actions[0], evidence_refs: ["E2"] }],
    }, comparisonContext),
    "displayed insight or watch item",
  );
  assertThrows(
    () => validateWeeklyReportOutput({
      ...baseOutput,
      key_insights: [
        baseOutput.key_insights[0],
        { ...baseOutput.key_insights[0], title: "第二项" },
        { ...baseOutput.key_insights[0], title: "第三项" },
        { ...baseOutput.key_insights[0], title: "第四项" },
      ],
    }, context),
    "1-3 items",
  );
  assertThrows(
    () => validateWeeklyReportOutput({
      ...baseOutput,
      overview: { ...baseOutput.overview, summary: `不应暴露 ${context.evidence_catalog[0].finding_id}` },
    }, context),
    "internal identifier",
  );
  assertThrows(
    () => validateWeeklyReportOutput({
      ...baseOutput,
      overview: {
        ...baseOutput.overview,
        summary: `前半句内容足够长并会在这里结束，后半句仍然不应暴露 ${context.evidence_catalog[0].finding_id}`,
      },
    }, context),
    "internal identifier",
  );
  assertThrows(
    () => validateWeeklyReportOutput({
      ...baseOutput,
      overview: { ...baseOutput.overview, summary: "长".repeat(121) },
    }, context),
    "at most 120 characters",
  );
  assertThrows(
    () => validateWeeklyReportOutput({
      ...baseOutput,
      next_actions: [{
        ...baseOutput.next_actions[0],
        steps: ["步骤".repeat(30), "步骤".repeat(30), "步骤".repeat(30)],
      }],
    }, context),
    "at most 140 characters",
  );

  const storedAfterInvalid = contextDb
    .prepare("SELECT report_json FROM weekly_reports WHERE weekly_report_id = ?")
    .get(reports.body.reports[0].weekly_report_id)?.report_json;
  assert(storedAfterInvalid === storedBeforeInvalid, "invalid weekly output must not replace the saved report");
  assert(hasUsableWeeklyData("student_demo", "math", "2026-08-31", "2026-09-06"), "weekly data should be usable");
  const noMemoryContext = getAnalysisContext("upload_no_memory_test");
  assert(noMemoryContext.accepted_memories.length === 0, "no relevant accepted memory should yield an empty memory list");
  contextDb.close();

  await stopServer();
  startServer({ HERMES_JOB_TIMEOUT_MS: "1200", HERMES_E5_FIXTURE_DELAY_MS: "5000" });
  await waitForHealth();
  const [timeoutA, timeoutB] = await Promise.all([
    jsonRequest("/api/hermes/jobs", {
      method: "POST",
      body: JSON.stringify({ job_type: "confirmed_mistake_analysis", source_ids: [uploadId] }),
    }),
    jsonRequest("/api/hermes/jobs", {
      method: "POST",
      body: JSON.stringify({ job_type: "confirmed_mistake_analysis", source_ids: [uploadId] }),
    }),
  ]);
  assert(timeoutA.status === 202 && timeoutB.status === 202, "timeout regression job creation should be 202");
  await assertTimeoutQueue(timeoutA.body.job_id, timeoutB.body.job_id);

  console.log("E5 fixture analysis/memory/report smoke passed");
}

try {
  await main();
} finally {
  await stopServer();
  cleanup();
}
