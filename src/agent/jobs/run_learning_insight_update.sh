#!/usr/bin/env bash
# run_learning_insight_update — generate local findings and focus question records from upload evidence
#
# Usage:
#   bash src/agent/jobs/run_learning_insight_update.sh --upload-id upload_20260518_001
#   bash src/agent/jobs/run_learning_insight_update.sh --upload-id upload_20260518_001 --output runtime/public/learning_findings/
#
# Environment:
#   HERMES_JOB_MODE=fixture   default, uses sample data
#   HERMES_JOB_MODE=real      calls hermes CLI with skill + prompt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

JOB_TYPE="learning_insight_update"

# ── Parse args ──
UPLOAD_ID=""
OUTPUT_DIR="${RUNTIME_PUBLIC}/learning_findings"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --upload-id) UPLOAD_ID="$2"; shift 2 ;;
    --output)    OUTPUT_DIR="$2"; shift 2 ;;
    --help)
      echo "Usage: $0 --upload-id <id> [--output <dir>]"
      echo "  Processes one upload session: loads upload_meta, split_result,"
      echo "  confirmation_result, related textbook summary, and text notes."
      exit 0
      ;;
    *) shift ;;
  esac
done

if [ -z "$UPLOAD_ID" ]; then
  log_error "--upload-id is required"
  exit 1
fi

log_info "Processing upload session: $UPLOAD_ID"

# ── Determine subject from upload_meta ──
UPLOAD_META="$DATA_DIR/sample_inputs/question_sessions/$UPLOAD_ID/upload_meta.json"
if [ ! -f "$UPLOAD_META" ]; then
  log_error "Upload meta not found: $UPLOAD_META"
  exit 1
fi

SUBJECT=$(python3 -c "import json; print(json.load(open('$UPLOAD_META'))['subject'])")
SUBJECT_LABEL=$(python3 -c "import json; print(json.load(open('$UPLOAD_META'))['subject_label'])")
log_info "Subject: $SUBJECT ($SUBJECT_LABEL)"

# ── Input paths ──
SPLIT_RESULT="$DATA_DIR/sample_inputs/question_sessions/$UPLOAD_ID/question_split_result.json"
CONFIRM_RESULT="$DATA_DIR/sample_inputs/question_sessions/$UPLOAD_ID/question_confirmation_result.json"
FOCUS_OUTPUT="$DATA_DIR/sample_outputs/focus_question_records/focus_questions_20260518.json"

# Map subject to findings batch
case "$SUBJECT" in
  math)    FINDINGS_BATCH="findings_20260518_math" ;;
  chinese) FINDINGS_BATCH="findings_20260518_chinese" ;;
  *)       FINDINGS_BATCH="findings_20260518_${SUBJECT}" ;;
esac

SAMPLE_FINDINGS="$DATA_DIR/sample_outputs/learning_findings/${FINDINGS_BATCH}.json"
SKILL_FILE="$SKILLS_DIR/learning_insight_update.skill.md"
PROMPT_FILE="$PROMPTS_DIR/learning_insight_update.prompt.md"
OUTPUT_FINDINGS="$OUTPUT_DIR/${FINDINGS_BATCH}.json"

if [ "$JOB_MODE" = "fixture" ]; then
  log_info "Fixture mode: using sample findings for $SUBJECT"
  run_fixture "$SAMPLE_FINDINGS" "$OUTPUT_FINDINGS"

  # Also copy focus question records as output
  FOCUS_OUT_DIR="$RUNTIME_PUBLIC/focus_question_records"
  mkdir -p "$FOCUS_OUT_DIR"
  if [ -f "$FOCUS_OUTPUT" ]; then
    cp "$FOCUS_OUTPUT" "$FOCUS_OUT_DIR/"
    log_info "Focus question records copied to $FOCUS_OUT_DIR"
  fi

elif [ "$JOB_MODE" = "real" ]; then
  # Validate required inputs for real mode
  if [ ! -f "$SPLIT_RESULT" ]; then
    log_error "Missing required input for real learning_insight_update: $SPLIT_RESULT"
    exit 1
  fi
  if [ ! -f "$CONFIRM_RESULT" ]; then
    log_error "Missing required input for real learning_insight_update: $CONFIRM_RESULT"
    exit 1
  fi

  # Assemble context: upload meta + split + confirmation + textbook
  CONTEXT=$(python3 -c "
import json, sys

context = {
    'upload_id': '$UPLOAD_ID',
    'upload_meta': json.load(open('$UPLOAD_META')),
    'split_result': json.load(open('$SPLIT_RESULT')),
    'confirmation_result': json.load(open('$CONFIRM_RESULT')),
}
# Try to load related textbook summary
import os
textbook_dir = '$DATA_DIR/sample_inputs/textbooks'
if os.path.isdir(textbook_dir):
    for d in os.listdir(textbook_dir):
        path = os.path.join(textbook_dir, d, 'textbook_content_summary.json')
        if os.path.exists(path):
            summary = json.load(open(path))
            if summary.get('subject') == '$SUBJECT':
                context['textbook_summary'] = summary
                break

json.dump(context, sys.stdout, ensure_ascii=False, indent=2)
")

  echo "$CONTEXT" | run_hermes "$SKILL_FILE" "$PROMPT_FILE" "-" "$OUTPUT_FINDINGS"
else
  log_error "Unknown JOB_MODE: $JOB_MODE"
  exit 1
fi

log_info "Done. Findings: $OUTPUT_FINDINGS"
