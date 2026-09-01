import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compactStderr } from "./e5Common.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path, "utf-8")).digest("hex");
}

function extractJsonObject(text) {
  if (!text) return null;
  const startCandidates = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "{") startCandidates.push(index);
  }
  for (const start of startCandidates) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(start, index + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

function copyIfExists(source, target) {
  if (existsSync(source)) copyFileSync(source, target);
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
      code: "SKILL_FILE_NOT_FOUND",
      message: "Skill file not found",
      skill_sha256: null,
    };
  }

  const skillSha256 = sha256File(skillPath);
  const baseDir = resolve(
    env.HERMES_E5_JOB_DIR ?? resolve(REPO_ROOT, "runtime", "private", "e5_jobs"),
    jobId,
  );
  const privateDir = resolve(baseDir, "private");
  const jobHome = resolve(privateDir, "hermes-home");
  const skillDir = resolve(jobHome, "skills", skillName);
  mkdirSync(skillDir, { recursive: true });

  // Execute the exact reviewed skill file, never a same-name profile skill.
  const executedSkillPath = resolve(skillDir, "SKILL.md");
  copyFileSync(skillPath, executedSkillPath);

  const sourceProfileDir =
    env.HERMES_SOURCE_PROFILE_DIR ?? env.HERMES_PROFILE_DIR ?? "";
  if (sourceProfileDir) {
    const requiredFiles = ["config.yaml", ".env"];
    const missing = requiredFiles.filter((file) => !existsSync(resolve(sourceProfileDir, file)));
    if (missing.length > 0) {
      return {
        ok: false,
        code: "HERMES_PROFILE_UNAVAILABLE",
        message: "Hermes source profile is missing required files",
        missing_files: missing,
        skill_sha256: skillSha256,
      };
    }
    copyIfExists(resolve(sourceProfileDir, "config.yaml"), resolve(jobHome, "config.yaml"));
    copyIfExists(resolve(sourceProfileDir, ".env"), resolve(jobHome, ".env"));
    copyIfExists(resolve(sourceProfileDir, "auth.json"), resolve(jobHome, "auth.json"));
    copyIfExists(resolve(sourceProfileDir, "SOUL.md"), resolve(jobHome, "SOUL.md"));
  } else {
    return {
      ok: false,
      code: "HERMES_PROFILE_UNAVAILABLE",
      message: "HERMES_SOURCE_PROFILE_DIR is required",
      skill_sha256: skillSha256,
    };
  }

  const requestJson = JSON.stringify(request, null, 2);
  const stdoutPath = resolve(privateDir, "stdout.txt");
  const stderrPath = resolve(privateDir, "stderr.txt");
  writeFileSync(stdoutPath, "", "utf-8");
  writeFileSync(stderrPath, "", "utf-8");

  const bin = env.HERMES_BIN ?? "hermes";
  const extraArgs = env.HERMES_BRIDGE_EXTRA_ARGS?.split(/\s+/).filter(Boolean) ?? [];
  const args = [
    "chat",
    "--query-file",
    "-",
    "--skills",
    skillName,
    "--quiet",
    "--max-turns",
    "1",
    ...extraArgs,
  ];

  const childEnv = {
    ...env,
    PYTHONUNBUFFERED: "1",
    HERMES_HOME: jobHome,
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
      writeFileSync(stderrPath, compactStderr(error.message), "utf-8");
      resolvePromise({
        ok: false,
        code: "HERMES_SPAWN_FAILED",
        message: "Hermes process could not be started",
        diagnostics_path: stderrPath,
        skill_sha256: skillSha256,
      });
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      writeFileSync(stdoutPath, stdout, "utf-8");
      writeFileSync(stderrPath, stderr, "utf-8");

      if (timedOut) {
        resolvePromise({
          ok: false,
          code: "HERMES_TIMEOUT",
          message: "Hermes job timed out",
          diagnostics_path: stderrPath,
          skill_sha256: skillSha256,
        });
        return;
      }

      if (code !== 0) {
        resolvePromise({
          ok: false,
          code: "HERMES_NONZERO_EXIT",
          message: "Hermes exited with a non-zero status",
          exit_code: code,
          diagnostics_path: stderrPath,
          skill_sha256: skillSha256,
        });
        return;
      }

      const result = extractJsonObject(stdout);
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        resolvePromise({
          ok: false,
          code: "HERMES_INVALID_JSON",
          message: "Hermes stdout did not contain a single JSON object",
          diagnostics_path: stdoutPath,
          skill_sha256: skillSha256,
        });
        return;
      }

      resolvePromise({
        ok: true,
        result,
        skill_sha256: skillSha256,
        executed_skill_path: executedSkillPath,
      });
    });

    child.stdin.write(requestJson);
    child.stdin.end();
  });
}
