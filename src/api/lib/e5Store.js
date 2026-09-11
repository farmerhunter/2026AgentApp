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
const WEEKLY_INSIGHT_TYPES = new Set([
  "recurring",
  "improving",
  "needs_attention",
  "insufficient_evidence",
]);

const WEEKLY_COPY_TARGETS = {
  overviewHeadline: 20,
  overviewSummary: 90,
  insightTitle: 14,
  insightSummary: 85,
  insightWhy: 26,
  insightLimitation: 26,
  watchTitle: 14,
  watchSummary: 75,
  watchLimitation: 26,
  actionTitle: 14,
  actionStep: 22,
  actionSuccess: 26,
  actionReason: 20,
};

function compactAtClauseBoundary(value, maxLength, { allowSoftBoundary = false } = {}) {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;

  let boundary = -1;
  for (let index = 0; index < maxLength; index += 1) {
    if (/[。！？；.!?;]/.test(normalized[index])) boundary = index;
    if (allowSoftBoundary && /[，：,:]/.test(normalized[index])) boundary = index;
  }
  if (boundary < 3) return normalized;

  return normalized
    .slice(0, boundary + 1)
    .replace(/[，；：,;:]\s*$/, "")
    .trim();
}

export function compactWeeklyReportCopy(output) {
  if (!output || typeof output !== "object") return output;
  const compact = compactAtClauseBoundary;
  return {
    ...output,
    overview: output.overview && typeof output.overview === "object"
      ? {
          ...output.overview,
          headline: compact(output.overview.headline, WEEKLY_COPY_TARGETS.overviewHeadline, { allowSoftBoundary: true }),
          summary: compact(output.overview.summary, WEEKLY_COPY_TARGETS.overviewSummary),
        }
      : output.overview,
    key_insights: asArray(output.key_insights).map((insight) =>
      insight && typeof insight === "object"
        ? {
            ...insight,
            title: compact(insight.title, WEEKLY_COPY_TARGETS.insightTitle, { allowSoftBoundary: true }),
            summary: compact(insight.summary, WEEKLY_COPY_TARGETS.insightSummary),
            why_it_matters: compact(insight.why_it_matters, WEEKLY_COPY_TARGETS.insightWhy),
            limitation: compact(insight.limitation, WEEKLY_COPY_TARGETS.insightLimitation),
          }
        : insight),
    watch_item: output.watch_item && typeof output.watch_item === "object"
      ? {
          ...output.watch_item,
          title: compact(output.watch_item.title, WEEKLY_COPY_TARGETS.watchTitle, { allowSoftBoundary: true }),
          summary: compact(output.watch_item.summary, WEEKLY_COPY_TARGETS.watchSummary),
          limitation: compact(output.watch_item.limitation, WEEKLY_COPY_TARGETS.watchLimitation),
        }
      : output.watch_item,
    next_actions: asArray(output.next_actions).map((action) =>
      action && typeof action === "object"
        ? {
            ...action,
            title: compact(action.title, WEEKLY_COPY_TARGETS.actionTitle, { allowSoftBoundary: true }),
            steps: asArray(action.steps).map((step) => compact(step, WEEKLY_COPY_TARGETS.actionStep)),
            success_check: compact(action.success_check, WEEKLY_COPY_TARGETS.actionSuccess),
            reason: compact(action.reason, WEEKLY_COPY_TARGETS.actionReason),
          }
        : action),
  };
}

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
  assert(output.contract === "weekly_learning_report", "weekly report contract must be weekly_learning_report");
  assert(output.contract_version === "2.0", "weekly report contract_version must be 2.0");
  const evidenceCatalog = asArray(context.evidence_catalog);
  const evidenceByRef = new Map(evidenceCatalog.map((item) => [item.evidence_ref, item]));
  assert(evidenceByRef.size > 0, "weekly report context must contain evidence");
  assert(
    context.report_scope?.confirmed_question_count === evidenceCatalog.length,
    "weekly report context question count must match its evidence catalog",
  );
  assert(
    context.report_scope?.upload_count === new Set(evidenceCatalog.map((item) => item.upload_id).filter(Boolean)).size,
    "weekly report context upload count must match its evidence catalog",
  );

  const text = (value, label, maxLength) => {
    assert(typeof value === "string" && value.trim(), `${label} is required`);
    const normalized = value.trim();
    assert(normalized.length <= maxLength, `${label} must contain at most ${maxLength} characters`);
    return normalized;
  };
  const evidenceRefs = (value, label, { min = 1, max = 3 } = {}) => {
    const refs = asArray(value);
    assert(refs.length >= min && refs.length <= max, `${label} must contain ${min}-${max} items`);
    assert(refs.every((ref) => typeof ref === "string"), `${label} must contain strings`);
    assert(new Set(refs).size === refs.length, `${label} must not contain duplicates`);
    for (const ref of refs) {
      assert(evidenceByRef.has(ref), `${label} references unknown evidence ${ref}`);
    }
    return refs;
  };

  const internalIds = new Set(
    evidenceCatalog
      .flatMap((item) => [item.evidence_ref, item.question_id, item.finding_id])
      .concat(asArray(context.accepted_memories).map((memory) => memory.memory_id))
      .filter((value) => typeof value === "string" && value),
  );
  const assertPublicCopy = (value, label) => {
    for (const id of internalIds) {
      assert(!value.includes(id), `${label} must not expose internal identifier ${id}`);
    }
    assert(
      !/(?:finding|upload|memory|question|exp_story)_[a-z0-9_-]+/i.test(value),
      `${label} must not expose internal identifiers`,
    );
  };

  const rawPublicCopies = [
    output.overview?.headline,
    output.overview?.summary,
    ...asArray(output.key_insights).flatMap((item) =>
      item && typeof item === "object"
        ? [item.title, item.summary, item.why_it_matters, item.limitation]
        : []),
    ...(output.watch_item && typeof output.watch_item === "object"
      ? [output.watch_item.title, output.watch_item.summary, output.watch_item.limitation]
      : []),
    ...asArray(output.next_actions).flatMap((item) =>
      item && typeof item === "object"
        ? [item.title, ...asArray(item.steps), item.success_check, item.reason]
        : []),
  ].filter((value) => typeof value === "string");
  rawPublicCopies.forEach((value, index) => assertPublicCopy(value, `weekly report raw copy ${index}`));
  const compactedOutput = compactWeeklyReportCopy(output);

  assert(compactedOutput.overview && typeof compactedOutput.overview === "object", "weekly report overview is required");
  const overview = {
    headline: text(compactedOutput.overview.headline, "weekly report overview.headline", 30),
    summary: text(compactedOutput.overview.summary, "weekly report overview.summary", 120),
  };
  assertPublicCopy(overview.headline, "weekly report overview.headline");
  assertPublicCopy(overview.summary, "weekly report overview.summary");

  const rawInsights = asArray(compactedOutput.key_insights);
  assert(rawInsights.length >= 1 && rawInsights.length <= 3, "weekly report key_insights must contain 1-3 items");
  const keyInsights = rawInsights.map((insight, index) => {
    assert(insight && typeof insight === "object", "weekly report key_insights entries must be objects");
    assert(WEEKLY_INSIGHT_TYPES.has(insight.type), `Unsupported weekly insight type: ${insight.type}`);
    const item = {
      type: insight.type,
      title: text(insight.title, `key_insights[${index}].title`, 18),
      summary: text(insight.summary, `key_insights[${index}].summary`, 110),
      why_it_matters: text(insight.why_it_matters, `key_insights[${index}].why_it_matters`, 70),
      limitation: insight.limitation == null || insight.limitation === ""
        ? null
        : text(insight.limitation, `key_insights[${index}].limitation`, 70),
      evidence_refs: evidenceRefs(insight.evidence_refs, `key_insights[${index}].evidence_refs`),
    };
    assertPublicCopy(item.title, `key_insights[${index}].title`);
    assertPublicCopy(item.summary, `key_insights[${index}].summary`);
    assertPublicCopy(item.why_it_matters, `key_insights[${index}].why_it_matters`);
    if (item.limitation) assertPublicCopy(item.limitation, `key_insights[${index}].limitation`);

    const referenced = item.evidence_refs.map((ref) => evidenceByRef.get(ref));
    const questionIds = new Set(referenced.map((entry) => entry.question_id));
    if (item.type === "recurring") {
      assert(questionIds.size >= 2, "recurring insight must reference at least 2 different questions");
    }
    if (item.type === "improving") {
      const generatedTimes = new Set(referenced.map((entry) => entry.generated_at).filter(Boolean));
      assert(questionIds.size >= 2, "improving insight must reference at least 2 different questions");
      assert(generatedTimes.size >= 2, "improving insight must reference evidence from different times");
    }
    if (item.type === "insufficient_evidence") {
      assert(item.limitation, "insufficient_evidence insight must explain its limitation");
    }
    const insightCopyLength = [item.title, item.summary, item.why_it_matters, item.limitation ?? ""].join("").length;
    assert(insightCopyLength <= 160, `key_insights[${index}] visible copy must contain at most 160 characters`);
    return item;
  });

  const insightCopies = keyInsights.map((item) => `${item.title}\n${item.summary}`.replace(/\s+/g, ""));
  assert(new Set(insightCopies).size === insightCopies.length, "weekly report insights must not duplicate each other");

  let watchItem = null;
  if (compactedOutput.watch_item != null) {
    assert(compactedOutput.watch_item && typeof compactedOutput.watch_item === "object", "weekly report watch_item must be an object or null");
    watchItem = {
      title: text(compactedOutput.watch_item.title, "weekly report watch_item.title", 18),
      summary: text(compactedOutput.watch_item.summary, "weekly report watch_item.summary", 100),
      limitation: text(compactedOutput.watch_item.limitation, "weekly report watch_item.limitation", 80),
      evidence_refs: evidenceRefs(compactedOutput.watch_item.evidence_refs, "weekly report watch_item.evidence_refs"),
    };
    assertPublicCopy(watchItem.title, "weekly report watch_item.title");
    assertPublicCopy(watchItem.summary, "weekly report watch_item.summary");
    assertPublicCopy(watchItem.limitation, "weekly report watch_item.limitation");
    const watchCopyLength = [watchItem.title, watchItem.summary, watchItem.limitation].join("").length;
    assert(watchCopyLength <= 140, "weekly report watch_item visible copy must contain at most 140 characters");
  }

  const rawActions = asArray(compactedOutput.next_actions);
  assert(rawActions.length >= 1 && rawActions.length <= 2, "weekly report next_actions must contain 1-2 items");
  const insightEvidenceRefs = new Set([
    ...keyInsights.flatMap((item) => item.evidence_refs),
    ...(watchItem?.evidence_refs ?? []),
  ]);
  const nextActions = rawActions.map((action, index) => {
    assert(action && typeof action === "object", "weekly report next_actions entries must be objects");
    const steps = asArray(action.steps).map((step, stepIndex) =>
      text(step, `next_actions[${index}].steps[${stepIndex}]`, 60));
    assert(steps.length >= 1 && steps.length <= 3, `next_actions[${index}].steps must contain 1-3 items`);
    const item = {
      title: text(action.title, `next_actions[${index}].title`, 18),
      steps,
      success_check: text(action.success_check, `next_actions[${index}].success_check`, 80),
      reason: text(action.reason, `next_actions[${index}].reason`, 80),
      evidence_refs: evidenceRefs(action.evidence_refs, `next_actions[${index}].evidence_refs`),
    };
    assert(
      item.evidence_refs.every((ref) => insightEvidenceRefs.has(ref)),
      `next_actions[${index}].evidence_refs must refer to a displayed insight or watch item`,
    );
    for (const [copyIndex, copy] of [item.title, ...item.steps, item.success_check, item.reason].entries()) {
      assertPublicCopy(copy, `next_actions[${index}] copy ${copyIndex}`);
    }
    const actionCopyLength = [item.title, ...item.steps, item.success_check, item.reason].join("").length;
    assert(actionCopyLength <= 140, `next_actions[${index}] visible copy must contain at most 140 characters`);
    return item;
  });

  const visibleCopy = [
    overview.headline,
    overview.summary,
    ...keyInsights.flatMap((item) => [item.title, item.summary, item.why_it_matters, item.limitation]),
    ...(watchItem ? [watchItem.title, watchItem.summary, watchItem.limitation] : []),
    ...nextActions.flatMap((item) => [item.title, ...item.steps, item.success_check, item.reason]),
  ].filter(Boolean).join("");
  assert(visibleCopy.length <= 700, "weekly report visible copy must contain at most 700 characters");

  const usedRefs = new Set([
    ...keyInsights.flatMap((item) => item.evidence_refs),
    ...(watchItem?.evidence_refs ?? []),
    ...nextActions.flatMap((item) => item.evidence_refs),
  ]);
  const evidenceDetails = evidenceCatalog
    .filter((item) => usedRefs.has(item.evidence_ref))
    .map((item) => ({
      evidence_ref: item.evidence_ref,
      display_name: item.display_name,
      question_id: item.question_id,
      finding_id: item.finding_id,
      question_text: item.question_text,
      student_answer_text: item.student_answer_text,
      note: item.note,
      finding_statement: item.finding_statement,
      evidence_summary: item.evidence_summary,
    }));

  return {
    contract: "weekly_learning_report",
    contract_version: "2.0",
    week_start: context.week_start,
    week_end: context.week_end,
    week: {
      start: context.week_start,
      end: context.week_end,
      title: `${context.week_start} 至 ${context.week_end} 学习周报`,
    },
    student: {
      student_id: context.student_id,
    },
    subject: context.subject,
    subject_label: context.subject_label,
    report_scope: context.report_scope,
    overview,
    key_insights: keyInsights,
    watch_item: watchItem,
    next_actions: nextActions,
    evidence_details: evidenceDetails,
    report_note: "本报告只根据本周上传并确认的错题生成，不代表整份试卷成绩。",
  };
}

export function saveWeeklyReport(report, context, meta = {}) {
  const reportId = `week_${context.week_start.replaceAll("-", "")}_${context.week_end.replaceAll("-", "")}`;
  const now = nowIso();
  const title =
    report.week?.title ?? `${context.week_start} 至 ${context.week_end} 学习周报`;
  const summary = report.overview?.summary?.slice(0, 240)
    ?? report.analysis?.overall_summary?.slice(0, 240)
    ?? "";
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
