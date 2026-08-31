import { Router } from "express";
import multer from "multer";
import { readFileSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve, dirname, join, extname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { imageSize } from "image-size";
import { getDb } from "../db/init.js";
import { runOcrAdapter } from "../lib/ocrAdapter.js";

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const PRIVATE_ROOT =
  process.env.HERMES_PRIVATE_UPLOADS_DIR ?? resolve(REPO_ROOT, "runtime", "private", "uploads");
const MAX_FILE_SIZE = 7 * 1024 * 1024;
const DEFAULT_STUDENT_ID = "student_demo";
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS ?? 30000);

const db = getDb();
db.defaultSafeIntegers(false);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

function imageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: ".png" };
  }
  return null;
}

function newUploadId() {
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
  return `upload_${ts}_${randomBytes(3).toString("hex")}`;
}

function privatePathFor(uploadId, fileName) {
  return resolve(PRIVATE_ROOT, uploadId, fileName);
}

function replaceQuestions(uploadId, normalized) {
  const deleteConfirmations = db.prepare(
    `DELETE FROM question_confirmations
     WHERE question_id IN (SELECT question_id FROM questions WHERE upload_id = ?)`,
  );
  const deleteQuestions = db.prepare(`DELETE FROM questions WHERE upload_id = ?`);
  const insert = db.prepare(
    `INSERT INTO questions (
       question_id, upload_id, page, question_index, question_text,
       student_answer_text, question_type, ocr_confidence, bbox_json,
       raw_ocr_json_url, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  deleteConfirmations.run(uploadId);
  deleteQuestions.run(uploadId);
  for (const item of normalized.questions) {
    insert.run(
      `question_${uploadId}_${String(item.question_index).padStart(2, "0")}`,
      uploadId,
      1,
      item.question_index,
      item.question_text,
      item.student_answer_text,
      item.question_type,
      item.ocr_confidence,
      JSON.stringify(item.bbox),
      null,
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }
}

function latestJob(uploadId) {
  return db
    .prepare(
      `SELECT * FROM ocr_jobs
       WHERE upload_id = ? AND is_latest = 1
       ORDER BY attempt DESC
       LIMIT 1`,
    )
    .get(uploadId);
}

function jobDto(row) {
  return {
    upload_id: row.upload_id,
    attempt: row.attempt,
    status: row.status,
    reason: row.status === "failed" && row.error_message === "timeout" ? "timeout" : null,
    provider: row.provider,
    provider_request_id: row.provider_request_id,
    error_message: row.error_message,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function markLatestFailed(uploadId, reason) {
  const job = latestJob(uploadId);
  if (!job) return;
  db.prepare(
    `UPDATE ocr_jobs
     SET status = 'failed', error_message = ?, updated_at = ?
     WHERE id = ?`,
  ).run(reason, new Date().toISOString(), job.id);
  db.prepare(`UPDATE uploads SET ocr_status = 'failed', updated_at = ? WHERE upload_id = ?`).run(
    new Date().toISOString(),
    uploadId,
  );
}

function markLatestInterrupted(uploadId) {
  const job = latestJob(uploadId);
  if (!job) return;
  db.prepare(
    `UPDATE ocr_jobs
     SET status = 'interrupted', error_message = 'interrupted', updated_at = ?
     WHERE id = ?`,
  ).run(new Date().toISOString(), job.id);
  db.prepare(`UPDATE uploads SET ocr_status = 'interrupted', updated_at = ? WHERE upload_id = ?`).run(
    new Date().toISOString(),
    uploadId,
  );
}

export function recoverOcrJobs() {
  const rows = db
    .prepare(`SELECT upload_id FROM ocr_jobs WHERE is_latest = 1 AND status IN ('queued', 'running')`)
    .all();
  for (const row of rows) {
    markLatestInterrupted(row.upload_id);
  }
}

async function startOcrJob(uploadId, attempt) {
  const now = new Date().toISOString();
  db.prepare(`UPDATE ocr_jobs SET status = 'running', updated_at = ? WHERE upload_id = ? AND attempt = ?`).run(
    now,
    uploadId,
    attempt,
  );
  db.prepare(`UPDATE uploads SET ocr_status = 'running', updated_at = ? WHERE upload_id = ?`).run(now, uploadId);

  const uploadRow = db.prepare(`SELECT * FROM uploads WHERE upload_id = ?`).get(uploadId);
  if (!uploadRow) return;
  const filePath = resolve(PRIVATE_ROOT, uploadRow.storage_key);

  try {
    const buffer = readFileSync(filePath);
    const normalized = await Promise.race([
      runOcrAdapter(buffer, {
        image_width: uploadRow.image_width,
        image_height: uploadRow.image_height,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), OCR_TIMEOUT_MS),
      ),
    ]);

    const succeed = db.transaction(() => {
      replaceQuestions(uploadId, normalized);
      db.prepare(
        `UPDATE ocr_jobs
         SET status = 'succeeded', provider_request_id = ?, provider_metadata_json = ?, error_message = NULL, updated_at = ?
         WHERE upload_id = ? AND attempt = ?`,
      ).run(
        normalized.request_id,
        JSON.stringify({
          use_new_model: normalized.use_new_model,
          image_width: normalized.image_width,
          image_height: normalized.image_height,
        }),
        new Date().toISOString(),
        uploadId,
        attempt,
      );
      db.prepare(`UPDATE uploads SET ocr_status = 'succeeded', updated_at = ? WHERE upload_id = ?`).run(
        new Date().toISOString(),
        uploadId,
      );
    });
    succeed();
  } catch (error) {
    const reason = error.message ?? "ocr_failed";
    const fail = db.transaction(() => {
      db.prepare(
        `UPDATE ocr_jobs
         SET status = 'failed', error_message = ?, updated_at = ?
         WHERE upload_id = ? AND attempt = ?`,
      ).run(reason, new Date().toISOString(), uploadId, attempt);
      db.prepare(`UPDATE uploads SET ocr_status = 'failed', updated_at = ? WHERE upload_id = ?`).run(
        new Date().toISOString(),
        uploadId,
      );
    });
    fail();
  }
}

function createOcrAttempt(uploadId) {
  const latest = latestJob(uploadId);
  if (latest && ["queued", "running"].includes(latest.status)) {
    const error = new Error("OCR job already queued or running");
    error.status = 409;
    throw error;
  }

  const attempt = (latest?.attempt ?? 0) + 1;
  const now = new Date().toISOString();
  db.prepare(`UPDATE ocr_jobs SET is_latest = 0 WHERE upload_id = ? AND is_latest = 1`).run(uploadId);
  db.prepare(
    `INSERT INTO ocr_jobs (
       upload_id, provider, status, attempt, is_latest, error_message, created_at, updated_at
     ) VALUES (?, 'tencent_question_split_ocr', 'queued', ?, 1, NULL, ?, ?)`,
  ).run(uploadId, attempt, now, now);
  return attempt;
}

router.post("/uploads", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "file_too_large", message: "Original image must be <= 7 MiB" });
      }
      return res.status(400).json({ error: "invalid_upload", message: err.message });
    }
    if (err) return next(err);
    next();
  });
}, (req, res) => {
  try {
    const buffer = req.file?.buffer;
    if (!buffer) {
      return res.status(400).json({ error: "invalid_upload", message: "`file` is required" });
    }
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({ error: "file_too_large", message: "Original image must be <= 7 MiB" });
    }

    const type = imageType(buffer);
    if (!type) {
      return res.status(400).json({ error: "invalid_image", message: "Only JPG/PNG images are allowed" });
    }

    let dimensions;
    try {
      dimensions = imageSize(buffer);
    } catch {
      return res.status(400).json({ error: "invalid_image", message: "Image contents could not be parsed" });
    }
    if (!dimensions?.width || !dimensions?.height) {
      return res.status(400).json({ error: "invalid_image_dimensions", message: "Could not determine image dimensions" });
    }
    if (dimensions.orientation && dimensions.orientation > 1) {
      return res.status(400).json({ error: "unsupported_image_orientation", message: "Rotated images are not supported yet" });
    }

    const uploadId = newUploadId();
    const fileName = `${randomBytes(16).toString("hex")}${type.ext}`;
    const uploadDir = resolve(PRIVATE_ROOT, uploadId);
    mkdirSync(uploadDir, { recursive: true });
    const filePath = join(uploadDir, fileName);
    writeFileSync(filePath, buffer);

    const now = new Date().toISOString();
    try {
      const createUploadAndJob = db.transaction(() => {
        db.prepare(
          `INSERT INTO uploads (
             upload_id, student_id, subject, subject_label, source_type, source_title,
             uploaded_at, storage_provider, storage_key, file_name, file_size, mime_type,
             image_width, image_height, ocr_status, status, created_at, updated_at
           ) VALUES (?, ?, 'math', '数学', 'exercise', ?, ?, 'local', ?, ?, ?, ?, ?, ?, 'queued', 'active', ?, ?)`,
        ).run(
          uploadId,
          DEFAULT_STUDENT_ID,
          req.file.originalname ?? uploadId,
          now,
          `${uploadId}/${fileName}`,
          fileName,
          buffer.length,
          type.mime,
          dimensions.width,
          dimensions.height,
          now,
          now,
        );
        createOcrAttempt(uploadId);
      });
      createUploadAndJob();
      setImmediate(() => {
        startOcrJob(uploadId, 1).catch(() => {});
      });

      res.status(202).json({
        contract: "upload_meta",
        contract_version: "1.1",
        upload_id: uploadId,
        status: "queued",
      });
    } catch (error) {
      if (existsSync(filePath)) unlinkSync(filePath);
      throw error;
    }
  } catch (error) {
    console.error("POST /api/uploads failed:", error);
    const status = error.status ?? 500;
    res.status(status).json({ error: status === 409 ? "ocr_job_conflict" : "internal_error", message: error.message });
  }
});

router.get("/uploads/:upload_id/ocr", (req, res) => {
  try {
    const job = latestJob(req.params.upload_id);
    if (!job) return res.status(404).json({ error: "ocr_job_not_found", message: "OCR job not found" });
    res.json({ contract: "ocr_job", contract_version: "1.0", ...jobDto(job) });
  } catch (error) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

router.post("/uploads/:upload_id/ocr/retry", (req, res) => {
  try {
    const uploadRow = db.prepare(`SELECT * FROM uploads WHERE upload_id = ?`).get(req.params.upload_id);
    if (!uploadRow) return res.status(404).json({ error: "upload_not_found", message: "Upload not found" });
    const attempt = createOcrAttempt(req.params.upload_id);
    setImmediate(() => {
      startOcrJob(req.params.upload_id, attempt).catch(() => {});
    });
    res.status(202).json({ upload_id: req.params.upload_id, attempt, status: "queued" });
  } catch (error) {
    const status = error.status ?? 500;
    res.status(status).json({ error: status === 409 ? "ocr_job_conflict" : "internal_error", message: error.message });
  }
});

router.get("/uploads/:upload_id/image", (req, res) => {
  try {
    const uploadRow = db.prepare(`SELECT * FROM uploads WHERE upload_id = ?`).get(req.params.upload_id);
    if (!uploadRow || !uploadRow.storage_key) {
      return res.status(404).json({ error: "image_not_found", message: "Image not found" });
    }

    const filePath = resolve(PRIVATE_ROOT, uploadRow.storage_key);
    const relPath = relative(resolve(PRIVATE_ROOT), filePath);
    if (relPath.startsWith("..") || isAbsolute(relPath)) {
      return res.status(403).json({ error: "image_forbidden", message: "Image path forbidden" });
    }
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: "image_not_found", message: "Image file missing" });
    }

    const buffer = readFileSync(filePath);
    const type = imageType(buffer);
    if (!type) {
      return res.status(415).json({ error: "invalid_image", message: "Stored file is not JPG/PNG" });
    }

    res.setHeader("Content-Type", type.mime);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

export default router;
