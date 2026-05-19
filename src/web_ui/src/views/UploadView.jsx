import { recentUploads } from "../lib/demoData.js";

export default function UploadView() {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">上传材料</h3>
          <p className="text-sm text-slate-500">后续会接入上传和切题结果。</p>
        </div>
        <button className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-aurora">
          添加材料
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        {recentUploads.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.subject} · {item.type} · {item.date}
                </p>
              </div>
              <span className="w-fit rounded-full bg-aurora/10 px-3 py-1 text-xs font-semibold text-aurora">
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
