#!/usr/bin/env bash
set -euo pipefail

# Build web and prepare the production root. Run as the deploy user on VPS.

PROD_ROOT="${XUETUZHIBAN_PROD_ROOT:-/opt/hermes/2026agentapp-prod}"
APP_DIR="$PROD_ROOT/app"
WEB_DIST="$PROD_ROOT/web/dist"

mkdir -p "$PROD_ROOT"/{data/sqlite,data/uploads,snapshots,logs,env}

cd "$APP_DIR/src/web_ui"
npm ci --no-audit --no-fund
npm run build

rm -rf "$WEB_DIST"
mkdir -p "$WEB_DIST"
cp -a dist/. "$WEB_DIST/"

mkdir -p "$PROD_ROOT/root-index"
cp "$APP_DIR/deploy/e6/root-index.html" "$PROD_ROOT/root-index/index.html"

install -m 0755 "$APP_DIR/deploy/e6/xuetuzhiban-demo" /usr/local/sbin/xuetuzhiban-demo
install -m 0644 "$APP_DIR/deploy/e6/xuetuzhiban-api.service" /etc/systemd/system/xuetuzhiban-api.service
systemctl daemon-reload

echo "deploy prepared: $PROD_ROOT"
