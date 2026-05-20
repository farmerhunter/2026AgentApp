import { useState } from "react";
import { ErrorState, LoadingState } from "./DataState.jsx";
import QuestionReviewView from "../views/QuestionReviewView.jsx";
import { fetchQuestionSession } from "../lib/api.js";

export default function SessionRow({ session }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);

    if (detail) return; // already loaded

    setLoading(true);
    try {
      const [splitResult, confirmResult] = await Promise.all([
        fetchQuestionSession(session.upload_id, "question_split_result.json"),
        fetchQuestionSession(session.upload_id, "question_confirmation_result.json"),
      ]);
      setDetail({ splitResult, confirmResult });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white transition hover:border-slate-300">
      {/* Summary row */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={[
            "shrink-0 text-lg transition",
            expanded ? "rotate-90" : "",
          ].join(" ")}
        >
          ▸
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink truncate">
              {session.source_title}
            </span>
            <span className="text-xs text-slate-400">
              {session.subject_label} · {session.source_type} · {session.captured_at}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-aurora/10 px-2 py-0.5 font-semibold text-aurora">
              {session.ocr_status}
            </span>
            <span className="text-slate-500">
              {session.question_count} 题 · 已确认 {session.confirmed_count} 题
            </span>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          {loading && <LoadingState label="加载详情..." />}
          {error && <ErrorState error={error} label="详情加载失败" />}
          {detail && (
            <QuestionReviewView
              splitResult={detail.splitResult}
              confirmationResult={detail.confirmResult}
            />
          )}
        </div>
      )}
    </div>
  );
}
