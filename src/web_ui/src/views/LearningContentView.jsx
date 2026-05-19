import { EmptyState, ErrorState, LoadingState } from "../components/DataState.jsx";
import { fetchTextbookSummary } from "../lib/api.js";
import useAsyncData from "../lib/useAsyncData.js";

const DEMO_TEXTBOOK_ID = "textbook_math_grade8_demo";

export default function LearningContentView() {
  const { data, error, isLoading } = useAsyncData(() =>
    fetchTextbookSummary(DEMO_TEXTBOOK_ID),
  );
  const chapters = data?.chapters ?? [];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-soft backdrop-blur-xl">
        <p className="text-sm font-semibold text-aurora">用例 1</p>
        <h2 className="mt-2 text-2xl font-bold text-ink">学习内容理解</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          上传课本 PDF 或教材摘要后，Hermes 建立章节、知识点和学习单元理解，用于后续比对作业、试卷和备注中的学习进度。
        </p>
      </section>

      {isLoading && <LoadingState label="正在读取教材理解数据..." />}
      {error && <ErrorState error={error} label="教材理解数据读取失败" />}
      {!isLoading && !error && chapters.length === 0 && (
        <EmptyState label="暂无教材理解数据" />
      )}
      <section className="grid gap-4 lg:grid-cols-3">
        {chapters.flatMap((chapter) =>
          chapter.learning_units.map((unit) => (
            <article
              key={unit.unit_id}
              className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                {chapter.chapter_title}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-ink">
                {unit.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {unit.knowledge_points.map((point) => point.name).join(" / ")}
              </p>
            </article>
          )),
        )}
      </section>
    </div>
  );
}
