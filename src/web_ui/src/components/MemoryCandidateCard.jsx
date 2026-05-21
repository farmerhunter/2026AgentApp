import { useState } from "react";

const PRIORITY_OPTIONS = [
  { value: "高", label: "高" },
  { value: "中", label: "中" },
  { value: "低", label: "低" },
];

export default function MemoryCandidateCard({
  candidate,
  index,
  findingId,
  decision,
  onDecisionChange,
}) {
  const [note, setNote] = useState(decision?.note ?? "");

  const isAccepted = decision?.accepted === true;
  const isIgnored = decision?.accepted === false;
  const currentPriority = decision?.priority ?? candidate.priority ?? "中";

  const handleAccept = () => {
    onDecisionChange(findingId, index, { accepted: true, priority: currentPriority, note });
  };

  const handleIgnore = () => {
    onDecisionChange(findingId, index, { accepted: false, priority: currentPriority, note });
  };

  const handlePriorityChange = (value) => {
    onDecisionChange(findingId, index, {
      accepted: decision?.accepted ?? true,
      priority: value,
      note,
    });
  };

  const handleNoteChange = (value) => {
    setNote(value);
    onDecisionChange(findingId, index, {
      accepted: decision?.accepted ?? true,
      priority: currentPriority,
      note: value,
    });
  };

  const statusClass = isIgnored
    ? "opacity-50 border-slate-200 bg-slate-50"
    : isAccepted
      ? "border-emerald-200 bg-emerald-50/40"
      : "border-slate-200 bg-white";

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${statusClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm text-ink">{candidate.reason}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            类型：{candidate.candidate_type === "short_term" ? "短期记忆" : candidate.candidate_type === "long_term" ? "长期记忆" : candidate.candidate_type}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={handleAccept}
            className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
              isAccepted
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700"
            }`}
          >
            {isAccepted ? "已接受" : "接受"}
          </button>
          <button
            type="button"
            onClick={handleIgnore}
            className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
              isIgnored
                ? "bg-slate-400 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {isIgnored ? "已忽略" : "忽略"}
          </button>
        </div>
      </div>

      {!isIgnored && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">优先级</span>
          <select
            value={currentPriority}
            onChange={(e) => handlePriorityChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-aurora"
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={note}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="补充说明（可选）"
            className="flex-1 min-w-[120px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-aurora placeholder:text-slate-300"
          />
        </div>
      )}
    </div>
  );
}
