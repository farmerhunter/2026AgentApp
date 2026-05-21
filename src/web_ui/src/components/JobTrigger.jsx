import { useState, useRef } from "react";
import { runHermesJob } from "../lib/hermesJobs.js";
import { getHermesExecutionMode } from "../lib/hermesExecutionMode.js";

const STATUS_STYLES = {
  pending: { label: "等待中", color: "text-slate-400", bg: "bg-slate-100", dot: "bg-slate-400" },
  running: { label: "处理中", color: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-500 animate-pulse" },
  completed: { label: "已完成", color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  failed: { label: "失败", color: "text-red-600", bg: "bg-red-50", dot: "bg-red-500" },
};

/**
 * JobTrigger — unified button + status display for Hermes job execution.
 *
 * Works in both static and api mode via runHermesJob().
 *
 * Props:
 *   jobType        — "textbook_summary" | "learning_insight_update" | "weekly_report"
 *   payload        — job creation payload object
 *   label          — button label
 *   onComplete     — callback when job finishes successfully (receives final result object)
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
  const [status, setStatus] = useState("idle"); // idle | pending | running | completed | failed
  const [errorMsg, setErrorMsg] = useState("");
  const mountedRef = useRef(true);
  const abortRef = useRef(null);

  const handleTrigger = async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("pending");
    setErrorMsg("");

    try {
      const final = await runHermesJob(
        { job_type: jobType, ...payload },
        {
          onUpdate: (s) => {
            if (mountedRef.current) setStatus(s.status);
          },
          signal: controller.signal,
        },
      );

      if (!mountedRef.current) return;

      if (final.status === "completed") {
        setStatus("completed");
        onComplete?.(final);
      } else {
        setStatus("failed");
        setErrorMsg("任务未能完成");
      }
    } catch (err) {
      if (mountedRef.current) {
        if (err.name === "AbortError") return;
        setStatus("failed");
        setErrorMsg(err.message);
      }
    }
  };

  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const isBusy = status === "pending" || status === "running";
  const isDone = status === "completed";
  const isError = status === "failed";
  const isStatic = getHermesExecutionMode() === "static";

  const btnClass = variant === "primary"
    ? "rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-aurora disabled:opacity-50"
    : "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50";

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
