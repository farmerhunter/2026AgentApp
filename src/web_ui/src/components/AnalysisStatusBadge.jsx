const STATUS_CONFIG = {
  idle: { label: "等待中", dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-500" },
  pending: { label: "已提交", dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-500" },
  running: { label: "分析中", dot: "bg-amber-500 animate-pulse", bg: "bg-amber-50", text: "text-amber-700" },
  completed: { label: "分析完成", dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  failed: { label: "分析失败", dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700" },
  unavailable: { label: "API 不可用", dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-400" },
};

export default function AnalysisStatusBadge({ status, className = "" }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text} ${className}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
