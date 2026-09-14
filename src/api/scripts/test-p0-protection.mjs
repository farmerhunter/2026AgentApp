import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { request } from "node:http";
import { once } from "node:events";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const temp = mkdtempSync(resolve(tmpdir(), "p0-boundaries-"));
const marker = resolve(temp, "external-call");
const data = resolve(temp, "private");
mkdirSync(data);
writeFileSync(resolve(data, "database"), "synthetic queued job: must remain unchanged");
writeFileSync(resolve(data, "profile"), "synthetic profile: must not read");
const bin = resolve(temp, "bin");
mkdirSync(bin);
for (const name of ["hermes", "curl", "systemctl", "nginx", "npm", "install", "cp", "rm", "python3"]) {
  writeFileSync(resolve(bin, name), `#!/bin/sh\necho attempted >> '${marker}'\nexit 99\n`, { mode: 0o755 });
}
const loader = resolve(temp, "spy-loader.mjs");
writeFileSync(loader, `import { appendFileSync } from 'node:fs';
export async function resolve(specifier, context, nextResolve) {
  if (/tencentcloud|better-sqlite3|\\/db\\/|\\/routes\\/|e5Context|e5Store/.test(specifier)) {
    appendFileSync(${JSON.stringify(marker)}, specifier + '\\n');
    throw new Error('forbidden business or SDK import');
  }
  return nextResolve(specifier, context);
}`);
const preload = resolve(temp, "spy-preload.mjs");
writeFileSync(preload, `import fs from 'node:fs';
import http from 'node:http'; import https from 'node:https'; import net from 'node:net';
import child from 'node:child_process'; import { syncBuiltinESMExports } from 'node:module';
const record = fs.appendFileSync;
function forbidden() { record(${JSON.stringify(marker)}, 'external or private access\\n'); throw new Error('forbidden side effect'); }
for (const owner of [http, https]) { owner.request = forbidden; owner.get = forbidden; }
net.connect = forbidden; net.createConnection = forbidden;
for (const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']) child[name] = forbidden;
globalThis.fetch = forbidden;
const originalRead = fs.readFileSync;
fs.readFileSync = function(path, ...args) { if (String(path).startsWith(${JSON.stringify(data)})) return forbidden(); return originalRead(path, ...args); };
syncBuiltinESMExports();`);
const env = {
  PATH: `${bin}:${process.env.PATH}`,
  HOME: temp,
  DATABASE_URL: `sqlite:///${data}/database`,
  HERMES_HOME: `${data}/profile`,
  HERMES_E5_JOB_DIR: data,
  HERMES_API_PORT: "0",
  HERMES_API_HOST: "0.0.0.0",
  HERMES_JOB_MODE: "real",
  OCR_PROVIDER_MODE: "real",
  TENCENTCLOUD_SECRET_ID: "synthetic-id",
  TENCENTCLOUD_SECRET_KEY: "synthetic-key",
};
const nodeArgs = ["--no-warnings", "--experimental-loader", loader, "--import", preload];
function run(command, args, overrides = {}) {
  const result = spawnSync(command, args, { cwd: root, env: { ...env, ...overrides }, encoding: "utf8", timeout: 10000 });
  assert.ifError(result.error);
  return result;
}
function denied(result) {
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /p0_protected_disabled/);
  assert.equal(existsSync(marker), false, existsSync(marker) ? readFileSync(marker, "utf8") : "");
}
const uri = (file) => JSON.stringify(pathToFileURL(resolve(root, file)).href);
for (const mode of ["real", "hermes", "fixture"]) {
  for (const script of ["run_e5_analysis.mjs", "run_e5_weekly_report.mjs", "probe-tencent-ocr.mjs"]) {
    denied(run(process.execPath, [...nodeArgs, `src/api/scripts/${script}`, "--image", `${data}/profile`], { HERMES_JOB_MODE: mode }));
  }
  for (const script of ["run_textbook_summary.sh", "run_learning_insight_update.sh", "run_weekly_report.sh"]) {
    denied(run("/bin/bash", [`src/agent/jobs/${script}`], { HERMES_JOB_MODE: mode }));
  }
}
for (const expression of [
  `import {callTencentQuestionSplitOcr as call} from ${uri("src/api/lib/ocrAdapter.js")}; await call(Buffer.from('synthetic'));`,
  `import {runOcrAdapter as call} from ${uri("src/api/lib/ocrAdapter.js")}; await call(Buffer.from('synthetic'), {});`,
  `import {runHermesSkill as call} from ${uri("src/api/lib/hermesBridge.js")}; await call({jobId:'job_test', skillPath:${JSON.stringify(data + "/profile")}});`,
]) denied(run(process.execPath, [...nodeArgs, "--input-type=module", "-e", expression]));
const python = spawnSync("/usr/bin/env", ["which", "python3"], { encoding: "utf8" }).stdout.trim();
for (const args of [[], ["--run", "--source-profile", `${data}/profile`]]) {
  denied(run(python, ["experiments/hermes-quality/run_probe.py", ...args]));
}
denied(run("/bin/bash", ["deploy/e6/deploy.sh"]));
denied(run("/bin/bash", ["deploy/e6/xuetuzhiban-demo", "restore", "baseline-ab"], {
  XUETUZHIBAN_PROD_ROOT: data, XUETUZHIBAN_API_SERVICE: "fake", XUETUZHIBAN_API_BASE: "http://127.0.0.1:1",
}));
const fallback = run("/bin/bash", ["deploy/e6/fallback-demo.sh"]);
assert.equal(fallback.status, 1);
assert.match(fallback.stdout, /LIVE_PROTECTED_DISABLED/);
assert.doesNotMatch(fallback.stdout, /LIVE_OK/);
assert.equal(existsSync(marker), false);

function api(port, path, method) {
  return new Promise((done, fail) => {
    const req = request({ hostname: "127.0.0.1", port, path, method }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => done({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", fail);
    req.end();
  });
}
for (const mode of ["real", "fixture"]) {
  const child = spawn(process.execPath, [...nodeArgs, "src/api/server.js"], { cwd: root, env: { ...env, HERMES_JOB_MODE: mode }, stdio: ["ignore", "pipe", "pipe"] });
  const exit = once(child, "exit");
  let stderr = "";
  child.stderr.on("data", (chunk) => stderr += chunk);
  try {
    const port = await new Promise((done, fail) => {
      const timer = setTimeout(() => fail(new Error(`startup timeout ${stderr}`)), 5000);
      child.once("exit", () => { clearTimeout(timer); fail(new Error(`early exit ${stderr}`)); });
      child.stdout.on("data", (chunk) => { const match = String(chunk).match(/127\.0\.0\.1:(\d+)/); if (match) { clearTimeout(timer); done(Number(match[1])); } });
    });
    const health = await api(port, "/api/health", "GET");
    assert.equal(health.status, 200);
    assert.deepEqual(JSON.parse(health.body), { status: "protected_disabled" });
    const paths = ["/api", "/api/", "/api/uploads", "/api/uploads/private/original", "/api/uploads/private/ocr/retry", "/api/sessions/private/split", "/api/memories", "/api/notes", "/api/reports/private", "/api/hermes/jobs/private/result", "/api/knowledge-map", "/api//uploads", "/api/%75ploads", "/api/../uploads", "/api/xuetuzhiban", "/api/xuetuzhiban-test/", "/app/report"];
    await Promise.all(paths.flatMap((path) => ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].map(async (method) => {
      const response = await api(port, path, method);
      assert.equal(response.status, 503, `${method} ${path}`);
      assert.equal(response.headers["cache-control"], "no-store");
      if (method !== "HEAD") assert.equal(JSON.parse(response.body).error, "p0_protected_disabled");
    })));
  } finally {
    child.kill("SIGTERM");
    await exit;
  }
}
assert.equal(readFileSync(resolve(data, "database"), "utf8"), "synthetic queued job: must remain unchanged");
assert.deepEqual(readdirSync(data).sort(), ["database", "profile"]);
assert.equal(existsSync(marker), false);
const appApi = await import(pathToFileURL(resolve(root, "src/web_ui/src/lib/appApi.js")).href);
let fetches = 0;
globalThis.fetch = () => { fetches++; throw new Error("unexpected browser network"); };
await assert.rejects(appApi.pollHermesJob("old-job"), { code: "p0_protected_disabled" });
await assert.rejects(appApi.retryUploadOcr("old-upload"), { code: "p0_protected_disabled" });
assert.equal(fetches, 0);
console.log("P0 boundary checks passed: 238 concurrent API denials, two clean boot modes, all paid entry families, zero external/private access, unchanged synthetic data, no UI retry.");
