#!/usr/bin/env node

/**
 * Validate demo data under src/web_ui/public/data/.
 *
 * Checks:
 * - week_reports_index.json exists and is valid JSON
 * - each referenced weekly report exists and is valid JSON
 * - weekly reports have subjects with chinese/math/english
 * - upload sessions referenced in reports exist with required files
 * - all subject fields use internal codes (chinese/math/english)
 * - subject_label exists for display
 * - no local absolute paths in public data
 *
 * Usage: node scripts/validate-demo-data.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "..", "public", "data");

let passed = 0;
let failed = 0;

function log(ok, message) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

function readJson(filePath) {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function checkNoLocalPaths(obj, label, depth = 0) {
  if (depth > 10) return;
  if (typeof obj === "string") {
    if (/^\/Users\//.test(obj) || /^\/var\/lib\//.test(obj) || /^\/private\//.test(obj)) {
      log(false, `${label}: contains local absolute path "${obj}"`);
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) checkNoLocalPaths(item, label, depth + 1);
  } else if (obj && typeof obj === "object") {
    for (const val of Object.values(obj)) checkNoLocalPaths(val, label, depth + 1);
  }
}

// ── 1. Week reports index ──
console.log("\n📋 Week Reports Index");
const indexPath = resolve(DATA_DIR, "week_reports", "week_reports_index.json");
const index = readJson(indexPath);

if (!index) {
  log(false, "week_reports_index.json missing or invalid JSON");
} else {
  log(true, "week_reports_index.json exists and is valid JSON");

  const reports = index.reports ?? [];
  log(reports.length >= 2, `has ${reports.length} reports (expected ≥ 2)`);

  const VALID_SUBJECTS = new Set(["chinese", "math", "english"]);

  for (const report of reports) {
    const reportPath = resolve(DATA_DIR, "week_reports", report.report_url?.split("/").pop() ?? "");
    const reportData = readJson(reportPath);

    if (!reportData) {
      log(false, `weekly report "${report.weekly_report_id}" missing or invalid`);
      continue;
    }

    const subjects = reportData.subjects ?? [];
    const subjectCodes = subjects.map((s) => s.subject);

    log(
      subjectCodes.includes("chinese") && subjectCodes.includes("math") && subjectCodes.includes("english"),
      `${report.weekly_report_id}: subjects has chinese/math/english`,
    );

    const activeChinese = subjects.some((s) => s.subject === "chinese" && s.status === "active");
    const activeMath = subjects.some((s) => s.subject === "math" && s.status === "active");
    log(activeChinese, `${report.weekly_report_id}: chinese is active`);
    log(activeMath, `${report.weekly_report_id}: math is active`);

    for (const s of subjects) {
      log(VALID_SUBJECTS.has(s.subject), `${report.weekly_report_id}: subject "${s.subject}" is valid code`);
      log(!!s.subject_label, `${report.weekly_report_id}: subject_label exists for ${s.subject}`);
    }

    // Check upload sessions referenced in materials
    const materials = reportData.uploaded_materials ?? [];
    for (const mat of materials) {
      if (mat.source_file_url?.includes("/question_sessions/")) {
        const parts = mat.source_file_url.split("/question_sessions/")[1]?.split("/");
        const uploadId = parts?.[0];
        if (uploadId) {
          const metaPath = resolve(DATA_DIR, "question_sessions", uploadId, "upload_meta.json");
          const exists = existsSync(metaPath);
          log(exists, `${report.weekly_report_id}: upload_meta.json for ${uploadId} exists`);
        }
      }
    }

    checkNoLocalPaths(reportData, report.weekly_report_id);
  }
}

// ── 2. Question sessions ──
console.log("\n📋 Question Sessions");
const sessionsDir = resolve(DATA_DIR, "question_sessions");
const { readdirSync } = await import("node:fs");
let sessionDirs = [];
try {
  sessionDirs = readdirSync(sessionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
} catch {
  log(false, "question_sessions directory not found");
}

const REQUIRED_SESSION_FILES = [
  "upload_meta.json",
  "question_split_result.json",
  "question_confirmation_result.json",
];

let activeSessionCount = 0;

for (const uploadId of sessionDirs) {
  const sessionDir = resolve(sessionsDir, uploadId);

  for (const file of REQUIRED_SESSION_FILES) {
    const filePath = resolve(sessionDir, file);
    const exists = existsSync(filePath);
    const data = readJson(filePath);
    log(exists && data !== null, `${uploadId}/${file} exists and is valid JSON`);

    if (data) {
      const subject = data.subject;
      if (subject) {
        log(
          ["chinese", "math", "english"].includes(subject),
          `${uploadId}/${file}: subject "${subject}" is valid internal code`,
        );
        log(!!data.subject_label, `${uploadId}/${file}: has subject_label`);
      }

      checkNoLocalPaths(data, `${uploadId}/${file}`);
    }
  }

  activeSessionCount++;
}

log(activeSessionCount >= 2, `has ${activeSessionCount} upload sessions (expected ≥ 2)`);

// ── 3. Textbooks ──
console.log("\n📋 Textbooks");
const textbooksDir = resolve(DATA_DIR, "textbooks");
let textbookDirs = [];
try {
  textbookDirs = readdirSync(textbooksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
} catch {
  log(false, "textbooks directory not found");
}

let textbookCount = 0;
for (const textbookId of textbookDirs) {
  const summaryPath = resolve(textbooksDir, textbookId, "textbook_content_summary.json");
  const data = readJson(summaryPath);
  log(data !== null, `${textbookId}/textbook_content_summary.json exists and is valid JSON`);

  if (data) {
    log(!!data.subject_label, `${textbookId}: has subject_label`);
    log(
      ["chinese", "math", "english"].includes(data.subject),
      `${textbookId}: subject "${data.subject}" is valid code`,
    );
    log(!!data.chapters && data.chapters.length > 0, `${textbookId}: has chapters`);
    checkNoLocalPaths(data, textbookId);
    textbookCount++;
  }
}

log(textbookCount >= 2, `has ${textbookCount} textbooks (expected ≥ 2)`);

// ── 4. Notes ──
console.log("\n📋 Notes");
const notesDir = resolve(DATA_DIR, "notes");
let noteFiles = [];
try {
  noteFiles = readdirSync(notesDir).filter((f) => f.endsWith(".json"));
} catch {
  log(false, "notes directory not found");
}

let noteCount = 0;
for (const file of noteFiles) {
  const data = readJson(resolve(notesDir, file));
  log(data !== null, `${file} is valid JSON`);
  if (data) {
    log(!!data.subject_label, `${file}: has subject_label`);
    log(
      ["chinese", "math", "english"].includes(data.subject),
      `${file}: subject "${data.subject}" is valid code`,
    );
    checkNoLocalPaths(data, file);
    noteCount++;
  }
}

log(noteCount >= 2, `has ${noteCount} notes (expected ≥ 2)`);

// ── 5. Focus question records ──
console.log("\n📋 Focus Question Records");
const focusDir = resolve(DATA_DIR, "focus_question_records");
let focusFiles = [];
try {
  focusFiles = readdirSync(focusDir).filter((f) => f.endsWith(".json"));
} catch {
  log(false, "focus_question_records directory not found");
}

let focusCount = 0;
for (const file of focusFiles) {
  const data = readJson(resolve(focusDir, file));
  log(data !== null, `${file} is valid JSON`);
  if (data) {
    const records = data.focus_question_records ?? [];
    log(true, `${file}: has ${records.length} records`);
    for (const r of records) {
      log(
        ["chinese", "math", "english"].includes(r.subject),
        `${file}: record subject "${r.subject}" is valid code`,
      );
    }
    checkNoLocalPaths(data, file);
    focusCount++;
  }
}

log(focusCount >= 1, `has ${focusCount} focus question record files (expected ≥ 1)`);

// ── 6. Demo jobs ──
console.log("\n📋 Demo Jobs");
const demoJobsDir = resolve(DATA_DIR, "demo_jobs");
const demoIndexPath = resolve(demoJobsDir, "index.json");
const demoIndex = readJson(demoIndexPath);

if (!demoIndex) {
  log(false, "demo_jobs/index.json missing or invalid JSON");
} else {
  log(true, "demo_jobs/index.json exists and is valid JSON");
  log(demoIndex.contract === "demo_jobs_index", "has correct contract");
  log(demoIndex.execution_mode === "static", 'execution_mode is "static"');

  const jobTypes = Object.keys(demoIndex.jobs ?? {});
  log(jobTypes.length >= 3, `has ${jobTypes.length} job types (expected ≥ 3)`);

  for (const jobType of jobTypes) {
    const mappings = demoIndex.jobs[jobType];
    const keys = Object.keys(mappings);
    log(keys.length >= 1, `${jobType}: has ${keys.length} mappings`);

    for (const key of keys) {
      const resultUrl = mappings[key];
      const resultPath = resolve(DATA_DIR, ...resultUrl.replace(/^\/data\//, "").split("/"));
      const exists = existsSync(resultPath);
      log(exists, `${jobType}/${key}: result_url exists (${resultUrl})`);
    }
  }

  checkNoLocalPaths(demoIndex, "demo_jobs/index.json");
}

const REQUIRED_DEMO_JOB_FIELDS = ["job_id", "job_type", "status", "mode", "result_url"];
const demoJobFiles = [
  "textbook_summary_math_demo.json",
  "textbook_summary_chinese_demo.json",
  "learning_insight_update_math_demo.json",
  "learning_insight_update_chinese_demo.json",
  "weekly_report_20260518_20260524_demo.json",
];

let demoJobCount = 0;
for (const file of demoJobFiles) {
  const filePath = resolve(demoJobsDir, file);
  const exists = existsSync(filePath);
  const data = readJson(filePath);
  log(exists && data !== null, `${file} exists and is valid JSON`);

  if (data) {
    for (const field of REQUIRED_DEMO_JOB_FIELDS) {
      log(!!data[field], `${file}: has ${field}`);
    }
    log(data.mode === "static", `${file}: mode is "static"`);
    log(data.status === "completed", `${file}: status is "completed"`);
    const resultPath = resolve(DATA_DIR, ...data.result_url.replace(/^\/data\//, "").split("/"));
    log(existsSync(resultPath), `${file}: result_url points to existing file`);
    checkNoLocalPaths(data, file);
    demoJobCount++;
  }
}

log(demoJobCount >= 5, `has ${demoJobCount} demo job files (expected ≥ 5)`);

// ── Summary ──
console.log(`\n${"─".repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
if (failed > 0) {
  console.error("❌ Validation failed. Fix the issues above.");
  process.exit(1);
} else {
  console.log("✅ All demo data validation checks passed.");
}
