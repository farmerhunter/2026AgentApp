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

function uploadNotFound(res, uploadId) {
  return res.status(404).json({
    error: "upload_not_found",
    message: `Upload ${uploadId} not found`,
  });
}

function toSessionSummary(row, questionCount, confirmedCount) {
  return {
    upload_id: row.upload_id,
    subject: row.subject,
    subject_label: row.subject_label,
    source_title: row.source_title,
    source_type: row.source_type,
    captured_at: row.captured_at,
    ocr_status: row.ocr_status,
    question_count: questionCount,
    confirmed_count: confirmedCount,
    has_split_result: questionCount > 0,
    has_confirmation_result: confirmedCount > 0,
  };
}

function toQuestionDto(row) {
  return {
    question_id: row.question_id,
    question_index: row.question_index,
    page: row.page,
    bbox: parseJson(row.bbox_json),
    question_text: row.question_text,
    student_answer_text: row.student_answer_text ?? null,
    question_type: row.question_type ?? null,
    ocr_confidence: row.ocr_confidence ?? null,
    question_image_url: row.question_image_url,
    related_knowledge_point_ids: [],
    raw_ocr_ref: row.raw_ocr_json_url
      ? {
          provider: null,
          raw_response_url: row.raw_ocr_json_url,
          raw_question_index: null,
        }
      : null,
  };
}

function toConfirmationDto(row, upload) {
  return {
    question_id: row.question_id,
    selected: booleanFromNumber(row.selected),
    student_answer_text: row.student_answer_text ?? null,
    subject: upload.subject,
    subject_label: upload.subject_label,
    student_mark: row.student_mark,
    teacher_score: row.teacher_score,
    full_score: row.full_score,
    knowledge_point: row.knowledge_point,
    knowledge_point_ids: parseJson(row.knowledge_point_ids_json, []),
    mistake_reason: row.mistake_reason,
    review_priority: row.review_priority,
    review_status: row.review_status,
    tags: parseJson(row.tags_json, []),
    note: row.note,
  };
}

router.get("/sessions", (req, res) => {
  try {
    const studentId = String(req.query.student_id ?? DEFAULT_STUDENT_ID);

    const uploads = db
      .prepare("SELECT * FROM uploads WHERE student_id = ? ORDER BY captured_at, upload_id")
      .all(studentId);

    const questionCounts = new Map();
    for (const row of db
      .prepare(
        `SELECT q.upload_id, COUNT(*) AS count
         FROM questions q
         JOIN uploads u ON u.upload_id = q.upload_id
         WHERE u.student_id = ?
         GROUP BY q.upload_id`
      )
      .all(studentId)) {
      questionCounts.set(row.upload_id, row.count);
    }

    const confirmedCounts = new Map();
    for (const row of db
      .prepare(
        `SELECT q.upload_id, COUNT(c.id) AS count
         FROM question_confirmations c
         JOIN questions q ON q.question_id = c.question_id
         JOIN uploads u ON u.upload_id = q.upload_id
         WHERE u.student_id = ?
         GROUP BY q.upload_id`
      )
      .all(studentId)) {
      confirmedCounts.set(row.upload_id, row.count);
    }

    const sessions = uploads.map((row) =>
      toSessionSummary(
        row,
        questionCounts.get(row.upload_id) ?? 0,
        confirmedCounts.get(row.upload_id) ?? 0
      )
    );

    res.json({
      contract: "question_sessions_index",
      contract_version: "1.0",
      generated_at: new Date().toISOString(),
      total_sessions: sessions.length,
      total_questions: [...questionCounts.values()].reduce((sum, n) => sum + n, 0),
      total_confirmed: [...confirmedCounts.values()].reduce((sum, n) => sum + n, 0),
      sessions,
    });
  } catch (err) {
    console.error("GET /api/sessions failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

router.get("/sessions/:upload_id", (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM uploads WHERE upload_id = ?").get(req.params.upload_id);
    if (!row) return uploadNotFound(res, req.params.upload_id);

    res.json({
      contract: "upload_meta",
      contract_version: "1.1",
      upload_id: row.upload_id,
      student_id: row.student_id,
      subject: row.subject,
      subject_label: row.subject_label,
      source_type: row.source_type,
      source_title: row.source_title,
      captured_at: row.captured_at,
      uploaded_at: row.uploaded_at,
      storage_provider: row.storage_provider,
      original_files: [],
      ocr_provider: null,
      ocr_status: row.ocr_status,
      related_textbook_id: null,
      related_chapter_ids: [],
      notes: null,
    });
  } catch (err) {
    console.error("GET /api/sessions/:upload_id failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

router.get("/sessions/:upload_id/split", (req, res) => {
  try {
    const upload = db.prepare("SELECT * FROM uploads WHERE upload_id = ?").get(req.params.upload_id);
    if (!upload) return uploadNotFound(res, req.params.upload_id);

    const rows = db
      .prepare("SELECT * FROM questions WHERE upload_id = ? ORDER BY question_index")
      .all(req.params.upload_id);

    res.json({
      contract: "question_split_result",
      contract_version: "1.2",
      upload_id: upload.upload_id,
      student_id: upload.student_id,
      subject: upload.subject,
      subject_label: upload.subject_label,
      ocr_provider: null,
      ocr_status: upload.ocr_status,
      processed_at: null,
      source_image_url: null,
      image_size: null,
      questions: rows.map(toQuestionDto),
      errors: [],
    });
  } catch (err) {
    console.error("GET /api/sessions/:upload_id/split failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

router.get("/sessions/:upload_id/confirmation", (req, res) => {
  try {
    const upload = db.prepare("SELECT * FROM uploads WHERE upload_id = ?").get(req.params.upload_id);
    if (!upload) return uploadNotFound(res, req.params.upload_id);

    const rows = db
      .prepare(
        `SELECT c.*, q.question_index, q.student_answer_text
         FROM question_confirmations c
         JOIN questions q ON q.question_id = c.question_id
         WHERE q.upload_id = ?
         ORDER BY q.question_index`
      )
      .all(req.params.upload_id);

    res.json({
      contract: "question_confirmation_result",
      contract_version: "1.2",
      upload_id: upload.upload_id,
      student_id: upload.student_id,
      subject: upload.subject,
      subject_label: upload.subject_label,
      confirmed_at: null,
      confirmed_by: "student",
      confirmations: rows.map((row) => toConfirmationDto(row, upload)),
    });
  } catch (err) {
    console.error("GET /api/sessions/:upload_id/confirmation failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

router.post("/sessions/:upload_id/confirmation", (req, res) => {
  try {
    const upload = db.prepare("SELECT * FROM uploads WHERE upload_id = ?").get(req.params.upload_id);
    if (!upload) return uploadNotFound(res, req.params.upload_id);

    const confirmations = req.body?.confirmations;
    if (!Array.isArray(confirmations)) {
      return res.status(400).json({
        error: "invalid_confirmations",
        message: "`confirmations` must be an array",
      });
    }

    const uploadQuestionIds = new Set(
      db
        .prepare("SELECT question_id FROM questions WHERE upload_id = ?")
        .all(req.params.upload_id)
        .map((row) => row.question_id)
    );

    const seenQuestionIds = new Set();
    for (const item of confirmations) {
      if (!item || typeof item.question_id !== "string") {
        return res.status(400).json({
          error: "invalid_confirmation_item",
          message: "Each confirmation requires a string `question_id`",
        });
      }
      if (seenQuestionIds.has(item.question_id)) {
        return res.status(400).json({
          error: "duplicate_confirmation_item",
          message: `Duplicate question_id ${item.question_id}`,
        });
      }
      seenQuestionIds.add(item.question_id);
      if (!uploadQuestionIds.has(item.question_id)) {
        return res.status(400).json({
          error: "question_not_in_upload",
          message: `Question ${item.question_id} does not belong to upload ${req.params.upload_id}`,
        });
      }
      if (typeof item.selected !== "boolean") {
        return res.status(400).json({
          error: "invalid_selected",
          message: "`selected` must be a boolean",
        });
      }
      if (item.note != null && typeof item.note !== "string") {
        return res.status(400).json({
          error: "invalid_note",
          message: "`note` must be a string or null",
        });
      }
      if (item.student_answer_text != null && typeof item.student_answer_text !== "string") {
        return res.status(400).json({
          error: "invalid_student_answer_text",
          message: "`student_answer_text` must be a string or null",
        });
      }
      if ((item.note ?? "").length > 2000 || (item.student_answer_text ?? "").length > 2000) {
        return res.status(400).json({
          error: "field_too_long",
          message: "note and student_answer_text must be <= 2000 characters",
        });
      }
      const allowedKeys = ["question_id", "selected", "student_answer_text", "note"];
      for (const key of Object.keys(item)) {
        if (!allowedKeys.includes(key)) {
          return res.status(400).json({
            error: "unsupported_confirmation_field",
            message: `Field ${key} is not accepted by E4 confirmation`,
          });
        }
      }
      if (item.student_answer_text != null && !item.selected) {
        return res.status(400).json({
          error: "answer_without_selection",
          message: "student_answer_text can only be provided for a selected wrong question",
        });
      }
      if (item.student_answer_text != null && item.student_answer_text !== "") {
        const question = db
          .prepare("SELECT student_answer_text FROM questions WHERE question_id = ?")
          .get(item.question_id);
        if (question?.student_answer_text) {
          return res.status(400).json({
            error: "ocr_answer_already_exists",
            message: `Question ${item.question_id} already has OCR answer text and cannot be overwritten`,
          });
        }
      }
    }

    const selectedCount = confirmations.filter((item) => item.selected).length;
    if (selectedCount > 10) {
      return res.status(400).json({
        error: "too_many_selected",
        message: "At most 10 wrong questions may be confirmed per upload",
      });
    }

    const deleteAll = db.prepare(
      `DELETE FROM question_confirmations
       WHERE question_id IN (SELECT question_id FROM questions WHERE upload_id = ?)`
    );

    const insert = db.prepare(
      `INSERT INTO question_confirmations
       (question_id, selected, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    );

    const updateAnswer = db.prepare(
      `UPDATE questions
       SET student_answer_text = ?, updated_at = ?
       WHERE question_id = ?`,
    );

    const save = db.transaction(() => {
      deleteAll.run(req.params.upload_id);
      for (const item of confirmations) {
        if (item.selected) {
          insert.run(item.question_id, 1, item.note ?? null, new Date().toISOString(), new Date().toISOString());
        }
        if (item.student_answer_text != null && item.student_answer_text !== "") {
          updateAnswer.run(item.student_answer_text, new Date().toISOString(), item.question_id);
        }
      }
    });

    save();

    const savedRows = db
      .prepare(
        `SELECT c.*, q.question_index, q.student_answer_text
         FROM question_confirmations c
         JOIN questions q ON q.question_id = c.question_id
         WHERE q.upload_id = ?
         ORDER BY q.question_index`
      )
      .all(req.params.upload_id);

    res.json({
      contract: "question_confirmation_result",
      contract_version: "1.2",
      upload_id: upload.upload_id,
      student_id: upload.student_id,
      subject: upload.subject,
      subject_label: upload.subject_label,
      confirmed_at: new Date().toISOString(),
      confirmed_by: "student",
      confirmations: savedRows.map((row) => toConfirmationDto(row, upload)),
    });
  } catch (err) {
    console.error("POST /api/sessions/:upload_id/confirmation failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

export default router;
