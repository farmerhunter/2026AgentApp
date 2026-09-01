import { readFileSync, existsSync, mkdirSync, statSync, utimesSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import express from "express";
import sessionsRouter from "./routes/sessions.js";
import findingsRouter from "./routes/findings.js";
import notesRouter from "./routes/notes.js";
import reportsRouter from "./routes/reports.js";
import knowledgeMapRouter from "./routes/knowledgeMap.js";
import uploadsRouter, { recoverOcrJobs } from "./routes/uploads.js";
import { getDb } from "./db/init.js";
import { runE4Migrations } from "./db/migrate-e4.js";
import { runE5Migrations } from "./db/migrate-e5.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const JOBS_DIR = resolve(__dirname, "..", "agent", "jobs");
const STATUS_DIR = resolve(REPO_ROOT, "runtime", "public", "job_status");
const PUBLIC_DIR = resolve(REPO_ROOT, "runtime", "public");

const PORT = process.env.HERMES_API_PORT ?? 8000;
const HOST = process.env.HERMES_API_HOST ?? "127.0.0.1";
let MODE = process.env.HERMES_JOB_MODE ?? "fixture";
if (MODE === "hermes") MODE = "real";

const JOB_SCRIPTS = {
  textbook_summary: "run_textbook_summary.sh",
  learning_insight_update: "run_learning_insight_update.sh",
  weekly_report: "run_weekly_report.sh",
  confirmed_mistake_analysis: "run_e5_analysis.mjs",
  weekly_learning_report: "run_e5_weekly_report.mjs",
};

const SUBJECTS = ["chinese", "math", "english"];
const JOB_RECONCILE_INTERVAL_MS = 1000;
const JOB_STALE_MS = 5 * 60 * 1000;
const jobQueue = [];
let activeJob = null;

const db = getDb();
db.defaultSafeIntegers(false);
runE4Migrations(db);
runE5Migrations(db);
recoverOcrJobs();

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// E1 persistence routes
app.use("/api", sessionsRouter);
app.use("/api", findingsRouter);
app.use("/api", notesRouter);
app.use("/api", reportsRouter);
app.use("/api", knowledgeMapRouter);
app.use("/api", uploadsRouter);

// ── Helpers ──

function generateJobId() {
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
  const rand = randomBytes(3).toString("hex");
  return `job_${ts}_${rand}`;
}

function readStatus(jobId) {
  const path = resolve(STATUS_DIR, `${jobId}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function touchStatus(jobId) {
  const path = resolve(STATUS_DIR, `${jobId}.json`);
  if (!existsSync(path)) return;
  const now = new Date();
  utimesSync(path, now, now);
}

function writeStatus(jobId, status) {
  mkdirSync(STATUS_DIR, { recursive: true });
  const data = {
    job_id: jobId,
    created_at: new Date().toISOString(),
    ...status,
  };
  const path = resolve(STATUS_DIR, `${jobId}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2));
}

import { writeFileSync } from "node:fs";

function readJobDb(jobId) {
  return db.prepare("SELECT * FROM hermes_jobs WHERE job_id = ?").get(jobId);
}

function insertJobDb(jobId, jobType, mode, payload) {
  db.prepare(
    `INSERT OR REPLACE INTO hermes_jobs
     (job_id, job_type, status, payload_json, result_json, result_path, error_message, mode, created_at)
     VALUES (?, ?, 'pending', ?, NULL, NULL, NULL, ?, ?)`
  ).run(jobId, jobType, JSON.stringify(payload ?? {}), mode, new Date().toISOString());
}

function syncJobFromStatusFile(jobId) {
  const status = readStatus(jobId);
  if (!status) return null;

  db.prepare(
    `UPDATE hermes_jobs
     SET status = ?, result_path = ?, error_message = ?, mode = ?,
         started_at = COALESCE(started_at, ?), completed_at = COALESCE(completed_at, ?)
     WHERE job_id = ?`
  ).run(
    status.status ?? "pending",
    status.result_path ?? null,
    status.error_message ?? null,
    status.mode ?? MODE,
    status.started_at ?? null,
    status.completed_at ?? null,
    jobId
  );

  return readJobDb(jobId);
}

function jobDto(row) {
  return {
    job_id: row.job_id,
    job_type: row.job_type,
    status: row.status,
    mode: row.mode,
    skill_version: row.skill_version ?? null,
    skill_sha256: row.skill_sha256 ?? null,
    result_path: row.result_path,
    created_at: row.created_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    error_message: row.error_message,
  };
}

function reconcileJobs() {
  const rows = db
    .prepare(
      "SELECT job_id, created_at FROM hermes_jobs WHERE status NOT IN ('completed', 'failed', 'timeout')"
    )
    .all();
  const now = Date.now();

  for (const row of rows) {
    const status = readStatus(row.job_id);
    if (status) {
      const statusPath = resolve(STATUS_DIR, `${row.job_id}.json`);
      let fileStat = null;
      try {
        fileStat = statSync(statusPath);
      } catch {
        fileStat = null;
      }

      if (
        (status.status === "pending" || status.status === "running") &&
        fileStat &&
        now - fileStat.mtimeMs > JOB_STALE_MS
      ) {
        writeStatus(row.job_id, {
          job_type: status.job_type ?? "unknown",
          status: "timeout",
          mode: status.mode ?? MODE,
          error_message: "Job status stale after restart",
        });
        syncJobFromStatusFile(row.job_id);
        continue;
      }

      syncJobFromStatusFile(row.job_id);
      continue;
    }

    const createdMs = row.created_at ? Date.parse(row.created_at) : now;
    if (now - createdMs > JOB_STALE_MS) {
      writeStatus(row.job_id, {
        job_type: "unknown",
        status: "timeout",
        mode: MODE,
        error_message: "Job status not found after restart",
      });
      syncJobFromStatusFile(row.job_id);
    }
  }
}

function startJobReconciliation() {
  reconcileJobs();
  setInterval(reconcileJobs, JOB_RECONCILE_INTERVAL_MS);
}

function runJob(jobType, args, payload, jobId) {
  const scriptName = JOB_SCRIPTS[jobType];
  const scriptPath = scriptName.endsWith(".mjs")
    ? resolve(__dirname, "scripts", scriptName)
    : resolve(JOBS_DIR, scriptName);
  const env = { ...process.env, HERMES_JOB_MODE: MODE, JOB_ID: jobId };

  writeStatus(jobId, { job_type: jobType, status: "running", mode: MODE });

  const isNodeScript = scriptName.endsWith(".mjs") || scriptName.endsWith(".js");
  const command = isNodeScript ? process.execPath : "bash";
  const commandArgs = [scriptPath, ...args];

  const child = spawn(command, commandArgs, {
    cwd: REPO_ROOT,
    env,
    detached: true,
    stdio: "ignore",
  });

  let checkInterval = null;
  let timeoutHandle = null;
  let finished = false;

  const finishActive = () => {
    if (finished) return;
    finished = true;
    if (checkInterval) clearInterval(checkInterval);
    if (timeoutHandle) clearTimeout(timeoutHandle);
    activeJob = null;
    drainJobQueue();
  };

  child.on("error", (err) => {
    writeStatus(jobId, {
      job_type: jobType,
      status: "failed",
      mode: MODE,
      error_message: err.message,
    });
    syncJobFromStatusFile(jobId);
    finishActive();
  });

  child.unref();

  checkInterval = setInterval(() => {
    try {
      const s = readStatus(jobId);
      if (s) {
        syncJobFromStatusFile(jobId);
        if (s.status === "pending" || s.status === "running") {
          touchStatus(jobId);
        }
      }
      if (s && (s.status === "completed" || s.status === "failed")) {
        finishActive();
      }
    } catch {
      // Status file not written yet, keep polling
    }
  }, 1000);

  timeoutHandle = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {}
    try {
      const s = readStatus(jobId);
      if (s && s.status !== "completed" && s.status !== "failed") {
        writeStatus(jobId, {
          job_type: jobType,
          status: "timeout",
          mode: MODE,
          error_message: "Job timed out after 5 minutes",
        });
        syncJobFromStatusFile(jobId);
      }
    } catch {}
    finishActive();
  }, 300_000);
}

function drainJobQueue() {
  if (activeJob || jobQueue.length === 0) return;
  const next = jobQueue.shift();
  activeJob = next.jobId;
  runJob(next.jobType, next.args, next.payload, next.jobId);
}

function spawnJob(jobType, args, payload) {
  const jobId = generateJobId();
  if (!JOB_SCRIPTS[jobType]) throw new Error(`Unknown job type: ${jobType}`);

  writeStatus(jobId, { job_type: jobType, status: "pending", mode: MODE });
  insertJobDb(jobId, jobType, MODE, payload);
  jobQueue.push({ jobId, jobType, args, payload });
  drainJobQueue();
  return jobId;
}

function buildArgs(jobType, body) {
  const args = [];
  switch (jobType) {
    case "textbook_summary":
      if (body.textbook_id) args.push("--textbook-id", body.textbook_id);
      break;
    case "learning_insight_update":
      if (body.source_ids?.[0]) args.push("--upload-id", body.source_ids[0]);
      break;
    case "weekly_report":
      if (body.week_start) args.push("--week-start", body.week_start);
      if (body.week_end) args.push("--week-end", body.week_end);
      break;
    case "confirmed_mistake_analysis":
      if (body.source_ids?.[0]) args.push("--upload-id", body.source_ids[0]);
      break;
    case "weekly_learning_report":
      if (body.week_start) args.push("--week-start", body.week_start);
      if (body.week_end) args.push("--week-end", body.week_end);
      break;
  }
  return args;
}

// ── Routes ──

// POST /api/hermes/jobs — create a new job
app.post("/api/hermes/jobs", (req, res) => {
  try {
    const { job_type, subject_scope, source_ids, week_start, week_end, textbook_id } = req.body ?? {};

    if (!job_type || !JOB_SCRIPTS[job_type]) {
      return res.status(400).json({
        error: "invalid_job_type",
        message: "job_type is required and must be supported",
        supported: Object.keys(JOB_SCRIPTS),
      });
    }

    const args = buildArgs(job_type, { textbook_id, source_ids, week_start, week_end });
    const requiresArgs = job_type !== "weekly_learning_report";
    if (requiresArgs && args.length === 0) {
      return res.status(400).json({
        error: "missing_parameters",
        message: `Missing required parameters for ${job_type}`,
        required: job_type === "textbook_summary"
          ? ["textbook_id"]
          : job_type === "learning_insight_update"
            ? ["source_ids[0]"]
            : job_type === "confirmed_mistake_analysis"
              ? ["source_ids[0]"]
              : ["week_start", "week_end"],
      });
    }

    const jobId = spawnJob(job_type, args, req.body ?? {});

    res.status(202).json({
      job_id: jobId,
      job_type,
      status: "pending",
      mode: MODE,
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

// GET /api/hermes/jobs/:job_id — query job status
app.get("/api/hermes/jobs/:job_id", (req, res) => {
  try {
    const fileStatus = readStatus(req.params.job_id);
    if (fileStatus) syncJobFromStatusFile(req.params.job_id);

    const job = readJobDb(req.params.job_id);
    if (!job) {
      return res.status(404).json({ error: "job_not_found", message: "Job not found" });
    }
    res.json(jobDto(job));
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

// GET /api/hermes/jobs/:job_id/result — serve result file
app.get("/api/hermes/jobs/:job_id/result", (req, res) => {
  try {
    const fileStatus = readStatus(req.params.job_id);
    if (fileStatus) syncJobFromStatusFile(req.params.job_id);

    const job = readJobDb(req.params.job_id);
    if (!job) return res.status(404).json({ error: "job_not_found", message: "Job not found" });
    if (job.status !== "completed") {
      return res.status(202).json({
        job_id: job.job_id,
        status: job.status,
        message: "Job not yet completed",
      });
    }
    if (!job.result_path) return res.status(404).json({ error: "no_result_path", message: "No result path" });

    // Serve the file; ensure it's under PUBLIC_DIR
    const absPath = resolve(job.result_path);
    if (!absPath.startsWith(PUBLIC_DIR)) {
      return res.status(403).json({ error: "result_path_forbidden", message: "Result path outside public directory" });
    }
    if (!existsSync(absPath)) return res.status(404).json({ error: "result_file_not_found", message: "Result file not found" });

    res.sendFile(absPath);
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

// GET /api/hermes/health — health check
app.get("/api/hermes/health", (req, res) => {
  res.json({ status: "ok", mode: MODE, supported_jobs: Object.keys(JOB_SCRIPTS) });
});

// GET /api/health — general health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    mode: MODE,
    supported_jobs: Object.keys(JOB_SCRIPTS),
    database: "sqlite",
    version: "0.1.0",
  });
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ──
startJobReconciliation();
app.listen(PORT, HOST, () => {
  console.log(`Hermes API server running on http://${HOST}:${PORT}`);
  console.log(`Mode: ${MODE}`);
  console.log(`Jobs: ${Object.keys(JOB_SCRIPTS).join(", ")}`);
});
