const CONFIDENCE_STYLES = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const FINDING_TYPE_LABELS = {
  concept_gap: "概念不清",
  procedure_gap: "步骤不熟",
  calculation_error: "计算错误",
  reading_comprehension: "审题/阅读问题",
  expression_issue: "表达问题",
  memory_recall: "记忆不牢",
  carelessness: "粗心",
  study_habit: "学习习惯",
  unknown: "证据不足",
};

export default function FindingCard({ finding }) {
  const confidenceClass = CONFIDENCE_STYLES[finding.confidence] ?? CONFIDENCE_STYLES.low;
  const typeLabel = FINDING_TYPE_LABELS[finding.finding_type] ?? finding.finding_type;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold text-slate-500 border-slate-200">
          {finding.finding_id}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${confidenceClass}`}>
          置信度：{finding.confidence === "high" ? "高" : finding.confidence === "medium" ? "中" : "低"}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
          {typeLabel}
        </span>
      </div>

      {/* Statement */}
      <p className="text-sm font-medium text-ink">{finding.statement}</p>

      {/* Evidence summary */}
      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-500">证据摘要</p>
        <p>{finding.evidence_summary}</p>
      </div>

      {/* Concept links */}
      {finding.concept_links?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {finding.concept_links.map((link, i) => (
            <span
              key={i}
              className="rounded-full bg-aurora/10 px-2 py-0.5 text-[11px] font-semibold text-aurora"
              title={`关联：${link.relationship}（置信度 ${link.confidence}）`}
            >
              {link.concept_name}
            </span>
          ))}
        </div>
      )}

      {/* Mistake reasons */}
      {finding.mistake_reasons?.length > 0 && (
        <div className="text-xs text-slate-500">
          <span className="font-semibold">错因标签：</span>
          {finding.mistake_reasons.map((r) => FINDING_TYPE_LABELS[r] ?? r).join("、")}
        </div>
      )}
    </div>
  );
}
