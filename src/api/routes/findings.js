import { Router } from "express";
import { getDb } from "../db/init.js";

const router = Router();
const DEFAULT_STUDENT_ID = "student_demo";

const db = getDb();
db.defaultSafeIntegers(false);

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function booleanFromNumber(value) {
  return value ? true : false;
}

function nowIso() {
  return new Date().toISOString();
}

function batchSummary(row, findingCount) {
  return {
    finding_batch_id: row.finding_batch_id,
    student_id: row.student_id,
    subject: row.subject,
    subject_label: row.subject_label,
    generated_by: row.generated_by,
    generated_at: row.generated_at,
    finding_count: findingCount,
  };
}

function memoryCandidateDto(row) {
  return {
    candidate_type: row.candidate_type,
    reason: row.reason,
    priority: row.priority,
  };
}

function actionCandidateDto(row) {
  return {
    action_type: row.action_type,
    description: row.description,
    priority: row.priority,
    target_week: row.target_week,
  };
}

function findingDto(row, memoryRows, actionRows) {
  return {
    finding_id: row.finding_id,
    scope: row.scope,
    finding_type: row.finding_type,
    statement: row.statement,
    evidence_summary: row.evidence_summary,
    concept_links: parseJson(row.concept_links_json, []),
    mistake_reasons: parseJson(row.mistake_reasons_json, []),
    confidence: row.confidence,
    is_recurring: booleanFromNumber(row.is_recurring),
    memory_candidates: memoryRows.map(memoryCandidateDto),
    action_candidates: actionRows.map(actionCandidateDto),
    weekly_context_candidates: [],
  };
}

function memoryDto(row) {
  return {
    memory_id: row.memory_id,
    finding_id: row.finding_id,
    finding_batch_id: row.finding_batch_id,
    student_id: row.student_id,
    subject: row.subject,
    subject_label: row.subject_label,
    statement: row.statement,
    reason: row.reason,
    candidate_type: row.candidate_type,
    priority: row.priority,
    note: row.note,
    status: row.status,
    accepted_at: row.accepted_at,
  };
}

function getBatchOr404(res, batchId) {
  const batch = db
    .prepare("SELECT * FROM learning_findings WHERE finding_batch_id = ?")
    .get(batchId);
  if (!batch) {
    res.status(404).json({
      error: "finding_batch_not_found",
      message: `Finding batch ${batchId} not found`,
    });
    return null;
  }
  return batch;
}

router.get("/findings", (req, res) => {
  try {
    const studentId = String(req.query.student_id ?? DEFAULT_STUDENT_ID);
    const params = [studentId];
    let sql = "SELECT * FROM learning_findings WHERE student_id = ?";

    if (req.query.subject) {
      sql += " AND subject = ?";
      params.push(String(req.query.subject));
    }

    sql += " ORDER BY generated_at DESC, finding_batch_id";

    const rows = db.prepare(sql).all(...params);
    const countStmt = db.prepare(
      "SELECT finding_batch_id, COUNT(*) AS count FROM findings GROUP BY finding_batch_id"
    );
    const countMap = new Map(countStmt.all().map((row) => [row.finding_batch_id, row.count]));

    res.json({
      contract: "learning_findings_index",
      contract_version: "1.0",
      total: rows.length,
      batches: rows.map((row) => batchSummary(row, countMap.get(row.finding_batch_id) ?? 0)),
    });
  } catch (err) {
    console.error("GET /api/findings failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

router.get("/findings/:batch_id", (req, res) => {
  try {
    const batch = getBatchOr404(res, req.params.batch_id);
    if (!batch) return;

    const findingRows = db
      .prepare("SELECT * FROM findings WHERE finding_batch_id = ? ORDER BY finding_id")
      .all(req.params.batch_id);

    const memoryByFinding = new Map();
    for (const row of db
      .prepare(
        `SELECT m.*
         FROM memory_decisions m
         WHERE m.finding_batch_id = ?
         ORDER BY m.finding_id`
      )
      .all(req.params.batch_id)) {
      const list = memoryByFinding.get(row.finding_id) ?? [];
      list.push(row);
      memoryByFinding.set(row.finding_id, list);
    }

    const actionByFinding = new Map();
    for (const row of db
      .prepare(
        `SELECT a.*
         FROM action_candidates a
         JOIN findings f ON f.finding_id = a.finding_id
         WHERE f.finding_batch_id = ?
         ORDER BY a.finding_id`
      )
      .all(req.params.batch_id)) {
      const list = actionByFinding.get(row.finding_id) ?? [];
      list.push(row);
      actionByFinding.set(row.finding_id, list);
    }

    res.json({
      contract: "learning_findings",
      contract_version: "1.0",
      finding_batch_id: batch.finding_batch_id,
      student_id: batch.student_id,
      subject: batch.subject,
      subject_label: batch.subject_label,
      generated_by: batch.generated_by,
      generated_at: batch.generated_at,
      source_refs: parseJson(batch.source_refs_json, []),
      findings: findingRows.map((row) =>
        findingDto(
          row,
          memoryByFinding.get(row.finding_id) ?? [],
          actionByFinding.get(row.finding_id) ?? []
        )
      ),
    });
  } catch (err) {
    console.error("GET /api/findings/:batch_id failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

router.get("/memories", (req, res) => {
  try {
    const studentId = String(req.query.student_id ?? DEFAULT_STUDENT_ID);
    const params = [studentId];
    let sql = "SELECT * FROM memory_decisions WHERE student_id = ?";

    if (req.query.subject) {
      sql += " AND subject = ?";
      params.push(String(req.query.subject));
    }
    if (req.query.status) {
      sql += " AND status = ?";
      params.push(String(req.query.status));
    }
    if (req.query.priority) {
      sql += " AND priority = ?";
      params.push(String(req.query.priority));
    }

    sql += " ORDER BY created_at DESC, memory_id";

    const rows = db.prepare(sql).all(...params);
    res.json({
      contract: "memory_decisions",
      contract_version: "1.0",
      total: rows.length,
      memories: rows.map(memoryDto),
    });
  } catch (err) {
    console.error("GET /api/memories failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

router.post("/memories", (req, res) => {
  try {
    const memories = req.body?.memories;
    if (!Array.isArray(memories)) {
      return res.status(400).json({
        error: "invalid_memories",
        message: "`memories` must be an array",
      });
    }

    const findFinding = db.prepare(
      `SELECT f.finding_id, f.statement,
              b.student_id AS batch_student_id,
              b.subject AS batch_subject,
              b.subject_label AS batch_subject_label
       FROM findings f
       JOIN learning_findings b ON b.finding_batch_id = f.finding_batch_id
       WHERE f.finding_id = ? AND f.finding_batch_id = ?`
    );
    const findExisting = db.prepare(
      "SELECT memory_id FROM memory_decisions WHERE finding_id = ? AND finding_batch_id = ?"
    );
    const insert = db.prepare(
      `INSERT INTO memory_decisions
       (memory_id, finding_id, finding_batch_id, student_id, subject, subject_label,
        statement, reason, candidate_type, priority, note, status, accepted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const update = db.prepare(
      `UPDATE memory_decisions
       SET student_id = ?, subject = ?, subject_label = ?, statement = ?, reason = ?,
           candidate_type = ?, priority = ?, note = ?, status = ?, accepted_at = ?,
           updated_at = ?
       WHERE finding_id = ? AND finding_batch_id = ?`
    );

    const save = db.transaction(() => {
      for (const item of memories) {
        const findingId = item?.finding_id;
        const batchId = item?.finding_batch_id;
        if (!findingId || !batchId) {
          throw new Error("finding_id and finding_batch_id are required");
        }
        const referencedFinding = findFinding.get(findingId, batchId);
        if (!referencedFinding) {
          throw new Error(`Finding ${findingId} in batch ${batchId} not found`);
        }

        const status = item.status ?? "accepted";
        const acceptedAt = status === "accepted" ? (item.accepted_at ?? nowIso()) : null;
        const existing = findExisting.get(findingId, batchId);
        const studentId = item.student_id ?? referencedFinding.batch_student_id ?? DEFAULT_STUDENT_ID;
        const subject = item.subject ?? referencedFinding.batch_subject ?? null;
        const subjectLabel = item.subject_label ?? referencedFinding.batch_subject_label ?? null;
        const statement = item.statement ?? referencedFinding.statement ?? null;

        if (existing) {
          update.run(
            studentId,
            subject,
            subjectLabel,
            statement,
            item.reason ?? null,
            item.candidate_type ?? "short_term",
            item.priority ?? "中",
            item.note ?? "",
            status,
            acceptedAt,
            nowIso(),
            findingId,
            batchId
          );
        } else {
          insert.run(
            `mem_${batchId}_${findingId}`,
            findingId,
            batchId,
            studentId,
            subject,
            subjectLabel,
            statement,
            item.reason ?? null,
            item.candidate_type ?? "short_term",
            item.priority ?? "中",
            item.note ?? "",
            status,
            acceptedAt
          );
        }
      }
    });

    save();

    const selectSaved = db.prepare(
      "SELECT * FROM memory_decisions WHERE finding_id = ? AND finding_batch_id = ?"
    );
    const saved = memories
      .map((item) => selectSaved.get(item.finding_id, item.finding_batch_id))
      .filter(Boolean);

    res.status(200).json({
      contract: "memory_decisions",
      contract_version: "1.0",
      total: saved.length,
      memories: saved.map(memoryDto),
    });
  } catch (err) {
    const message = err.message || "internal_error";
    if (message.includes("required") || message.includes("not found")) {
      return res.status(400).json({
        error: "invalid_memory_decision",
        message,
      });
    }
    console.error("POST /api/memories failed:", err);
    res.status(500).json({ error: "internal_error", message });
  }
});

export default router;
