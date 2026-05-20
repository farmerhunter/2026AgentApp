#!/usr/bin/env bash
# run_weekly_report — generate weekly report from findings, memory, and materials
#
# Usage:
#   bash src/agent/jobs/run_weekly_report.sh --week-start 2026-05-18 --week-end 2026-05-24
#
# Environment:
#   HERMES_JOB_MODE=fixture   default, uses sample data
#   HERMES_JOB_MODE=hermes    calls hermes CLI with skill + prompt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

JOB_TYPE="weekly_report"

# ── Parse args ──
WEEK_START=""
WEEK_END=""
OUTPUT_DIR="${RUNTIME_PUBLIC}/week_reports"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --week-start) WEEK_START="$2"; shift 2 ;;
    --week-end)   WEEK_END="$2"; shift 2 ;;
    --output)     OUTPUT_DIR="$2"; shift 2 ;;
    --help)
      echo "Usage: $0 --week-start <YYYY-MM-DD> --week-end <YYYY-MM-DD> [--output <dir>]"
      echo "  Consolidates weekly findings, memory, and materials into a cross-subject report."
      exit 0
      ;;
    *) shift ;;
  esac
done

if [ -z "$WEEK_START" ] || [ -z "$WEEK_END" ]; then
  log_error "--week-start and --week-end are required"
  exit 1
fi

# Derive report ID and title
REPORT_ID="week_${WEEK_START//-/}_${WEEK_END//-/}"
WEEK_TITLE="第${WEEK_START//-/}—${WEEK_END//-/}周学习报告"
log_info "Generating weekly report: $REPORT_ID"

# ── Input paths ──
SAMPLE_REPORT="$DATA_DIR/sample_outputs/week_reports/$REPORT_ID.json"
SAMPLE_INDEX="$DATA_DIR/sample_outputs/week_reports/week_reports_index.json"
SAMPLE_MEMORY="$DATA_DIR/sample_outputs/memory/short_term_memory_2026W21.json"
SAMPLE_CONSOLIDATION="$DATA_DIR/sample_outputs/insight_consolidations/consolidation_2026W21.json"

SKILL_FILE="$SKILLS_DIR/weekly_report.skill.md"
PROMPT_FILE="$PROMPTS_DIR/weekly_report.prompt.md"
OUTPUT_REPORT="$OUTPUT_DIR/$REPORT_ID.json"
OUTPUT_INDEX="$OUTPUT_DIR/week_reports_index.json"

if [ "$JOB_MODE" = "fixture" ]; then
  log_info "Fixture mode: using sample weekly report"

  run_fixture "$SAMPLE_REPORT" "$OUTPUT_REPORT"

  # Copy index
  mkdir -p "$(dirname "$OUTPUT_INDEX")"
  if [ -f "$SAMPLE_INDEX" ]; then
    cp "$SAMPLE_INDEX" "$OUTPUT_INDEX"
    log_info "Week reports index copied to $OUTPUT_INDEX"
  fi

  # Copy memory snapshot
  MEMORY_OUT_DIR="$RUNTIME_PUBLIC/memory"
  mkdir -p "$MEMORY_OUT_DIR"
  if [ -f "$SAMPLE_MEMORY" ]; then
    cp "$SAMPLE_MEMORY" "$MEMORY_OUT_DIR/"
    log_info "Memory snapshot copied to $MEMORY_OUT_DIR"
  fi

  # Copy consolidation output
  CONSOL_OUT_DIR="$RUNTIME_PUBLIC/insight_consolidations"
  mkdir -p "$CONSOL_OUT_DIR"
  if [ -f "$SAMPLE_CONSOLIDATION" ]; then
    cp "$SAMPLE_CONSOLIDATION" "$CONSOL_OUT_DIR/"
    log_info "Consolidation output copied to $CONSOL_OUT_DIR"
  fi

elif [ "$JOB_MODE" = "hermes" ]; then
  # Assemble context: findings + memory + materials
  CONTEXT=$(python3 -c "
import json, os, sys

context = {
    'week_start': '$WEEK_START',
    'week_end': '$WEEK_END',
    'report_id': '$REPORT_ID',
    'findings': [],
    'short_term_memory': None,
}

# Load findings if available
findings_dir = '$DATA_DIR/sample_outputs/learning_findings'
if os.path.isdir(findings_dir):
    for f in sorted(os.listdir(findings_dir)):
        if f.endswith('.json'):
            path = os.path.join(findings_dir, f)
            context['findings'].append(json.load(open(path)))

# Load short-term memory
if os.path.exists('$SAMPLE_MEMORY'):
    context['short_term_memory'] = json.load(open('$SAMPLE_MEMORY'))

# Load week reports index for continuity
if os.path.exists('$SAMPLE_INDEX'):
    context['existing_index'] = json.load(open('$SAMPLE_INDEX'))

json.dump(context, sys.stdout, ensure_ascii=False, indent=2)
")

  echo "$CONTEXT" | run_hermes "$SKILL_FILE" "$PROMPT_FILE" "-" "$OUTPUT_REPORT"

  # Rebuild index
  python3 -c "
import json
report = json.load(open('$OUTPUT_REPORT'))
index = {
    'contract': 'week_reports_index',
    'contract_version': '1.1',
    'student_id': report.get('student', {}).get('student_id', '小明'),
    'generated_at': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    'reports': [{
        'weekly_report_id': '$REPORT_ID',
        'week_start': '$WEEK_START',
        'week_end': '$WEEK_END',
        'title': report.get('week', {}).get('title', '$WEEK_TITLE'),
        'report_url': '/data/week_reports/$REPORT_ID.json'
    }]
}
with open('$OUTPUT_INDEX', 'w') as f:
    json.dump(index, f, ensure_ascii=False, indent=2)
" 2>/dev/null || true

else
  log_error "Unknown JOB_MODE: $JOB_MODE"
  exit 1
fi

log_info "Done. Report: $OUTPUT_REPORT"
log_info "Index: $OUTPUT_INDEX"
