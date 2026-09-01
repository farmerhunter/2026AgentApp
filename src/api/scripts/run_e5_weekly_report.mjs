#!/usr/bin/env node

import { resolve } from "node:path";
import { runHermesSkill } from "../lib/hermesBridge.js";
import {
  getWeeklyContext,
  hasUsableWeeklyData,
} from "../lib/e5Context.js";
import {
  REPO_ROOT,
  effectiveMode,
  finishFailure,
  finishSuccess,
  parseArgs,
  writePublicResult,
  writeStatus,
} from "../lib/e5JobRuntime.js";
import {
  endOfNaturalWeek,
  localDateString,
  nowIso,
  startOfNaturalWeek,
} from "../lib/e5Common.js";
import { saveWeeklyReport, validateWeeklyReportOutput } from "../lib/e5Store.js";

const JOB_TYPE = "weekly_learning_report";
const SKILL_NAME = "weekly-learning-report";
const SKILL_PATH = resolve(REPO_ROOT, "src", "skills", "weekly_learning_report.skill.md");

function fixtureWeeklyReport(context) {
  const questionIds = context.findings
    .map((finding) => finding.question?.question_id)
    .filter(Boolean);
  const findingIds = context.findings.map((finding) => finding.finding_id);

  return {
    contract: "weekly_learning_report",
    contract_version: "1.0",
    week: {
      start: context.week_start,
      end: context.week_end,
      title: `${context.week_start} 至 ${context.week_end} 学习周报`,
    },
    analysis: {
      overall_summary:
        "分析范围：本周已确认错题。主要问题：fixture 仅用于验证周报保存、展示与打印链路，不代表真实 Hermes 结论。可见变化与限制：当前没有真实 Skill 输出证据。下一步：接入真实 Hermes 后重新生成。",
    },
    evidence_links: [
      {
        claim: "本地 fixture 周报占位。",
        question_ids: questionIds,
        finding_ids: findingIds,
        memory_ids: [],
      },
    ],
    actions: [
      {
        description: "接入真实 Hermes Skill 后重新生成本周报告。",
        reason: "当前为本地 fixture 测试结果。",
        question_ids: questionIds,
      },
    ],
  };
}

async function main() {
  const jobId = process.env.JOB_ID ?? `job_${Date.now()}`;
  const mode = effectiveMode();
  const args = parseArgs(process.argv.slice(2));

  try {
    writeStatus(jobId, {
      job_type: JOB_TYPE,
      status: "running",
      mode,
      started_at: nowIso(),
    });

    const now = new Date();
    const weekStart = args.weekStart || localDateString(startOfNaturalWeek(now));
    const weekEnd = args.weekEnd || localDateString(endOfNaturalWeek(now));

    const context = getWeeklyContext({
      studentId: "student_demo",
      subject: "math",
      weekStart,
      weekEnd,
    });

    if (!hasUsableWeeklyData("student_demo", "math", weekStart, weekEnd)) {
      const output = {
        contract: "weekly_learning_report",
        contract_version: "1.0",
        status: "no_data",
        week_start: weekStart,
        week_end: weekEnd,
        message: "本周没有可用的分析数据，未调用 Hermes。",
      };
      const resultPath = writePublicResult(
        `e5/weekly/${jobId}.json`,
        output,
      );
      finishSuccess(jobId, {
        jobType: JOB_TYPE,
        mode,
        resultPath,
        outputJson: output,
        skillVersion: null,
        skillSha256: null,
      });
      return;
    }

    if (mode === "real-required") {
      throw new Error(
        "E5 weekly report requires HERMES_JOB_MODE=real or explicit HERMES_E5_TEST_MODE=fixture",
      );
    }

    const raw =
      mode === "real"
        ? await runHermesSkill({
            jobId,
            skillName: SKILL_NAME,
            skillPath: SKILL_PATH,
            request: context,
            timeoutMs: Number(process.env.HERMES_E5_TIMEOUT_MS ?? 180_000),
          })
        : { ok: true, result: fixtureWeeklyReport(context), skill_sha256: null };

    if (!raw.ok) {
      const error = new Error(raw.message ?? "Hermes weekly report failed");
      error.code = raw.code ?? "HERMES_WEEKLY_REPORT_FAILED";
      error.diagnostics_path = raw.diagnostics_path ?? null;
      throw error;
    }

    const normalized = validateWeeklyReportOutput(raw.result, context);
    const saved = saveWeeklyReport(normalized, context, {
      generated_by: "weekly-learning-report",
      skill_version: "e5-wip-0.1",
      skill_sha256: raw.skill_sha256,
    });

    const output = {
      ...normalized,
      weekly_report_id: saved.weekly_report_id,
      generated_at: nowIso(),
    };
    const resultPath = writePublicResult(
      `week_reports/${saved.weekly_report_id}.json`,
      output,
    );

    finishSuccess(jobId, {
      jobType: JOB_TYPE,
      mode,
      resultPath,
      outputJson: output,
      skillVersion: "e5-wip-0.1",
      skillSha256: raw.skill_sha256,
    });
  } catch (error) {
    finishFailure(jobId, {
      jobType: JOB_TYPE,
      mode,
      errorMessage: error.message ?? "E5 weekly report failed",
    });
  }
}

await main();
