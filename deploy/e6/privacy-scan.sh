#!/usr/bin/env bash
set -euo pipefail

# Lightweight public-data privacy scan. Does not alter any file.

PUBLIC_ROOT="${XUETUZHIBAN_PUBLIC_ROOT:-/opt/hermes/2026agentapp-prod/web/dist}"
ROOT_INDEX="${XUETUZHIBAN_ROOT_INDEX:-/opt/hermes/2026agentapp-prod/root-index}"

patterns=(
  'TENCENTCLOUD_SECRET_ID'
  'TENCENTCLOUD_SECRET_KEY'
  'DEEPSEEK_API_KEY'
  '/opt/hermes/.secrets'
  '/home/ubuntu/.hermes'
  '真实学生'
  '学校：'
  '姓名：'
)

failed=0
for pattern in "${patterns[@]}"; do
  if rg -n --fixed-strings "$pattern" "$PUBLIC_ROOT" "$ROOT_INDEX" >/dev/null 2>&1; then
    echo "PRIVACY_HIT: $pattern" >&2
    failed=1
  fi
done

if [[ "$failed" -eq 0 ]]; then
  echo "PRIVACY_SCAN_OK"
fi
exit "$failed"
