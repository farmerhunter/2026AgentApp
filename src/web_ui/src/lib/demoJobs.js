const DATA_BASE_URL = "/data";

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

export async function runHermesJob(payload, { onUpdate, signal } = {}) {
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
