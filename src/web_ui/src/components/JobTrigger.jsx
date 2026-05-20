import { useState, useEffect, useRef } from "react";
import { isApiAvailable, createHermesJob, pollHermesJob, fetchHermesJob } from "../lib/api.js";

const STATUS_STYLES = {
  pending: { label: "等待中", color: "text-slate-400", bg: "bg-slate-100", dot: "bg-slate-400" },
  running: { label: "处理中", color: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-500 animate-pulse" },
  completed: { label: "已完成", color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  failed: { label: "失败", color: "text-red-600", bg: "bg-red-50", dot: "bg-red-500" },
  timeout: { label: "超时", color: "text-red-500", bg: "bg-red-50", dot: "bg-red-500" },
  unavailable: { label: "API 不可用", color: "text-slate-400", bg: "bg-slate-100", dot: "bg-slate-400" },
};

/**
 * JobTrigger — button + status display for Hermes job execution.
 *
 * Props:
 *   jobType        — "textbook_summary" | "learning_insight_update" | "weekly_report"
 *   payload        — job creation payload object
 *   label          — button label
 *   onComplete     — callback when job finishes successfully (receives job status)
 *   variant        — "primary" | "secondary" (button style)
 *   className      — additional classes
 */
export default function JobTrigger({
  jobType,
  payload,
  label = "触发任务",
  onComplete,
  variant = "secondary",
  className = "",
}) {
  const [status, setStatus] = useState("idle"); // idle | pending | running | completed | failed | unavailable
  const [jobId, setJobId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [apiAvailable, setApiAvailable] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    isApiAvailable().then((ok) => {
      if (mountedRef.current) setApiAvailable(ok);
    });
    return () => { mountedRef.current = false; };
  }, []);

  const handleTrigger = async () => {
    setStatus("pending");
    setErrorMsg("");

    try {
      const result = await createHermesJob({ job_type: jobType, ...payload });

      if (!result) {
        setStatus("unavailable");
        return;
      }

      setJobId(result.job_id);
      setStatus("running");

      await pollHermesJob(result.job_id, {
        timeoutMs: 300_000,
      });

      if (!mountedRef.current) return;

      // Re-fetch final status
      const final = await fetchHermesJob(result.job_id);

      if (!final) {
        setStatus("failed");
        setErrorMsg("无法获取最终状态");
        return;
      }

      if (final.status === "completed") {
        setStatus("completed");
        onComplete?.(final);
      } else {
        setStatus(final.status === "timeout" ? "timeout" : "failed");
        setErrorMsg(final.error_message ?? "任务未能完成");
      }
    } catch (err) {
      if (mountedRef.current) {
        setStatus("failed");
        setErrorMsg(err.message);
      }
    }
  };

  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const isBusy = status === "pending" || status === "running";
  const isDone = status === "completed";
  const isError = status === "failed" || status === "timeout";

  const btnClass = variant === "primary"
    ? "rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-aurora disabled:opacity-50"
    : "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50";

  if (apiAvailable === false) {
    return (
      <div className={`inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-400 ${className}`}>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
        Hermes API 未连接（使用 demo 数据）
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleTrigger}
        disabled={isBusy || isDone}
        className={btnClass}
      >
        {isBusy ? (status === "pending" ? "提交中..." : "处理中...") : isDone ? "已完成 ✓" : label}
      </button>

      {status !== "idle" && (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style.color} ${style.bg}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
      )}

      {isError && errorMsg && (
        <span className="text-xs text-red-500">{errorMsg}</span>
      )}
    </div>
  );
}
