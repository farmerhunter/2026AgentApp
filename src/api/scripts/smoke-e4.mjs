#!/usr/bin/env node

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, rmSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_DIR = resolve(__dirname, "..");
const PRIVATE_DIR = resolve(API_DIR, `e4_smoke_private_${Date.now()}`);
const DB_PATH = resolve(API_DIR, `e4_smoke_${Date.now()}.db`).replaceAll("\\", "/");
const DATABASE_URL = `sqlite:///${DB_PATH}`;
const PORT = 8125;
const BASE_URL = `http://127.0.0.1:${PORT}`;

let server = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
}

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // not ready
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("API did not become healthy before timeout");
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

async function waitForOcr(uploadId, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await jsonRequest(`/api/uploads/${uploadId}/ocr`);
    if (result.status === 200 && ["succeeded", "failed", "interrupted"].includes(result.body.status)) {
      return result.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("OCR job did not reach terminal state");
}

function startServer() {
  mkdirSync(PRIVATE_DIR, { recursive: true });
  server = spawn(process.execPath, ["server.js"], {
    cwd: API_DIR,
    env: {
      ...process.env,
      HERMES_API_PORT: String(PORT),
      HERMES_JOB_MODE: "fixture",
      OCR_PROVIDER_MODE: "fixture",
      HERMES_PRIVATE_UPLOADS_DIR: PRIVATE_DIR,
      DATABASE_URL,
    },
    stdio: "ignore",
  });
}

async function stopServer() {
  if (server) {
    const child = server;
    server = null;
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

function cleanup() {
  for (const suffix of ["", "-shm", "-wal"]) {
    const file = `${DB_PATH}${suffix}`;
    if (existsSync(file)) rmSync(file);
  }
  if (existsSync(PRIVATE_DIR)) rmSync(PRIVATE_DIR, { recursive: true, force: true });
}

async function main() {
  startServer();
  await waitForHealth();

  const form = new FormData();
  form.append("file", new Blob([pngBuffer()], { type: "image/png" }), "exercise.png");
  const upload = await jsonRequest("/api/uploads", { method: "POST", body: form });
  assert(upload.status === 202, `upload should be 202, got ${upload.status}`);
  const uploadId = upload.body.upload_id;

  const job = await waitForOcr(uploadId);
  assert(job.status === "succeeded", `OCR should succeed, got ${job.status}`);

  const split = await jsonRequest(`/api/sessions/${uploadId}/split`);
  assert(split.status === 200, `split should be 200, got ${split.status}`);
  assert(split.body.contract_version === "1.2", "split contract_version should be 1.2");
  assert(split.body.questions.length === 11, "fixture OCR should produce 11 questions");
  assert(split.body.questions[0].student_answer_text === "5√2", "student answer text mismatch");

  const image = await fetch(`${BASE_URL}/api/uploads/${uploadId}/image`);
  assert(image.status === 200, `image should be 200, got ${image.status}`);
  assert(image.headers.get("cache-control")?.includes("no-store"), "image should be no-store");

  const questionId = split.body.questions[0].question_id;
  const confirm = await jsonRequest(`/api/sessions/${uploadId}/confirmation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      confirmations: [{ question_id: questionId, selected: true, note: "fixture note" }],
    }),
  });
  assert(confirm.status === 200, `confirmation should be 200, got ${confirm.status}`);
  assert(confirm.body.contract_version === "1.2", "confirmation contract_version should be 1.2");
  assert(confirm.body.confirmations.length === 1, "confirmation length mismatch");

  const tooMany = await jsonRequest(`/api/sessions/${uploadId}/confirmation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      confirmations: split.body.questions.map((question) => ({
        question_id: question.question_id,
        selected: true,
      })),
    }),
  });
  assert(tooMany.status === 400, `>10 selected should be 400, got ${tooMany.status}`);
  const afterTooMany = await jsonRequest(`/api/sessions/${uploadId}/confirmation`);
  assert(afterTooMany.body.confirmations.length === 1, ">10 failure must not partially write");

  const malformedNote = await jsonRequest(`/api/sessions/${uploadId}/confirmation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmations: [{ question_id: questionId, selected: true, note: { bad: true } }] }),
  });
  assert(malformedNote.status === 400, `malformed note should be 400, got ${malformedNote.status}`);

  const unsupportedField = await jsonRequest(`/api/sessions/${uploadId}/confirmation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmations: [{ question_id: questionId, selected: true, knowledge_point_id: "kp_x" }] }),
  });
  assert(unsupportedField.status === 400, `unsupported field should be 400, got ${unsupportedField.status}`);

  const falseAnswer = await jsonRequest(`/api/sessions/${uploadId}/confirmation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmations: [{ question_id: questionId, selected: false, student_answer_text: "补录" }] }),
  });
  assert(falseAnswer.status === 400, `false with answer should be 400, got ${falseAnswer.status}`);

  const overwriteAnswer = await jsonRequest(`/api/sessions/${uploadId}/confirmation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmations: [{ question_id: questionId, selected: true, student_answer_text: "覆盖答案" }] }),
  });
  assert(overwriteAnswer.status === 400, `OCR answer overwrite should be 400, got ${overwriteAnswer.status}`);

  const duplicateItem = await jsonRequest(`/api/sessions/${uploadId}/confirmation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      confirmations: [
        { question_id: questionId, selected: true },
        { question_id: questionId, selected: true },
      ],
    }),
  });
  assert(duplicateItem.status === 400, `duplicate question should be 400, got ${duplicateItem.status}`);

  const unknownImage = await fetch(`${BASE_URL}/api/uploads/not_found/image`);
  assert(unknownImage.status === 404, `unknown image should be 404, got ${unknownImage.status}`);

  console.log("E4 upload/OCR/confirmation smoke passed");
}

try {
  await main();
} finally {
  await stopServer();
  cleanup();
}
