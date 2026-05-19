import { EmptyState } from "../components/DataState.jsx";

export default function QuestionReviewView({ splitResult, confirmationResult }) {
  const questions = splitResult?.questions ?? [];
  const confirmations = confirmationResult?.confirmations ?? [];
  const selectedConfirmations = confirmations.filter((item) => item.selected);

  return (
    <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">重点题确认</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            已读取切题结果和人工确认结果。后续 #7 会把这里扩展成可编辑确认工作台。
          </p>
        </div>
        <span className="w-fit rounded-full bg-berry/10 px-3 py-1 text-xs font-semibold text-berry">
          已选择 {selectedConfirmations.length} 题
        </span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
        <div className="min-h-64 rounded-xl border border-dashed border-aurora/30 bg-aurora/5 p-4">
          <p className="text-sm font-semibold text-ink">题目框预览</p>
          <p className="mt-1 text-xs text-slate-500">
            原图尺寸：{splitResult?.image_size?.width ?? "-"} x{" "}
            {splitResult?.image_size?.height ?? "-"}
          </p>
          <div className="mt-4 space-y-3">
            {questions.length === 0 && <EmptyState label="暂无切题结果" />}
            {questions.map((question) => (
              <div
                key={question.question_id}
                className="rounded-lg border border-aurora/20 bg-white/80 p-3 text-sm"
              >
                <p className="font-semibold text-aurora">
                  题目 {question.question_index}
                </p>
                <p className="mt-1 leading-6 text-slate-600">
                  {question.question_text}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  bbox: x {question.bbox.x}, y {question.bbox.y}, w{" "}
                  {question.bbox.width}, h {question.bbox.height}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-sm font-semibold text-ink">题目确认表单</p>
          <div className="mt-3 space-y-3 text-sm text-slate-500">
            {confirmations.length === 0 && <EmptyState label="暂无确认结果" />}
            {confirmations.map((item) => (
              <div
                key={item.question_id}
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{item.question_id}</p>
                  <span
                    className={[
                      "rounded-full px-2 py-1 text-xs font-semibold",
                      item.selected
                        ? "bg-aurora/10 text-aurora"
                        : "bg-slate-100 text-slate-500",
                    ].join(" ")}
                  >
                    {item.selected ? "已选重点题" : "未选"}
                  </span>
                </div>
                <p className="mt-2">状态：{item.student_mark}</p>
                <p>得分：{item.teacher_score} / {item.full_score}</p>
                <p>知识点：{item.knowledge_point}</p>
                <p>优先级：{item.review_priority}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
