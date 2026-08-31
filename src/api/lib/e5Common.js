import { randomBytes } from "node:crypto";

export function nowIso() {
  return new Date().toISOString();
}

export function timestampId(prefix, length = 15) {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, length);
  return `${prefix}_${ts}_${randomBytes(3).toString("hex")}`;
}

export function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function isTerminalStatus(status) {
  return ["completed", "failed", "timeout"].includes(status);
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfNaturalWeek(date = new Date()) {
  const value = new Date(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() + diff);
  return value;
}

export function endOfNaturalWeek(date = new Date()) {
  const start = startOfNaturalWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function compactStderr(text, maxLength = 500) {
  if (!text) return "";
  const clean = String(text).replace(/\u001b\[[0-9;]*m/g, "").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength)}...`;
}
