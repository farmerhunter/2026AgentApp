import { useState } from "react";
import { ErrorState, LoadingState } from "../components/DataState.jsx";
import QuestionReviewView from "../views/QuestionReviewView.jsx";
import { fetchQuestionSession } from "../lib/api.js";
import useAsyncData from "../lib/useAsyncData.js";

const STEPS = [
  { id: "info", label: "材料信息", number: 1 },
  { id: "split", label: "识别/切题", number: 2 },
  { id: "confirm", label: "重点题确认", number: 3 },
  { id: "save", label: "保存结果", number: 4 },
];

const SUBJECT_OPTIONS = [
  { value: "chinese", label: "语文" },
  { value: "math", label: "数学" },
  { value: "english", label: "英语" },
];

const SOURCE_TYPES = ["试卷页", "练习页", "错题本", "作业"];

const DEMO_SESSIONS = [
  { uploadId: "upload_20260518_001", label: "数学 — 反比例函数练习", subject: "math" },
  { uploadId: "upload_20260518_002", label: "语文 — 议论文片段", subject: "chinese" },
];

export default function UploadMaterialFlow({ onCancel }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [formSubject, setFormSubject] = useState("math");
  const [sourceType, setSourceType] = useState("试卷页");
  const [sourceTitle, setSourceTitle] = useState("");
  const [capturedDate, setCapturedDate] = useState("");
  const [selectedDemoSession, setSelectedDemoSession] = useState(null);
  const [saved, setSaved] = useState(false);

  const currentStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const { data: splitData, error: splitError, isLoading: splitLoading } = useAsyncData(
    () =>
      selectedDemoSession
        ? fetchQuestionSession(selectedDemoSession, "question_split_result.json")
        : Promise.resolve(null),
    [selectedDemoSession],
  );

  const { data: confirmData } = useAsyncData(
    () =>
      selectedDemoSession
        ? fetchQuestionSession(selectedDemoSession, "question_confirmation_result.json")
        : Promise.resolve(null),
    [selectedDemoSession],
  );

  const handleNext = () => {
    if (stepIndex === 0 && !selectedDemoSession) {
      setSelectedDemoSession(DEMO_SESSIONS[0].uploadId);
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const handlePrev = () => setStepIndex((i) => Math.max(i - 1, 0));

  const handleSave = () => {
    setSaved(true);
  };

  const selectedLabel =
    DEMO_SESSIONS.find((s) => s.uploadId === selectedDemoSession)?.label ?? "";

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-soft backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-aurora">上传材料</p>
            <h2 className="mt-1 text-2xl font-bold text-ink">
              {saved ? "已保存" : currentStep.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            {saved ? "返回学习成果" : "取消"}
          </button>
        </div>

        {/* Step indicator */}
        <div className="mt-5 flex items-center gap-2">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2">
              <div
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition",
                  i < stepIndex || saved
                    ? "bg-emerald-500 text-white"
                    : i === stepIndex
                      ? "bg-aurora text-white"
                      : "bg-slate-200 text-slate-500",
                ].join(" ")}
              >
                {i < stepIndex || saved ? "✓" : step.number}
              </div>
              <span
                className={[
                  "text-xs font-semibold hidden sm:inline",
                  i <= stepIndex || saved ? "text-ink" : "text-slate-400",
                ].join(" ")}
              >
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={[
                    "h-px w-6 sm:w-10",
                    i < stepIndex || saved ? "bg-emerald-300" : "bg-slate-200",
                  ].join(" ")}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Step 1: Material Info */}
      {stepIndex === 0 && !saved && (
        <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-ink">材料信息</h3>
          <p className="mt-1 text-sm text-slate-500">
            填写学习材料的基本信息，第一版使用 demo 数据模拟上传。
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-ink">学科</label>
              <select
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-aurora focus:ring-4 focus:ring-aurora/10"
              >
                {SUBJECT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <label className="block text-sm font-semibold text-ink">来源类型</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-aurora focus:ring-4 focus:ring-aurora/10"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-ink">资料标题</label>
              <input
                type="text"
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
                placeholder="例如：八年级数学反比例函数单元练习"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-aurora focus:ring-4 focus:ring-aurora/10"
              />
              <label className="block text-sm font-semibold text-ink">日期</label>
              <input
                type="date"
                value={capturedDate}
                onChange={(e) => setCapturedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-aurora focus:ring-4 focus:ring-aurora/10"
              />
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            <p className="font-semibold text-ink">选择文件</p>
            <p className="mt-1">
              第一版 demo：选择一个样例 upload session 继续流程。不执行真实文件上传。
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {DEMO_SESSIONS.map((session) => (
                <button
                  key={session.uploadId}
                  type="button"
                  onClick={() => setSelectedDemoSession(session.uploadId)}
                  className={[
                    "rounded-xl border px-4 py-3 text-left text-sm font-semibold transition",
                    selectedDemoSession === session.uploadId
                      ? "border-aurora/30 bg-aurora/10 text-aurora"
                      : "border-slate-200 bg-white text-slate-600 hover:border-aurora/30",
                  ].join(" ")}
                >
                  {session.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Step 2: Split/OCR */}
      {stepIndex === 1 && !saved && (
        <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-ink">识别/切题</h3>
          <p className="mt-1 text-sm text-slate-500">
            读取 demo 切题结果，展示题目数量、原图信息和题目列表摘要。
          </p>
          {splitLoading && <LoadingState label="正在读取切题结果..." />}
          {splitError && <ErrorState error={splitError} label="切题结果读取失败" />}
          {splitData && (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="题目数量" value={splitData.questions?.length ?? 0} />
                <Metric label="页面数" value={splitData.page_count ?? 1} />
                <Metric label="状态" value={splitData.processing_status ?? "已完成"} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-ink">题目列表</p>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {(splitData.questions ?? []).map((q) => (
                    <li key={q.question_id} className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-aurora/10 text-xs font-bold text-aurora">
                        {q.question_index}
                      </span>
                      <span className="truncate">{q.question_text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-slate-400">
                Session: {selectedLabel} · upload_id: {selectedDemoSession}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Step 3: Question Confirmation (shell, delegates to QuestionReviewView) */}
      {stepIndex === 2 && !saved && (
        <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-ink">重点题确认</h3>
          <p className="mt-1 text-sm text-slate-500">
            选择需要记录的重点题。完整编辑能力（得分、错因、知识点等）由后续 issue #7 实现。
          </p>
          <div className="mt-4">
            {splitData && confirmData ? (
              <QuestionReviewView
                splitResult={splitData}
                confirmationResult={confirmData}
              />
            ) : (
              <LoadingState label="正在加载确认数据..." />
            )}
          </div>
        </section>
      )}

      {/* Step 4: Save */}
      {stepIndex === 3 && !saved && (
        <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-ink">保存结果</h3>
          <p className="mt-1 text-sm text-slate-500">
            确认并保存本次上传材料的结果。第一版保存到本地 demo state。
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
            <p className="font-semibold text-ink">保存内容摘要</p>
            <ul className="mt-3 space-y-1">
              <li>Upload session: {selectedLabel}</li>
              <li>学科：{SUBJECT_OPTIONS.find((o) => o.value === formSubject)?.label ?? formSubject}</li>
              <li>来源类型：{sourceType}</li>
              {sourceTitle && <li>资料标题：{sourceTitle}</li>}
              {capturedDate && <li>日期：{capturedDate}</li>}
              <li>切题结果：{splitData?.questions?.length ?? 0} 道题目</li>
              <li>确认结果：{confirmData?.confirmations?.length ?? 0} 道已确认</li>
            </ul>
          </div>
        </section>
      )}

      {/* Saved state */}
      {saved && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-emerald-700">保存成功 ✓</h3>
          <p className="mt-1 text-sm text-emerald-600">
            上传材料流程已完成（demo 状态，未写入服务器）。
          </p>
        </section>
      )}

      {/* Navigation buttons */}
      {!saved && (
        <div className="flex justify-between">
          <button
            type="button"
            onClick={handlePrev}
            disabled={stepIndex === 0}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            上一步
          </button>
          {isLastStep ? (
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              保存确认结果
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-aurora"
            >
              下一步
            </button>
          )}
        </div>
      )}
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
