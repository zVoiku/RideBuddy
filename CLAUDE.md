# RideBuddy — developer guide

Cross-platform app for car owners to hire drivers to drive their own car.

- **Frontend:** React Native + Expo (Expo Router, SDK 54) in `frontend/` — the
  customer app (car owners booking a driver)
- **Partner app:** React Native + Expo (SDK 54) in `RideBuddy-partner/` — the
  driver-facing app ("Buddies"), talking to the same backend via `/api/driver/*`
- **Backend:** FastAPI + MongoDB (Motor) in `backend/` — serves both apps
- **Mocked for MVP:** OTP (real Twilio optional), payments, maps/driver matching
- Active development branch: `claude/epic-johnson-fo6eu5`

## Layout

```
backend/
  server.py            FastAPI app (auth, garage, bookings, driver auto-assign)
  requirements.txt     Full Emergent env (NOT all installable on public PyPI)
  requirements-dev.txt Lean, runnable subset actually used by server.py
  tests/test_ridebuddy.py  Integration tests (hit a running server)
  tests/test_driver.py     Integration tests for the /api/driver/* surface
frontend/
  app/                 Expo Router screens (login, otp, onboarding, home, booking/*)
  src/                 api client, theme, maps helpers, LiveMap (native) + LiveMap.web
RideBuddy-partner/     Driver app — self-contained Expo project, own package.json
  app/                 login, otp, (tabs)/*, trip/[id], nav/[id]
  src/                 api client, theme tokens, TripMap (native) + TripMap.web
  README.md            Lifecycle, privacy rules, and on-device run instructions
scripts/capture.js     Playwright script: screenshots the whole flow (web build)
.claude/               SessionStart hook that installs deps + scaffolds .env
```

The partner app is a separate npm project: run `npm install` inside
`RideBuddy-partner/` (the SessionStart hook only installs `frontend/` + `backend/`).

## Environment variables

Not committed (git-ignored). The SessionStart hook scaffolds safe defaults.

`backend/.env`
- `MONGO_URL`, `DB_NAME` — Mongo connection (used when `USE_INMEMORY_DB` is off)
- `USE_INMEMORY_DB=true` — use the in-memory `mongomock-motor` store (no mongod needed)
- `TWILIO_*` — optional; blank ⇒ mock OTP (any 6-digit code logs in). When set,
  real SMS is sent only to numbers in `TWILIO_VERIFIED_NUMBERS` (trial-safe), mock otherwise.

`frontend/.env`
- `EXPO_PUBLIC_BACKEND_URL` — backend base URL (default `http://localhost:8001`)

`RideBuddy-partner/.env` (template committed as `.env.example`)
- `EXPO_PUBLIC_BACKEND_URL` — must be a LAN IP, not `localhost`, when running on a phone
- `EXPO_PUBLIC_GOOGLE_MAPS_KEY` — optional; blank ⇒ the map renders blank on device

## Run locally

Each app is its own npm project, so Expo commands must run **inside** the app
folder — `npx expo start` at the repo root fails with `ConfigError: The
expected package.json path .../RideBuddy/package.json does not exist`. The root
`package.json` holds convenience scripts that cd for you:

```bash
npm run backend       # uvicorn on 0.0.0.0:8001
npm run partner       # RideBuddy-partner, dev client, cache cleared
npm run client        # frontend on port 8083
npm run partner:ios   # device build (macOS + Xcode)
npm test              # backend suite — needs `npm run backend` already running
npm run ip            # the LAN IP to put in each app's .env
```

It is deliberately **not** an npm workspace: hoisting Expo's native deps out of
the app folders breaks Metro resolution.

Run them directly if you prefer:

```bash
backend/.venv/bin/uvicorn --app-dir backend server:app --host 0.0.0.0 --port 8001

# Frontend — web preview (works headless; maps use the SVG fallback)
cd frontend && BROWSER=none npx expo start --web --offline --port 8081
```

`EXPO_PUBLIC_*` values are baked in when Metro starts, so after changing a
`.env` (a new Wi-Fi network, say) restart with `--clear`.

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
# Backend integration tests need a running server (covers both apps' surfaces):
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001 backend/.venv/bin/pytest backend/tests -q
# Frontend lint:
cd frontend && npx expo lint
# Partner app typecheck:
cd RideBuddy-partner && npx tsc --noEmit
```

## Sandbox network notes

This environment uses an allowlist: PyPI, npm, and GitHub are reachable, but
`mongodb.org` (Mongo binaries) and Expo's servers/tunnel infra are blocked.
Consequences: we run an in-memory Mongo (`USE_INMEMORY_DB=true`) and rely on the
web preview + screenshots; live Expo Go tunneling to a phone is not reachable
from here (use a local machine or EAS for on-device testing).
