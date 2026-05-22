/**
 * Dashboard data aggregation for HomeView.
 * All data comes from existing /data/ static JSON — no API dependency.
 */
import { fetchJson } from "./api.js";
import { demoNoteIds, demoTextbookIds } from "./demoData.js";

const DATA_BASE_URL = "/data";

/**
 * Fetch and aggregate all dashboard statistics in one call.
 * Returns a single object with all stats resolved.
 */
export async function fetchDashboardStats() {
  const [weekIndex, sessionIndex] = await Promise.all([
    fetchWeekIndex(),
    fetchSessionIndex(),
  ]);

  const [findingsChinese, findingsMath, notes] = await Promise.all([
    fetchFindings("chinese"),
    fetchFindings("math"),
    fetchNotes(),
  ]);

  const totalFindings =
    (findingsChinese?.findings?.length ?? 0) +
    (findingsMath?.findings?.length ?? 0);

  const memoryCandidatesChinese =
    findingsChinese?.findings?.reduce(
      (sum, f) => sum + (f.memory_candidates?.length ?? 0),
      0,
    ) ?? 0;

  const memoryCandidatesMath =
    findingsMath?.findings?.reduce(
      (sum, f) => sum + (f.memory_candidates?.length ?? 0),
      0,
    ) ?? 0;

  // Recent 7 days
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentSessions =
    sessionIndex?.sessions?.filter((s) => {
      if (!s.captured_at) return false;
      return new Date(s.captured_at) >= oneWeekAgo;
    }) ?? [];

  const recentQuestions =
    recentSessions.reduce((sum, s) => sum + (s.question_count ?? 0), 0);
  const recentConfirmed =
    recentSessions.reduce((sum, s) => sum + (s.confirmed_count ?? 0), 0);

  // Subject status from latest week report
  const reports = weekIndex?.reports ?? [];
  const latestReport = reports[reports.length - 1];
  const subjects = latestReport?.subjects ?? [];

  const subjectStatus = {};
  for (const s of subjects) {
    subjectStatus[s.subject] = {
      label: s.subject_label ?? s.subject,
      status: s.status ?? "no_data",
      summary: s.summary ?? "",
    };
  }

  return {
    // Counts
    totalSessions: sessionIndex?.sessions?.length ?? 0,
    totalReports: reports.length,
    totalTextbooks: demoTextbookIds.length,
    totalNotes: notes.length,
    totalFindings,
    totalMemoryCandidates: memoryCandidatesChinese + memoryCandidatesMath,

    // Recent
    recentSessions: recentSessions.length,
    recentQuestions,
    recentConfirmed,

    // Subject status
    subjects: subjectStatus,

    // Raw data for detail views
    reports,
    recentMaterials: recentSessions,
  };
}

async function fetchWeekIndex() {
  try {
    return await fetchJson("/week_reports/week_reports_index.json");
  } catch {
    return null;
  }
}

async function fetchSessionIndex() {
  try {
    return await fetchJson("/question_sessions/_index.json");
  } catch {
    return null;
  }
}

async function fetchFindings(subject) {
  try {
    const batchId =
      subject === "chinese"
        ? "findings_20260518_chinese"
        : "findings_20260518_math";
    return await fetchJson(`/learning_findings/${batchId}.json`);
  } catch {
    return null;
  }
}

async function fetchNotes() {
  try {
    const results = await Promise.allSettled(
      demoNoteIds.map((id) => fetchJson(`/notes/${id}.json`)),
    );
    return results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);
  } catch {
    return [];
  }
}
