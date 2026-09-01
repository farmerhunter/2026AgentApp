import { Router } from "express";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../db/init.js";

const router = Router();
const DEFAULT_STUDENT_ID = "student_demo";
const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DATA = resolve(__dirname, "..", "..", "..", "src", "web_ui", "public", "data");

const db = getDb();
db.defaultSafeIntegers(false);

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function subjectsForReport(reportId) {
  const indexPath = resolve(PUBLIC_DATA, "week_reports", "week_reports_index.json");
  const index = readJson(indexPath);
  const report = index?.reports?.find((item) => item.weekly_report_id === reportId);
  return report?.subjects ?? [];
}

function reportIndexDto(row) {
  return {
    weekly_report_id: row.weekly_report_id,
    week_start: row.week_start,
    week_end: row.week_end,
    title: row.title,
    summary: row.summary,
    subjects: subjectsForReport(row.weekly_report_id),
    report_url: row.report_json_url,
    status: row.status,
    published_at: row.published_at,
  };
}

router.get("/reports", (req, res) => {
  try {
    const studentId = String(req.query.student_id ?? DEFAULT_STUDENT_ID);
    const rows = db
      .prepare(
        `SELECT * FROM weekly_reports
         WHERE student_id = ?
         ORDER BY week_start DESC, weekly_report_id`
      )
      .all(studentId);

    res.json({
      contract: "week_reports_index",
      contract_version: "1.1",
      student_id: studentId,
      generated_at: new Date().toISOString(),
      reports: rows.map(reportIndexDto),
    });
  } catch (err) {
    console.error("GET /api/reports failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

router.get("/reports/:report_id", (req, res) => {
  try {
    const row = db
      .prepare("SELECT * FROM weekly_reports WHERE weekly_report_id = ?")
      .get(req.params.report_id);
    if (!row) {
      return res.status(404).json({
        error: "report_not_found",
        message: `Report ${req.params.report_id} not found`,
      });
    }

    if (row.report_json) {
      try {
        return res.json(JSON.parse(row.report_json));
      } catch (error) {
        console.error("GET /api/reports/:report_id stored report JSON failed:", error);
      }
    }

    const reportUrl = row.report_json_url;
    if (!reportUrl) {
      return res.status(404).json({ error: "report_content_not_found", message: "No report file" });
    }

    const fileName = basename(reportUrl);
    const reportPath = resolve(PUBLIC_DATA, "week_reports", fileName);
    const report = readJson(reportPath);
    if (!report) {
      return res.status(404).json({
        error: "report_file_not_found",
        message: `Report file ${fileName} not found`,
      });
    }

    res.json(report);
  } catch (err) {
    console.error("GET /api/reports/:report_id failed:", err);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

export default router;
