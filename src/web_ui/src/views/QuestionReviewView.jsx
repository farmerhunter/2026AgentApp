export default function QuestionReviewView() {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">重点题确认</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            这里是后续 #7 的基础容器：左侧展示原图和题目框，右侧展示题目列表、选择状态和人工确认表单。
          </p>
        </div>
        <span className="w-fit rounded-full bg-berry/10 px-3 py-1 text-xs font-semibold text-berry">
          Placeholder
        </span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
        <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-aurora/30 bg-aurora/5 p-6 text-center text-sm leading-6 text-slate-500">
          原图预览和题目框叠加区域
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-sm font-semibold text-ink">题目确认表单</p>
          <div className="mt-3 space-y-2 text-sm text-slate-500">
            <p>选择状态：等待接入切题结果</p>
            <p>字段：得分 / 满分 / 知识点 / 错因 / 备注 / 优先级</p>
          </div>
        </div>
      </div>
    </section>
  );
}
