import { Link } from "react-router-dom";

export default function AppApp() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-20 text-slate-800">
      <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-aurora">学途智伴</p>
        <h1 className="mt-3 text-2xl font-bold">真实功能暂时停止开放</h1>
        <p className="mt-5 leading-relaxed">上传、识别、分析和周报已暂停，已有结果的在线查看与打印也暂时不可用。</p>
        <p className="mt-3 leading-relaxed">原有数据保留。公开演示仍可使用，演示内容不会调用真实服务。</p>
        <Link className="mt-6 inline-block rounded-lg bg-aurora px-5 py-3 font-semibold text-white" to="/demo">查看公开演示</Link>
      </section>
    </main>
  );
}
