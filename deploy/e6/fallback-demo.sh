#!/usr/bin/env bash
set -euo pipefail

# Live-demo fallback helper. The static /demo path does not depend on API/OCR/Hermes,
# so if the real runtime is unavailable the operator points the presenter to demo.

API_BASE="${XUETUZHIBAN_API_BASE:-http://127.0.0.1:8001/api}"

if curl -fsS "$API_BASE/health" >/dev/null 2>&1; then
  echo "LIVE_OK $API_BASE"
else
  echo "LIVE_UNAVAILABLE"
  echo "FALLBACK_URL=/apps/xuetuzhiban/demo/"
  exit 1
fi
