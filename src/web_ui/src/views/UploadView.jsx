import { EmptyState } from "../components/DataState.jsx";

export default function UploadView({ uploadMeta }) {
  const files = uploadMeta?.original_files ?? [];
  const subjectLabel = uploadMeta?.subject_label ?? uploadMeta?.subject ?? "-";

  return (
    <section className="rounded-2xl border border-white/80 bg-white/86 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">{uploadMeta?.source_title || "已上传材料"}</h3>
          <p className="text-sm text-slate-500">
            {uploadMeta?.subject_label ?? uploadMeta?.subject ?? "-"} · {uploadMeta?.source_type ?? "-"}
          </p>
        </div>
        <button className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-aurora">
          上传材料
        </button>
      </div>

      {!uploadMeta && (
        <div className="mt-4">
          <EmptyState label="暂无上传记录" />
        </div>
      )}

      {uploadMeta && (
        <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{uploadMeta.source_title}</p>
              <p className="mt-1 text-sm text-slate-500">
                {subjectLabel} · {uploadMeta.source_type} ·{" "}
                {uploadMeta.captured_at}
              </p>
            </div>
            <span className="w-fit rounded-full bg-aurora/10 px-3 py-1 text-xs font-semibold text-aurora">
              {uploadMeta.ocr_status}
            </span>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-500">
            <p>上传编号：{uploadMeta.upload_id}</p>
            <p>学科：{subjectLabel}</p>
            <p>关联教材：{uploadMeta.related_textbook_id}</p>
            <p>文件数量：{files.length}</p>
          </div>
        </div>
      )}
    </section>
  );
}
