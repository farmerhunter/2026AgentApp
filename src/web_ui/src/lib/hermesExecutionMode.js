const STORAGE_KEY = "hermesExecutionMode";

const _listeners = new Set();

function _notify() {
  for (const fn of _listeners) {
    try {
      fn();
    } catch {}
  }
}

/**
 * Get the build-time default Hermes execution mode.
 */
export function getDefaultHermesExecutionMode() {
  return import.meta.env.VITE_HERMES_EXECUTION_MODE ?? "static";
}

/**
 * Check whether the web mode switch is enabled via build flag.
 */
export function isHermesModeSwitchEnabled() {
  return import.meta.env.VITE_ENABLE_HERMES_MODE_SWITCH === "true";
}

/**
 * Get the effective Hermes execution mode.
 *
 * Priority:
 *   localStorage override (only if switch is enabled)
 *   -> VITE_HERMES_EXECUTION_MODE
 *   -> "static"
 */
export function getHermesExecutionMode() {
  if (isHermesModeSwitchEnabled()) {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "static" || stored === "api") {
      return stored;
    }
  }
  return getDefaultHermesExecutionMode();
}

/**
 * Set the execution mode override in localStorage.
 */
export function setHermesExecutionMode(mode) {
  if (mode !== "static" && mode !== "api") {
    throw new Error(`Invalid mode: ${mode}`);
  }
  localStorage.setItem(STORAGE_KEY, mode);
  _notify();
}

/**
 * Clear the localStorage override, falling back to build default.
 */
export function clearHermesExecutionModeOverride() {
  localStorage.removeItem(STORAGE_KEY);
  _notify();
}

/**
 * Subscribe to mode changes. Returns an unsubscribe function.
 */
export function subscribeHermesExecutionMode(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
