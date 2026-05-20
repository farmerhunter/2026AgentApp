import { useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../components/DataState.jsx";
import SubjectFilter, {
  matchesSubject,
} from "../components/SubjectFilter.jsx";
import JobTrigger from "../components/JobTrigger.jsx";
import { fetchWeekReportsIndex, fetchWeeklyReport } from "../lib/api.js";
import useAsyncData from "../lib/useAsyncData.js";

export default function WeeklyReportsView() {
  const [selectedReportUrl, setSelectedReportUrl] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState("all");
  const indexState = useAsyncData(fetchWeekReportsIndex);
  const reports = indexState.data?.reports ?? [];
  const activeReportUrl = selectedReportUrl ?? reports[0]?.report_url ?? null;
  const activeFileName = useMemo(
    () => activeReportUrl?.split("/").pop() ?? null,
    [activeReportUrl],
  );
  const reportState = useAsyncData(
    () => (activeFileName ? fetchWeeklyReport(activeFileName) : Promise.resolve(null)),
    [activeFileName],
  );
  const report = reportState.data;
  const reportSubjects = report?.subjects ?? [];
  const filteredMaterials =
    report?.uploaded_materials.filter((item) => matchesSubject(item, selectedSubject)) ??
    [];
  const filteredQuestions =
    report?.focus_questions.filter((item) => matchesSubject(item, selectedSubject)) ??
    [];
  const filteredSuggestions =
    report?.suggestions.filter((item) => matchesSubject(item, selectedSubject)) ?? [];
  const filteredActions =
    report?.next_actions.filter((item) => matchesSubject(item, selectedSubject)) ?? [];
  const filteredRisks =
    selectedSubject === "all"
      ? report?.analysis.main_risks ?? []
      : (report?.analysis.subject_summaries
          ?.find((item) => item.subject === selectedSubject)
          ?.main_risks ?? []);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-soft backdrop-blur-xl">
        <p className="text-sm font-semibold text-aurora">用例 5 / 6</p>
        <h2 className="mt-2 text-2xl font-bold text-ink">历史周报</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          这里会读取 `/data/week_reports/week_reports_index.json`，再按选择加载对应周报详情。
        </p>
        <div className="mt-3">
          <JobTrigger
            jobType="weekly_report"
            payload={{ week_start: "2026-05-18", week_end: "2026-05-24" }}
            label="生成最新周报"
            onComplete={(job) => console.log("weekly_report completed:", job.result_path)}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/80 bg-white/86 p-4 shadow-sm">
          <p className="text-sm font-semibold text-ink">周报周期</p>
          <div className="mt-3 space-y-2">
            {indexState.isLoading && <LoadingState label="正在读取周报索引..." />}
            {indexState.error && (
              <ErrorState error={indexState.error} label="周报索引读取失败" />
            )}
            {!indexState.isLoading && !indexState.error && reports.length === 0 && (
              <EmptyState label="暂无周报" />
            )}
            {reports.map((item) => (
              <button
                key={item.weekly_report_id}
                type="button"
                onClick={() => setSelectedReportUrl(item.report_url)}
                className={[
                  "w-full rounded-xl border px-3 py-3 text-left text-sm font-semibold transition",
                  item.report_url === activeReportUrl
                    ? "border-aurora/30 bg-aurora/10 text-aurora"
                    : "border-slate-200 bg-white text-slate-600 hover:border-aurora/30",
                ].join(" ")}
              >
                {item.title}
              </button>
            ))}
          </div>
        </aside>
        <article className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
          {reportState.isLoading && <LoadingState label="正在读取周报详情..." />}
          {reportState.error && (
            <ErrorState error={reportState.error} label="周报详情读取失败" />
          )}
          {!reportState.isLoading && !reportState.error && !report && (
            <EmptyState label="请选择周报" />
          )}
          {report && (
            <>
              <h3 className="text-lg font-semibold text-ink">
                {report.week.title}
              </h3>
              <SubjectFilter
                value={selectedSubject}
                onChange={setSelectedSubject}
                subjects={reportSubjects}
                className="mt-4"
              />
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {selectedSubject === "all"
                  ? report.analysis.overall_summary
                  : report.analysis.subject_summaries?.find(
                      (item) => item.subject === selectedSubject,
                    )?.summary ?? "当前学科暂无周报摘要。"}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Metric label="上传材料" value={filteredMaterials.length} />
                <Metric label="重点题" value={filteredQuestions.length} />
                <Metric label="下周行动" value={filteredActions.length} />
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <ReportList title="主要风险" items={filteredRisks} />
                <ReportList
                  title="学习建议"
                  items={filteredSuggestions.map(
                    (item) => `${item.subject_label}：${item.content}`,
                  )}
                />
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <ReportList
                  title="重点题"
                  items={filteredQuestions.map(
                    (item) => `${item.subject_label}：${item.knowledge_point}`,
                  )}
                />
                <ReportList
                  title="下周行动"
                  items={filteredActions.map(
                    (item) => `${item.subject_label}：${item.title}`,
                  )}
                />
              </div>
            </>
          )}
        </article>
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function ReportList({ title, items }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.length === 0 && <li className="text-slate-400">当前学科暂无数据</li>}
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
