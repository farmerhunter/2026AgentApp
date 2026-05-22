import { useMemo, useState } from "react";
import UploadMaterialFlow from "../components/UploadMaterialFlow.jsx";
import SessionRow from "../components/SessionRow.jsx";
import { ErrorState, LoadingState } from "../components/DataState.jsx";
import SubjectFilter, { matchesSubject } from "../components/SubjectFilter.jsx";
import { fetchSessionIndex } from "../lib/api.js";
import { defaultSubjects, learningResultSteps } from "../lib/demoData.js";
import useAsyncData from "../lib/useAsyncData.js";

const INITIAL_SHOW = 5;

export default function LearningResultsView() {
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("list");
  const [showAll, setShowAll] = useState(false);

  const { data: index, error, isLoading } = useAsyncData(fetchSessionIndex);
  const sessions = index?.sessions ?? [];

  const filtered = useMemo(() => {
    let list = sessions;
    if (selectedSubject !== "all") {
      list = list.filter((s) => matchesSubject(s, selectedSubject));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => s.source_title?.toLowerCase().includes(q));
    }
    return list;
  }, [sessions, selectedSubject, search]);

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_SHOW);
  const hasMore = filtered.length > INITIAL_SHOW && !showAll;

  const stats = useMemo(() => {
    const total = sessions.length;
    const totalQ = sessions.reduce((sum, s) => sum + (s.question_count ?? 0), 0);
    const totalC = sessions.reduce((sum, s) => sum + (s.confirmed_count ?? 0), 0);
    const weekSessions = sessions.filter((s) => {
      const d = new Date(s.captured_at);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      return d >= weekAgo;
    });
    return {
      total,
      totalQ,
      totalC,
      weekUploads: weekSessions.length,
      weekQ: weekSessions.reduce((sum, s) => sum + (s.question_count ?? 0), 0),
      weekC: weekSessions.reduce((sum, s) => sum + (s.confirmed_count ?? 0), 0),
    };
  }, [sessions]);

  if (mode === "uploadFlow") {
    return <UploadMaterialFlow onCancel={() => setMode("list")} />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="aurora-panel rounded-2xl border border-white/80 bg-white/86 p-5 shadow-soft backdrop-blur-xl">
        <h2 className="mt-2 text-2xl font-bold leading-tight text-ink">学习成果整理</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          上传试卷、作业或练习册页面后，学途智伴会先展示切题结果，再进入重点题确认。
        </p>
        <SubjectFilter
          value={selectedSubject}
          onChange={setSelectedSubject}
          subjects={defaultSubjects}
          className="mt-4"
        />
        <div className="mt-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索材料标题..."
            className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-aurora focus:ring-4 focus:ring-aurora/10"
          />
        </div>
      </section>

      {/* Step cards */}
      <section className="grid gap-4 lg:grid-cols-3">
        {learningResultSteps.map((step) => (
          <article
            key={step.title}
            className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-aurora/10 text-sm font-bold text-aurora">
              {step.step}
            </div>
            <h3 className="text-base font-semibold text-ink">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
          </article>
        ))}
      </section>

      {/* Stats bar */}
      <section className="grid gap-3 sm:grid-cols-4">
        <StatBox label="本周上传" value={stats.weekUploads} />
        <StatBox label="本周切题" value={stats.weekQ} />
        <StatBox label="本周确认" value={stats.weekC} />
        <StatBox label="累计上传" value={stats.total} />
      </section>

      {/* Upload entry */}
      <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">添加材料</h3>
            <p className="text-sm text-slate-500">
              上传新的试卷、作业或错题本，进入材料信息、切题识别和重点题确认流程。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMode("uploadFlow")}
            className="rounded-xl bg-ink px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-aurora"
          >
            上传材料
          </button>
        </div>
      </section>

      {/* Session list */}
      {isLoading && <LoadingState label="正在读取学习成果列表..." />}
      {error && <ErrorState error={error} label="学习成果列表读取失败" />}
      {!isLoading && !error && filtered.length === 0 && (
        <section className="rounded-2xl border border-white/80 bg-white/86 p-5 text-sm text-slate-500">
          {search ? "没有匹配的材料" : "当前学科暂无学习成果材料。"}
        </section>
      )}
      {visible.length > 0 && (
        <div className="space-y-2">
          {visible.map((session) => (
            <SessionRow key={session.upload_id} session={session} />
          ))}
        </div>
      )}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
        >
          查看全部 {filtered.length} 条记录
        </button>
      )}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/86 p-4 text-center shadow-sm">
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
