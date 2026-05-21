import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, closeDb } from "./init.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DATA = resolve(__dirname, "..", "..", "..", "src", "web_ui", "public", "data");

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    console.warn(`Skip ${path}: ${e.message}`);
    return null;
  }
}

function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json"));
}

function listDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory());
}

function isoNow() {
  return new Date().toISOString();
}

// ── 1. Students ──
function seedStudents(db) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO students (student_id, display_name, grade, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  stmt.run("student_demo", "小明", "八年级", isoNow(), isoNow());
  console.log("  students: seeded 1");
}

// ── 2. Uploads (from _index.json + upload_meta.json) ──
function seedUploads(db) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO uploads
     (upload_id, student_id, subject, subject_label, source_type, source_title, captured_at,
      uploaded_at, storage_provider, ocr_status, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const sessionsDir = join(PUBLIC_DATA, "question_sessions");
  const indexPath = join(sessionsDir, "_index.json");
  const index = readJson(indexPath);

  let count = 0;
  for (const s of index?.sessions ?? []) {
    const metaPath = join(sessionsDir, s.upload_id, "upload_meta.json");
    const meta = existsSync(metaPath) ? readJson(metaPath) : null;

    insert.run(
      s.upload_id,
      meta?.student_id ?? "student_demo",
      s.subject,
      s.subject_label ?? meta?.subject_label,
      s.source_type ?? meta?.source_type,
      s.source_title ?? meta?.source_title,
      s.captured_at ?? meta?.captured_at,
      meta?.uploaded_at,
      meta?.storage_provider ?? "local",
      s.ocr_status ?? meta?.ocr_status ?? "已完成",
      "active",
      isoNow(),
      isoNow()
    );
    count++;
  }
  console.log(`  uploads: seeded ${count}`);
}

// ── 3. Questions (from question_split_result.json) ──
function seedQuestions(db) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO questions
     (question_id, upload_id, page, question_index, question_text, question_image_url,
      bbox_json, raw_ocr_json_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const sessionsDir = join(PUBLIC_DATA, "question_sessions");
  const sessionIds = listDirs(sessionsDir).filter((d) => !d.startsWith("_"));

  let count = 0;
  for (const sid of sessionIds) {
    const splitPath = join(sessionsDir, sid, "question_split_result.json");
    const split = readJson(splitPath);
    if (!split) continue;

    for (const q of split.questions ?? []) {
      insert.run(
        q.question_id,
        sid,
        q.page ?? 1,
        q.question_index,
        q.question_text,
        q.question_image_url,
        q.bbox ? JSON.stringify(q.bbox) : null,
        q.raw_ocr_ref?.raw_response_url,
        isoNow(),
        isoNow()
      );
      count++;
    }
  }
  console.log(`  questions: seeded ${count}`);
}

// ── 4. Question Confirmations ──
function seedConfirmations(db) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO question_confirmations
     (question_id, selected, student_mark, teacher_score, full_score, knowledge_point,
      knowledge_point_ids_json, mistake_reason, review_priority, review_status, tags_json, note,
      created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const sessionsDir = join(PUBLIC_DATA, "question_sessions");
  const sessionIds = listDirs(sessionsDir).filter((d) => !d.startsWith("_"));

  let count = 0;
  for (const sid of sessionIds) {
    const confPath = join(sessionsDir, sid, "question_confirmation_result.json");
    const conf = readJson(confPath);
    if (!conf) continue;

    for (const c of conf.confirmations ?? []) {
      insert.run(
        c.question_id,
        c.selected ? 1 : 0,
        c.student_mark,
        c.teacher_score,
        c.full_score,
        c.knowledge_point,
        c.knowledge_point_ids ? JSON.stringify(c.knowledge_point_ids) : null,
        c.mistake_reason,
        c.review_priority,
        c.review_status,
        c.tags ? JSON.stringify(c.tags) : null,
        c.note,
        isoNow(),
        isoNow()
      );
      count++;
    }
  }
  console.log(`  question_confirmations: seeded ${count}`);
}

// ── 5. Learning Findings + Findings + Memory Decisions + Action Candidates ──
function seedFindings(db) {
  const insertBatch = db.prepare(
    `INSERT OR IGNORE INTO learning_findings
     (finding_batch_id, student_id, subject, subject_label, generated_by, generated_at,
      source_refs_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertFinding = db.prepare(
    `INSERT OR IGNORE INTO findings
     (finding_batch_id, finding_id, scope, finding_type, statement, evidence_summary,
      confidence, is_recurring, mistake_reasons_json, concept_links_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertMemory = db.prepare(
    `INSERT OR IGNORE INTO memory_decisions
     (memory_id, finding_id, finding_batch_id, student_id, subject, subject_label, statement,
      reason, candidate_type, priority, note, status, accepted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertAction = db.prepare(
    `INSERT OR IGNORE INTO action_candidates
     (finding_id, action_type, description, priority, target_week, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const dir = join(PUBLIC_DATA, "learning_findings");
  const files = listJsonFiles(dir);

  let batchCount = 0, findingCount = 0, memoryCount = 0, actionCount = 0;

  for (const f of files) {
    const data = readJson(join(dir, f));
    if (!data) continue;

    insertBatch.run(
      data.finding_batch_id,
      data.student_id,
      data.subject,
      data.subject_label,
      data.generated_by,
      data.generated_at,
      data.source_refs ? JSON.stringify(data.source_refs) : null,
      isoNow(),
      isoNow()
    );
    batchCount++;

    for (const fd of data.findings ?? []) {
      insertFinding.run(
        data.finding_batch_id,
        fd.finding_id,
        fd.scope,
        fd.finding_type,
        fd.statement,
        fd.evidence_summary,
        fd.confidence,
        fd.is_recurring ? 1 : 0,
        fd.mistake_reasons ? JSON.stringify(fd.mistake_reasons) : null,
        fd.concept_links ? JSON.stringify(fd.concept_links) : null,
        isoNow(),
        isoNow()
      );
      findingCount++;

      // Memory candidates: seed as accepted by default for demo
      for (let idx = 0; idx < (fd.memory_candidates ?? []).length; idx++) {
        const mc = fd.memory_candidates[idx];
        insertMemory.run(
          `mem_${data.finding_batch_id}_${fd.finding_id}_${idx}`,
          fd.finding_id,
          data.finding_batch_id,
          data.student_id,
          data.subject,
          data.subject_label,
          fd.statement,
          mc.reason,
          mc.candidate_type,
          mc.priority,
          "",
          "accepted",
          isoNow(),
          isoNow(),
          isoNow()
        );
        memoryCount++;
      }

      // Action candidates
      for (const ac of fd.action_candidates ?? []) {
        insertAction.run(
          fd.finding_id,
          ac.action_type,
          ac.description,
          ac.priority,
          ac.target_week,
          isoNow(),
          isoNow()
        );
        actionCount++;
      }
    }
  }

  console.log(`  learning_findings: seeded ${batchCount}`);
  console.log(`  findings: seeded ${findingCount}`);
  console.log(`  memory_decisions: seeded ${memoryCount}`);
  console.log(`  action_candidates: seeded ${actionCount}`);
}

// ── 6. Text Notes ──
function seedNotes(db) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO text_notes
     (note_id, student_id, subject, subject_label, note_type, related_textbook_id,
      related_chapter_id, knowledge_point_ids_json, content, student_confidence,
      tags_json, visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const dir = join(PUBLIC_DATA, "notes");
  const files = listJsonFiles(dir);

  let count = 0;
  for (const f of files) {
    const n = readJson(join(dir, f));
    if (!n) continue;

    insert.run(
      n.note_id,
      n.student_id,
      n.subject,
      n.subject_label,
      n.note_type,
      n.related_textbook_id,
      n.related_chapter_id,
      n.related_knowledge_point_ids ? JSON.stringify(n.related_knowledge_point_ids) : null,
      n.content,
      n.student_confidence,
      n.tags ? JSON.stringify(n.tags) : null,
      n.visibility,
      n.created_at ?? isoNow(),
      isoNow()
    );
    count++;
  }
  console.log(`  text_notes: seeded ${count}`);
}

// ── 7. Weekly Reports ──
function seedReports(db) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO weekly_reports
     (weekly_report_id, student_id, week_start, week_end, title, summary,
      report_json_url, status, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const indexPath = join(PUBLIC_DATA, "week_reports", "week_reports_index.json");
  const index = readJson(indexPath);

  let count = 0;
  for (const r of index?.reports ?? []) {
    insert.run(
      r.weekly_report_id,
      index?.student_id ?? "student_demo",
      r.week_start,
      r.week_end,
      r.title,
      r.summary,
      r.report_url,
      r.status ?? "已发布",
      r.published_at,
      isoNow(),
      isoNow()
    );
    count++;
  }
  console.log(`  weekly_reports: seeded ${count}`);
}

// ── 8. Focus Question Records ──
function seedFocusQuestions(db) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO focus_question_records
     (focus_question_id, question_id, upload_id, student_id, subject, subject_label,
      related_textbook_id, related_chapter_id, knowledge_point, knowledge_point_ids_json,
      mistake_summary, recommended_action, review_priority, review_status, weekly_report_id,
      evidence_refs_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const dir = join(PUBLIC_DATA, "focus_question_records");
  const files = listJsonFiles(dir);

  let count = 0;
  for (const f of files) {
    const data = readJson(join(dir, f));
    if (!data) continue;

    for (const r of data.records ?? []) {
      insert.run(
        r.focus_question_id,
        r.question_id,
        r.upload_id,
        r.student_id,
        r.subject,
        r.subject_label,
        r.related_textbook_id,
        r.related_chapter_id,
        r.knowledge_point,
        r.knowledge_point_ids ? JSON.stringify(r.knowledge_point_ids) : null,
        r.mistake_summary,
        r.recommended_action,
        r.review_priority,
        r.review_status,
        r.weekly_report_id,
        r.evidence_refs ? JSON.stringify(r.evidence_refs) : null,
        data.generated_at ?? isoNow(),
        isoNow()
      );
      count++;
    }
  }
  console.log(`  focus_question_records: seeded ${count}`);
}

// ── Main ──
function main() {
  console.log("Seeding Hermes demo data...\n");
  const db = getDb();

  db.transaction(() => {
    seedStudents(db);
    seedUploads(db);
    seedQuestions(db);
    seedConfirmations(db);
    seedFindings(db);
    seedNotes(db);
    seedReports(db);
    seedFocusQuestions(db);
  })();

  console.log("\nSeed complete.");
  closeDb();
}

main();
