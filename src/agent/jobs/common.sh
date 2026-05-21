#!/usr/bin/env bash
# Common functions for Hermes job runners.
# Source this file: source "$(dirname "$0")/common.sh"

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DATA_DIR="$REPO_ROOT/data"
SKILLS_DIR="$REPO_ROOT/src/skills"
PROMPTS_DIR="$REPO_ROOT/src/prompts"
RUNTIME_PUBLIC="$REPO_ROOT/runtime/public"

# Job metadata
JOB_TYPE="${JOB_TYPE:-unknown}"
JOB_ID="${JOB_ID:-job_$(date +%Y%m%d_%H%M%S)}"
JOB_MODE="${HERMES_JOB_MODE:-fixture}"

# Normalize legacy mode names
[[ "$JOB_MODE" == "hermes" ]] && JOB_MODE="real"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[${JOB_TYPE}]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[${JOB_TYPE}]${NC} $*"; }
log_error() { echo -e "${RED}[${JOB_TYPE}]${NC} $*"; }

# Load a JSON file and print it
load_json() {
  local path="$1"
  if [ ! -f "$path" ]; then
    log_error "Missing input: $path"
    exit 1
  fi
  python3 -c "import json; json.dump(json.load(open('$path')), sys.stdout, ensure_ascii=False, indent=2)"
}

# Validate output JSON against basic contract rules
validate_output() {
  local output_file="$1"
  local contract_name="${2:-}"

  log_info "Validating output: $output_file"

  python3 -c "
import json, sys

with open('$output_file') as f:
    data = json.load(f)

errors = []

# Required top-level fields
if 'contract' not in data:
    errors.append('Missing: contract')
if 'contract_version' not in data:
    errors.append('Missing: contract_version')

# Subject code validation
for key in data:
    if key == 'subject':
        if data[key] not in ('chinese', 'math', 'english'):
            errors.append(f'subject \"{data[key]}\" is not a valid internal code')
    if isinstance(data[key], dict) and 'subject' in data[key]:
        if data[key]['subject'] not in ('chinese', 'math', 'english', None):
            errors.append(f'nested subject \"{data[key][\"subject\"]}\" invalid')

# No local paths
text = json.dumps(data, ensure_ascii=False)
for bad in ['/var/lib/', '/Users/', '/private/', '/home/']:
    if bad in text and '/data/' not in text:
        errors.append(f'Contains local path prefix: {bad}')

if errors:
    print('VALIDATION FAILED:', file=sys.stderr)
    for e in errors:
        print(f'  - {e}', file=sys.stderr)
    sys.exit(1)

print(f'Validation OK: {len(data)} top-level keys')
"

  if [ $? -ne 0 ]; then
    log_error "Output validation failed"
    return 1
  fi
  log_info "Output validation passed"
}

# Write output JSON and job status
write_output() {
  local output_file="$1"

  mkdir -p "$(dirname "$output_file")"
  cat > "$output_file"

  log_info "Output written: $output_file"

  # Write job status
  local status_file="$RUNTIME_PUBLIC/job_status/${JOB_ID}.json"
  mkdir -p "$(dirname "$status_file")"
  cat > "$status_file" <<STATUS
{
  "job_id": "$JOB_ID",
  "job_type": "$JOB_TYPE",
  "status": "completed",
  "mode": "$JOB_MODE",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "completed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "result_path": "$output_file"
}
STATUS
  log_info "Job status: $status_file"
}

# Fixture mode: copy sample output to target
run_fixture() {
  local sample_path="$1"
  local output_file="$2"

  log_info "Fixture mode: using sample data from $sample_path"

  if [ ! -f "$sample_path" ]; then
    log_error "Sample not found: $sample_path"
    exit 1
  fi

  cat "$sample_path" | python3 -c "
import json, sys
data = json.load(sys.stdin)
data['generated_by'] = 'job_runner.fixture'
data['job_id'] = '$JOB_ID'
json.dump(data, sys.stdout, ensure_ascii=False, indent=2)
" | write_output "$output_file"

  validate_output "$output_file"
}

# Real mode: call hermes CLI with skill + prompt + context
run_hermes() {
  local skill_file="$1"
  local prompt_file="$2"
  local context_json="$3"
  local output_file="$4"

  log_info "Hermes mode: calling hermes run"

  if ! command -v hermes >/dev/null 2>&1; then
    log_error "hermes CLI not found"
    exit 1
  fi

  # Assemble full prompt
  local full_prompt
  full_prompt=$(cat "$skill_file"; echo; cat "$prompt_file"; echo; echo "## Context Data"; cat "$context_json")

  # Call Hermes
  hermes run --json 2>/dev/null <<< "$full_prompt" | python3 -c "
import json, sys
data = json.load(sys.stdin)
data['generated_by'] = 'hermes'
data['job_id'] = '$JOB_ID'
json.dump(data, sys.stdout, ensure_ascii=False, indent=2)
" | write_output "$output_file"

  validate_output "$output_file"
}
