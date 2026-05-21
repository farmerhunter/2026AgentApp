import { useState, useEffect, useCallback } from "react";
import {
  getHermesExecutionMode,
  getDefaultHermesExecutionMode,
  isHermesModeSwitchEnabled,
  setHermesExecutionMode,
  clearHermesExecutionModeOverride,
  subscribeHermesExecutionMode,
} from "../lib/hermesExecutionMode.js";

const MODE_LABELS = {
  static: "静态演示",
  api: "API 实时",
};

export default function HermesModeSwitch() {
  const enabled = isHermesModeSwitchEnabled();
  const defaultMode = getDefaultHermesExecutionMode();
  const [mode, setMode] = useState(getHermesExecutionMode);

  useEffect(() => {
    return subscribeHermesExecutionMode(() => {
      setMode(getHermesExecutionMode());
    });
  }, []);

  const handleChange = useCallback((next) => {
    setHermesExecutionMode(next);
  }, []);

  const handleReset = useCallback(() => {
    clearHermesExecutionModeOverride();
  }, []);

  if (!enabled) return null;

  const isOverridden = mode !== defaultMode;

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[10px] font-semibold text-slate-400">Hermes</span>
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
        {["static", "api"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleChange(m)}
            className={[
              "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
              mode === m
                ? "bg-ink text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50",
            ].join(" ")}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
      {isOverridden && (
        <button
          type="button"
          onClick={handleReset}
          className="text-[10px] text-slate-400 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-600"
        >
          恢复默认
        </button>
      )}
    </div>
  );
}
