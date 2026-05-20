import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import express from "express";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const JOBS_DIR = resolve(__dirname, "..", "agent", "jobs");
const STATUS_DIR = resolve(REPO_ROOT, "runtime", "public", "job_status");
const PUBLIC_DIR = resolve(REPO_ROOT, "runtime", "public");

const PORT = process.env.HERMES_API_PORT ?? 8000;
const MODE = process.env.HERMES_JOB_MODE ?? "fixture";

const JOB_SCRIPTS = {
  textbook_summary: "run_textbook_summary.sh",
  learning_insight_update: "run_learning_insight_update.sh",
  weekly_report: "run_weekly_report.sh",
};

const SUBJECTS = ["chinese", "math", "english"];

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

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

function spawnJob(jobType, args) {
  const jobId = generateJobId();
  const scriptName = JOB_SCRIPTS[jobType];
  if (!scriptName) throw new Error(`Unknown job type: ${jobType}`);

  const scriptPath = resolve(JOBS_DIR, scriptName);
  const env = { ...process.env, HERMES_JOB_MODE: MODE, JOB_ID: jobId };

  writeStatus(jobId, { job_type: jobType, status: "pending", mode: MODE });

  const child = spawn("bash", [scriptPath, ...args], {
    cwd: REPO_ROOT,
    env,
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  // Poll for completion in background
  const checkInterval = setInterval(() => {
    try {
      const s = readStatus(jobId);
      if (s && s.status === "completed") {
        clearInterval(checkInterval);
      }
    } catch {
      // Status file not written yet, keep polling
    }
  }, 1000);

  // Timeout after 5 minutes
  setTimeout(() => {
    clearInterval(checkInterval);
    try {
      const s = readStatus(jobId);
      if (s && s.status !== "completed" && s.status !== "failed") {
        writeStatus(jobId, {
          job_type: jobType,
          status: "timeout",
          mode: MODE,
          error_message: "Job timed out after 5 minutes",
        });
      }
    } catch {}
  }, 300_000);

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
        error: "Invalid job_type",
        supported: Object.keys(JOB_SCRIPTS),
      });
    }

    const args = buildArgs(job_type, { textbook_id, source_ids, week_start, week_end });
    if (args.length === 0) {
      return res.status(400).json({
        error: `Missing required parameters for ${job_type}`,
        required: job_type === "textbook_summary"
          ? ["textbook_id"]
          : job_type === "learning_insight_update"
            ? ["source_ids[0]"]
            : ["week_start", "week_end"],
      });
    }

    const jobId = spawnJob(job_type, args);

    res.status(202).json({
      job_id: jobId,
      job_type,
      status: "pending",
      mode: MODE,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hermes/jobs/:job_id — query job status
app.get("/api/hermes/jobs/:job_id", (req, res) => {
  try {
    const status = readStatus(req.params.job_id);
    if (!status) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hermes/jobs/:job_id/result — serve result file
app.get("/api/hermes/jobs/:job_id/result", (req, res) => {
  try {
    const status = readStatus(req.params.job_id);
    if (!status) return res.status(404).json({ error: "Job not found" });
    if (status.status !== "completed") {
      return res.status(202).json({
        job_id: status.job_id,
        status: status.status,
        message: "Job not yet completed",
      });
    }
    if (!status.result_path) return res.status(404).json({ error: "No result path" });

    // Serve the file; ensure it's under PUBLIC_DIR
    const absPath = resolve(status.result_path);
    if (!absPath.startsWith(PUBLIC_DIR)) {
      return res.status(403).json({ error: "Result path outside public directory" });
    }
    if (!existsSync(absPath)) return res.status(404).json({ error: "Result file not found" });

    res.sendFile(absPath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hermes/health — health check
app.get("/api/hermes/health", (req, res) => {
  res.json({ status: "ok", mode: MODE, supported_jobs: Object.keys(JOB_SCRIPTS) });
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`Hermes API server running on http://localhost:${PORT}`);
  console.log(`Mode: ${MODE}`);
  console.log(`Jobs: ${Object.keys(JOB_SCRIPTS).join(", ")}`);
});
