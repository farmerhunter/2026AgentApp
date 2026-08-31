import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compactStderr } from "./e5Common.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path, "utf-8")).digest("hex");
}

function parseUniqueJson(stdout) {
  if (!stdout) return null;
  const clean = String(stdout).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

function buildArgs({ profile, skillName, usageFile, requestJson, env }) {
  if (env.HERMES_BRIDGE_CLI_ARGS) {
    return env.HERMES_BRIDGE_CLI_ARGS.split(/\s+/)
      .map((token) =>
        token
          .replaceAll("{profile}", profile)
          .replaceAll("{skill}", skillName)
          .replaceAll("{usage}", usageFile),
      )
      .concat(["-z", requestJson]);
  }

  const args = ["-p", profile, "--skills", skillName, "--usage-file", usageFile];
  if (env.HERMES_BRIDGE_EXTRA_ARGS) {
    args.push(...env.HERMES_BRIDGE_EXTRA_ARGS.split(/\s+/).filter(Boolean));
  }
  args.push("-z", requestJson);
  return args;
}

export async function runHermesSkill({
  jobId,
  skillName,
  skillPath,
  request,
  timeoutMs = 180_000,
  env = process.env,
}) {
  if (!existsSync(skillPath)) {
    return {
      ok: false,
      error: `Skill file not found: ${skillPath}`,
      skill_sha256: null,
    };
  }

  const skillSha256 = sha256File(skillPath);
  const privateDir = resolve(
    env.HERMES_E5_JOB_DIR ?? resolve(REPO_ROOT, "runtime", "private", "e5_jobs"),
    jobId,
  );
  mkdirSync(privateDir, { recursive: true });

  const requestJson = JSON.stringify(request, null, 2);
  const usageFile = resolve(privateDir, "usage.json");
  writeFileSync(usageFile, "{}", "utf-8");

  const bin = env.HERMES_BIN ?? "hermes";
  const profile = env.HERMES_PROFILE ?? "studyv2";
  const args = buildArgs({ profile, skillName, usageFile, requestJson, env });

  const childEnv = {
    ...env,
    PYTHONUNBUFFERED: "1",
    ...(env.HERMES_HOME ? { HERMES_HOME: env.HERMES_HOME } : {}),
  };

  return await new Promise((resolvePromise) => {
    const child = spawn(bin, args, {
      cwd: REPO_ROOT,
      env: childEnv,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.setEncoding("utf-8");
    child.stderr.setEncoding("utf-8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({
        ok: false,
        error: compactStderr(error.message),
        skill_sha256: skillSha256,
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (timedOut) {
        resolvePromise({
          ok: false,
          error: `Hermes job timed out after ${timeoutMs} ms`,
          skill_sha256: skillSha256,
        });
        return;
      }

      if (code !== 0) {
        resolvePromise({
          ok: false,
          exit_code: code,
          error: compactStderr(stderr) || `Hermes exited with code ${code}`,
          skill_sha256: skillSha256,
        });
        return;
      }

      const result = parseUniqueJson(stdout);
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        resolvePromise({
          ok: false,
          error: "Hermes stdout did not contain a single JSON object",
          skill_sha256: skillSha256,
        });
        return;
      }

      resolvePromise({ ok: true, result, skill_sha256: skillSha256 });
    });

    child.stdin.write(requestJson);
    child.stdin.end();
  });
}
