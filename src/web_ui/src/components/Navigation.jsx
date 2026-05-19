import { navigationItems } from "../lib/demoData.js";

export default function Navigation({ activeView, onViewChange }) {
  return (
    <nav className="rounded-2xl border border-white/80 bg-white/82 p-3 shadow-soft backdrop-blur-xl lg:sticky lg:top-6 lg:h-fit">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        {navigationItems.map((item) => {
          const isActive = item.id === activeView;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={[
                "group min-h-20 rounded-xl border px-4 py-3 text-left transition",
                "focus:outline-none focus:ring-2 focus:ring-aurora/40",
                isActive
                  ? "border-aurora/40 bg-gradient-to-br from-aurora/12 to-white shadow-sm"
                  : "border-slate-200/70 bg-white/70 hover:border-aurora/25 hover:bg-aurora/5",
              ].join(" ")}
            >
              <span className="block text-sm font-semibold text-ink">
                {item.label}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                {item.description}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
