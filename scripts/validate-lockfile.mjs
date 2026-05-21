#!/usr/bin/env node
/**
 * Validate that all package-lock.json files use the official npm registry.
 * Prevents private/VPS-specific mirrors (e.g. tencentyun, huaweicloud)
 * from being committed to the repository.
 *
 * Exit code 0 = all pass, 1 = failures found.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(fileURLToPath(new URL(".", import.meta.url)));

const ALLOWED_HOSTS = [
  "registry.npmjs.org",
  "npm.pkg.github.com", // optional: GitHub Packages
];

const BLOCKED_PATTERNS = [
  "tencentyun",
  "huaweicloud",
  "aliyun",
  "taobao",
  "registry.npmmirror",
  "mirrors.cloud.tencent",
];

const LOCKFILES = [
  "package-lock.json",
  "src/web_ui/package-lock.json",
  "src/api/package-lock.json",
];

const errors = [];

function validateLockfile(path) {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf-8");
  let lock;
  try {
    lock = JSON.parse(content);
  } catch (e) {
    errors.push(`${path}: invalid JSON (${e.message})`);
    return;
  }

  // npm v7+ uses "packages", npm v6 uses "dependencies"
  const deps = lock.packages ?? lock.dependencies ?? {};

  for (const [name, info] of Object.entries(deps)) {
    if (!info || typeof info !== "object") continue;

    const resolved = info.resolved;
    if (!resolved || typeof resolved !== "string") continue;

    // Check blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (resolved.includes(pattern)) {
        errors.push(
          `${path}: ${name} uses blocked mirror "${pattern}": ${resolved}`
        );
        break;
      }
    }

    // Check allowed hosts
    try {
      const url = new URL(resolved);
      if (!ALLOWED_HOSTS.includes(url.host)) {
        errors.push(
          `${path}: ${name} resolves from unexpected host "${url.host}": ${resolved}`
        );
      }
      if (url.protocol === "http:") {
        errors.push(
          `${path}: ${name} uses insecure HTTP: ${resolved}`
        );
      }
    } catch {
      errors.push(`${path}: ${name} has invalid resolved URL: ${resolved}`);
    }
  }
}

// ── Main ──
console.log("Validating package-lock.json files...\n");

for (const rel of LOCKFILES) {
  const abs = resolve(REPO_ROOT, rel);
  if (existsSync(abs)) {
    validateLockfile(abs);
    console.log(`  checked: ${rel}`);
  } else {
    console.log(`  skipped: ${rel} (not found)`);
  }
}

console.log(`\n  Errors: ${errors.length}\n`);

if (errors.length > 0) {
  console.log("Failures:");
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log(
    "\nFix: delete the lockfile and re-run `npm install` with the official registry.\n"
  );
  process.exit(1);
}

console.log("✓ All lockfiles use the official npm registry.\n");
