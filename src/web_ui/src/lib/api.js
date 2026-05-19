const DATA_BASE_URL = "/data";

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

export function fetchTextbookSummary(textbookId) {
  return fetchJson(`/textbooks/${textbookId}/textbook_content_summary.json`);
}

export function fetchTextNote(noteId) {
  return fetchJson(`/notes/${noteId}.json`);
}
