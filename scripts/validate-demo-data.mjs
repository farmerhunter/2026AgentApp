#!/usr/bin/env node
/**
 * Validate all demo data JSON files under src/web_ui/public/data/.
 * Checks structural correctness, required fields, and cross-references.
 * Exit code 0 = all pass, 1 = failures found.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_ROOT = fileURLToPath(new URL("../src/web_ui/public/data", import.meta.url));
const errors = [];
const warnings = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    errors.push(`${path}: ${e.message}`);
    return null;
  }
}

function listDirs(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path).filter((f) => statSync(join(path, f)).isDirectory());
}

function listJsonFiles(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path).filter((f) => f.endsWith(".json"));
}

// ── 1. question_sessions/_index.json ──
const sessionsIndexPath = join(DATA_ROOT, "question_sessions", "_index.json");
const sessionsIndex = readJson(sessionsIndexPath);
if (sessionsIndex) {
  assert(sessionsIndex.contract === "question_sessions_index", `${sessionsIndexPath}: missing/invalid contract`);
  assert(Array.isArray(sessionsIndex.sessions), `${sessionsIndexPath}: sessions must be array`);

  const sessionIds = [];
  for (const s of sessionsIndex.sessions ?? []) {
    assert(typeof s.upload_id === "string", `${sessionsIndexPath}: session missing upload_id`);
    assert(typeof s.subject === "string", `${sessionsIndexPath}: session ${s.upload_id} missing subject`);
    assert(typeof s.question_count === "number", `${sessionsIndexPath}: session ${s.upload_id} missing question_count`);
    sessionIds.push(s.upload_id);
  }

  // Cross-check: every session dir has required files
  const sessionDirs = listDirs(join(DATA_ROOT, "question_sessions"));
  for (const sid of sessionIds) {
    const dir = join(DATA_ROOT, "question_sessions", sid);
    assert(existsSync(dir), `session dir missing: ${dir}`);
    if (existsSync(dir)) {
      assert(existsSync(join(dir, "upload_meta.json")), `${dir}: upload_meta.json missing`);
      assert(existsSync(join(dir, "question_split_result.json")), `${dir}: question_split_result.json missing`);
      assert(existsSync(join(dir, "question_confirmation_result.json")), `${dir}: question_confirmation_result.json missing`);
    }
  }

  // ── 2. per-session files ──
  for (const sid of sessionIds) {
    const dir = join(DATA_ROOT, "question_sessions", sid);

    // upload_meta
    const meta = readJson(join(dir, "upload_meta.json"));
    if (meta) {
      assert(meta.contract === "upload_meta", `${dir}/upload_meta.json: invalid contract`);
      assert(meta.upload_id === sid, `${dir}/upload_meta.json: upload_id mismatch (${meta.upload_id} vs ${sid})`);
      assert(typeof meta.student_id === "string", `${dir}/upload_meta.json: missing student_id`);
      assert(typeof meta.subject === "string", `${dir}/upload_meta.json: missing subject`);
    }

    // question_split_result
    const split = readJson(join(dir, "question_split_result.json"));
    if (split) {
      assert(split.contract === "question_split_result", `${dir}/question_split_result.json: invalid contract`);
      assert(split.upload_id === sid, `${dir}/question_split_result.json: upload_id mismatch`);
      assert(Array.isArray(split.questions), `${dir}/question_split_result.json: questions must be array`);
      for (const q of split.questions ?? []) {
        assert(typeof q.question_id === "string", `${dir}/question_split_result.json: question missing question_id`);
        assert(typeof q.question_text === "string", `${dir}/question_split_result.json: ${q.question_id} missing question_text`);
      }
    }

    // question_confirmation_result
    const confirm = readJson(join(dir, "question_confirmation_result.json"));
    if (confirm) {
      assert(confirm.contract === "question_confirmation_result", `${dir}/question_confirmation_result.json: invalid contract`);
      assert(confirm.upload_id === sid, `${dir}/question_confirmation_result.json: upload_id mismatch`);
      assert(Array.isArray(confirm.confirmations), `${dir}/question_confirmation_result.json: confirmations must be array`);
      for (const c of confirm.confirmations ?? []) {
        assert(typeof c.question_id === "string", `${dir}/question_confirmation_result.json: confirmation missing question_id`);
        assert(typeof c.selected === "boolean", `${dir}/question_confirmation_result.json: ${c.question_id} missing selected`);
      }
    }

    // Cross: every confirmation.question_id exists in split.questions
    if (split && confirm) {
      const splitIds = new Set((split.questions ?? []).map((q) => q.question_id));
      for (const c of confirm.confirmations ?? []) {
        assert(splitIds.has(c.question_id), `${dir}: confirmation ${c.question_id} not found in split result`);
      }
    }
  }
}

// ── 3. learning_findings/*.json (#58) ──
const findingsDir = join(DATA_ROOT, "learning_findings");
const findingsFiles = listJsonFiles(findingsDir);
assert(findingsFiles.length > 0, `${findingsDir}: no findings JSON files found`);

for (const fname of findingsFiles) {
  const path = join(findingsDir, fname);
  const data = readJson(path);
  if (!data) continue;

  assert(data.contract === "learning_findings", `${path}: invalid contract (${data.contract})`);
  assert(typeof data.finding_batch_id === "string", `${path}: missing finding_batch_id`);
  assert(typeof data.student_id === "string", `${path}: missing student_id`);
  assert(typeof data.subject === "string", `${path}: missing subject`);
  assert(Array.isArray(data.findings), `${path}: findings must be array`);

  for (const f of data.findings ?? []) {
    assert(typeof f.finding_id === "string", `${path}: finding missing finding_id`);
    assert(typeof f.statement === "string", `${path}: ${f.finding_id} missing statement`);
    assert(["high", "medium", "low"].includes(f.confidence), `${path}: ${f.finding_id} invalid confidence: ${f.confidence}`);
    assert(typeof f.evidence_summary === "string", `${path}: ${f.finding_id} missing evidence_summary`);
    assert(Array.isArray(f.memory_candidates), `${path}: ${f.finding_id} memory_candidates must be array`);
    assert(Array.isArray(f.action_candidates), `${path}: ${f.finding_id} action_candidates must be array`);

    for (const mc of f.memory_candidates ?? []) {
      assert(typeof mc.reason === "string", `${path}: ${f.finding_id} memory_candidate missing reason`);
      assert(["高", "中", "低"].includes(mc.priority), `${path}: ${f.finding_id} memory_candidate invalid priority: ${mc.priority}`);
    }

    for (const ac of f.action_candidates ?? []) {
      assert(typeof ac.description === "string", `${path}: ${f.finding_id} action_candidate missing description`);
      assert(["高", "中", "低"].includes(ac.priority), `${path}: ${f.finding_id} action_candidate invalid priority: ${ac.priority}`);
      assert(typeof ac.action_type === "string", `${path}: ${f.finding_id} action_candidate missing action_type`);
    }

    // concept_links optional but validated if present
    if (f.concept_links) {
      assert(Array.isArray(f.concept_links), `${path}: ${f.finding_id} concept_links must be array`);
      for (const cl of f.concept_links) {
        assert(typeof cl.concept_name === "string", `${path}: ${f.finding_id} concept_link missing concept_name`);
      }
    }
  }
}

// ── 4. week_reports_index.json ──
const wrIndexPath = join(DATA_ROOT, "week_reports", "week_reports_index.json");
const wrIndex = readJson(wrIndexPath);
if (wrIndex) {
  assert(wrIndex.contract === "week_reports_index", `${wrIndexPath}: invalid contract`);
  assert(Array.isArray(wrIndex.reports), `${wrIndexPath}: reports must be array`);
  for (const r of wrIndex.reports ?? []) {
    assert(typeof r.weekly_report_id === "string", `${wrIndexPath}: report missing weekly_report_id`);
    assert(typeof r.report_url === "string", `${wrIndexPath}: ${r.weekly_report_id} missing report_url`);
    const reportPath = join(DATA_ROOT, "..", r.report_url); // /data/... -> relative from public/
    // report_url starts with /data/, resolve relative to DATA_ROOT parent (public/)
    const resolved = join(DATA_ROOT, r.report_url.replace(/^\/data\//, ""));
    assert(existsSync(resolved), `${wrIndexPath}: ${r.weekly_report_id} report_url not found: ${resolved}`);
  }
}

// ── 5. per-week report ──
for (const r of wrIndex?.reports ?? []) {
  const resolved = join(DATA_ROOT, r.report_url.replace(/^\/data\//, ""));
  const report = readJson(resolved);
  if (report) {
    assert(report.contract === "weekly_report", `${resolved}: invalid contract`);
    assert(report.weekly_report_id === r.weekly_report_id, `${resolved}: weekly_report_id mismatch`);
    assert(typeof report.student?.student_id === "string", `${resolved}: missing student.student_id`);
    assert(Array.isArray(report.subjects), `${resolved}: subjects must be array`);
    assert(Array.isArray(report.uploaded_materials), `${resolved}: uploaded_materials must be array`);
  }
}

// ── 6. textbooks ──
const textbookDir = join(DATA_ROOT, "textbooks");
const textbookIds = listDirs(textbookDir);
for (const tid of textbookIds) {
  const summaryPath = join(textbookDir, tid, "textbook_content_summary.json");
  const summary = readJson(summaryPath);
  if (summary) {
    assert(summary.contract === "textbook_content_summary", `${summaryPath}: invalid contract`);
    assert(typeof summary.textbook_id === "string", `${summaryPath}: missing textbook_id`);
    assert(Array.isArray(summary.chapters), `${summaryPath}: chapters must be array`);
  }
}

// ── 7. notes ──
const notesDir = join(DATA_ROOT, "notes");
const noteFiles = listJsonFiles(notesDir);
for (const nf of noteFiles) {
  const path = join(notesDir, nf);
  const note = readJson(path);
  if (note) {
    assert(note.contract === "text_note", `${path}: invalid contract`);
    assert(typeof note.note_id === "string", `${path}: missing note_id`);
    assert(typeof note.content === "string", `${path}: missing content`);
    assert(typeof note.subject === "string", `${path}: missing subject`);
  }
}

// ── 8. focus_question_records ──
const fqrDir = join(DATA_ROOT, "focus_question_records");
const fqrFiles = listJsonFiles(fqrDir);
for (const ff of fqrFiles) {
  const path = join(fqrDir, ff);
  const fqr = readJson(path);
  if (fqr) {
    assert(fqr.contract === "focus_question_records", `${path}: invalid contract`);
    assert(Array.isArray(fqr.records), `${path}: records must be array`);
    for (const r of fqr.records ?? []) {
      assert(typeof r.focus_question_id === "string", `${path}: record missing focus_question_id`);
      assert(typeof r.mistake_summary === "string", `${path}: ${r.focus_question_id} missing mistake_summary`);
      assert(typeof r.review_priority === "string", `${path}: ${r.focus_question_id} missing review_priority`);
    }
  }
}

// ── Summary ──
console.log(`\nValidated demo data in ${DATA_ROOT}\n`);
console.log(`  Files checked: ${findingsFiles.length + (sessionsIndex?.sessions?.length ?? 0) * 3 + 1 + (wrIndex?.reports?.length ?? 0) + textbookIds.length + noteFiles.length + fqrFiles.length}`);
console.log(`  Errors:   ${errors.length}`);
console.log(`  Warnings: ${warnings.length}\n`);

if (errors.length > 0) {
  console.log("Errors:");
  for (const e of errors) console.log(`  ✗ ${e}`);
}
if (warnings.length > 0) {
  console.log("Warnings:");
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

if (errors.length === 0) {
  console.log("✓ All demo data passed validation.\n");
} else {
  console.log("\n✗ Validation failed.\n");
  process.exit(1);
}
