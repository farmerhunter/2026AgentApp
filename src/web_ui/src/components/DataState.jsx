export function LoadingState({ label = "正在加载数据..." }) {
  return (
    <div className="rounded-xl border border-aurora/20 bg-aurora/5 p-4 text-sm text-aurora">
      {label}
    </div>
  );
}

export function ErrorState({ error, label = "数据读取失败", onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 break-words">{error?.message ?? "未知错误"}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
        >
          重试
        </button>
      )}
    </div>
  );
}

export function EmptyState({ label = "暂无数据" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
      {label}
    </div>
  );
}

export function NotReadyState({ label = "该能力尚未接入" }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
      <p className="font-semibold">尚未接入</p>
      <p className="mt-1">{label}</p>
    </div>
  );
}

export function SavedState({ label = "已保存" }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
      {label}
    </div>
  );
}
