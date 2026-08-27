#!/usr/bin/env node

/**
 * Validate versioned textbook_knowledge_map artifacts.
 *
 * Default mode validates all JSON files under data/knowledge_maps/.
 * Optional mode validates explicit file paths passed as argv.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, relative, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const MAPS_DIR = resolve(REPO_ROOT, "data", "knowledge_maps");

const REQUIRED_TOP_KEYS = [
  "contract",
  "contract_version",
  "map_id",
  "map_version",
  "subject",
  "subject_label",
  "textbook",
  "generated_by",
  "generated_at",
  "review_status",
  "chapters",
];

const TEXTBOOK_KEYS = ["title", "publisher", "grade", "semester", "edition"];
const POINT_KEYS = [
  "knowledge_point_id",
  "name",
  "description",
  "prerequisite_point_ids",
  "coverage",
  "status",
  "superseded_by",
];

let passed = 0;
let failed = 0;

function log(ok, message) {
  if (ok) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (error) {
    return { __parseError: error.message };
  }
}

function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listJsonFiles(full));
    } else if (entry.endsWith(".json")) {
      files.push(full);
    }
  }
  return files;
}

function hasKeys(obj, keys) {
  return keys.every((key) => Object.prototype.hasOwnProperty.call(obj, key));
}

function checkNoLocalPaths(value, label) {
  if (typeof value === "string") {
    if (/^\/Users\//.test(value) || /^\/var\/lib\//.test(value) || /^\/private\//.test(value)) {
      log(false, `${label}: contains local absolute path "${value}"`);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) checkNoLocalPaths(item, label);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) checkNoLocalPaths(child, label);
  }
}

function validateArtifact(filePath) {
  const label = relative(REPO_ROOT, filePath).replaceAll("\\", "/");
  const data = readJson(filePath);

  if (data.__parseError) {
    log(false, `${label}: invalid JSON (${data.__parseError})`);
    return;
  }

  log(data.contract === "textbook_knowledge_map", `${label}: contract is textbook_knowledge_map`);
  log(data.contract_version === "1.0", `${label}: contract_version is 1.0`);
  log(hasKeys(data, REQUIRED_TOP_KEYS), `${label}: required top-level keys present`);

  const expectedDir = basename(dirname(filePath));
  const expectedFile = `${data.map_version ?? "unknown"}.json`;
  log(
    dirname(filePath).endsWith(data.map_id ?? "__missing__") && basename(filePath) === expectedFile,
    `${label}: file path matches (map_id, map_version)`,
  );

  log(/^\d+\.\d+\.\d+$/.test(data.map_version ?? ""), `${label}: map_version is semver-like`);
  log(data.subject === "math", `${label}: subject is math`);
  log(!!data.subject_label, `${label}: subject_label exists`);
  log(hasKeys(data.textbook ?? {}, TEXTBOOK_KEYS), `${label}: textbook metadata keys present`);
  log(Array.isArray(data.chapters), `${label}: chapters is an array`);

  const pointIds = new Set();
  const chapterIds = new Set();
  const sectionIds = new Set();
  const allPoints = [];

  for (const chapter of data.chapters ?? []) {
    log(hasKeys(chapter, ["chapter_id", "chapter_number", "title", "sections"]), `${label}: chapter required keys present`);
    if (!chapter.chapter_id) continue;
    log(!chapterIds.has(chapter.chapter_id), `${label}: chapter_id ${chapter.chapter_id} unique`);
    chapterIds.add(chapter.chapter_id);

    for (const section of chapter.sections ?? []) {
      log(
        hasKeys(section, ["section_id", "section_number", "title", "knowledge_points"]),
        `${label}: section required keys present`,
      );
      if (!section.section_id) continue;
      log(!sectionIds.has(section.section_id), `${label}: section_id ${section.section_id} unique`);
      sectionIds.add(section.section_id);

      for (const point of section.knowledge_points ?? []) {
        log(hasKeys(point, POINT_KEYS), `${label}: knowledge point required keys present`);
        if (!point.knowledge_point_id) continue;
        log(!pointIds.has(point.knowledge_point_id), `${label}: knowledge_point_id ${point.knowledge_point_id} unique`);
        pointIds.add(point.knowledge_point_id);
        log(["active", "superseded"].includes(point.status), `${label}: ${point.knowledge_point_id} status valid`);
        log(["catalog", "detailed"].includes(point.coverage), `${label}: ${point.knowledge_point_id} coverage valid`);
        allPoints.push(point);
      }
    }
  }

  for (const point of allPoints) {
    for (const ref of point.prerequisite_point_ids ?? []) {
      log(pointIds.has(ref), `${label}: prerequisite ${ref} resolves`);
    }
    if (point.status === "superseded") {
      log(!!point.superseded_by, `${label}: ${point.knowledge_point_id} superseded_by present`);
      if (point.superseded_by) {
        log(pointIds.has(point.superseded_by), `${label}: superseded_by ${point.superseded_by} resolves`);
      }
    }
  }

  checkNoLocalPaths(data, label);
}

function main() {
  const args = process.argv.slice(2);
  const files = args.length ? args.filter((file) => file.endsWith(".json")) : listJsonFiles(MAPS_DIR);

  if (files.length === 0) {
    console.error("No knowledge map artifacts found.");
    process.exit(1);
  }

  for (const file of files) {
    const abs = resolve(process.cwd(), file);
    validateArtifact(abs);
  }

  console.log(`\nPassed: ${passed}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main();
