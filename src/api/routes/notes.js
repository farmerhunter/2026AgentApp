import { Router } from "express";
import { randomBytes } from "node:crypto";
import { getDb } from "../db/init.js";

const router = Router();
const DEFAULT_STUDENT_ID = "student_demo";
const SUBJECT_LABELS = {
  chinese: "语文",
  math: "数学",
  english: "英语",
};

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

function generateNoteId() {
  const ts = new Date().toISOString().replace(/[-:TZ]/g, "").slice(0, 14);
  const rand = randomBytes(3).toString("hex");
  return `note_${ts}_${rand}`;
}

function noteDto(row) {
  return {
    contract: "text_note",
    contract_version: "1.1",
    note_id: row.note_id,
    student_id: row.student_id,
    created_at: row.created_at,
    subject: row.subject,
    subject_label: row.subject_label,
    note_type: row.note_type,
    related_textbook_id: row.related_textbook_id,
    related_chapter_id: row.related_chapter_id,
    related_knowledge_point_ids: parseJson(row.knowledge_point_ids_json, []),
    content: row.content,
    student_confidence: row.student_confidence,
    tags: parseJson(row.tags_json, []),
    visibility: row.visibility,
  };
}

router.get("/notes", (req, res) => {
  try {
    const studentId = String(req.query.student_id ?? DEFAULT_STUDENT_ID);
    const params = [studentId];
    let sql = "SELECT * FROM text_notes WHERE student_id = ?";

    if (req.query.subject) {
      sql += " AND subject = ?";
      params.push(String(req.query.subject));
    }

    sql += " ORDER BY created_at DESC, note_id";
    const rows = db.prepare(sql).all(...params);

    res.json({
      contract: "text_notes",
      contract_version: "1.1",
      total: rows.length,
      notes: rows.map(noteDto),
    });
  } catch (err) {
    console.error("GET /api/notes failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

router.get("/notes/:note_id", (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM text_notes WHERE note_id = ?").get(req.params.note_id);
    if (!row) {
      return res.status(404).json({
        error: "note_not_found",
        message: `Note ${req.params.note_id} not found`,
      });
    }
    res.json(noteDto(row));
  } catch (err) {
    console.error("GET /api/notes/:note_id failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

router.post("/notes", (req, res) => {
  try {
    const body = req.body ?? {};
    if (!body.subject || !body.content) {
      return res.status(400).json({
        error: "invalid_note",
        message: "`subject` and `content` are required",
      });
    }

    const noteId = generateNoteId();
    const studentId = body.student_id ?? DEFAULT_STUDENT_ID;
    const subject = String(body.subject);
    const subjectLabel = body.subject_label ?? SUBJECT_LABELS[subject] ?? subject;
    const tags = body.tags ?? [];
    const knowledgePointIds = body.related_knowledge_point_ids ?? body.relatedKnowledgePointIds ?? null;

    db.prepare(
      `INSERT INTO text_notes
       (note_id, student_id, subject, subject_label, note_type, related_textbook_id,
        related_chapter_id, knowledge_point_ids_json, content, student_confidence,
        tags_json, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      noteId,
      studentId,
      subject,
      subjectLabel,
      body.note_type ?? "学生问题",
      body.related_textbook_id ?? null,
      body.related_chapter_id ?? null,
      knowledgePointIds ? JSON.stringify(knowledgePointIds) : null,
      body.content,
      body.student_confidence ?? null,
      tags.length > 0 ? JSON.stringify(tags) : null,
      body.visibility ?? "演示公开"
    );

    const row = db.prepare("SELECT * FROM text_notes WHERE note_id = ?").get(noteId);
    res.status(201).json(noteDto(row));
  } catch (err) {
    console.error("POST /api/notes failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

export default router;
