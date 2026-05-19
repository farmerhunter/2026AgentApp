import { weeklyReportPreview } from "../lib/demoData.js";

export default function WeeklyReportsView() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-soft backdrop-blur-xl">
        <p className="text-sm font-semibold text-aurora">用例 5 / 6</p>
        <h2 className="mt-2 text-2xl font-bold text-ink">历史周报</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          这里会读取 `/data/week_reports/week_reports_index.json`，再按选择加载对应周报详情。
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/80 bg-white/86 p-4 shadow-sm">
          <p className="text-sm font-semibold text-ink">周报周期</p>
          <button className="mt-3 w-full rounded-xl border border-aurora/30 bg-aurora/10 px-3 py-3 text-left text-sm font-semibold text-aurora">
            {weeklyReportPreview.week}
          </button>
        </aside>
        <article className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-ink">
            {weeklyReportPreview.title}
          </h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {weeklyReportPreview.summary}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {weeklyReportPreview.metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <p className="text-2xl font-bold text-ink">{metric.value}</p>
                <p className="mt-1 text-sm text-slate-500">{metric.label}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
