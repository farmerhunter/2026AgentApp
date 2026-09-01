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

export function compactKnowledgePointsForIds(ids = []) {
  const full = compactKnowledgePoints();
  if (!ids.length) {
    return { ...full, knowledge_points: [] };
  }
  const wanted = new Set(ids);
  return {
    ...full,
    knowledge_points: full.knowledge_points.filter((point) => wanted.has(point.knowledge_point_id)),
  };
}

function bigrams(text) {
  const clean = String(text ?? "").replace(/\s+/g, "");
  const result = new Set();
  for (let index = 0; index < clean.length - 1; index += 1) {
    result.add(clean.slice(index, index + 2));
  }
  return result;
}

function sharesBigram(left, right) {
  const leftGrams = bigrams(left);
  for (const gram of bigrams(right)) {
    if (leftGrams.has(gram)) return true;
  }
  return false;
}

function acceptedMemoriesFor(studentId, subject, questions = [], limit = 5) {
  const rows = db
    .prepare(
      `SELECT memory_id, statement, reason, candidate_type, priority, finding_id, finding_batch_id
       FROM memory_decisions
       WHERE student_id = ? AND subject = ? AND status = 'accepted'
       ORDER BY accepted_at DESC, memory_id`,
    )
    .all(studentId, subject);

  const questionText = questions
    .map((question) => [question.question_text, question.student_answer_text, question.note].filter(Boolean).join(" "))
    .join("\n");
  const knowledgeIds = new Set(questions.flatMap((question) => question.knowledge_point_ids ?? []));

  const getConceptLinks = db.prepare(
    "SELECT concept_links_json FROM findings WHERE finding_id = ?",
  );
  const scored = rows
    .map((row) => {
      let score = 0;
      const source = getConceptLinks.get(row.finding_id);
      const links = parseJson(source?.concept_links_json, []);
      if (links.some((link) => knowledgeIds.has(link.concept_id ?? link.knowledge_point_id))) {
        score += 3;
      }
      if (questionText && sharesBigram(questionText, row.statement)) {
        score += 1;
      }
      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(b.row.accepted_at).localeCompare(String(a.row.accepted_at)))
    .slice(0, limit);

  if (scored.length > 0) return scored.map((item) => item.row);
  return rows.slice(0, Math.min(2, limit));
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
  if (rows.length > 10) {
    const error = new Error(`Upload ${uploadId} has more than 10 confirmed wrong questions`);
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
    accepted_memories: acceptedMemoriesFor(upload.student_id ?? studentId, upload.subject, questions),
    knowledge_map: compactKnowledgePointsForIds(questions.flatMap((question) => question.knowledge_point_ids)),
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

function utcStart(dateString) {
  return new Date(`${dateString}T00:00:00+08:00`).toISOString();
}

function utcDayAfter(dateString) {
  const value = new Date(`${dateString}T00:00:00+08:00`);
  value.setDate(value.getDate() + 1);
  return value.toISOString();
}

export function getWeeklyContext({ studentId = DEFAULT_STUDENT_ID, subject = "math", weekStart, weekEnd }) {
  const start = utcStart(weekStart);
  const end = utcDayAfter(weekEnd);
  const allRows = findingRowsForRange(studentId, subject, start, end);
  const latestByQuestion = new Map();
  for (const row of allRows) {
    latestByQuestion.set(row.question_id, row);
  }
  const rows = [...latestByQuestion.values()];
  if (rows.length === 0) {
    return {
      job: "weekly_learning_report",
      student_id: studentId,
      subject,
      subject_label: null,
      week_start: weekStart,
      week_end: weekEnd,
      findings: [],
      accepted_memories: acceptedMemoriesFor(studentId, subject, []),
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
    .all(studentId, subject, start, end)) {
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
    .all(studentId, subject, start, end)) {
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

  const selectedFindingIds = new Set(rows.map((row) => row.finding_id));
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
    actions: (actionByFinding.get(row.finding_id) ?? []).filter(() => selectedFindingIds.has(row.finding_id)),
    memory_decisions: (memoryByFinding.get(row.finding_id) ?? []).filter(() => selectedFindingIds.has(row.finding_id)),
  }));

  return {
    job: "weekly_learning_report",
    student_id: studentId,
    subject,
    subject_label: subjectLabel,
    week_start: weekStart,
    week_end: weekEnd,
    findings,
    accepted_memories: acceptedMemoriesFor(
      studentId,
      subject,
      findings.map((finding) => finding.question).filter(Boolean),
    ),
    knowledge_map: compactKnowledgePointsForIds(
      findings.flatMap((finding) => finding.question?.knowledge_point_ids ?? []),
    ),
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
  const start = utcStart(weekStart);
  const end = utcDayAfter(weekEnd);
  const rows = findingRowsForRange(studentId, subject, start, end);
  const latest = new Set(rows.map((row) => row.question_id));
  return latest.size > 0;
}
