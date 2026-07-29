# RideBuddy — Context & Handoff for the Driver/Partner App

**Purpose of this document.** RideBuddy is a client app (car owners hire drivers to
drive the owner's own car). A **sister app for drivers/partners** is now being built,
where drivers log in and see/accept trip orders from clients. This doc gives a new
Claude session the full context of the existing system so it can build the driver app
that integrates with the same backend. Attach this file at the start of the new chat.

> **Read this first, then read the repo.** The existing code is the source of truth;
> this doc summarizes it and, crucially, flags what does **not** yet exist and must be
> built for the driver side.

---

## 1. System overview

- **Client app ("RideBuddy")** — car owners book a driver for their own car. Built and
  working on-device (iOS dev build; Android via EAS).
- **Driver app (to build)** — partners/drivers log in, see incoming/available trip
  orders, accept them, navigate, and run the trip (start/complete with codes).
- **One shared backend.** Both apps talk to the **same FastAPI backend**. The driver app
  is a second React Native/Expo client. The backend must be **extended** with driver
  auth + driver-facing endpoints (see §9 — most of this does not exist yet).

### Recommended architecture for the driver app
- **Keep a single backend**, extended with a `/driver/*` surface + driver auth. Do **not**
  fork the backend — bookings created by the client app must be visible to the driver app.
- **Driver frontend**: a separate Expo app. Either a new repo (cleanest) or a
  `driver/` folder in a monorepo. It can reuse patterns/components from the client app
  (theme, api client, LiveMap, maps helpers).

---

## 2. Tech stack

- **Frontend:** React Native + Expo (**SDK 54**, Expo Router, React 19, RN 0.81),
  TypeScript. Native map via `react-native-maps` **1.27.2** (Google provider on both
  platforms). `react-native-webview` for the Razorpay checkout.
- **Backend:** FastAPI + Motor (async MongoDB). Dev uses an **in-memory Mongo**
  (`mongomock-motor`) via `USE_INMEMORY_DB=true` — no real mongod needed.
- **Auth:** phone + OTP → **JWT** (HS256, 30-day expiry), sent as `Authorization: Bearer`.
- **Integrations:** Google Maps (Directions/Places/Geocoding/Static + native SDK),
  Razorpay (payments), Twilio (OTP SMS, optional).
- **Mocked for MVP:** OTP (any 6-digit code unless Twilio configured), driver matching
  (auto-assigned from seeds), maps in Expo Go (static-image fallback).

---

## 3. Repo layout (client app)

```
backend/
  server.py               FastAPI app — ALL routes, models, auth, fare, seeding
  requirements-dev.txt    Lean runnable deps (fastapi, motor, pymongo, pydantic,
                          python-dotenv, PyJWT, twilio, razorpay, mongomock-motor, …)
  tests/test_ridebuddy.py Integration tests (hit a running server)
  .env                    NOT committed — see §7
frontend/
  app/                    Expo Router screens
    login.tsx, otp.tsx    Phone → OTP → JWT
    onboarding/profile.tsx
    home.tsx, account.tsx
    booking/
      summary.tsx         Fare estimate + interactive Google map (tap to expand)
      payment.tsx         Full/30% choice → Razorpay checkout → creates booking
      finding.tsx         "Finding a driver" (waits for auto-assign)
      [id].tsx            Booking detail: status, driver card, live-trip map, codes
  src/
    api.ts                Fetch wrapper + typed endpoint methods; token in AsyncStorage
    theme.ts              Colors/spacing (primary green #4A5C2F)
    maps.ts               Google REST helpers (autocomplete, place details, directions,
                          static map) — uses EXPO_PUBLIC_GOOGLE_MAPS_KEY
    LiveMap.tsx           Native interactive map (react-native-maps); Expo Go → Google
                          Static Map image; else SVG RouteMap
    LiveMap.web.tsx       Web fallback (SVG)
    RouteMap.tsx          Polyline decoder + SVG route drawing
    CityPicker.tsx        Google Places autocomplete modal
    RazorpayCheckout.tsx  Razorpay checkout.js in a WebView
  app.json                Expo config (name RideBuddy, bundleId com.ridebuddy.app);
                          NO secrets — maps key injected by app.config.js
  app.config.js           Injects EXPO_PUBLIC_GOOGLE_MAPS_KEY into react-native-maps plugin
  eas.json                EAS build profiles (development / preview / production)
docs/
  run-on-phone.md, run-on-android.md   Setup guides
```

Active branch for the client app: **`claude/epic-johnson-fo6eu5`**.

---

## 4. Backend API reference (current)

Base URL: `http://<host>:8001`, all routes prefixed **`/api`**. Auth via
`Authorization: Bearer <jwt>` unless noted. `get_current_user` decodes the JWT (`sub` =
user id) and looks up the user; returns **401 "User not found"** if the user record is
gone (happens after an in-memory DB restart — client must re-login).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/` | no | Health → `{"message":"RideBuddy API"}` |
| POST | `/auth/send-otp` | no | Body `{phone}`. Generates 6-digit code (5-min expiry). Real SMS only if Twilio set **and** phone ∈ `TWILIO_VERIFIED_NUMBERS`; else mock. Returns `{sent, phone, channel: "twilio"|"mock", hint?, twilio_error?}` |
| POST | `/auth/verify-otp` | no | Body `{phone, otp}`. Strict check only for Twilio-verified numbers; otherwise **any 6-digit code passes**. Creates the user if new. Returns `{token, user}` |
| GET  | `/users/me` | yes | Current user |
| PUT  | `/users/me` | yes | Body `{name?, email?}`; sets `is_new=false` |
| GET  | `/users/me/cars` | yes | List the user's cars |
| POST | `/users/me/cars` | yes | Add a car (`make, model, transmission, color?, plate?`) |
| DELETE | `/users/me/cars/{car_id}` | yes | Delete a car |
| POST | `/bookings/estimate` | yes | Body `EstimateIn` → fare breakdown incl. `advance_30` |
| POST | `/bookings` | yes | Body `BookingIn` → creates booking (`status=searching`) and schedules `auto_assign_driver` |
| GET  | `/bookings` | yes | User's bookings (newest first), driver hydrated |
| GET  | `/bookings/{id}` | yes | One booking (must belong to user), driver hydrated |
| POST | `/bookings/{id}/verify-start` | yes | Body `{code}`; owner enters **start_code**; `assigned/arrived → in_progress` |
| POST | `/bookings/{id}/verify-end` | yes | Body `{code}`; owner enters **end_code**; `in_progress → completed`, sets `paid_amount = total_fare` |
| POST | `/bookings/{id}/cancel` | yes | `status → cancelled` |
| POST | `/bookings/{id}/simulate-arrived` | yes | Demo helper: `assigned → arrived` |
| GET  | `/drivers` | **no** | Lists all seeded drivers |
| POST | `/payments/create-order` | yes | Body `{amount}` (rupees). Real Razorpay order if keys set, else mock. Returns `{mock, order_id, key_id, amount(paise), currency}` |
| POST | `/payments/verify` | yes | Body `{razorpay_order_id, razorpay_payment_id, razorpay_signature}`; HMAC-verifies signature server-side |

### Booking status lifecycle
```
pending → searching → assigned → arrived → in_progress → completed
                                                        ↘ cancelled (any point)
```
- `searching`: set on creation.
- `assigned`: `auto_assign_driver` (background, 3s later) picks the first
  `available` driver whose `transmissions` include the booking's transmission; sets
  `driver_id`, generates **4-digit** `start_code` and `end_code`.
- `arrived`: via `simulate-arrived` (demo).
- `in_progress`: owner submits `start_code` (verify-start).
- `completed`: owner submits `end_code` (verify-end).

### Fare logic (`compute_fare`)
- **Point-to-point one-way:** `base = 199 + distance_km × 12`; 10% new-user discount.
- **Round trip (`one_way=false`, `days>0`):** `base = days × 1499`; ₹200/day new-user discount.
- **Hourly:** `base = max(1, duration_hours) × 249`; 10% new-user discount.
- `advance_30 = 30% of total` (the partial-payment option).

---

## 5. Data models (Mongo collections)

**users** (`User`): `id, phone, name?, email?, is_new, created_at`
**cars** (`Car`): `id, user_id, make, model, transmission("Manual"|"Automatic"), color?, plate?`
**drivers** (`Driver`): `id, name, phone, rating(4.7), trips(0), photo, aadhaar_verified,
police_verified, transmissions[], available, eta_minutes` — **seeded, 5 fake drivers, no login.**
**otps**: `phone, code, expires_at, verified`
**bookings** (`Booking`): `id, user_id, trip_type("point_to_point"|"hourly"), one_way,
pickup_address, drop_address?, pickup_lat/lng, drop_lat/lng, distance_km, duration_hours,
days, schedule_now, scheduled_at?, return_at?, intersect_at_owner (true=driver comes to
owner; false=owner picks up driver), transmission, car_id?, base_fare, discount,
total_fare, payment_method("upi"|"card"|"cash"), pay_partial, paid_amount, status,
driver_id?, start_code?, end_code?, created_at, started_at?, completed_at?`

`GET /bookings*` **hydrates** `booking.driver` from the drivers collection when `driver_id` is set.

---

## 6. Integrations

- **Google Maps.** Native map = `react-native-maps` w/ `PROVIDER_GOOGLE` (both platforms).
  Key set at **build time** via `app.config.js` → react-native-maps config plugin
  (needs a **clean prebuild** to take effect). REST (autocomplete/directions/static) via
  `src/maps.ts` reading `EXPO_PUBLIC_GOOGLE_MAPS_KEY` from the JS bundle. In Expo Go
  (no native module) `LiveMap` falls back to a Google **Static Map** image, then SVG.
  Required APIs on the key: Maps SDK iOS + Android, Directions, Places, Geocoding, Static.
- **Razorpay.** Backend creates an order and verifies the signature (secret stays
  server-side). Frontend opens `checkout.js` in a WebView (`RazorpayCheckout.tsx`),
  posts the result back, backend verifies, then the booking is created. Falls back to a
  mock flow if keys aren't set. Test card `4111 1111 1111 1111`, any future expiry/CVV.
- **Twilio.** Real OTP SMS only when `TWILIO_*` set and the number is in
  `TWILIO_VERIFIED_NUMBERS` (E.164). Note: **Twilio → India SMS needs DLT registration**;
  trial accounts usually can't deliver to +91, so mock OTP is the practical dev path.

---

## 7. Environment variables (never committed — `.env` is git-ignored)

`backend/.env`
```
DB_NAME=ridebuddy
USE_INMEMORY_DB=true
MONGO_URL=mongodb://localhost:27017
# optional:
TWILIO_ACCOUNT_SID=…  TWILIO_AUTH_TOKEN=…  TWILIO_FROM_NUMBER=+1…  TWILIO_VERIFIED_NUMBERS=+91…,+91…
RAZORPAY_KEY_ID=rzp_test_…  RAZORPAY_KEY_SECRET=…
```
`frontend/.env`
```
EXPO_PUBLIC_BACKEND_URL=http://<mac-lan-ip>:8001
EXPO_PUBLIC_GOOGLE_MAPS_KEY=…
```

---

## 8. Dev / build / ops notes (hard-won lessons)

- **Run:** backend `uvicorn --app-dir backend server:app --host 0.0.0.0 --port 8001`;
  frontend `npx expo start --dev-client`. Backend **must** bind `0.0.0.0` for the phone.
- **Native modules need a dev build** — Expo Go can't run react-native-maps (SDK 54).
  Build: `npx expo run:ios --device` (Mac) or `eas build -p android --profile development`.
- **In-memory DB resets on every backend restart** → users/bookings vanish → the app
  shows "User not found" until you **log out + log in**. (Switch to real MongoDB with
  `USE_INMEMORY_DB=false` for persistence.)
- **iOS free Apple ID cert expires every 7 days** → app shows "No longer available";
  re-run `npx expo run:ios --device` (may need Xcode GUI once to regenerate the profile).
- **Mac Wi-Fi IP changes** → update `frontend/.env` and restart Metro with `--clear`
  (EXPO_PUBLIC_* are baked in at Metro start). Dev-client launcher auto-discovery often
  fails on restricted Wi-Fi → "Enter URL manually": `http://<ip>:8081`.
- **Python 3.9 friendly** — `requirements-dev.txt` uses version ranges.
- **Conventions:** develop on a feature branch; secrets never in git or chat; `.env`
  files created locally; commit messages are concise + descriptive.

---

## 9. What the DRIVER app needs (the actual build work)

The current backend has **no driver login and no driver-facing trip endpoints** —
drivers are seed records auto-assigned by `auto_assign_driver`. To build the driver app,
extend the **same backend** and add a new Expo client. Suggested scope (confirm with the
user before implementing):

### Backend additions
- **Driver auth.** Driver login (phone+OTP mirroring the user flow, or a separate
  onboarding). Issue a JWT with a **role** (`role: "driver"`) or a separate token, and a
  `get_current_driver` dependency. Link the authenticated driver to a `drivers` record
  (give `Driver` a real identity + credentials; today it has none).
- **Assignment model — decide one:**
  - *Pool/accept (recommended for a real driver app):* drivers see open orders and accept.
    - `GET /driver/trips/available` → bookings with `status=searching` (optionally filtered
      by transmission / proximity), not yet assigned.
    - `POST /driver/trips/{id}/accept` → set `driver_id`, `status=assigned`, generate codes.
    - Adjust/disable `auto_assign_driver` (or keep it as a fallback timer).
  - *Auto-assign (current):* keep it, and the driver app just shows trips already assigned
    to that driver.
- **Driver trip actions:**
  - `GET /driver/trips` (assigned/active/history for the logged-in driver)
  - `POST /driver/trips/{id}/arrived` → `status=arrived`
  - Trip start/finish: today the **owner** enters `start_code`/`end_code`. Decide the
    two-sided flow — e.g., driver **displays** the codes for the owner to enter (current
    model), or add driver-side verify endpoints. Keep both apps consistent.
  - `PATCH /driver/availability` (online/offline → `available`)
  - Optional: driver location updates for live tracking; earnings summary.
- **Reuse:** JWT/OTP helpers, `Booking` model + status lifecycle, `compute_fare`,
  hydration. Bookings are shared — the client app already creates them.

### Driver frontend
- New Expo app (separate repo or `driver/` folder). Screens: login/OTP, online/offline
  home with **available/assigned trip cards**, trip detail (map + pickup/drop + client +
  fare + codes), navigation, arrived/start/complete actions, trip history/earnings.
- Reuse from the client app: `theme`, `api` client pattern, `LiveMap`/`maps.ts`,
  the dev-build + EAS setup, and all the ops lessons in §8.

### Open decisions for the new chat to confirm with the user
1. Separate repo vs monorepo folder for the driver app.
2. Assignment: pool/accept vs keep auto-assign.
3. Driver onboarding/auth (self-signup vs admin-provisioned; documents/verification).
4. Who enters trip codes (owner-enters vs driver-enters vs both).
5. Real-time updates (polling — current client uses 3s polling — vs websockets/push).
6. Persistence: move off in-memory Mongo for shared multi-user testing.

---

*Generated as a handoff for building the RideBuddy driver/partner app. The RideBuddy
client repo + branch `claude/epic-johnson-fo6eu5` is the source of truth; verify details
against `backend/server.py` and `frontend/` before implementing.*
