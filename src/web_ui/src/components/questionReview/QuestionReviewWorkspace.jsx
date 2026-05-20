import { useMemo, useState } from "react";

const STUDENT_MARKS = [
  { value: "做错了", label: "做错了" },
  { value: "不确定", label: "不确定" },
  { value: "老师重点讲过", label: "老师重点讲过" },
  { value: "需要复习", label: "需要复习" },
  { value: "已掌握", label: "已掌握" },
];

const REVIEW_PRIORITIES = [
  { value: "高", label: "高" },
  { value: "中", label: "中" },
  { value: "低", label: "低" },
];

const REVIEW_STATUSES = ["需要复习", "已复习", "已掌握"];

const COMMON_TAGS = ["错题", "老师讲过", "常考题", "易错点", "新知识点"];

function buildInitialConfirmations(splitResult, existingConfirmation) {
  const existing = {};
  if (existingConfirmation?.confirmations) {
    for (const c of existingConfirmation.confirmations) {
      existing[c.question_id] = c;
    }
  }

  return (splitResult?.questions ?? []).map((q) => {
    const prior = existing[q.question_id];
    return {
      question_id: q.question_id,
      selected: prior?.selected ?? false,
      subject: splitResult.subject,
      subject_label: splitResult.subject_label,
      student_mark: prior?.student_mark ?? "",
      teacher_score: prior?.teacher_score ?? "",
      full_score: prior?.full_score ?? "",
      knowledge_point: prior?.knowledge_point ?? q.related_knowledge_point_ids?.join(", ") ?? "",
      knowledge_point_ids: prior?.knowledge_point_ids ?? q.related_knowledge_point_ids ?? [],
      mistake_reason: prior?.mistake_reason ?? "",
      review_priority: prior?.review_priority ?? "",
      review_status: prior?.review_status ?? "",
      tags: prior?.tags ?? [],
      note: prior?.note ?? "",
    };
  });
}

export default function QuestionReviewWorkspace({
  splitResult,
  existingConfirmation,
  onSave,
}) {
  const [confirmations, setConfirmations] = useState(() =>
    buildInitialConfirmations(splitResult, existingConfirmation),
  );
  const [activeQuestionId, setActiveQuestionId] = useState(
    splitResult?.questions?.[0]?.question_id ?? null,
  );
  const [saved, setSaved] = useState(false);

  const questions = splitResult?.questions ?? [];
  const subjectLabel = splitResult?.subject_label ?? "-";
  const activeIndex = confirmations.findIndex((c) => c.question_id === activeQuestionId);
  const activeConfirmation = activeIndex >= 0 ? confirmations[activeIndex] : null;
  const selectedCount = confirmations.filter((c) => c.selected).length;

  const updateConfirmation = (questionId, patch) => {
    setConfirmations((prev) =>
      prev.map((c) => (c.question_id === questionId ? { ...c, ...patch } : c)),
    );
  };

  const toggleTag = (tag) => {
    if (!activeConfirmation) return;
    const tags = activeConfirmation.tags.includes(tag)
      ? activeConfirmation.tags.filter((t) => t !== tag)
      : [...activeConfirmation.tags, tag];
    updateConfirmation(activeConfirmation.question_id, { tags });
  };

  const handleSave = () => {
    setSaved(true);
    if (onSave) onSave(buildOutputJson());
  };

  const buildOutputJson = () => ({
    contract: "question_confirmation_result",
    contract_version: "1.1",
    upload_id: splitResult?.upload_id ?? "",
    student_id: splitResult?.student_id ?? "小明",
    subject: splitResult?.subject ?? "",
    subject_label: splitResult?.subject_label ?? "",
    confirmed_at: new Date().toISOString(),
    confirmed_by: "student",
    confirmations: confirmations.map((c) => ({ ...c })),
  });

  const outputJson = buildOutputJson();

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-aurora/10 px-3 py-1 text-xs font-semibold text-aurora">
            {subjectLabel} · {questions.length} 题
          </span>
          <span className="rounded-full bg-berry/10 px-3 py-1 text-xs font-semibold text-berry">
            已选 {selectedCount} 题
          </span>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saved}
          className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {saved ? "已保存 ✓" : "保存确认结果"}
        </button>
      </div>

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <p className="font-semibold">确认结果已保存（demo 状态）</p>
          <p className="mt-1">
            共确认 {selectedCount} 道重点题，未写入服务器。可在下方 JSON 预览中查看完整数据。
          </p>
        </div>
      )}

      {/* Main workspace: image viewer + form */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        {/* Left: image viewer + question list */}
        <div className="space-y-4">
          <QuestionImageViewer
            splitResult={splitResult}
            activeQuestionId={activeQuestionId}
            onSelectQuestion={setActiveQuestionId}
          />
          <QuestionSelectionList
            questions={questions}
            confirmations={confirmations}
            activeQuestionId={activeQuestionId}
            onSelect={(id) => {
              setActiveQuestionId(id);
              updateConfirmation(id, { selected: true });
            }}
            onToggleSelect={(id) => {
              const current = confirmations.find((c) => c.question_id === id);
              updateConfirmation(id, { selected: !current?.selected });
            }}
          />
        </div>

        {/* Right: confirmation form + JSON preview */}
        <div className="space-y-4">
          {activeConfirmation && (
            <QuestionConfirmForm
              confirmation={activeConfirmation}
              onChange={(patch) => updateConfirmation(activeConfirmation.question_id, patch)}
              onToggleTag={toggleTag}
            />
          )}
          <ConfirmationPreview json={outputJson} />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function QuestionImageViewer({ splitResult, activeQuestionId, onSelectQuestion }) {
  const questions = splitResult?.questions ?? [];
  const imgW = splitResult?.image_size?.width ?? 1200;
  const imgH = splitResult?.image_size?.height ?? 1600;
  const sourceImageUrl = splitResult?.source_image_url;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-ink">原图预览</p>
      <p className="text-xs text-slate-400">
        {splitResult?.source_image_url ?? "demo image"} · {imgW}×{imgH}
      </p>
      <div
        className="relative mt-3 overflow-hidden rounded-lg border border-dashed border-aurora/30 bg-slate-100"
        style={{ aspectRatio: `${imgW}/${imgH}`, maxHeight: 360 }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
          demo 试卷图片区域
        </div>
        {sourceImageUrl && (
          <img
            src={sourceImageUrl}
            alt="上传材料原图"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {/* Bbox overlays */}
        {questions.map((q) => {
          const left = ((q.bbox?.x ?? 0) / imgW) * 100;
          const top = ((q.bbox?.y ?? 0) / imgH) * 100;
          const width = ((q.bbox?.width ?? 100) / imgW) * 100;
          const height = ((q.bbox?.height ?? 100) / imgH) * 100;
          const isActive = q.question_id === activeQuestionId;
          return (
            <button
              key={q.question_id}
              type="button"
              onClick={() => onSelectQuestion(q.question_id)}
              className={[
                "absolute rounded border-2 transition hover:opacity-90",
                isActive
                  ? "border-aurora bg-aurora/15 z-10"
                  : "border-amber-400/80 bg-amber-50/20 z-10",
              ].join(" ")}
              style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
              title={`题目 ${q.question_index}: ${q.question_text}`}
            >
              <span className="absolute left-1 top-0 text-[10px] font-bold text-aurora">
                Q{q.question_index}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionSelectionList({
  questions,
  confirmations,
  activeQuestionId,
  onSelect,
  onToggleSelect,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-ink">题目列表</p>
      <div className="mt-2 space-y-1">
        {questions.map((q, i) => {
          const conf = confirmations[i];
          return (
            <button
              key={q.question_id}
              type="button"
              onClick={() => onSelect(q.question_id)}
              className={[
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition",
                q.question_id === activeQuestionId
                  ? "border-aurora/30 bg-aurora/5"
                  : "border-slate-100 bg-white hover:bg-slate-50",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
                  q.question_id === activeQuestionId
                    ? "bg-aurora text-white"
                    : "bg-slate-200 text-slate-500",
                ].join(" ")}
              >
                {q.question_index}
              </span>
              <span className="flex-1 truncate text-slate-600">{q.question_text}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(q.question_id);
                }}
                className={[
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  conf?.selected
                    ? "bg-aurora/10 text-aurora"
                    : "bg-slate-100 text-slate-400",
                ].join(" ")}
              >
                {conf?.selected ? "重点题" : "未选"}
              </button>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionConfirmForm({ confirmation, onChange, onToggleTag }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-ink">
        确认表单 — Q{confirmation?.question_id}
      </p>
      <div className="mt-3 grid gap-3 text-sm">
        {/* Student mark */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">掌握状态</label>
          <select
            value={confirmation.student_mark}
            onChange={(e) => onChange({ student_mark: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-aurora"
          >
            <option value="">--</option>
            {STUDENT_MARKS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">得分</label>
            <input
              type="text"
              value={confirmation.teacher_score}
              onChange={(e) => onChange({ teacher_score: e.target.value })}
              placeholder="0"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-aurora"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">满分</label>
            <input
              type="text"
              value={confirmation.full_score}
              onChange={(e) => onChange({ full_score: e.target.value })}
              placeholder="3"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-aurora"
            />
          </div>
        </div>

        {/* Knowledge point */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">知识点</label>
          <input
            type="text"
            value={confirmation.knowledge_point}
            onChange={(e) => onChange({ knowledge_point: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-aurora"
          />
        </div>

        {/* Mistake reason */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">错因</label>
          <textarea
            value={confirmation.mistake_reason}
            onChange={(e) => onChange({ mistake_reason: e.target.value })}
            rows={2}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-aurora"
          />
        </div>

        {/* Review priority + status */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">复习优先级</label>
            <select
              value={confirmation.review_priority}
              onChange={(e) => onChange({ review_priority: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-aurora"
            >
              <option value="">--</option>
              {REVIEW_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">复习状态</label>
            <select
              value={confirmation.review_status}
              onChange={(e) => onChange({ review_status: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-aurora"
            >
              <option value="">--</option>
              {REVIEW_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">标签</label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_TAGS.map((tag) => {
              const active = confirmation.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onToggleTag(tag)}
                  className={[
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                    active
                      ? "bg-aurora/15 text-aurora"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                  ].join(" ")}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">备注</label>
          <textarea
            value={confirmation.note}
            onChange={(e) => onChange({ note: e.target.value })}
            rows={2}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-aurora"
          />
        </div>
      </div>
    </div>
  );
}

function ConfirmationPreview({ json }) {
  const [expanded, setExpanded] = useState(false);
  const jsonStr = useMemo(() => JSON.stringify(json, null, 2), [json]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-900 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-300">JSON 预览</p>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] font-semibold text-aurora hover:underline"
        >
          {expanded ? "收起" : "展开"}
        </button>
      </div>
      <pre
        className={[
          "mt-2 overflow-auto text-[11px] leading-relaxed text-slate-400 transition-all",
          expanded ? "max-h-96" : "max-h-32",
        ].join(" ")}
      >
        {jsonStr}
      </pre>
    </div>
  );
}
