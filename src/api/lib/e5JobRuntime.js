import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../db/init.js";
import { nowIso } from "./e5Common.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, "..", "..", "..");
export const RUNTIME_PUBLIC = resolve(REPO_ROOT, "runtime", "public");
export const STATUS_DIR = resolve(RUNTIME_PUBLIC, "job_status");

const db = getDb();
db.defaultSafeIntegers(false);

export function parseArgs(argv) {
  const args = { uploadId: "", weekStart: "", weekEnd: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--upload-id") args.uploadId = argv[index + 1] ?? "";
    if (token === "--week-start") args.weekStart = argv[index + 1] ?? "";
    if (token === "--week-end") args.weekEnd = argv[index + 1] ?? "";
  }
  return args;
}

export function writeStatus(jobId, status) {
  mkdirSync(STATUS_DIR, { recursive: true });
  writeFileSync(
    resolve(STATUS_DIR, `${jobId}.json`),
    JSON.stringify(
      {
        job_id: jobId,
        created_at: status.created_at ?? nowIso(),
        ...status,
      },
      null,
      2,
    ),
  );
}

export function writePublicResult(relativePath, value) {
  const absPath = resolve(RUNTIME_PUBLIC, relativePath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, JSON.stringify(value, null, 2));
  return absPath;
}

export function updateJobMetadata(jobId, { skillVersion, skillSha256, outputJson }) {
  db.prepare(
    `UPDATE hermes_jobs
     SET skill_version = COALESCE(?, skill_version),
         skill_sha256 = COALESCE(?, skill_sha256),
         output_json = COALESCE(?, output_json)
     WHERE job_id = ?`,
  ).run(skillVersion ?? null, skillSha256 ?? null, outputJson ?? null, jobId);
}

export function finishSuccess(jobId, { jobType, mode, resultPath, outputJson, skillVersion, skillSha256 }) {
  const completedAt = nowIso();
  writeStatus(jobId, {
    job_type: jobType,
    status: "completed",
    mode,
    started_at: completedAt,
    completed_at: completedAt,
    result_path: resultPath,
  });
  updateJobMetadata(jobId, {
    skillVersion,
    skillSha256,
    outputJson: outputJson ? JSON.stringify(outputJson) : null,
  });
}

export function finishFailure(jobId, { jobType, mode, errorMessage }) {
  const completedAt = nowIso();
  writeStatus(jobId, {
    job_type: jobType,
    status: "failed",
    mode,
    started_at: completedAt,
    completed_at: completedAt,
    error_message: errorMessage,
  });
}

export function isFixtureAllowed(env = process.env) {
  return env.HERMES_JOB_MODE === "real"
    ? false
    : env.HERMES_E5_TEST_MODE === "fixture";
}

export function effectiveMode(env = process.env) {
  if (env.HERMES_JOB_MODE === "real") return "real";
  if (env.HERMES_E5_TEST_MODE === "fixture") return "fixture";
  return "real-required";
}
