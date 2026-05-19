export function LoadingState({ label = "正在加载数据..." }) {
  return (
    <div className="rounded-xl border border-aurora/20 bg-aurora/5 p-4 text-sm text-aurora">
      {label}
    </div>
  );
}

export function ErrorState({ error, label = "数据读取失败" }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 break-words">{error?.message ?? "未知错误"}</p>
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
