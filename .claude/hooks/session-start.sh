#!/bin/bash
# SessionStart hook for RideBuddy.
# Prepares the repo so the backend + Expo web preview can run and tests/linters
# work. Installs frontend (yarn) and backend (venv) dependencies and scaffolds
# local .env files with safe, secret-free defaults. Idempotent — safe to re-run.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT" || exit 0
log() { echo "[session-start] $*"; }

# --- Frontend dependencies (yarn) ---
if [ ! -d "frontend/node_modules" ]; then
  log "Installing frontend dependencies (yarn)… (logs: /tmp/rb-yarn.log)"
  yarn --cwd "$ROOT/frontend" install >/tmp/rb-yarn.log 2>&1 \
    && log "frontend deps installed" || log "WARN: yarn install failed (see /tmp/rb-yarn.log)"
else
  log "frontend/node_modules present — skipping yarn install"
fi

# --- Backend virtualenv + lean dependencies ---
[ -d "backend/.venv" ] || { log "Creating backend venv…"; python3 -m venv "$ROOT/backend/.venv" || log "WARN: venv failed"; }
if [ -x "backend/.venv/bin/pip" ]; then
  log "Installing backend dependencies… (logs: /tmp/rb-pip.log)"
  "$ROOT/backend/.venv/bin/pip" install -q --upgrade pip >/dev/null 2>&1 || true
  "$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements-dev.txt" >/tmp/rb-pip.log 2>&1 \
    && log "backend deps installed" || log "WARN: pip install failed (see /tmp/rb-pip.log)"
fi

# --- Scaffold local env files (no secrets; safe defaults) ---
if [ ! -f "backend/.env" ]; then
  log "Creating backend/.env (in-memory DB, mock OTP)…"
  cat > "$ROOT/backend/.env" <<'ENV'
MONGO_URL=mongodb://localhost:27017
DB_NAME=ridebuddy
# In-memory MongoDB (mongomock-motor) — no real mongod needed. Set false to use MONGO_URL.
USE_INMEMORY_DB=true
# Optional Twilio. Leave blank for mock OTP (any 6-digit code works in dev).
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_VERIFIED_NUMBERS=
ENV
fi
if [ ! -f "frontend/.env" ]; then
  log "Creating frontend/.env…"
  echo "EXPO_PUBLIC_BACKEND_URL=http://localhost:8001" > "$ROOT/frontend/.env"
fi

# --- Persist helper env for Playwright screenshots, if the image provides them ---
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  [ -d /opt/pw-browsers ] && echo 'export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers' >> "$CLAUDE_ENV_FILE"
  [ -d /opt/node22/lib/node_modules ] && echo 'export NODE_PATH=/opt/node22/lib/node_modules' >> "$CLAUDE_ENV_FILE"
fi

log "Ready."
exit 0
