"""Bounded VPS experiment: real Hermes CLI, synthetic inputs, no product writes.

Use the installed Hermes venv Python. Without --run this only checks config,
skill loading and credential availability. Never prints or copies credentials.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hermes-source", required=True, type=Path)
    parser.add_argument("--source-profile", required=True, type=Path)
    parser.add_argument("--knowledge-map", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--cases-file", type=Path, help="Synthetic case file; defaults to cases.json")
    parser.add_argument("--only", help="Comma-separated case IDs from the file; at most three")
    parser.add_argument("--skill-file", type=Path, help="Skill source or immutable previous snapshot")
    parser.add_argument("--run", action="store_true")
    args = parser.parse_args()
    os.umask(0o077)
    base = Path(__file__).resolve().parent
    source = args.hermes_source.resolve()
    profile = args.source_profile.resolve()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    sys.path.insert(0, str(source))
    os.environ["HERMES_HOME"] = str(profile)

    # Resolve through Hermes, never call the model provider API directly.
    from hermes_cli.config import load_config
    from hermes_cli.runtime_provider import resolve_runtime_provider

    original = load_config()
    model = original["model"]["default"]
    provider = original["model"]["provider"]
    if provider != "deepseek":
        raise RuntimeError("Unexpected provider; stop for review instead of switching.")
    runtime = resolve_runtime_provider(requested=provider, target_model=model)
    key = runtime.get("api_key")
    if not key:
        raise RuntimeError("Hermes profile has no usable credential; values not printed.")
    if (runtime.get("base_url") or "").rstrip("/") not in (
        "https://api.deepseek.com", "https://api.deepseek.com/v1"
    ):
        raise RuntimeError("Unexpected provider endpoint; stop for review.")

    cases_file = args.cases_file or base / "cases.json"
    cases = json.loads(cases_file.read_text())
    ids = [case["case_id"] for case in cases]
    if len(set(ids)) != len(ids) or not all(re.fullmatch(r"[QH][0-9]+", x) for x in ids):
        raise RuntimeError("Expected unique simple synthetic case IDs.")
    if args.only:
        selected = args.only.split(",")
        if len(set(selected)) != len(selected) or not set(selected).issubset(ids):
            raise RuntimeError("Unknown or duplicate selected case IDs.")
        cases = [next(case for case in cases if case["case_id"] == x) for x in selected]
    if not 1 <= len(cases) <= 3:
        raise RuntimeError("At most three cases per invocation; no automatic expansion.")
    knowledge_map = json.loads(args.knowledge_map.read_text())
    nodes = [
        {k: node[k] for k in ("knowledge_point_id", "name", "description", "coverage")}
        for chapter in knowledge_map["chapters"]
        for section in chapter["sections"]
        for node in section["knowledge_points"]
    ]
    config = {
        "model": {"default": model, "provider": provider,
                  "base_url": runtime["base_url"]},
        "agent": {"max_turns": 1, "api_max_retries": 1},
        "platform_toolsets": {"cli": []},
        "memory": {"memory_enabled": False, "user_profile_enabled": False},
        "mcp_servers": {},
        "fallback_model": [],
        "auxiliary": {"transient_retries": 0},
    }
    skill_name = "confirmed-mistake-analysis-probe"
    skill = args.skill_file or base / "skills" / skill_name / "SKILL.md"
    shutil.copyfile(skill, output / "skill-snapshot.md")
    shutil.copyfile(cases_file, output / "cases-snapshot.json")
    save(output / "config-snapshot.json", config)
    manifest = {
        "mode": "real_cli" if args.run else "preflight_only",
        "provider": provider, "model": model,
        "skill_sha256": digest(skill), "cases_sha256": digest(cases_file),
        "case_ids": [case["case_id"] for case in cases], "runner_sha256": digest(Path(__file__)),
        "map_sha256": digest(args.knowledge_map),
        "map_id": knowledge_map["map_id"], "map_version": knowledge_map["map_version"],
        "max_jobs": len(cases), "per_job_timeout_seconds": 180,
        "retries": "no runner retry; Hermes api_max_retries=1; SDK behavior is not overridden",
        "hermes_commit": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=source, text=True).strip(),
        "results": [],
    }
    save(output / "manifest.json", manifest)

    for case in cases:
        case_dir = output / case["case_id"]
        home = case_dir / "hermes-home"
        work = case_dir / "work"
        (home / "skills" / skill_name).mkdir(parents=True)
        work.mkdir()
        shutil.copyfile(skill, home / "skills" / skill_name / "SKILL.md")
        # JSON is valid YAML; these are generated private experiment files.
        save(home / "config.yaml", config)
        (home / ".no-bundled-skills").write_text("E5 isolated quality probe\n")
        (home / "SOUL.md").write_text("Follow the explicitly loaded math analysis skill.\n")
        request = {**case, "knowledge_map": {
            "map_id": knowledge_map["map_id"], "map_version": knowledge_map["map_version"],
            "knowledge_points": nodes,
        }}
        save(case_dir / "input.json", request)
        env = {k: os.environ[k] for k in ("HOME", "USER", "PATH", "LANG", "SSL_CERT_FILE", "SSL_CERT_DIR") if k in os.environ}
        env.update({"HERMES_HOME": str(home), "DEEPSEEK_API_KEY": key,
                    "PYTHONPATH": str(source), "PYTHONUNBUFFERED": "1"})
        preflight = (
            "import json; from hermes_cli.config import load_config; "
            "from hermes_cli.tools_config import _get_platform_tools; "
            "from model_tools import get_tool_definitions; "
            "from agent.skill_commands import build_preloaded_skills_prompt; "
            "c=load_config(); p,l,m=build_preloaded_skills_prompt(['" + skill_name + "']); "
            "t=sorted(_get_platform_tools(c,'cli')); "
            "definitions=get_tool_definitions(enabled_toolsets=t,quiet_mode=True); "
            "names=[d['function']['name'] for d in definitions]; "
            "print(json.dumps({'resolved_toolsets':t,'tools':names,'loaded_skills':l,'missing_skills':m,'skill_prompt_chars':len(p)})); "
            "assert not names and l==['" + skill_name + "'] and not m; "
            "assert c['memory']['memory_enabled'] is False; "
            "assert c['memory']['user_profile_enabled'] is False"
        )
        verified = subprocess.run([sys.executable, "-c", preflight], env=env,
                                  cwd=work, capture_output=True, text=True, timeout=30)
        (case_dir / "preflight.stdout.txt").write_text(verified.stdout)
        (case_dir / "preflight.stderr.txt").write_text(verified.stderr)
        if verified.returncode:
            raise RuntimeError(f"{case['case_id']}: isolated skill/tool preflight failed.")
        print(case["case_id"] + " preflight passed", flush=True)
        if not args.run:
            continue
        cmd = [str(source / "venv/bin/hermes"), "--skills", skill_name,
               "--usage-file", str(case_dir / "usage.json"),
               "-z", json.dumps(request, ensure_ascii=False)]
        started = time.monotonic()
        record = {"case_id": case["case_id"], "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        try:
            with (case_dir / "stdout.txt").open("w") as stdout, (case_dir / "stderr.txt").open("w") as stderr:
                result = subprocess.run(cmd, cwd=work, env=env, stdout=stdout,
                                        stderr=stderr, timeout=180)
            record["exit_code"] = result.returncode
        except subprocess.TimeoutExpired:
            record.update({"exit_code": None, "timed_out": True})
        record["elapsed_seconds"] = round(time.monotonic() - started, 2)
        manifest["results"].append(record)
        save(output / "manifest.json", manifest)
        print(json.dumps(record), flush=True)
        if record["exit_code"] != 0:
            print("Stopping after failure; no retry or remaining jobs.", flush=True)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
