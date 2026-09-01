import { getDb } from "../db/init.js";
import { asArray, nowIso, parseJson, timestampId } from "./e5Common.js";
import { compactKnowledgePoints } from "./e5Context.js";

const db = getDb();
db.defaultSafeIntegers(false);

const FINDING_TYPES = new Set([
  "concept_gap",
  "procedure_gap",
  "calculation_error",
  "reading_comprehension",
  "expression_issue",
  "memory_recall",
  "carelessness",
  "study_habit",
  "unknown",
]);

const CONFIDENCE_VALUES = new Set(["high", "medium", "low"]);
const ACTION_TYPES = new Set([
  "review_concept",
  "redo_question",
  "practice_set",
  "ask_for_help",
  "check_again",
  "read_textbook_section",
  "make_summary",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validKnowledgeIds() {
  return new Set(compactKnowledgePoints().knowledge_points.map((point) => point.knowledge_point_id));
}

function normalizeConceptLinks(value, validIds) {
  const links = asArray(value);
  return links.map((link) => {
    assert(link && typeof link === "object", "concept_links entries must be objects");
    const conceptId = link.concept_id ?? link.knowledge_point_id;
    if (conceptId) {
      assert(validIds.has(conceptId), `Knowledge point ${conceptId} is not present in the current map`);
    }
    return {
      concept_type: link.concept_type ?? "knowledge_point",
      concept_id: conceptId ?? null,
      concept_name: link.concept_name ?? null,
      relationship: link.relationship ?? null,
      confidence: CONFIDENCE_VALUES.has(link.confidence) ? link.confidence : null,
    };
  });
}

function normalizeActionCandidates(value) {
  const actions = asArray(value);
  assert(actions.length <= 2, "action_candidates must contain at most 2 items");
  return actions.map((action) => {
    assert(action && typeof action === "object", "action_candidates entries must be objects");
    assert(ACTION_TYPES.has(action.action_type), `Unsupported action_type: ${action.action_type}`);
    assert(typeof action.description === "string" && action.description.trim(), "action description is required");
    return {
      action_type: action.action_type,
      description: action.description.trim(),
      priority: action.priority ?? "medium",
      target_week: action.target_week ?? null,
    };
  });
}

function normalizeMemoryCandidates(value, findingId) {
  const candidates = asArray(value);
  assert(candidates.length <= 1, "memory_candidates must contain at most 1 item");
  return candidates.map((candidate) => {
    assert(candidate && typeof candidate === "object", "memory_candidates entries must be objects");
    const statement = candidate.statement ?? candidate.reason ?? "";
    assert(typeof statement === "string" && statement.trim(), "memory candidate statement is required");
    return {
      memory_id: `mem_${findingId}`,
      statement: statement.trim(),
      reason: candidate.reason ?? null,
      candidate_type: candidate.candidate_type ?? "short_term",
      priority: candidate.priority ?? "medium",
      review_status: candidate.review_status ?? "pending",
      note: candidate.note ?? "",
    };
  });
}

function normalizeFinding(raw, context, validIds) {
  assert(raw && typeof raw === "object", "finding must be an object");
  const questionId = raw.question_id;
  assert(typeof questionId === "string" && questionId, "finding.question_id is required");

  const contextQuestion = context.questions.find((question) => question.question_id === questionId);
  assert(contextQuestion, `Finding references unknown question ${questionId}`);

  const type = raw.finding_type;
  assert(FINDING_TYPES.has(type), `Unsupported finding_type: ${type}`);
  assert(typeof raw.statement === "string" && raw.statement.trim(), "finding.statement is required");
  assert(typeof raw.evidence_summary === "string", "finding.evidence_summary must be a string");
  assert(CONFIDENCE_VALUES.has(raw.confidence), `Unsupported confidence: ${raw.confidence}`);

  const sourceMemoryIds = asArray(raw.source_memory_ids).filter((id) => typeof id === "string");
  const acceptedIds = new Set(context.accepted_memories.map((memory) => memory.memory_id));
  for (const id of sourceMemoryIds) {
    assert(acceptedIds.has(id), `source_memory_ids references unknown accepted memory ${id}`);
  }

  const mistakeReasons = asArray(raw.mistake_reasons).filter((reason) => FINDING_TYPES.has(reason));
  if (raw.mistake_reasons != null && raw.mistake_reasons.length > 0) {
    assert(
      raw.mistake_reasons.every((reason) => FINDING_TYPES.has(reason)),
      "mistake_reasons contains an unsupported type",
    );
  }

  return {
    question_id: questionId,
    upload_id: context.upload_id,
    scope: raw.scope ?? "local",
    finding_type: type,
    statement: raw.statement.trim(),
    evidence_summary: raw.evidence_summary ?? "",
    confidence: raw.confidence,
    is_recurring: Boolean(raw.is_recurring),
    mistake_reasons: mistakeReasons,
    concept_links: normalizeConceptLinks(raw.concept_links, validIds),
    source_memory_ids: sourceMemoryIds,
    action_candidates: normalizeActionCandidates(raw.action_candidates),
    memory_candidates: normalizeMemoryCandidates(raw.memory_candidates, questionId),
  };
}

export function validateAnalysisOutput(output, context) {
  assert(output && typeof output === "object", "Hermes analysis output must be an object");
  assert(Array.isArray(output.findings), "analysis output `findings` must be an array");
  assert(output.findings.length === context.questions.length, "each confirmed question must have exactly one finding");

  const validIds = validKnowledgeIds();
  const seen = new Set();
  const normalized = output.findings.map((finding) => {
    const item = normalizeFinding(finding, context, validIds);
    assert(!seen.has(item.question_id), `Duplicate finding for question ${item.question_id}`);
    seen.add(item.question_id);
    return item;
  });

  return {
    contract: "confirmed_mistake_analysis",
    contract_version: "1.0",
    upload_id: context.upload_id,
    findings: normalized,
  };
}

export function saveAnalysisResult(normalized, context, meta = {}) {
  const batchId = timestampId("findings");
  const now = nowIso();
  const sourceRefs = [
    { ref_type: "upload_meta", upload_id: context.upload_id },
    { ref_type: "question_confirmation_result", upload_id: context.upload_id },
    { ref_type: "confirmed_mistake_analysis", skill_sha256: meta.skill_sha256 ?? null, skill_version: meta.skill_version ?? null },
  ];

  const insertBatch = db.prepare(
    `INSERT INTO learning_findings
     (finding_batch_id, student_id, subject, subject_label, generated_by, generated_at,
      source_refs_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertFinding = db.prepare(
    `INSERT INTO findings
     (finding_batch_id, finding_id, question_id, upload_id, scope, finding_type,
      statement, evidence_summary, confidence, is_recurring, mistake_reasons_json,
      concept_links_json, source_memory_ids_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertAction = db.prepare(
    `INSERT INTO action_candidates
     (finding_id, action_type, description, priority, target_week, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertWeeklyContext = db.prepare(
    `INSERT INTO weekly_context_candidates
     (finding_id, relevance, priority, include_in_summary, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)`,
  );
  const insertMemory = db.prepare(
    `INSERT INTO memory_decisions
     (memory_id, finding_id, finding_batch_id, student_id, subject, subject_label,
      statement, reason, candidate_type, priority, note, status, accepted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)`,
  );

  const save = db.transaction(() => {
    insertBatch.run(
      batchId,
      context.student_id,
      context.subject,
      context.subject_label,
      meta.generated_by ?? "confirmed-mistake-analysis",
      now,
      JSON.stringify(sourceRefs),
      now,
      now,
    );

    for (const finding of normalized.findings) {
      const findingId = `finding_${batchId}_${finding.question_id}`;
      insertFinding.run(
        batchId,
        findingId,
        finding.question_id,
        finding.upload_id,
        finding.scope,
        finding.finding_type,
        finding.statement,
        finding.evidence_summary,
        finding.confidence,
        finding.is_recurring ? 1 : 0,
        JSON.stringify(finding.mistake_reasons),
        JSON.stringify(finding.concept_links),
        JSON.stringify(finding.source_memory_ids),
        now,
        now,
      );

      for (const action of finding.action_candidates) {
        insertAction.run(
          findingId,
          action.action_type,
          action.description,
          action.priority,
          action.target_week,
          now,
          now,
        );
      }

      const relevance = finding.evidence_summary || finding.statement;
      insertWeeklyContext.run(findingId, relevance, "medium", now, now);

      for (const candidate of finding.memory_candidates) {
        insertMemory.run(
          `mem_${batchId}_${finding.question_id}`,
          findingId,
          batchId,
          context.student_id,
          context.subject,
          context.subject_label,
          candidate.statement,
          candidate.reason,
          candidate.candidate_type,
          candidate.priority,
          candidate.note,
          now,
          now,
        );
      }
    }
  });

  save();
  return { finding_batch_id: batchId, finding_count: normalized.findings.length };
}

export function validateWeeklyReportOutput(output, context) {
  assert(output && typeof output === "object", "weekly report output must be an object");
  assert(
    output.analysis && typeof output.analysis.overall_summary === "string" && output.analysis.overall_summary.trim(),
    "weekly report analysis.overall_summary is required",
  );

  const actions = asArray(output.actions);
  assert(actions.length <= 2, "weekly report actions must contain at most 2 items");
  for (const action of actions) {
    assert(action && typeof action === "object", "weekly report actions must be objects");
    assert(typeof action.description === "string" && action.description.trim(), "weekly report action description is required");
  }

  return {
    contract: "weekly_learning_report",
    contract_version: "1.0",
    ...output,
    week_start: context.week_start,
    week_end: context.week_end,
    student: {
      ...(output.student ?? {}),
      student_id: context.student_id,
    },
    analysis: {
      ...(output.analysis ?? {}),
      overall_summary: output.analysis.overall_summary.trim(),
    },
    actions,
  };
}

export function saveWeeklyReport(report, context, meta = {}) {
  const reportId = `week_${context.week_start.replaceAll("-", "")}_${context.week_end.replaceAll("-", "")}`;
  const now = nowIso();
  const title =
    report.week?.title ?? `${context.week_start} 至 ${context.week_end} 学习周报`;
  const summary = report.analysis?.overall_summary?.slice(0, 240) ?? "";
  const reportJson = JSON.stringify(
    {
      ...report,
      weekly_report_id: reportId,
      generated_at: now,
      generated_by: meta.generated_by ?? "weekly-learning-report",
      skill_version: meta.skill_version ?? null,
      skill_sha256: meta.skill_sha256 ?? null,
    },
    null,
    2,
  );

  db.prepare(
    `INSERT INTO weekly_reports
     (weekly_report_id, student_id, week_start, week_end, title, summary,
      report_json_url, report_json, status, published_at, generated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?)
     ON CONFLICT(weekly_report_id) DO UPDATE SET
       student_id = excluded.student_id,
       week_start = excluded.week_start,
       week_end = excluded.week_end,
       title = excluded.title,
       summary = excluded.summary,
       report_json_url = excluded.report_json_url,
       report_json = excluded.report_json,
       status = 'published',
       published_at = excluded.published_at,
       generated_by = excluded.generated_by,
       updated_at = excluded.updated_at`,
  ).run(
    reportId,
    context.student_id,
    context.week_start,
    context.week_end,
    title,
    summary,
    `/data/week_reports/${reportId}.json`,
    reportJson,
    now,
    meta.generated_by ?? "weekly-learning-report",
    now,
    now,
  );

  return { weekly_report_id: reportId };
}
