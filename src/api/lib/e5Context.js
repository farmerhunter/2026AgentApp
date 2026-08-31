import { getDb } from "../db/init.js";
import { readCurrentArtifact } from "../routes/knowledgeMap.js";
import { asArray, parseJson } from "./e5Common.js";

const db = getDb();
db.defaultSafeIntegers(false);

const DEFAULT_STUDENT_ID = "student_demo";

export function compactKnowledgePoints() {
  try {
    const artifact = readCurrentArtifact();
    const points = [];
    for (const chapter of artifact.chapters ?? []) {
      for (const section of chapter.sections ?? []) {
        for (const point of section.knowledge_points ?? []) {
          points.push({
            knowledge_point_id: point.knowledge_point_id,
            name: point.name,
            description: point.description ?? "",
            coverage: point.coverage ?? null,
            chapter_id: chapter.chapter_id,
            section_id: section.section_id,
          });
        }
      }
    }
    return {
      map_id: artifact.map_id,
      map_version: artifact.map_version,
      knowledge_points: points,
    };
  } catch (error) {
    console.warn("E5 knowledge-map context unavailable:", error.message);
    return { map_id: null, map_version: null, knowledge_points: [] };
  }
}

function acceptedMemoriesFor(studentId, subject) {
  return db
    .prepare(
      `SELECT memory_id, statement, reason, candidate_type, priority, finding_id, finding_batch_id
       FROM memory_decisions
       WHERE student_id = ? AND subject = ? AND status = 'accepted'
       ORDER BY accepted_at DESC, memory_id`,
    )
    .all(studentId, subject);
}

export function getAnalysisContext(uploadId, studentId = DEFAULT_STUDENT_ID) {
  const upload = db.prepare("SELECT * FROM uploads WHERE upload_id = ?").get(uploadId);
  if (!upload) {
    const error = new Error(`Upload ${uploadId} not found`);
    error.status = 404;
    throw error;
  }

  const rows = db
    .prepare(
      `SELECT q.question_id, q.question_index, q.question_text,
              q.student_answer_text, q.question_type, q.ocr_confidence,
              c.selected, c.note, c.knowledge_point, c.knowledge_point_ids_json
       FROM question_confirmations c
       JOIN questions q ON q.question_id = c.question_id
       WHERE q.upload_id = ? AND c.selected = 1
       ORDER BY q.question_index`,
    )
    .all(uploadId);

  if (rows.length === 0) {
    const error = new Error(`Upload ${uploadId} has no confirmed wrong questions`);
    error.status = 400;
    throw error;
  }

  const questions = rows.map((row) => ({
    question_id: row.question_id,
    question_index: row.question_index ?? null,
    question_text: row.question_text ?? "",
    student_answer_text: row.student_answer_text ?? null,
    question_type: row.question_type ?? null,
    ocr_confidence: row.ocr_confidence ?? null,
    note: row.note ?? null,
    knowledge_point: row.knowledge_point ?? null,
    knowledge_point_ids: parseJson(row.knowledge_point_ids_json, []),
  }));

  return {
    job: "confirmed_mistake_analysis",
    upload_id: upload.upload_id,
    student_id: upload.student_id ?? studentId,
    subject: upload.subject,
    subject_label: upload.subject_label,
    questions,
    accepted_memories: acceptedMemoriesFor(upload.student_id ?? studentId, upload.subject),
    knowledge_map: compactKnowledgePoints(),
  };
}

function questionSourceForFinding(uploadId, questionId) {
  const q = db
    .prepare(
      `SELECT question_id, question_index, question_text, student_answer_text, question_type
       FROM questions WHERE upload_id = ? AND question_id = ?`,
    )
    .get(uploadId, questionId);
  if (!q) return null;
  const confirmation = db
    .prepare(
      `SELECT note, knowledge_point, knowledge_point_ids_json
       FROM question_confirmations WHERE question_id = ?`,
    )
    .get(questionId);
  return {
    question_id: q.question_id,
    question_index: q.question_index ?? null,
    question_text: q.question_text ?? "",
    student_answer_text: q.student_answer_text ?? null,
    question_type: q.question_type ?? null,
    note: confirmation?.note ?? null,
    knowledge_point: confirmation?.knowledge_point ?? null,
    knowledge_point_ids: parseJson(confirmation?.knowledge_point_ids_json, []),
  };
}

function findingRowsForRange(studentId, subject, weekStart, weekEnd) {
  return db
    .prepare(
      `SELECT b.finding_batch_id, b.student_id, b.subject, b.subject_label,
              b.generated_by, b.generated_at, b.source_refs_json,
              f.finding_id, f.question_id, f.upload_id, f.scope, f.finding_type,
              f.statement, f.evidence_summary, f.confidence, f.is_recurring,
              f.mistake_reasons_json, f.concept_links_json, f.source_memory_ids_json
       FROM learning_findings b
       JOIN findings f ON f.finding_batch_id = b.finding_batch_id
       WHERE b.student_id = ? AND b.subject = ?
         AND b.generated_at >= ? AND b.generated_at < ?
       ORDER BY b.generated_at, f.finding_id`,
    )
    .all(studentId, subject, weekStart, weekEnd);
}

export function getWeeklyContext({ studentId = DEFAULT_STUDENT_ID, subject = "math", weekStart, weekEnd }) {
  const rows = findingRowsForRange(studentId, subject, weekStart, weekEnd);
  if (rows.length === 0) {
    return {
      job: "weekly_learning_report",
      student_id: studentId,
      subject,
      subject_label: null,
      week_start: weekStart,
      week_end: weekEnd,
      findings: [],
      accepted_memories: acceptedMemoriesFor(studentId, subject),
      knowledge_map: compactKnowledgePoints(),
    };
  }

  const subjectLabel = rows[0].subject_label;
  const actionByFinding = new Map();
  for (const action of db
    .prepare(
      `SELECT a.*
       FROM action_candidates a
       JOIN findings f ON f.finding_id = a.finding_id
       JOIN learning_findings b ON b.finding_batch_id = f.finding_batch_id
       WHERE b.student_id = ? AND b.subject = ?
         AND b.generated_at >= ? AND b.generated_at < ?
       ORDER BY a.finding_id, a.id`,
    )
    .all(studentId, subject, weekStart, weekEnd)) {
    const list = actionByFinding.get(action.finding_id) ?? [];
    list.push({
      action_type: action.action_type,
      description: action.description,
      priority: action.priority,
      target_week: action.target_week,
    });
    actionByFinding.set(action.finding_id, list);
  }

  const memoryByFinding = new Map();
  for (const memory of db
    .prepare(
      `SELECT m.*
       FROM memory_decisions m
       JOIN findings f ON f.finding_id = m.finding_id
       JOIN learning_findings b ON b.finding_batch_id = f.finding_batch_id
       WHERE b.student_id = ? AND b.subject = ?
         AND b.generated_at >= ? AND b.generated_at < ?
       ORDER BY m.finding_id, m.memory_id`,
    )
    .all(studentId, subject, weekStart, weekEnd)) {
    const list = memoryByFinding.get(memory.finding_id) ?? [];
    list.push({
      memory_id: memory.memory_id,
      status: memory.status,
      statement: memory.statement,
      reason: memory.reason,
      accepted_at: memory.accepted_at,
    });
    memoryByFinding.set(memory.finding_id, list);
  }

  const findings = rows.map((row) => ({
    finding_id: row.finding_id,
    finding_batch_id: row.finding_batch_id,
    generated_at: row.generated_at,
    question: questionSourceForFinding(row.upload_id, row.question_id),
    scope: row.scope,
    finding_type: row.finding_type,
    statement: row.statement,
    evidence_summary: row.evidence_summary,
    confidence: row.confidence,
    is_recurring: Boolean(row.is_recurring),
    mistake_reasons: parseJson(row.mistake_reasons_json, []),
    concept_links: parseJson(row.concept_links_json, []),
    source_memory_ids: parseJson(row.source_memory_ids_json, []),
    actions: actionByFinding.get(row.finding_id) ?? [],
    memory_decisions: memoryByFinding.get(row.finding_id) ?? [],
  }));

  return {
    job: "weekly_learning_report",
    student_id: studentId,
    subject,
    subject_label: subjectLabel,
    week_start: weekStart,
    week_end: weekEnd,
    findings,
    accepted_memories: acceptedMemoriesFor(studentId, subject),
    knowledge_map: compactKnowledgePoints(),
  };
}

export function listWeekFindingsSummary(studentId = DEFAULT_STUDENT_ID, subject = "math") {
  return db
    .prepare(
      `SELECT finding_batch_id, generated_at, subject, subject_label
       FROM learning_findings
       WHERE student_id = ? AND subject = ?
       ORDER BY generated_at DESC`,
    )
    .all(studentId, subject);
}

export function hasUsableWeeklyData(studentId, subject, weekStart, weekEnd) {
  return findingRowsForRange(studentId, subject, weekStart, weekEnd).length > 0;
}
