#!/usr/bin/env bash
# run_textbook_summary — generate textbook_content_summary from textbook sample data
#
# Usage:
#   bash src/agent/jobs/run_textbook_summary.sh --textbook-id textbook_math_grade8_demo
#   bash src/agent/jobs/run_textbook_summary.sh --textbook-id textbook_math_grade8_demo --output /var/www/html/data/textbooks/
#
# Environment:
#   HERMES_JOB_MODE=fixture   default, uses sample data
#   HERMES_JOB_MODE=real      calls hermes CLI with skill + prompt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

JOB_TYPE="textbook_summary"

# ── Parse args ──
TEXTBOOK_ID=""
OUTPUT_DIR="${RUNTIME_PUBLIC}/textbooks"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --textbook-id) TEXTBOOK_ID="$2"; shift 2 ;;
    --output)      OUTPUT_DIR="$2"; shift 2 ;;
    --help)
      echo "Usage: $0 --textbook-id <id> [--output <dir>]"
      echo "  JOB_MODE=fixture|real (default: fixture)"
      exit 0
      ;;
    *) shift ;;
  esac
done

if [ -z "$TEXTBOOK_ID" ]; then
  log_error "--textbook-id is required"
  exit 1
fi

log_info "Processing textbook: $TEXTBOOK_ID"

# ── Input paths ──
SAMPLE_TEXTBOOK="$DATA_DIR/sample_inputs/textbooks/$TEXTBOOK_ID/textbook_content_summary.json"
SKILL_FILE="$SKILLS_DIR/textbook_summary.skill.md"
PROMPT_FILE="$PROMPTS_DIR/textbook_summary.prompt.md"
OUTPUT_FILE="$OUTPUT_DIR/$TEXTBOOK_ID/textbook_content_summary.json"

if [ "$JOB_MODE" = "fixture" ]; then
  run_fixture "$SAMPLE_TEXTBOOK" "$OUTPUT_FILE"
elif [ "$JOB_MODE" = "real" ]; then
  CONTEXT=$(load_json "$SAMPLE_TEXTBOOK")
  echo "$CONTEXT" | run_hermes "$SKILL_FILE" "$PROMPT_FILE" "-" "$OUTPUT_FILE"
else
  log_error "Unknown JOB_MODE: $JOB_MODE"
  exit 1
fi

log_info "Done. Output: $OUTPUT_FILE"
