import { useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../components/DataState.jsx";
import SubjectFilter, {
  matchesSubject,
} from "../components/SubjectFilter.jsx";
import JobTrigger from "../components/JobTrigger.jsx";
import { fetchTextbookSummary } from "../lib/api.js";
import { runHermesJob } from "../lib/hermesJobs.js";
import { defaultSubjects, demoTextbookIds } from "../lib/demoData.js";
import useAsyncData from "../lib/useAsyncData.js";

const ANALYSIS_STATES = {
  idle: { label: "待上传", color: "text-slate-400", bg: "bg-slate-100" },
  selected: { label: "已选择文件", color: "text-blue-600", bg: "bg-blue-50" },
  pending: { label: "等待中", color: "text-slate-400", bg: "bg-slate-100" },
  running: { label: "分析中", color: "text-amber-600", bg: "bg-amber-50" },
  completed: { label: "已完成", color: "text-emerald-600", bg: "bg-emerald-50" },
  failed: { label: "失败", color: "text-red-600", bg: "bg-red-50" },
};

export default function LearningContentView() {
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [analysisState, setAnalysisState] = useState("idle");
  const [analysisError, setAnalysisError] = useState("");
  const [formSubject, setFormSubject] = useState("math");
  const [grade, setGrade] = useState("八年级");
  const [sourceTitle, setSourceTitle] = useState("");
  const [pageRange, setPageRange] = useState("");

  const { data, error, isLoading } = useAsyncData(() =>
    Promise.all(demoTextbookIds.map((textbookId) => fetchTextbookSummary(textbookId))),
  );
  const textbooks = data ?? [];
  const filteredTextbooks = textbooks.filter((textbook) =>
    matchesSubject(textbook, selectedSubject),
  );
  const chapterUnits = filteredTextbooks.flatMap((textbook) =>
    textbook.chapters.flatMap((chapter) =>
      chapter.learning_units.map((unit) => ({
        textbook,
        chapter,
        unit,
      })),
    ),
  );

  const handleAnalyze = async () => {
    setAnalysisState("pending");
    setAnalysisError("");

    try {
      const final = await runHermesJob(
        {
          job_type: "textbook_summary",
          textbook_id: formSubject === "chinese" ? "textbook_chinese_grade8_demo" : "textbook_math_grade8_demo",
        },
        {
          onUpdate: (s) => setAnalysisState(s.status),
        },
      );

      if (final.status === "completed") {
        setAnalysisState("completed");
      } else {
        setAnalysisState("failed");
        setAnalysisError("任务未能完成");
      }
    } catch (err) {
      setAnalysisState("failed");
      setAnalysisError(err.message);
    }
  };

  const handleFileSelect = () => {
    setAnalysisState("selected");
  };

  const stateStyle = ANALYSIS_STATES[analysisState] || ANALYSIS_STATES.idle;

  return (
    <div className="space-y-5">
      <section className="aurora-panel rounded-2xl border border-white/80 bg-white/86 p-5 shadow-soft backdrop-blur-xl">
        <h2 className="mt-2 text-2xl font-bold text-ink">学习内容理解</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          上传课本 PDF 或教材摘要后，Hermes 建立章节、知识点和学习单元理解，用于后续比对作业、试卷和备注中的学习进度。
        </p>
        <SubjectFilter
          value={selectedSubject}
          onChange={setSelectedSubject}
          subjects={defaultSubjects}
          className="mt-4"
        />
      </section>

      {/* Upload / Analyze Section */}
      <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-ink">上传课本 PDF</h3>
          <p className="mt-1 text-sm text-slate-500">
            选择课本 PDF 文件，填写学科和年级信息后开始分析。
          </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-ink">学科</label>
            <select
              value={formSubject}
              onChange={(e) => setFormSubject(e.target.value)}
              disabled={analysisState === "pending" || analysisState === "running"}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-aurora focus:ring-4 focus:ring-aurora/10 disabled:opacity-50"
            >
              <option value="chinese">语文</option>
              <option value="math">数学</option>
              <option value="english">英语</option>
            </select>

            <label className="block text-sm font-semibold text-ink">年级</label>
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              disabled={analysisState === "pending" || analysisState === "running"}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-aurora focus:ring-4 focus:ring-aurora/10 disabled:opacity-50"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-ink">资料标题</label>
            <input
              type="text"
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              placeholder="例如：八年级数学下册示例教材"
              disabled={analysisState === "pending" || analysisState === "running"}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-aurora focus:ring-4 focus:ring-aurora/10 disabled:opacity-50"
            />

            <label className="block text-sm font-semibold text-ink">页码范围或章节范围</label>
            <input
              type="text"
              value={pageRange}
              onChange={(e) => setPageRange(e.target.value)}
              placeholder="例如：42-58"
              disabled={analysisState === "pending" || analysisState === "running"}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-aurora focus:ring-4 focus:ring-aurora/10 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <button
                type="button"
                onClick={handleFileSelect}
                disabled={analysisState === "pending" || analysisState === "running"}
                className="font-semibold text-aurora underline decoration-aurora/30 underline-offset-2 transition hover:text-ink disabled:opacity-50 disabled:no-underline"
              >
                选择 PDF 文件
              </button>
              <span className="ml-2">
                {analysisState === "idle" ? "未选择文件" : "示例教材文件"}
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${stateStyle.color} ${stateStyle.bg}`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  analysisState === "running" ? "animate-pulse bg-amber-500" : "bg-current"
                }`}
              />
              {stateStyle.label}
            </span>
          </div>

          <div className="flex gap-3">
            {analysisState === "completed" && (
              <button
                type="button"
                onClick={() => {
                  setAnalysisState("idle");
                  setSourceTitle("");
                  setPageRange("");
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                重新上传
              </button>
            )}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analysisState === "pending" || analysisState === "running" || analysisState === "idle"}
              className="rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-aurora disabled:cursor-not-allowed disabled:opacity-40"
            >
              {analysisState === "running" || analysisState === "pending" ? "分析中..." : "分析教材"}
            </button>
          </div>
        </div>

        {(analysisState === "running" || analysisState === "pending") && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            <p className="font-semibold">Hermes 正在分析教材…</p>
            <p className="mt-1 text-amber-600">
              正在提取章节结构、学习单元和知识点…
            </p>
          </div>
        )}

        {analysisState === "completed" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              <p className="font-semibold">分析完成 ✓</p>
              <p className="mt-1 text-emerald-600">
                教材摘要已生成。下方展示 {formSubject === "chinese" ? "语文" : formSubject === "math" ? "数学" : "英语"} 学科的教材摘要。
              </p>
            </div>
            <JobTrigger
              jobType="textbook_summary"
              payload={{ textbook_id: formSubject === "chinese" ? "textbook_chinese_grade8_demo" : "textbook_math_grade8_demo" }}
              label="触发 Hermes 教材分析"
            />
          </div>
        )}

        {analysisState === "failed" && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">分析失败</p>
            <p className="mt-1">{analysisError || "请重试或检查 PDF 文件是否可读。"}</p>
          </div>
        )}
      </section>

      {isLoading && <LoadingState label="正在读取教材理解数据..." />}
      {error && <ErrorState error={error} label="教材理解数据读取失败" />}
      {!isLoading && !error && chapterUnits.length === 0 && (
        <EmptyState label="暂无教材理解数据" />
      )}
      <section className="grid gap-4 lg:grid-cols-3">
        {chapterUnits.map(({ textbook, chapter, unit }) => (
          <article
            key={unit.unit_id}
            className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {textbook.subject_label} · {chapter.chapter_title}
            </p>
            <h3 className="mt-3 text-lg font-semibold text-ink">{unit.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {unit.knowledge_points.map((point) => point.name).join(" / ")}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
