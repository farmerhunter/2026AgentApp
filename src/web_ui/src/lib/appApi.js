export class ApiUnavailableError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiUnavailableError";
    this.status = options.status ?? null;
  }
}

async function apiFetch() {
  const error = new ApiUnavailableError("真实功能已暂停，请使用公开演示。", { status: 503 });
  error.code = "p0_protected_disabled";
  throw error;
}

export function fetchSessions(params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/sessions${search ? `?${search}` : ""}`);
}

export function fetchSessionMeta(uploadId) {
  return apiFetch(`/sessions/${uploadId}`);
}

export function fetchSessionSplit(uploadId) {
  return apiFetch(`/sessions/${uploadId}/split`);
}

export function fetchSessionConfirmation(uploadId) {
  return apiFetch(`/sessions/${uploadId}/confirmation`);
}

export function saveSessionConfirmation(uploadId, confirmations) {
  return apiFetch(`/sessions/${uploadId}/confirmation`, {
    method: "POST",
    body: JSON.stringify({ confirmations }),
  });
}

export function uploadExerciseImage(file) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch("/uploads", {
    method: "POST",
    body: form,
    headers: {},
  });
}

export function fetchUploadOcr(uploadId) {
  return apiFetch(`/uploads/${uploadId}/ocr`);
}

export function retryUploadOcr(uploadId) {
  return apiFetch(`/uploads/${uploadId}/ocr/retry`, {
    method: "POST",
  });
}

export function fetchFindings(params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/findings${search ? `?${search}` : ""}`);
}

export function fetchFindingBatch(batchId) {
  return apiFetch(`/findings/${batchId}`);
}

export function fetchMemories(params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/memories${search ? `?${search}` : ""}`);
}

export function saveMemories(memories) {
  return apiFetch("/memories", {
    method: "POST",
    body: JSON.stringify({ memories }),
  });
}

export function fetchNotes(params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/notes${search ? `?${search}` : ""}`);
}

export function createNote(payload) {
  return apiFetch("/notes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchReports(params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiFetch(`/reports${search ? `?${search}` : ""}`);
}

export function fetchReport(reportId) {
  return apiFetch(`/reports/${reportId}`);
}

export function createHermesJob(payload) {
  return apiFetch("/hermes/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchHermesJob(jobId) {
  return apiFetch(`/hermes/jobs/${jobId}`);
}

export async function pollHermesJob(jobId, { onUpdate, timeoutMs = 300000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await fetchHermesJob(jobId);
    onUpdate?.(status);
    if (status.status === "completed") return status;
    if (status.status === "failed" || status.status === "timeout") return status;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return null;
}

export function fetchHermesJobResult(jobId) {
  return apiFetch(`/hermes/jobs/${jobId}/result`);
}
