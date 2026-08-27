#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(API_DIR, "..", "..");
const ARTIFACT = resolve(
  REPO_ROOT,
  "data",
  "knowledge_maps",
  "renjiao_math_grade8_v2",
  "1.0.0.json",
);
const FIXTURES_DIR = resolve(API_DIR, "tests", "fixtures");
const PORT = 8124;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = resolve(API_DIR, `e3_smoke_${Date.now()}.db`).replaceAll("\\", "/");
const DATABASE_URL = `sqlite:///${DB_PATH}`;

let server = null;
let db = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), "utf-8"));
}

function runPromote() {
  const result = spawnSync(process.execPath, ["scripts/promote-knowledge-map.mjs", ARTIFACT], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL },
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    throw new Error(`promote failed:\n${result.stdout || ""}\n${result.stderr || ""}`);
  }
}

function openDb() {
  const database = new Database(DB_PATH);
  database.defaultSafeIntegers(false);
  return database;
}

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("API did not become healthy before timeout");
}

async function jsonRequest(path) {
  const response = await fetch(`${BASE_URL}${path}`);
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

function startServer() {
  server = spawn(process.execPath, ["server.js"], {
    cwd: API_DIR,
    env: {
      ...process.env,
      HERMES_API_PORT: String(PORT),
      HERMES_JOB_MODE: "fixture",
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

function cleanupDbFiles() {
  for (const suffix of ["", "-shm", "-wal"]) {
    const file = `${DB_PATH}${suffix}`;
    if (existsSync(file)) unlinkSync(file);
  }
}

async function main() {
  runPromote();
  runPromote();

  db = openDb();
  const currentCount = db
    .prepare(`SELECT COUNT(*) AS count FROM knowledge_map_registry WHERE subject = 'math' AND status = 'current'`)
    .get().count;
  assert(currentCount === 1, `expected one current map, got ${currentCount}`);
  db.close();
  db = null;

  startServer();
  await waitForHealth();

  const current = await jsonRequest("/api/knowledge-map/current");
  assert(current.status === 200, `current should be 200, got ${current.status}`);
  assert(current.body.data.map_id === "renjiao_math_grade8_v2", "current map_id mismatch");
  assert(current.body.data.map_version === "1.0.0", "current map_version mismatch");
  assert(current.body.data.subject === "math", "current subject mismatch");
  assert(current.body.data.knowledge_point_count === 1, "current point count mismatch");

  const chapters = await jsonRequest("/api/knowledge-map/chapters");
  assert(chapters.status === 200, `chapters should be 200, got ${chapters.status}`);
  assert(chapters.body.data.chapters.length === 1, "chapters length mismatch");

  const points = await jsonRequest(
    "/api/knowledge-map/points?chapter_id=ch16_quadratic_radical&coverage=detailed",
  );
  assert(points.status === 200, `points should be 200, got ${points.status}`);
  assert(points.body.data.knowledge_points.length === 1, "points list length mismatch");

  const invalidFilter = await jsonRequest("/api/knowledge-map/points?coverage=bogus");
  assert(invalidFilter.status === 400, `invalid filter should be 400, got ${invalidFilter.status}`);

  const detail = await jsonRequest("/api/knowledge-map/points/kp_8b_ch16_radical_concept");
  assert(detail.status === 200, `point detail should be 200, got ${detail.status}`);
  assert(detail.body.data.name === "二次根式的概念", "point detail name mismatch");

  const unknownPoint = await jsonRequest("/api/knowledge-map/points/kp_8b_does_not_exist");
  assert(unknownPoint.status === 404, `unknown point should be 404, got ${unknownPoint.status}`);

  const consumer = readFixture("e4_e5_knowledge_map_consumer_fixture.json");
  assert(consumer.knowledge_map_ref.map_id === current.body.data.map_id, "consumer map_id mismatch");
  assert(consumer.knowledge_map_ref.map_version === current.body.data.map_version, "consumer map_version mismatch");
  for (const pointId of consumer.knowledge_point_ids) {
    const pointResponse = await jsonRequest(`/api/knowledge-map/points/${pointId}`);
    assert(pointResponse.status === 200, `consumer point ${pointId} should be 200`);
  }

  const wrongVersion = readFixture("e4_e5_knowledge_map_consumer_wrong_version.json");
  assert(wrongVersion.knowledge_map_ref.map_version !== current.body.data.map_version, "wrong version fixture should differ");

  const unknownConsumer = readFixture("e4_e5_knowledge_map_consumer_unknown_point.json");
  for (const pointId of unknownConsumer.knowledge_point_ids) {
    const pointResponse = await jsonRequest(`/api/knowledge-map/points/${pointId}`);
    assert(pointResponse.status === 404, `unknown consumer point ${pointId} should be 404`);
  }

  console.log("E3 knowledge-map smoke passed");
}

try {
  await main();
} finally {
  await stopServer();
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (db) db.close();
  cleanupDbFiles();
}
