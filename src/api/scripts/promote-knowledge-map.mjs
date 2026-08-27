#!/usr/bin/env node

/**
 * Promote a validated textbook_knowledge_map artifact as current for its subject.
 *
 * Usage:
 *   node scripts/promote-knowledge-map.mjs data/knowledge_maps/<map_id>/<map_version>.json
 *
 * Transaction order:
 *   1. validate artifact and hash outside transaction
 *   2. BEGIN IMMEDIATE
 *   3. demote existing current map for same subject to superseded
 *   4. upsert new (map_id, map_version) as current
 *   5. COMMIT; any failure rolls back, preserving previous current
 */

import { readFileSync } from "node:fs";
import { resolve, dirname, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { getDb, closeDb } from "../db/init.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(API_DIR, "..", "..");
const VALIDATOR = resolve(__dirname, "validate-knowledge-map.mjs");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function validateArtifact(artifactPath) {
  const result = spawnSync(process.execPath, [VALIDATOR, artifactPath], {
    cwd: API_DIR,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    fail(`Artifact validation failed:\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function main() {
  const artifactArg = process.argv[2];
  if (!artifactArg) fail("Usage: node scripts/promote-knowledge-map.mjs <artifact-path>");

  const artifactPath = resolve(process.cwd(), artifactArg);
  validateArtifact(artifactPath);

  const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
  const mapId = artifact.map_id;
  const mapVersion = artifact.map_version;
  const subject = artifact.subject;
  const now = new Date().toISOString();
  const artifactHash = sha256(artifactPath);
  const registryPath = relative(REPO_ROOT, artifactPath).replaceAll("\\", "/");

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `UPDATE knowledge_map_registry
       SET status = 'superseded', updated_at = ?
       WHERE subject = ? AND status = 'current'`,
    ).run(now, subject);

    db.prepare(
      `INSERT INTO knowledge_map_registry (
         map_id, map_version, subject, artifact_path, artifact_sha256, status,
         textbook_title, publisher, grade, semester, edition, isbn,
         activated_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, 'current', ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(map_id, map_version) DO UPDATE SET
         subject = excluded.subject,
         artifact_path = excluded.artifact_path,
         artifact_sha256 = excluded.artifact_sha256,
         status = 'current',
         textbook_title = excluded.textbook_title,
         publisher = excluded.publisher,
         grade = excluded.grade,
         semester = excluded.semester,
         edition = excluded.edition,
         isbn = excluded.isbn,
         activated_at = excluded.activated_at,
         updated_at = excluded.updated_at`,
    ).run(
      mapId,
      mapVersion,
      subject,
      registryPath,
      artifactHash,
      artifact.textbook?.title ?? null,
      artifact.textbook?.publisher ?? null,
      artifact.textbook?.grade ?? null,
      artifact.textbook?.semester ?? null,
      artifact.textbook?.edition ?? null,
      artifact.textbook?.isbn ?? null,
      now,
      now,
      now,
    );

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    closeDb();
  }

  console.log(`Promoted ${mapId}@${mapVersion} as current for ${subject}`);
}

main();
