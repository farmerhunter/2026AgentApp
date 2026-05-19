import { ErrorState, LoadingState } from "../components/DataState.jsx";
import { fetchTextNote } from "../lib/api.js";
import useAsyncData from "../lib/useAsyncData.js";

const DEMO_NOTE_ID = "note_20260518_001";

export default function TextNoteView() {
  const { data, error, isLoading } = useAsyncData(() =>
    fetchTextNote(DEMO_NOTE_ID),
  );

  return (
    <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-soft backdrop-blur-xl">
      <p className="text-sm font-semibold text-aurora">用例 3</p>
      <h2 className="mt-2 text-2xl font-bold text-ink">输入备注</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
        记录课堂提醒、自己不理解的知识点、复习备注或临时问题。后续这些文字会和课本章节、学习成果、重点题一起进入
        Hermes 分析。
      </p>
      <div className="mt-5">
        {isLoading && <LoadingState label="正在读取备注样例..." />}
        {error && <ErrorState error={error} label="备注样例读取失败" />}
        {data && (
          <div className="rounded-xl border border-aurora/20 bg-aurora/5 p-4 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-ink">已读取备注样例</p>
            <p className="mt-2">{data.content}</p>
            <p className="mt-2 text-xs text-slate-500">
              {data.subject} · {data.note_type} · {data.student_confidence}
            </p>
          </div>
        )}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <textarea
          className="min-h-48 resize-y rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 outline-none transition placeholder:text-slate-400 focus:border-aurora focus:ring-4 focus:ring-aurora/10"
          placeholder="例如：今天老师强调反比例函数图像所在象限，我还是容易把 k 的正负和象限对应关系记反。"
        />
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600">
          <p className="font-semibold text-ink">备注会用于</p>
          <ul className="mt-3 space-y-2">
            <li>关联教材章节</li>
            <li>补充重点题语义</li>
            <li>生成学习建议</li>
            <li>更新周报上下文</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
