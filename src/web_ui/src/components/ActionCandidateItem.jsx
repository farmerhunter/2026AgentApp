const ACTION_TYPE_LABELS = {
  redo_question: "重做错题",
  review_concept: "复习概念",
  read_textbook_section: "回看教材章节",
  make_summary: "整理笔记",
  practice_set: "做专项练习",
  ask_for_help: "向老师/家长/智能体追问",
  check_again: "下次复查",
};

const PRIORITY_DOT = {
  高: "bg-red-400",
  中: "bg-amber-400",
  低: "bg-slate-300",
};

export default function ActionCandidateItem({ candidate }) {
  const typeLabel = ACTION_TYPE_LABELS[candidate.action_type] ?? candidate.action_type;
  const dotClass = PRIORITY_DOT[candidate.priority] ?? PRIORITY_DOT.低;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
      <span className={`mt-1.5 inline-block h-1.5 w-1.5 rounded-full ${dotClass} shrink-0`} />
      <div className="flex-1">
        <p className="text-sm text-ink">{candidate.description}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
          <span>{typeLabel}</span>
          <span>·</span>
          <span>优先级：{candidate.priority}</span>
          {candidate.target_week && (
            <>
              <span>·</span>
              <span>{candidate.target_week}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
