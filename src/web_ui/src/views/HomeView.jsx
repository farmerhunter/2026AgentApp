import { LoadingState, ErrorState } from "../components/DataState.jsx";
import { studentSnapshot } from "../lib/demoData.js";
import { fetchDashboardStats } from "../lib/dashboardData.js";
import useAsyncData from "../lib/useAsyncData.js";

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        {icon && <span className="text-2xl">{icon}</span>}
        <div>
          <p className="text-3xl font-bold text-ink">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function SubjectDots({ subjects }) {
  const codes = ["chinese", "math", "english"];
  return (
    <div className="flex flex-wrap gap-3">
      {codes.map((code) => {
        const info = subjects[code];
        const isActive = info?.status === "active";
        return (
          <div key={code} className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                isActive ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            <span
              className={`text-sm font-semibold ${
                isActive ? "text-ink" : "text-slate-400"
              }`}
            >
              {info?.label ?? code}
            </span>
            {!isActive && (
              <span className="text-xs text-slate-400">暂无数据</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const QUICK_LINKS = [
  { id: "results", label: "学习成果", desc: "上传材料，确认重点题", icon: "📋" },
  { id: "notes", label: "输入备注", desc: "记录课堂提醒和疑问", icon: "📝" },
  { id: "reports", label: "历史周报", desc: "查看阶段分析和行动建议", icon: "📊" },
  { id: "content", label: "学习内容", desc: "理解教材章节并比对进度", icon: "📚" },
];

export default function HomeView({ onNavigate }) {
  const statsState = useAsyncData(fetchDashboardStats);
  const stats = statsState.data;

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-aurora/20 via-aurora/10 to-sunrise/10 p-8 shadow-soft backdrop-blur-xl sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aurora">
            AI 学习智能体工作台
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-ink sm:text-4xl">
            学途智伴
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
            帮你把材料、错题和备注，整理成看得见的学习进展。
            不是错题本，不是聊天机器人——是一个了解你学习状态的 AI 辅导员。
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.("results")}
            className="mt-6 rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-aurora"
          >
            进入工作台
          </button>
        </div>
        {/* Decorative background circles */}
        <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-aurora/10" />
        <div className="absolute -bottom-8 right-20 h-48 w-48 rounded-full bg-sunrise/10" />
      </section>

      {/* ── Dashboard ── */}
      {statsState.isLoading && <LoadingState label="正在加载统计数据..." />}
      {statsState.error && (
        <ErrorState error={statsState.error} label="统计数据加载失败" />
      )}

      {stats && (
        <div className="grid gap-4 lg:grid-cols-4">
          {/* Card 1: My Info */}
          <div className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              我的信息
            </p>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-aurora/10 text-xl font-bold text-aurora">
                {studentSnapshot.displayName?.[0] ?? "?"}
              </div>
              <div>
                <p className="text-xl font-bold text-ink">
                  {studentSnapshot.displayName}
                </p>
                <p className="text-sm text-slate-500">
                  {studentSnapshot.grade}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: This Week */}
          <div className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              本周动态
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">上传材料</span>
                <span className="text-lg font-bold text-ink">
                  {stats.recentSessions}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">切题数量</span>
                <span className="text-lg font-bold text-ink">
                  {stats.recentQuestions}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">已确认重点题</span>
                <span className="text-lg font-bold text-ink">
                  {stats.recentConfirmed}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Cumulative */}
          <div className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              累计成果
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <p className="text-xl font-bold text-ink">
                  {stats.totalTextbooks}
                </p>
                <p className="text-xs text-slate-500">教材分析</p>
              </div>
              <div>
                <p className="text-xl font-bold text-ink">
                  {stats.totalReports}
                </p>
                <p className="text-xs text-slate-500">历史周报</p>
              </div>
              <div>
                <p className="text-xl font-bold text-ink">
                  {stats.totalFindings}
                </p>
                <p className="text-xs text-slate-500">学习发现</p>
              </div>
              <div>
                <p className="text-xl font-bold text-ink">
                  {stats.totalMemoryCandidates}
                </p>
                <p className="text-xs text-slate-500">记忆条目</p>
              </div>
            </div>
          </div>

          {/* Card 4: Subject Status */}
          <div className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              学习状态
            </p>
            <div className="mt-3 space-y-3">
              <SubjectDots subjects={stats.subjects} />
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Entry ── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={() => onNavigate?.(link.id)}
            className="group rounded-2xl border border-white/80 bg-white/86 p-5 text-left shadow-sm transition hover:border-aurora/40 hover:bg-gradient-to-br hover:from-aurora/8 hover:to-white"
          >
            <span className="text-2xl">{link.icon}</span>
            <p className="mt-3 text-sm font-semibold text-ink group-hover:text-aurora">
              {link.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {link.desc}
            </p>
          </button>
        ))}
      </section>
    </div>
  );
}
