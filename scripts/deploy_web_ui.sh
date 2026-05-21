#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/hermes/2026AgentApp}"
WEB_UI_DIR="${WEB_UI_DIR:-$REPO_DIR/src/web_ui}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/hermes-web}"

# npm registry for install speed; lockfile always rewritten with official registry
# Change this single variable if you need a domestic mirror (e.g. tencentyun, huaweicloud)
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"
OFFICIAL_REGISTRY="https://registry.npmjs.org/"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "Error: $REPO_DIR is not a git checkout."
  exit 1
fi

cd "$REPO_DIR"
git pull origin main

if [ ! -d "$WEB_UI_DIR" ]; then
  echo "Error: web UI directory not found: $WEB_UI_DIR"
  exit 1
fi

cd "$WEB_UI_DIR"

# Use npm install (not ci) to avoid optional-dep bugs; registry may be mirror for speed
npm install --registry="$NPM_REGISTRY"

npm run build

# Always rewrite lockfile with official registry so it passes validate-lockfile.mjs
npm install --registry="$OFFICIAL_REGISTRY" --package-lock-only
node "$REPO_DIR/scripts/validate-lockfile.mjs"

if [ ! -d dist ]; then
  echo "Error: build output directory not found: $WEB_UI_DIR/dist"
  exit 1
fi

mkdir -p "$DEPLOY_DIR"
rm -rf "$DEPLOY_DIR"/*
cp -R dist/* "$DEPLOY_DIR"/

# Sync demo data from build output to Nginx data directory
if [ -d dist/data ]; then
  echo "Syncing demo data to /var/www/html/data/ ..."
  mkdir -p /var/www/html/data
  cp -R dist/data/* /var/www/html/data/
fi

sudo systemctl reload nginx

echo "Deployed Hermes Web UI to $DEPLOY_DIR"
