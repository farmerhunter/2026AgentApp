import { useState, useEffect } from "react";
import { Routes, Route, NavLink, Navigate, Outlet } from "react-router-dom";
import { ErrorState, LoadingState, EmptyState, NotReadyState, SavedState } from "../components/DataState.jsx";
import {
  fetchSessions,
  fetchSessionSplit,
  fetchSessionConfirmation,
  uploadExerciseImage,
  fetchUploadOcr,
  retryUploadOcr,
  saveSessionConfirmation,
  fetchFindings,
  fetchFindingBatch,
  fetchMemories,
  fetchReports,
  fetchReport,
  createHermesJob,
  pollHermesJob,
  saveMemories,
} from "../lib/appApi.js";
import FindingCard from "../components/FindingCard.jsx";
import useAsyncData from "../lib/useAsyncData.js";

const appNav = [
  { to: "/app/overview", label: "本周概览", description: "当前学习状态与最近材料" },
  { to: "/app/import", label: "练习导入与确认", description: "上传图片并确认错题" },
  { to: "/app/analysis", label: "分析与记忆", description: "查看发现并决定记忆" },
  { to: "/app/report", label: "周报与打印", description: "查看和打印本周报告" },
];

function AppLayout() {
  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f7fbff_0%,#eef8f5_46%,#fff8eb_100%)] text-ink">
      <header className="border-b border-white/70 bg-white/78 px-4 py-4 shadow-sm backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-aurora">真实能力主线</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-ink sm:text-3xl">学途智伴</h1>
          </div>
          <span className="rounded-full border border-aurora/20 bg-aurora/10 px-3 py-1 text-sm font-medium text-aurora">
            /app
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-8">
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <nav className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {appNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "rounded-xl border px-4 py-3 transition",
                      isActive
                        ? "border-aurora/40 bg-aurora/10 text-aurora"
                        : "border-slate-200/70 bg-white/80 text-slate-600 hover:border-aurora/25 hover:bg-aurora/5",
                    ].join(" ")
                  }
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.description}</span>
                </NavLink>
              ))}
            </nav>
          </aside>
          <section className="min-w-0">
            <Outlet />
          </section>
        </div>
      </main>
    </div>
  );
}

function AppNotFound() {
  return (
    <ErrorState error={{ message: "当前 /app 路径不存在。" }} label="页面未找到" />
  );
}

function OverviewView() {
  const [reloadKey, setReloadKey] = useState(0);
  const sessions = useAsyncData(() => fetchSessions(), [reloadKey]);
  const findings = useAsyncData(() => fetchFindings(), [reloadKey]);
  const memories = useAsyncData(() => fetchMemories({ status: "accepted" }), [reloadKey]);
  const reports = useAsyncData(() => fetchReports(), [reloadKey]);

  if (sessions.isLoading || findings.isLoading || memories.isLoading || reports.isLoading) {
    return <LoadingState label="正在读取本周概览..." />;
  }
  if (sessions.error || findings.error || memories.error || reports.error) {
    return <ErrorState error={sessions.error ?? findings.error ?? memories.error ?? reports.error} label="本周概览读取失败" onRetry={() => setReloadKey((k) => k + 1)} />;
  }

  const sessionCount = sessions.data?.total_sessions ?? 0;
  const findingCount = findings.data?.total ?? 0;
  const memoryCount = memories.data?.total ?? 0;
  const latestReport = reports.data?.reports?.[0] ?? null;
  const isEmpty = sessionCount === 0 && findingCount === 0 && memoryCount === 0 && !latestReport;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink">本周概览</h2>
      {isEmpty ? (
        <EmptyState label="暂时没有可展示的学习数据。" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="练习批次" value={sessionCount} />
          <Metric label="发现批次" value={findingCount} />
          <Metric label="已接受记忆" value={memoryCount} />
          <Metric label="最新周报" value={latestReport ? "已生成" : "暂无"} />
        </div>
      )}
    </div>
  );
}

function ImportView() {
  const [reloadKey, setReloadKey] = useState(0);
  const sessions = useAsyncData(() => fetchSessions(), [reloadKey]);
  const [selectedId, setSelectedId] = useState(null);
  const [uploadState, setUploadState] = useState("idle");
  const [uploadError, setUploadError] = useState(null);
  const [ocrState, setOcrState] = useState(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState(new Set());
  const [notes, setNotes] = useState({});
  const [answerOverrides, setAnswerOverrides] = useState({});
  const selectedIdValue = selectedId ?? sessions.data?.sessions?.[0]?.upload_id ?? null;
  const split = useAsyncData(
    () => (selectedIdValue ? fetchSessionSplit(selectedIdValue) : Promise.resolve(null)),
    [selectedIdValue, reloadKey],
  );
  const confirmation = useAsyncData(
    () => (selectedIdValue ? fetchSessionConfirmation(selectedIdValue) : Promise.resolve(null)),
    [selectedIdValue, reloadKey],
  );

  useEffect(() => {
    setSelectedQuestionIds(new Set());
    setNotes({});
    setAnswerOverrides({});
    const saved = confirmation.data?.confirmations ?? [];
    if (saved.length === 0) return;
    const selected = new Set();
    const nextNotes = {};
    const nextAnswers = {};
    for (const item of saved) {
      if (item.selected) selected.add(item.question_id);
      if (item.note) nextNotes[item.question_id] = item.note;
      if (item.student_answer_text) nextAnswers[item.question_id] = item.student_answer_text;
    }
    setSelectedQuestionIds(selected);
    setNotes(nextNotes);
    setAnswerOverrides(nextAnswers);
  }, [selectedIdValue, confirmation.data]);

  useEffect(() => {
    const session = sessions.data?.sessions?.find((item) => item.upload_id === selectedIdValue);
    if (!session || !["queued", "running"].includes(session.ocr_status)) return;
    let cancelled = false;
    setUploadState("polling");
    setOcrState({ upload_id: selectedIdValue, status: session.ocr_status });
    (async () => {
      try {
        const latest = await pollUpload(selectedIdValue);
        if (cancelled) return;
        if (latest.status === "succeeded") {
          setUploadState("ready");
          setReloadKey((key) => key + 1);
        } else {
          setUploadState("failed");
          setUploadError({ message: latest.error_message ?? "OCR 处理失败" });
        }
      } catch (error) {
        if (cancelled) return;
        setUploadState("failed");
        setUploadError(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedIdValue, sessions.data?.sessions]);

  async function pollUpload(uploadId) {
    let latest = { status: "queued", upload_id: uploadId };
    for (let i = 0; i < 60; i += 1) {
      latest = await fetchUploadOcr(uploadId);
      setOcrState(latest);
      if (["succeeded", "failed", "interrupted"].includes(latest.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return latest;
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadState("uploading");
    setUploadError(null);
    try {
      const uploaded = await uploadExerciseImage(file);
      setUploadState("polling");
      setOcrState({ upload_id: uploaded.upload_id, status: "queued" });
      const latest = await pollUpload(uploaded.upload_id);
      if (latest.status === "succeeded") {
        setSelectedId(uploaded.upload_id);
        setUploadState("ready");
        setReloadKey((key) => key + 1);
      } else {
        setUploadState("failed");
        setUploadError({ message: latest.error_message ?? "OCR 处理失败" });
      }
    } catch (error) {
      setUploadState("failed");
      setUploadError(error);
    }
  }

  async function handleRetry() {
    if (!ocrState?.upload_id) return;
    setUploadState("polling");
    setUploadError(null);
    try {
      await retryUploadOcr(ocrState.upload_id);
      const latest = await pollUpload(ocrState.upload_id);
      if (latest.status === "succeeded") {
        setSelectedId(ocrState.upload_id);
        setUploadState("ready");
        setReloadKey((key) => key + 1);
      } else {
        setUploadState("failed");
        setUploadError({ message: latest.error_message ?? "OCR 处理失败" });
      }
    } catch (error) {
      setUploadState("failed");
      setUploadError(error);
    }
  }

  function toggleQuestion(questionId) {
    setSelectedQuestionIds((current) => {
      const next = new Set(current);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else if (next.size < 10) {
        next.add(questionId);
      }
      return next;
    });
  }

  async function handleSaveConfirmation() {
    if (!selectedIdValue || selectedQuestionIds.size > 10) return;
    setUploadState("saving");
    setUploadError(null);
    try {
      const confirmations = (split.data?.questions ?? [])
        .filter((question) => selectedQuestionIds.has(question.question_id))
        .map((question) => {
          const override = answerOverrides[question.question_id]?.trim();
          return {
            question_id: question.question_id,
            selected: true,
            note: notes[question.question_id] ?? "",
            student_answer_text: override && !question.student_answer_text ? override : undefined,
          };
        });
      await saveSessionConfirmation(selectedIdValue, confirmations);
      setUploadState("saved");
      setReloadKey((key) => key + 1);
    } catch (error) {
      setUploadState("ready");
      setUploadError(error);
    }
  }

  if (sessions.isLoading) return <LoadingState label="正在读取练习批次..." />;
  if (sessions.error) return <ErrorState error={sessions.error} label="练习批次读取失败" onRetry={() => setReloadKey((k) => k + 1)} />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink">练习导入与确认</h2>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-sm font-semibold text-ink">上传一张练习或试卷图片</label>
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          disabled={uploadState === "uploading" || uploadState === "polling" || uploadState === "saving"}
          className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-aurora/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-aurora"
        />
        {uploadState === "uploading" || uploadState === "polling" ? (
          <LoadingState label="正在上传并处理 OCR..." />
        ) : null}
        {uploadState === "failed" ? (
          ocrState?.upload_id ? (
            <ErrorState error={uploadError} label="上传或 OCR 失败" onRetry={handleRetry} />
          ) : (
            <ErrorState error={uploadError} label="上传失败，请重新选择图片" />
          )
        ) : null}
        {uploadState === "ready" && uploadError ? (
          <ErrorState error={uploadError} label="保存失败" onRetry={handleSaveConfirmation} />
        ) : null}
        {uploadState === "saved" ? <SavedState label="错题确认已保存。" /> : null}
      </div>
      {sessions.data?.sessions?.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-2">
            {sessions.data.sessions.map((session) => (
              <button
                key={session.upload_id}
                type="button"
                onClick={() => setSelectedId(session.upload_id)}
                className={[
                  "w-full rounded-xl border px-3 py-2 text-left text-sm",
                  session.upload_id === selectedIdValue
                    ? "border-aurora/40 bg-aurora/10"
                    : "border-slate-200 bg-white hover:border-aurora/25",
                ].join(" ")}
              >
                <span className="font-semibold">{session.subject_label}</span>
                <span className="block truncate text-xs text-slate-500">{session.source_title}</span>
              </button>
            ))}
          </div>
          <div>
            {split.isLoading || confirmation.isLoading ? (
              <LoadingState label="正在读取切题和确认结果..." />
            ) : split.error || confirmation.error ? (
              <ErrorState
                error={split.error ?? confirmation.error}
                label="切题或确认结果读取失败"
                onRetry={() => setReloadKey((k) => k + 1)}
              />
            ) : selectedIdValue ? (
              <div className="space-y-4">
                {split.data?.questions?.length > 0 ? (
                  <ImageBboxViewer uploadId={selectedIdValue} questions={split.data.questions} />
                ) : (
                  <EmptyState label="暂无切题结果。" />
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink">请勾选错题</p>
                    <span className="rounded-full bg-aurora/10 px-3 py-1 text-sm font-medium text-aurora">
                      已选 {selectedQuestionIds.size}/10
                    </span>
                  </div>
                  {(split.data?.questions ?? []).map((question) => (
                    <div
                      key={question.question_id}
                      className="rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedQuestionIds.has(question.question_id)}
                          onChange={() => toggleQuestion(question.question_id)}
                          disabled={!selectedQuestionIds.has(question.question_id) && selectedQuestionIds.size >= 10}
                        />
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="font-medium text-ink">
                            {question.question_index}. {question.question_text}
                          </p>
                          <p className="mt-1 text-slate-500">
                            作答：{question.student_answer_text || "未识别到学生作答"}
                          </p>
                          {!question.student_answer_text ? (
                            <input
                              type="text"
                              value={answerOverrides[question.question_id] ?? ""}
                              onChange={(event) =>
                                setAnswerOverrides((current) => ({
                                  ...current,
                                  [question.question_id]: event.target.value,
                                }))
                              }
                              placeholder="补录学生作答（可选）"
                              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                          ) : null}
                          <input
                            type="text"
                            value={notes[question.question_id] ?? ""}
                            onChange={(event) =>
                              setNotes((current) => ({
                                ...current,
                                [question.question_id]: event.target.value,
                              }))
                            }
                            placeholder="备注（可选）"
                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSaveConfirmation}
                  disabled={selectedQuestionIds.size === 0 || selectedQuestionIds.size > 10 || uploadState === "saving"}
                  className="rounded-xl bg-aurora px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  保存错题确认
                </button>
              </div>
            ) : (
              <EmptyState label="请选择一个练习批次。" />
            )}
          </div>
        </div>
      )}
      {sessions.data?.sessions?.length === 0 && <EmptyState label="暂无练习批次。" />}
    </div>
  );
}

function ImageBboxViewer({ uploadId, questions }) {
  const [size, setSize] = useState(null);
  const [imageError, setImageError] = useState(null);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
      {imageError ? <ErrorState error={imageError} label="原图加载失败" /> : null}
      <img
        src={`${import.meta.env.VITE_APP_API_BASE_URL ?? "/api/xuetuzhiban"}/uploads/${uploadId}/image`}
        alt="练习原图"
        onError={() => setImageError({ message: "原图不存在或已损坏。" })}
        onLoad={(event) => {
          setImageError(null);
          setSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          });
        }}
        className="block w-full"
      />
      {size
        ? questions.map((question) => {
            if (!question.bbox) return null;
            return (
              <div
                key={question.question_id}
                className="pointer-events-none absolute border-2 border-aurora/80 bg-aurora/5"
                style={{
                  left: `${(question.bbox.x / size.width) * 100}%`,
                  top: `${(question.bbox.y / size.height) * 100}%`,
                  width: `${(question.bbox.width / size.width) * 100}%`,
                  height: `${(question.bbox.height / size.height) * 100}%`,
                }}
              />
            );
          })
        : null}
    </div>
  );
}

function AnalysisView() {
  const [reloadKey, setReloadKey] = useState(0);
  const [jobStatus, setJobStatus] = useState("idle");
  const [jobError, setJobError] = useState(null);
  const [selectedUploadId, setSelectedUploadId] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [memorySaving, setMemorySaving] = useState(false);
  const sessions = useAsyncData(() => fetchSessions(), [reloadKey]);
  const findings = useAsyncData(() => fetchFindings(), [reloadKey]);
  const memories = useAsyncData(() => fetchMemories(), [reloadKey]);
  const uploadId = selectedUploadId ?? sessions.data?.sessions?.find((s) => s.confirmed_count > 0)?.upload_id ?? null;
  const selectedId = selectedBatchId ?? findings.data?.batches?.[0]?.finding_batch_id ?? null;
  const detail = useAsyncData(
    () => (selectedId ? fetchFindingBatch(selectedId) : Promise.resolve(null)),
    [selectedId, reloadKey],
  );

  async function handleAnalyze() {
    if (!uploadId || jobStatus === "running" || jobStatus === "pending") return;
    setJobStatus("pending");
    setJobError(null);
    try {
      const created = await createHermesJob({
        job_type: "confirmed_mistake_analysis",
        source_ids: [uploadId],
      });
      setJobStatus("running");
      const final = await pollHermesJob(created.job_id, {
        onUpdate: (status) => setJobStatus(status.status),
        timeoutMs: 300_000,
      });
      if (!final || final.status !== "completed") {
        throw new Error(final?.error_message ?? "错题分析任务未完成");
      }
      setJobStatus("completed");
      setReloadKey((key) => key + 1);
    } catch (error) {
      setJobStatus("failed");
      setJobError(error);
    }
  }

  async function handleMemoryDecision(memory, status) {
    setMemorySaving(true);
    try {
      await saveMemories([
        {
          finding_id: memory.finding_id,
          finding_batch_id: memory.finding_batch_id,
          status,
          note: "",
        },
      ]);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setJobError(error);
    } finally {
      setMemorySaving(false);
    }
  }

  if (sessions.isLoading || findings.isLoading) {
    return <LoadingState label="正在读取分析数据..." />;
  }
  if (sessions.error || findings.error) {
    return <ErrorState error={sessions.error ?? findings.error} label="分析数据读取失败" onRetry={() => setReloadKey((k) => k + 1)} />;
  }

  const analysisSessions = (sessions.data?.sessions ?? []).filter((session) => session.confirmed_count > 0);
  const findingsBatches = findings.data?.batches ?? [];
  const memoryList = memories.data?.memories ?? [];
  const pendingMemories = memoryList.filter((memory) => memory.status === "pending");

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink">分析与记忆</h2>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-ink">生成错题分析</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[220px]">
            <span className="text-xs text-slate-500">选择已确认错题的练习批次</span>
            <select
              value={uploadId ?? ""}
              onChange={(event) => setSelectedUploadId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">请选择</option>
              {analysisSessions.map((session) => (
                <option key={session.upload_id} value={session.upload_id}>
                  {session.subject_label} · {session.source_title} · {session.confirmed_count} 题
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!uploadId || jobStatus === "pending" || jobStatus === "running"}
            className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {jobStatus === "pending" ? "提交中..." : jobStatus === "running" ? "分析中..." : "开始分析"}
          </button>
          {jobStatus === "completed" && <SavedState label="分析已保存" />}
          {jobStatus === "failed" && jobError && <ErrorState error={jobError} label="分析失败" onRetry={handleAnalyze} />}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">发现</h3>
        {findingsBatches.length === 0 ? (
          <EmptyState label="暂无分析数据" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="space-y-2">
              {findingsBatches.map((batch) => (
                <button
                  key={batch.finding_batch_id}
                  type="button"
                  onClick={() => setSelectedBatchId(batch.finding_batch_id)}
                  className={[
                    "w-full rounded-xl border px-3 py-2 text-left text-sm",
                    batch.finding_batch_id === selectedId
                      ? "border-aurora/40 bg-aurora/10"
                      : "border-slate-200 bg-white hover:border-aurora/25",
                  ].join(" ")}
                >
                  <span className="font-semibold">{batch.subject_label}</span>
                  <span className="block truncate text-xs text-slate-500">{batch.finding_batch_id}</span>
                </button>
              ))}
            </div>
            <div>
              {detail.isLoading ? (
                <LoadingState label="正在读取发现详情..." />
              ) : detail.error ? (
                <ErrorState error={detail.error} label="发现详情读取失败" onRetry={() => setReloadKey((k) => k + 1)} />
              ) : (
                <div className="space-y-3">
                  {(detail.data?.findings ?? []).map((finding) => (
                    <FindingCard key={finding.finding_id} finding={finding} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">待确认记忆</h3>
        {memories.isLoading ? (
          <LoadingState label="正在读取记忆决策..." />
        ) : memories.error ? (
          <ErrorState error={memories.error} label="记忆决策读取失败" onRetry={() => setReloadKey((k) => k + 1)} />
        ) : pendingMemories.length === 0 ? (
          <EmptyState label="暂无待确认的记忆记录" />
        ) : (
          <div className="space-y-2">
            {pendingMemories.map((memory) => (
              <div key={memory.memory_id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <p className="font-medium text-ink">{memory.statement}</p>
                <p className="mt-1 text-xs text-slate-500">{memory.subject_label} · {memory.candidate_type}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleMemoryDecision(memory, "accepted")}
                    disabled={memorySaving}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    接受
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMemoryDecision(memory, "rejected")}
                    disabled={memorySaving}
                    className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-50"
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReportView() {
  const [reloadKey, setReloadKey] = useState(0);
  const [jobStatus, setJobStatus] = useState("idle");
  const [jobError, setJobError] = useState(null);
  const reports = useAsyncData(() => fetchReports(), [reloadKey]);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const selectedId = selectedReportId ?? reports.data?.reports?.[0]?.weekly_report_id ?? null;
  const detail = useAsyncData(
    () => (selectedId ? fetchReport(selectedId) : Promise.resolve(null)),
    [selectedId, reloadKey],
  );

  async function handleGenerate() {
    if (jobStatus === "pending" || jobStatus === "running") return;
    setJobStatus("pending");
    setJobError(null);
    try {
      const created = await createHermesJob({ job_type: "weekly_learning_report" });
      setJobStatus("running");
      const final = await pollHermesJob(created.job_id, {
        onUpdate: (status) => setJobStatus(status.status),
        timeoutMs: 300_000,
      });
      if (!final || final.status !== "completed") {
        throw new Error(final?.error_message ?? "周报任务未完成");
      }
      setJobStatus("completed");
      setReloadKey((key) => key + 1);
    } catch (error) {
      setJobStatus("failed");
      setJobError(error);
    }
  }

  if (reports.isLoading) return <LoadingState label="正在读取周报..." />;
  if (reports.error) return <ErrorState error={reports.error} label="周报读取失败" onRetry={() => setReloadKey((k) => k + 1)} />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-ink">周报与打印</h2>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-ink">生成本自然周学习周报</p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={jobStatus === "pending" || jobStatus === "running"}
            className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {jobStatus === "pending" ? "提交中..." : jobStatus === "running" ? "生成中..." : "生成周报"}
          </button>
          {jobStatus === "completed" && <SavedState label="周报已保存" />}
          {jobStatus === "failed" && jobError && <ErrorState error={jobError} label="周报生成失败" onRetry={handleGenerate} />}
        </div>
      </section>
      {reports.data?.reports?.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-2">
            {reports.data.reports.map((report) => (
              <button
                key={report.weekly_report_id}
                type="button"
                onClick={() => setSelectedReportId(report.weekly_report_id)}
                className={[
                  "w-full rounded-xl border px-3 py-2 text-left text-sm",
                  report.weekly_report_id === selectedId
                    ? "border-aurora/40 bg-aurora/10"
                    : "border-slate-200 bg-white hover:border-aurora/25",
                ].join(" ")}
              >
                <span className="font-semibold">{report.title}</span>
                <span className="block truncate text-xs text-slate-500">{report.summary}</span>
              </button>
            ))}
          </div>
          <div>
            {detail.isLoading ? (
              <LoadingState label="正在读取周报详情..." />
            ) : detail.error ? (
              <ErrorState error={detail.error} label="周报详情读取失败" onRetry={() => setReloadKey((k) => k + 1)} />
            ) : detail.data ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700">
                <h3 className="font-semibold text-ink">{detail.data.week?.title ?? detail.data.weekly_report_id}</h3>
                <p className="mt-2 whitespace-pre-wrap">{detail.data.analysis?.overall_summary ?? "暂无周报摘要"}</p>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="mt-4 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white"
                >
                  打印周报
                </button>
              </div>
            ) : (
              <EmptyState label="请选择一份周报" />
            )}
          </div>
        </div>
      ) : (
        <EmptyState label="暂无周报" />
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/85 p-4 shadow-sm">
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

export default function AppApp() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/app/overview" replace />} />
        <Route path="overview" element={<OverviewView />} />
        <Route path="import" element={<ImportView />} />
        <Route path="analysis" element={<AnalysisView />} />
        <Route path="report" element={<ReportView />} />
        <Route path="*" element={<AppNotFound />} />
      </Route>
    </Routes>
  );
}
