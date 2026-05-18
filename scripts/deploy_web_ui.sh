#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/hermes/2026AgentApp}"
WEB_UI_DIR="${WEB_UI_DIR:-$REPO_DIR/src/web_ui}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/hermes-web}"

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

if [ -f package-lock.json ]; then
  npm ci
else
  echo "Warning: package-lock.json not found; using npm install."
  npm install
fi

npm run build

if [ ! -d dist ]; then
  echo "Error: build output directory not found: $WEB_UI_DIR/dist"
  exit 1
fi

mkdir -p "$DEPLOY_DIR"
rm -rf "$DEPLOY_DIR"/*
cp -R dist/* "$DEPLOY_DIR"/

sudo systemctl reload nginx

echo "Deployed Hermes Web UI to $DEPLOY_DIR"
