# RideBuddy — developer guide

Cross-platform app for car owners to hire drivers to drive their own car.

- **Frontend:** React Native + Expo (Expo Router, SDK 54) in `frontend/`
- **Backend:** FastAPI + MongoDB (Motor) in `backend/`
- **Mocked for MVP:** OTP (real Twilio optional), payments, maps/driver matching
- Active development branch: `claude/epic-johnson-fo6eu5`

## Layout

```
backend/
  server.py            FastAPI app (auth, garage, bookings, driver auto-assign)
  requirements.txt     Full Emergent env (NOT all installable on public PyPI)
  requirements-dev.txt Lean, runnable subset actually used by server.py
  tests/test_ridebuddy.py  Integration tests (hit a running server)
frontend/
  app/                 Expo Router screens (login, otp, onboarding, home, booking/*)
  src/                 api client, theme, maps helpers, LiveMap (native) + LiveMap.web
scripts/capture.js     Playwright script: screenshots the whole flow (web build)
.claude/               SessionStart hook that installs deps + scaffolds .env
```

## Environment variables

Not committed (git-ignored). The SessionStart hook scaffolds safe defaults.

`backend/.env`
- `MONGO_URL`, `DB_NAME` — Mongo connection (used when `USE_INMEMORY_DB` is off)
- `USE_INMEMORY_DB=true` — use the in-memory `mongomock-motor` store (no mongod needed)
- `TWILIO_*` — optional; blank ⇒ mock OTP (any 6-digit code logs in). When set,
  real SMS is sent only to numbers in `TWILIO_VERIFIED_NUMBERS` (trial-safe), mock otherwise.

`frontend/.env`
- `EXPO_PUBLIC_BACKEND_URL` — backend base URL (default `http://localhost:8001`)

## Run locally

```bash
# Backend (in-memory DB by default via .env)
backend/.venv/bin/uvicorn --app-dir backend server:app --host 0.0.0.0 --port 8001

# Frontend — web preview (works headless; maps use the SVG fallback)
cd frontend && BROWSER=none npx expo start --web --offline --port 8081
```

Test login: any 10-digit phone + any 6-digit OTP (e.g. `123456`).

## Visual preview (Claude Code on the web)

This is a headless Linux sandbox: no iOS/Android emulator. The **Expo web** build
runs here and `scripts/capture.js` screenshots every screen at phone size:

```bash
NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  node scripts/capture.js          # -> /tmp/ridebuddy-shots/*.png
```

`react-native-maps` renders real Google Maps only in a native build / Expo Go;
on web `LiveMap.web.tsx` shows a placeholder (by design).

## Tests & lint

```bash
# Backend integration tests need a running server:
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001 backend/.venv/bin/pytest backend/tests -q
# Frontend lint:
cd frontend && npx expo lint
```

## Sandbox network notes

This environment uses an allowlist: PyPI, npm, and GitHub are reachable, but
`mongodb.org` (Mongo binaries) and Expo's servers/tunnel infra are blocked.
Consequences: we run an in-memory Mongo (`USE_INMEMORY_DB=true`) and rely on the
web preview + screenshots; live Expo Go tunneling to a phone is not reachable
from here (use a local machine or EAS for on-device testing).
