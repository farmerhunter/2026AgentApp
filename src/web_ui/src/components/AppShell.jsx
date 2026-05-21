import Navigation from "./Navigation.jsx";
import HermesModeSwitch from "./HermesModeSwitch.jsx";
import { studentSnapshot } from "../lib/demoData.js";

export default function AppShell({ activeView, onViewChange, children }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f7fbff_0%,#eef8f5_46%,#fff8eb_100%)] text-ink">
      <header className="border-b border-white/70 bg-white/78 px-4 py-4 shadow-sm backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aurora">
              Hermes Web
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-ink sm:text-3xl">
              学途智伴
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <HermesModeSwitch />
            <span className="rounded-full border border-aurora/20 bg-aurora/10 px-3 py-1 font-medium text-aurora">
              {studentSnapshot.displayName}
            </span>
            <span className="rounded-full border border-sunrise/30 bg-sunrise/10 px-3 py-1 font-medium text-amber-700">
              {studentSnapshot.status}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-8">
        <div className="workspace-grid gap-5">
          <Navigation activeView={activeView} onViewChange={onViewChange} />
          <section className="min-w-0">{children}</section>
        </div>
      </main>
    </div>
  );
}
