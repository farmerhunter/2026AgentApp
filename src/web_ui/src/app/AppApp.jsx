import { useState } from "react";
import { Routes, Route, NavLink, Navigate, Outlet } from "react-router-dom";
import { ErrorState, LoadingState, EmptyState, NotReadyState } from "../components/DataState.jsx";
import {
  fetchSessions,
  fetchSessionSplit,
  fetchSessionConfirmation,
  fetchFindings,
  fetchFindingBatch,
  fetchMemories,
  fetchReports,
  fetchReport,
} from "../lib/appApi.js";
import useAsyncData from "../lib/useAsyncData.js";

const appNav = [
  { to: "/app/overview", label: "本周概览", description: "当前学习状态与最近材料" },
  { to: "/app/import", label: "练习导入与确认", description: "上传图片并确认错题" },
  { to: "/app/analysis", label: "分析与记忆", description: "查看发现并决定记忆" },
  { to: "/app/report", label: "周报与打印", description: "查看和打印本周报告" },
];

function AppLayout() {
  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f7fbff_0%,#eef8f5_46%,#fff8eb_100%)] text-ink">
      <header className="border-b border-white/70 bg-white/78 px-4 py-4 shadow-sm backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-aurora">真实能力主线</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-ink sm:text-3xl">学途智伴</h1>
          </div>
          <span className="rounded-full border border-aurora/20 bg-aurora/10 px-3 py-1 text-sm font-medium text-aurora">
            /app
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-8">
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <nav className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {appNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "rounded-xl border px-4 py-3 transition",
                      isActive
                        ? "border-aurora/40 bg-aurora/10 text-aurora"
                        : "border-slate-200/70 bg-white/80 text-slate-600 hover:border-aurora/25 hover:bg-aurora/5",
                    ].join(" ")
                  }
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.description}</span>
                </NavLink>
              ))}
            </nav>
          </aside>
          <section className="min-w-0">
            <Outlet />
          </section>
        </div>
      </main>
    </div>
  );
}

function AppNotFound() {
  return (
    <ErrorState error={{ message: "当前 /app 路径不存在。" }} label="页面未找到" />
  );
}

function OverviewView() {
  const sessions = useAsyncData(() => fetchSessions());
  const findings = useAsyncData(() => fetchFindings());
  const memories = useAsyncData(() => fetchMemories({ status: "accepted" }));
  const reports = useAsyncData(() => fetchReports());

  if (sessions.isLoading || findings.isLoading || memories.isLoading || reports.isLoading) {
    return <LoadingState label="正在读取本周概览..." />;
  }
  if (sessions.error || findings.error || memories.error || reports.error) {
    return <ErrorState error={sessions.error ?? findings.error ?? memories.error ?? reports.error} label="本周概览读取失败" />;
  }

  const sessionCount = sessions.data?.total_sessions ?? 0;
  const findingCount = findings.data?.total ?? 0;
  const memoryCount = memories.data?.total ?? 0;
  const latestReport = reports.data?.reports?.[0] ?? null;
  const isEmpty = sessionCount === 0 && findingCount === 0 && memoryCount === 0 && !latestReport;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink">本周概览</h2>
      {isEmpty ? (
        <EmptyState label="暂时没有可展示的学习数据。" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="练习批次" value={sessionCount} />
          <Metric label="发现批次" value={findingCount} />
          <Metric label="已接受记忆" value={memoryCount} />
          <Metric label="最新周报" value={latestReport ? "已生成" : "暂无"} />
        </div>
      )}
    </div>
  );
}

function ImportView() {
  const sessions = useAsyncData(() => fetchSessions());
  const [selectedId, setSelectedId] = useState(null);
  const selectedIdValue = selectedId ?? sessions.data?.sessions?.[0]?.upload_id ?? null;
  const split = useAsyncData(
    () => (selectedIdValue ? fetchSessionSplit(selectedIdValue) : Promise.resolve(null)),
    [selectedIdValue],
  );
  const confirmation = useAsyncData(
    () => (selectedIdValue ? fetchSessionConfirmation(selectedIdValue) : Promise.resolve(null)),
    [selectedIdValue],
  );

  if (sessions.isLoading) return <LoadingState label="正在读取练习批次..." />;
  if (sessions.error) return <ErrorState error={sessions.error} label="练习批次读取失败" />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink">练习导入与确认</h2>
      {sessions.data?.sessions?.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-2">
            {sessions.data.sessions.map((session) => (
              <button
                key={session.upload_id}
                type="button"
                onClick={() => setSelectedId(session.upload_id)}
                className={[
                  "w-full rounded-xl border px-3 py-2 text-left text-sm",
                  session.upload_id === selectedIdValue
                    ? "border-aurora/40 bg-aurora/10"
                    : "border-slate-200 bg-white hover:border-aurora/25",
                ].join(" ")}
              >
                <span className="font-semibold">{session.subject_label}</span>
                <span className="block truncate text-xs text-slate-500">{session.source_title}</span>
              </button>
            ))}
          </div>
          <div>
            {split.data ? (
              <p className="text-sm text-slate-600">已读取切题结果：{split.data.questions?.length ?? 0} 题</p>
            ) : (
              <EmptyState label="暂无切题结果。" />
            )}
            <div className="mt-4">
              <NotReadyState label="E4 真实图片上传和 OCR 尚未接入，暂不能创建新的练习导入。" />
            </div>
          </div>
        </div>
      ) : (
        <EmptyState label="暂无练习批次。" />
      )}
    </div>
  );
}

function AnalysisView() {
  const findings = useAsyncData(() => fetchFindings());
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const selectedId = selectedBatchId ?? findings.data?.batches?.[0]?.finding_batch_id ?? null;
  const detail = useAsyncData(
    () => (selectedId ? fetchFindingBatch(selectedId) : Promise.resolve(null)),
    [selectedId],
  );
  const memories = useAsyncData(() => fetchMemories());

  if (findings.isLoading) return <LoadingState label="正在读取分析数据..." />;
  if (findings.error) return <ErrorState error={findings.error} label="分析数据读取失败" />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink">分析与记忆</h2>
      {findings.data?.batches?.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-2">
            {findings.data.batches.map((batch) => (
              <button
                key={batch.finding_batch_id}
                type="button"
                onClick={() => setSelectedBatchId(batch.finding_batch_id)}
                className={[
                  "w-full rounded-xl border px-3 py-2 text-left text-sm",
                  batch.finding_batch_id === selectedId
                    ? "border-aurora/40 bg-aurora/10"
                    : "border-slate-200 bg-white hover:border-aurora/25",
                ].join(" ")}
              >
                <span className="font-semibold">{batch.subject_label}</span>
                <span className="block truncate text-xs text-slate-500">{batch.finding_batch_id}</span>
              </button>
            ))}
          </div>
          <div>
            {detail.data ? (
              <p className="text-sm text-slate-600">已读取 {detail.data.findings?.length ?? 0} 条发现。</p>
            ) : (
              <EmptyState label="暂无发现详情。" />
            )}
            <div className="mt-4">
              <NotReadyState label="E5 Hermes 分析生成尚未接入，当前只能查看 E1 已保存的分析结果。" />
            </div>
          </div>
        </div>
      ) : (
        <EmptyState label="暂无分析数据。" />
      )}
    </div>
  );
}

function ReportView() {
  const reports = useAsyncData(() => fetchReports());
  const [selectedReportId, setSelectedReportId] = useState(null);
  const selectedId = selectedReportId ?? reports.data?.reports?.[0]?.weekly_report_id ?? null;
  const detail = useAsyncData(
    () => (selectedId ? fetchReport(selectedId) : Promise.resolve(null)),
    [selectedId],
  );

  if (reports.isLoading) return <LoadingState label="正在读取周报..." />;
  if (reports.error) return <ErrorState error={reports.error} label="周报读取失败" />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink">周报与打印</h2>
      {reports.data?.reports?.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-2">
            {reports.data.reports.map((report) => (
              <button
                key={report.weekly_report_id}
                type="button"
                onClick={() => setSelectedReportId(report.weekly_report_id)}
                className={[
                  "w-full rounded-xl border px-3 py-2 text-left text-sm",
                  report.weekly_report_id === selectedId
                    ? "border-aurora/40 bg-aurora/10"
                    : "border-slate-200 bg-white hover:border-aurora/25",
                ].join(" ")}
              >
                <span className="font-semibold">{report.title}</span>
                <span className="block truncate text-xs text-slate-500">{report.summary}</span>
              </button>
            ))}
          </div>
          <div>
            {detail.data ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                <h3 className="font-semibold text-ink">{detail.data.week?.title ?? detail.data.weekly_report_id}</h3>
                <p className="mt-2">{detail.data.analysis?.overall_summary ?? "暂无周报摘要"}</p>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="mt-4 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white"
                >
                  打印周报
                </button>
              </div>
            ) : (
              <EmptyState label="请选择一份周报。" />
            )}
          </div>
        </div>
      ) : (
        <EmptyState label="暂无周报。" />
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm">
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

export default function AppApp() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/app/overview" replace />} />
        <Route path="overview" element={<OverviewView />} />
        <Route path="import" element={<ImportView />} />
        <Route path="analysis" element={<AnalysisView />} />
        <Route path="report" element={<ReportView />} />
        <Route path="*" element={<AppNotFound />} />
      </Route>
    </Routes>
  );
}
