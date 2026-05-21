const DATA_BASE_URL = "/data";

// Hermes API base URL - configurable via env for local/VPS switching
const HERMES_API_BASE = import.meta.env.VITE_HERMES_API_BASE_URL ?? "http://localhost:8000";

let _apiAvailable = null;

/**
 * Check whether the Hermes API is reachable.
 * Cached after first call to avoid repeated connection attempts.
 */
export async function isApiAvailable() {
  if (_apiAvailable !== null) return _apiAvailable;
  try {
    const res = await fetch(`${HERMES_API_BASE}/api/hermes/health`, {
      signal: AbortSignal.timeout(3000),
    });
    _apiAvailable = res.ok;
  } catch {
    _apiAvailable = false;
  }
  return _apiAvailable;
}

/**
 * Create a Hermes job via the API.
 * Falls back to null when API is unavailable.
 */
export async function createHermesJob(payload) {
  const available = await isApiAvailable();
  if (!available) return null;

  const res = await fetch(`${HERMES_API_BASE}/api/hermes/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch Hermes job status.
 */
export async function fetchHermesJob(jobId) {
  const res = await fetch(`${HERMES_API_BASE}/api/hermes/jobs/${jobId}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Fetch Hermes job result data.
 */
export async function fetchHermesJobResult(jobId) {
  const res = await fetch(`${HERMES_API_BASE}/api/hermes/jobs/${jobId}/result`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Poll a Hermes job until completion, calling onUpdate with each status.
 * Returns the final completed job status, or null on failure/timeout.
 */
export async function pollHermesJob(jobId, { onUpdate, timeoutMs = 300_000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await fetchHermesJob(jobId);
    if (!status) return null;

    onUpdate?.(status);

    if (status.status === "completed") return status;
    if (status.status === "failed" || status.status === "timeout") return null;

    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

// ── Static JSON fetch helpers (unchanged) ──

export async function fetchJson(path) {
  const response = await fetch(`${DATA_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  return response.json();
}

export function fetchWeekReportsIndex() {
  return fetchJson("/week_reports/week_reports_index.json");
}

export function fetchWeeklyReport(fileName) {
  return fetchJson(`/week_reports/${fileName}`);
}

export function fetchQuestionSession(uploadId, fileName) {
  return fetchJson(`/question_sessions/${uploadId}/${fileName}`);
}

export function fetchSessionIndex() {
  return fetchJson("/question_sessions/_index.json");
}

export function fetchTextbookSummary(textbookId) {
  return fetchJson(`/textbooks/${textbookId}/textbook_content_summary.json`);
}

export function fetchTextNote(noteId) {
  return fetchJson(`/notes/${noteId}.json`);
}

export function fetchLearningFindings(batchId) {
  return fetchJson(`/learning_findings/${batchId}.json`);
}
