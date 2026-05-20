import { useState } from "react";
import { ErrorState, LoadingState } from "../components/DataState.jsx";
import SubjectFilter, {
  matchesSubject,
} from "../components/SubjectFilter.jsx";
import { fetchTextNote } from "../lib/api.js";
import { defaultSubjects, demoNoteIds } from "../lib/demoData.js";
import useAsyncData from "../lib/useAsyncData.js";

export default function TextNoteView() {
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [draftSubject, setDraftSubject] = useState("math");
  const { data, error, isLoading } = useAsyncData(() =>
    Promise.all(demoNoteIds.map((noteId) => fetchTextNote(noteId))),
  );
  const notes = data ?? [];
  const filteredNotes = notes.filter((note) => matchesSubject(note, selectedSubject));

  return (
    <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-soft backdrop-blur-xl">
      <p className="text-sm font-semibold text-aurora">用例 3</p>
      <h2 className="mt-2 text-2xl font-bold text-ink">输入备注</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
        记录课堂提醒、自己不理解的知识点、复习备注或临时问题。后续这些文字会和课本章节、学习成果、重点题一起进入
        Hermes 分析。
      </p>
      <SubjectFilter
        value={selectedSubject}
        onChange={setSelectedSubject}
        subjects={defaultSubjects}
        className="mt-4"
      />
      <div className="mt-5">
        {isLoading && <LoadingState label="正在读取备注样例..." />}
        {error && <ErrorState error={error} label="备注样例读取失败" />}
        {data && filteredNotes.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
            当前学科暂无备注样例。
          </div>
        )}
        {filteredNotes.map((note) => (
          <div
            key={note.note_id}
            className="mb-3 rounded-xl border border-aurora/20 bg-aurora/5 p-4 text-sm leading-6 text-slate-600"
          >
            <p className="font-semibold text-ink">已读取备注样例</p>
            <p className="mt-2">{note.content}</p>
            <p className="mt-2 text-xs text-slate-500">
              {note.subject_label} · {note.note_type} · {note.student_confidence}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-ink" htmlFor="note-subject">
            备注学科
          </label>
          <select
            id="note-subject"
            value={draftSubject}
            onChange={(event) => setDraftSubject(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-aurora focus:ring-4 focus:ring-aurora/10"
          >
            <option value="chinese">语文</option>
            <option value="math">数学</option>
            <option value="english">英语</option>
          </select>
          <textarea
            className="min-h-48 w-full resize-y rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 outline-none transition placeholder:text-slate-400 focus:border-aurora focus:ring-4 focus:ring-aurora/10"
            placeholder="例如：今天老师提醒阅读题要先判断中心论点，再说明论据作用。"
          />
          <button className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-aurora">
            保存备注
          </button>
        </div>
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
