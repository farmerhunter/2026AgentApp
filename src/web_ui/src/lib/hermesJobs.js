import { createHermesJob, pollHermesJob, fetchHermesJobResult } from "./api.js";
import { getHermesExecutionMode } from "./hermesExecutionMode.js";

const DATA_BASE_URL = "/data";

/**
 * Resolve a demo job mapping key from payload.
 */
function resolveDemoKey(jobType, payload) {
  if (jobType === "textbook_summary") {
    return payload?.textbook_id ?? payload?.source_ids?.[0];
  }
  if (jobType === "learning_insight_update") {
    return payload?.source_ids?.[0];
  }
  if (jobType === "weekly_report") {
    const start = payload?.week_start;
    const end = payload?.week_end;
    if (start && end) return `${start}_${end}`;
    return payload?.source_ids?.join("_");
  }
  return payload?.source_ids?.[0] ?? payload?.textbook_id;
}

/**
 * Run a static demo job by looking up the demo job manifest.
 * Simulates pending -> running -> completed with fixed delays.
 */
async function runStaticDemoJob(payload, { onUpdate, signal } = {}) {
  const jobType = payload?.job_type;
  if (!jobType) throw new Error("job_type is required");

  const indexRes = await fetch(`${DATA_BASE_URL}/demo_jobs/index.json`, { signal });
  if (!indexRes.ok) throw new Error("demo_jobs/index.json not found");
  const index = await indexRes.json();

  const key = resolveDemoKey(jobType, payload);
  const resultUrl = index.jobs?.[jobType]?.[key];
  if (!resultUrl) {
    throw new Error(`No demo job mapping for ${jobType} / ${key}`);
  }

  const jobId = `demo_job_${jobType}_${key}`;

  const emit = (status) => {
    onUpdate?.({ job_id: jobId, job_type: jobType, status, mode: "static", result_url: resultUrl });
  };

  emit("pending");
  await delay(500, signal);

  emit("running");
  await delay(1500, signal);

  const resultRes = await fetch(resultUrl, { signal });
  if (!resultRes.ok) throw new Error(`Failed to fetch result: ${resultUrl}`);
  const result = await resultRes.json();

  const final = {
    job_id: jobId,
    job_type: jobType,
    status: "completed",
    mode: "static",
    result_url: resultUrl,
    result,
  };
  emit("completed");
  return final;
}

/**
 * Run a real API job: create -> poll -> fetch result.
 */
async function runApiJob(payload, { onUpdate, signal } = {}) {
  const created = await createHermesJob(payload);
  if (!created?.job_id) throw new Error("Failed to create Hermes job");

  onUpdate?.({ job_id: created.job_id, job_type: payload.job_type, status: "pending", mode: "api" });

  const final = await pollHermesJob(created.job_id, {
    onUpdate: (status) => onUpdate?.({ ...status, mode: "api" }),
    timeoutMs: 300_000,
    signal,
  });

  if (!final || final.status !== "completed") {
    throw new Error(final?.error_message ?? "任务未能完成");
  }

  const result = await fetchHermesJobResult(created.job_id);
  return {
    job_id: created.job_id,
    job_type: payload.job_type,
    status: "completed",
    mode: "api",
    result_url: final.result_path ?? null,
    result: result ?? {},
  };
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal.aborted) return abort();
      signal.addEventListener("abort", abort, { once: true });
    }
  });
}

/**
 * Unified Hermes job runner.
 *
 * In static mode, reads demo job manifest and simulates status transitions.
 * In api mode, creates a real job via the backend and polls until completion.
 *
 * Options:
 *   onUpdate — callback(statusObj) on each status change
 *   signal   — AbortSignal for cancellation
 *
 * Returns:
 *   { job_id, job_type, status, mode, result_url, result }
 */
export async function runHermesJob(payload, options = {}) {
  const mode = getHermesExecutionMode();
  if (mode === "api") {
    return runApiJob(payload, options);
  }
  return runStaticDemoJob(payload, options);
}
