import { Router } from "express";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { getDb } from "../db/init.js";

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const db = getDb();
db.defaultSafeIntegers(false);

let cached = null;

function currentRegistryRow() {
  return db
    .prepare(
      `SELECT *
       FROM knowledge_map_registry
       WHERE subject = 'math' AND status = 'current'
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .get();
}

function readCurrentArtifact() {
  const row = currentRegistryRow();
  if (!row) {
    const error = new Error("No current knowledge map registry entry");
    error.status = 503;
    throw error;
  }

  if (cached && cached.artifact_sha256 === row.artifact_sha256) {
    return cached.artifact;
  }

  const artifactPath = resolve(REPO_ROOT, row.artifact_path);
  if (!existsSync(artifactPath)) {
    const error = new Error(`Knowledge map artifact missing: ${row.artifact_path}`);
    error.status = 503;
    throw error;
  }

  const raw = readFileSync(artifactPath, "utf-8");
  const hash = createHash("sha256").update(raw).digest("hex");
  if (hash !== row.artifact_sha256) {
    const error = new Error("Knowledge map artifact hash mismatch");
    error.status = 503;
    throw error;
  }

  let artifact;
  try {
    artifact = JSON.parse(raw);
  } catch (cause) {
    const error = new Error(`Knowledge map artifact invalid JSON: ${cause.message}`);
    error.status = 503;
    throw error;
  }

  if (artifact.contract !== "textbook_knowledge_map" || artifact.map_id !== row.map_id || artifact.map_version !== row.map_version) {
    const error = new Error("Knowledge map artifact identity does not match registry");
    error.status = 503;
    throw error;
  }

  cached = { artifact_sha256: row.artifact_sha256, artifact };
  return artifact;
}

function envelope(artifact, data) {
  return {
    contract: "textbook_knowledge_map",
    contract_version: "1.0",
    map_id: artifact.map_id,
    map_version: artifact.map_version,
    data,
  };
}

function flattenPoints(artifact) {
  const points = new Map();
  for (const chapter of artifact.chapters ?? []) {
    for (const section of chapter.sections ?? []) {
      for (const point of section.knowledge_points ?? []) {
        points.set(point.knowledge_point_id, {
          ...point,
          chapter_id: chapter.chapter_id,
          section_id: section.section_id,
        });
      }
    }
  }
  return points;
}

function handleReadError(res, error) {
  console.error("GET /api/knowledge-map failed:", error);
  const status = error.status ?? 503;
  res.status(status).json({
    error: "knowledge_map_unavailable",
    message: error.message ?? "Knowledge map unavailable",
  });
}

router.get("/knowledge-map/current", (req, res) => {
  try {
    const artifact = readCurrentArtifact();
    const pointCount = flattenPoints(artifact).size;
    res.json(
      envelope(artifact, {
        map_id: artifact.map_id,
        map_version: artifact.map_version,
        subject: artifact.subject,
        subject_label: artifact.subject_label,
        textbook: artifact.textbook,
        chapter_count: (artifact.chapters ?? []).length,
        knowledge_point_count: pointCount,
      }),
    );
  } catch (error) {
    handleReadError(res, error);
  }
});

router.get("/knowledge-map/chapters", (req, res) => {
  try {
    const artifact = readCurrentArtifact();
    res.json(
      envelope(artifact, {
        chapters: (artifact.chapters ?? []).map((chapter) => ({
          chapter_id: chapter.chapter_id,
          chapter_number: chapter.chapter_number,
          title: chapter.title,
          sections: (chapter.sections ?? []).map((section) => ({
            section_id: section.section_id,
            section_number: section.section_number,
            title: section.title,
          })),
        })),
      }),
    );
  } catch (error) {
    handleReadError(res, error);
  }
});

router.get("/knowledge-map/points", (req, res) => {
  try {
    const { chapter_id: chapterId, coverage } = req.query;
    if (coverage && !["catalog", "detailed"].includes(String(coverage))) {
      return res.status(400).json({
        error: "invalid_filter",
        message: "`coverage` must be catalog or detailed",
      });
    }

    const artifact = readCurrentArtifact();
    const points = flattenPoints(artifact);
    const list = [...points.values()].filter((point) => {
      if (chapterId && point.chapter_id !== chapterId) return false;
      if (coverage && point.coverage !== coverage) return false;
      return true;
    });

    res.json(
      envelope(artifact, {
        knowledge_points: list.map((point) => ({
          knowledge_point_id: point.knowledge_point_id,
          name: point.name,
          status: point.status,
          coverage: point.coverage,
        })),
      }),
    );
  } catch (error) {
    handleReadError(res, error);
  }
});

router.get("/knowledge-map/points/:knowledge_point_id", (req, res) => {
  try {
    const artifact = readCurrentArtifact();
    const point = flattenPoints(artifact).get(req.params.knowledge_point_id);
    if (!point) {
      return res.status(404).json({
        error: "knowledge_point_not_found",
        message: `Knowledge point ${req.params.knowledge_point_id} not found`,
      });
    }
    res.json(envelope(artifact, point));
  } catch (error) {
    handleReadError(res, error);
  }
});

export default router;
