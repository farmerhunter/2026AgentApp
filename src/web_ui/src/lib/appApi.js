const API_BASE = import.meta.env.VITE_APP_API_BASE_URL ?? "/api";

export class ApiUnavailableError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiUnavailableError";
    this.status = options.status ?? null;
  }
}

async function apiFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
  } catch (err) {
    throw new ApiUnavailableError(`API unavailable: ${err.message}`);
  }

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message = body?.message ?? body?.error ?? `API error: ${response.status}`;
    const error = new ApiUnavailableError(message, { status: response.status });
    error.body = body;
    throw error;
  }

  return body;
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
    if (status.status === "failed" || status.status === "timeout") return null;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return null;
}

export function fetchHermesJobResult(jobId) {
  return apiFetch(`/hermes/jobs/${jobId}/result`);
}
