#!/usr/bin/env bash
# Smoke test for Hermes job runners.
# Validates that all job runners work in fixture mode and produce expected outputs.
#
# Usage:
#   bash src/agent/jobs/smoke_test_jobs.sh
#
# Exit code 0 = all pass, 1 = any failure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RUNTIME_DIR="$REPO_ROOT/runtime/public"
STATUS_DIR="$RUNTIME_DIR/job_status"

PASSED=0
FAILED=0

log_pass() { echo "  ✓ $1"; ((PASSED++)) || true; }
log_fail() { echo "  ✗ $1"; ((FAILED++)) || true; }

run_job() {
  local job_type="$1"
  shift
  local args=("$@")

  echo ""
  echo "▶ Testing $job_type (${args[*]})"

  HERMES_JOB_MODE=fixture bash "$SCRIPT_DIR/run_${job_type}.sh" "${args[@]}"

  # Find the most recently created status file for this job type
  local status_file
  status_file=$(ls -t "$STATUS_DIR"/*.json 2>/dev/null | head -1)

  if [ -z "$status_file" ]; then
    log_fail "No status file found for $job_type"
    return
  fi

  local status
  status=$(python3 -c "import json; print(json.load(open('$status_file'))['status'])")

  if [ "$status" = "completed" ]; then
    log_pass "$job_type completed (status file: $(basename "$status_file"))"
  else
    log_fail "$job_type status is '$status' (expected 'completed')"
  fi
}

# ── Main ──
echo "══════════════════════════════════════════════════"
echo "  Hermes Job Runner Smoke Test"
echo "══════════════════════════════════════════════════"

mkdir -p "$STATUS_DIR"

# 1. Textbook summary
run_job textbook_summary --textbook-id textbook_math_grade8_demo

# 2. Learning insight update
run_job learning_insight_update --upload-id upload_20260518_001

# 3. Weekly report
run_job weekly_report --week-start 2026-05-18 --week-end 2026-05-24

# ── Summary ──
echo ""
echo "──────────────────────────────────────────────────"
echo "Passed: $PASSED  Failed: $FAILED"

if [ "$FAILED" -gt 0 ]; then
  echo "❌ Smoke test failed."
  exit 1
fi

echo "✅ All smoke tests passed."
