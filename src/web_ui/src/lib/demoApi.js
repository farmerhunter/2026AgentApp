const DATA_BASE_URL = "/apps/xuetuzhiban/data";

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
