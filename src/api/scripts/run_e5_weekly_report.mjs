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
  const firstEvidence = context.evidence_catalog[0];

  return {
    contract: "weekly_learning_report",
    contract_version: "2.0",
    overview: {
      headline: "本周学习记录已整理",
      summary: "当前为本地测试模式，重点验证新版周报的结构、证据关联、保存和页面展示是否完整。",
    },
    key_insights: [
      {
        type: "needs_attention",
        title: "核对本周错题分析",
        summary: "测试数据已经形成可追溯的错题分析，真实学习结论需要在正式 Hermes 模式下重新生成。",
        why_it_matters: "先确认数据和页面链路可靠，再进行真实内容验收。",
        limitation: "测试模式不代表真实模型结论。",
        evidence_refs: [firstEvidence.evidence_ref],
      },
    ],
    watch_item: null,
    next_actions: [
      {
        title: "生成真实学习周报",
        steps: ["切换到正式 Hermes 模式", "重新生成并核对重点结论"],
        success_check: "确认结论能够追溯到本周实际题目。",
        reason: "当前为本地 fixture 测试结果。",
        evidence_refs: [firstEvidence.evidence_ref],
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
        contract_version: "2.0",
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
            extraArgs: ["--reasoning", "low"],
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
      skill_version: "2.0",
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
      skillVersion: "2.0",
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
