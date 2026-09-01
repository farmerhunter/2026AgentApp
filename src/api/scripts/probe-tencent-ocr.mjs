#!/usr/bin/env node

/**
 * Minimal real QuestionSplitOCR signed probe.
 *
 * Usage:
 *   node scripts/probe-tencent-ocr.mjs --image <path> --use-new-model false --out <sanitized-output.json>
 *
 * Writes sanitized metadata only; never writes raw response, ImageBase64, full OCR text,
 * secret values or complete response body.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { callTencentQuestionSplitOcr } from "../lib/ocrAdapter.js";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const imagePath = arg("--image");
  const useNewModel = arg("--use-new-model", "false") === "true";
  const outPath = arg("--out");
  if (!imagePath) fail("--image is required");

  const buffer = readFileSync(resolve(process.cwd(), imagePath));
  const normalized = await callTencentQuestionSplitOcr(buffer, { useNewModel });
  const output = {
    provider: normalized.provider,
    request_id: normalized.request_id,
    use_new_model: normalized.use_new_model,
    image_width: normalized.image_width,
    image_height: normalized.image_height,
    question_count: normalized.questions.length,
    questions: normalized.questions.map((question) => ({
      question_index: question.question_index,
      question_text_length: question.question_text?.length ?? 0,
      student_answer_text_length: question.student_answer_text?.length ?? 0,
      bbox: question.bbox,
    })),
  };

  if (outPath) {
    writeFileSync(resolve(process.cwd(), outPath), JSON.stringify(output, null, 2));
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

main().catch((error) => {
  console.error(`probe_failed: ${error.message}`);
  process.exit(1);
});
