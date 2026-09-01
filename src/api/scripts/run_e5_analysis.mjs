#!/usr/bin/env node

import { resolve } from "node:path";
import { runHermesSkill } from "../lib/hermesBridge.js";
import { getAnalysisContext } from "../lib/e5Context.js";
import {
  REPO_ROOT,
  RUNTIME_PUBLIC,
  effectiveMode,
  finishFailure,
  finishSuccess,
  isFixtureAllowed,
  parseArgs,
  writePublicResult,
  writeStatus,
} from "../lib/e5JobRuntime.js";
import { nowIso } from "../lib/e5Common.js";
import { saveAnalysisResult, validateAnalysisOutput } from "../lib/e5Store.js";

const JOB_TYPE = "confirmed_mistake_analysis";
const SKILL_NAME = "confirmed-mistake-analysis";
const SKILL_PATH = resolve(REPO_ROOT, "src", "skills", "confirmed_mistake_analysis.skill.md");

function fixtureAnalysis(context) {
  const findings = context.questions.map((question) => ({
    question_id: question.question_id,
    scope: "local",
    finding_type: question.student_answer_text ? "procedure_gap" : "unknown",
    statement: question.student_answer_text
      ? `本题需要先说明正确数学关系，再对照“${question.student_answer_text}”定位可观察的步骤问题；当前为 fixture 结果，仅用于本地边界测试。`
      : "当前只有题干、没有可核验的完整作答步骤，错因保留为证据不足；fixture 结果仅用于本地边界测试。",
    evidence_summary: question.student_answer_text
      ? `作答：${question.student_answer_text}${question.note ? `；备注：${question.note}` : ""}`
      : question.note
        ? `备注：${question.note}`
        : "无可用作答步骤。",
    mistake_reasons: question.student_answer_text ? ["procedure_gap"] : ["unknown"],
    confidence: question.student_answer_text ? "medium" : "low",
    is_recurring: false,
    source_memory_ids: [],
    concept_links: question.knowledge_point_ids.slice(0, 2).map((id) => ({
      concept_id: id,
      concept_name: id,
      relationship: "直接相关",
      confidence: "medium",
    })),
    action_candidates: [
      {
        action_type: "check_again",
        description: "核对本题正确数学关系，并在下一次同类题中检查对应步骤。",
        priority: "medium",
      },
    ],
    memory_candidates: [
      {
        statement: `在“${question.question_text}”中保留当前可观察的步骤证据；fixture 候选不作为真实记忆。`,
        reason: "本地 fixture 候选，仅验证保存与接受/拒绝链路。",
        candidate_type: "short_term",
        priority: "medium",
        review_status: "pending",
      },
    ],
  }));

  return {
    contract: "confirmed_mistake_analysis",
    contract_version: "1.0",
    upload_id: context.upload_id,
    findings,
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

    if (!args.uploadId) {
      throw new Error("--upload-id is required for confirmed_mistake_analysis");
    }

    const context = getAnalysisContext(args.uploadId);

    if (mode === "real-required") {
      throw new Error(
        "E5 analysis requires HERMES_JOB_MODE=real or explicit HERMES_E5_TEST_MODE=fixture",
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
        : { ok: true, result: fixtureAnalysis(context), skill_sha256: null };

    if (!raw.ok) {
      const error = new Error(raw.message ?? "Hermes analysis failed");
      error.code = raw.code ?? "HERMES_ANALYSIS_FAILED";
      error.diagnostics_path = raw.diagnostics_path ?? null;
      throw error;
    }

    const fixtureDelayMs = Number(process.env.HERMES_E5_FIXTURE_DELAY_MS ?? 0);
    if (fixtureDelayMs > 0) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, fixtureDelayMs));
    }

    const normalized = validateAnalysisOutput(raw.result, context);
    const saved = saveAnalysisResult(normalized, context, {
      generated_by: "confirmed-mistake-analysis",
      skill_version: "e5-wip-0.1",
      skill_sha256: raw.skill_sha256,
    });

    const output = {
      ...normalized,
      finding_batch_id: saved.finding_batch_id,
      finding_count: saved.finding_count,
      generated_at: nowIso(),
    };
    const resultPath = writePublicResult(
      `e5/analysis/${saved.finding_batch_id}.json`,
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
      errorMessage: error.message ?? "E5 analysis failed",
    });
  }
}

await main();
