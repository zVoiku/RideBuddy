# RideBuddy Partner

The driver/partner app for RideBuddy — "Buddies" run the trips that customers
book in the client app. React Native + Expo (SDK 54, Expo Router), talking to the
same FastAPI backend as the client app via its `/api/driver/*` surface.

> Built to the RideBuddy Ops App design (Buddy Role). The Ops console is a
> separate, later build.

## How assignment works

Assignment is **Ops-owned**: a partner sees only trips already assigned to them.
There is no open pool and no accept button — the Home empty state says so
("New assignments from Ops will appear here"). Until the Ops console ships, the
backend's `auto_assign_driver` stands in for that step, so trips booked in the
client app still reach a partner a few seconds later.

## Trip lifecycle

```
assigned → en_route → arrived → in_progress → completed
(Confirmed) (Left for  (Arrived   (In Progress) (Complete)
             Pickup)    at Pickup)
```

The handshake is two-sided and split on purpose:

- **The partner starts the trip.** The owner's app displays a 4-digit code; the
  owner reads it out and the partner types it into the trip screen.
- **The owner ends the trip.** The partner's screen says so and waits.

## Screens

| Route | Screen |
|---|---|
| `/login`, `/otp` | Phone + 6-digit OTP (mocked — any 6 digits) |
| `/(tabs)/home` | Greeting, online/offline toggle, upcoming trip cards, past trips |
| `/trip/[id]` | Map, details, earnings, status CTA, start-code entry |
| `/nav/[id]` | Navigation mode: ETA, quick actions, Running late, Safety/SOS |
| `/(tabs)/earnings` | Week/Month/Quarter/Annual, bar chart, payout note, trip list |
| `/(tabs)/profile` | Stats, account, documents, Gigs, sign out |
| `/(tabs)/messages` | Placeholder — in-app chat is phase 2 |

A pulsing banner sits above the tab bar whenever a trip is live.

## Privacy

Partners never receive the owner's full name, phone or email. The backend
projects each booking down to what a partner may see: the customer is masked to
`"Aarti M."`, and a **round trip's exact drop address is withheld** until the day
of travel (only the drop city is shown). The start code is never sent to this
app — it only ever travels by voice from the owner.

## Setup

```bash
npm install
cp .env.example .env      # then edit
```

`.env` (git-ignored):

```
EXPO_PUBLIC_BACKEND_URL=http://<your-lan-ip>:8001
EXPO_PUBLIC_GOOGLE_MAPS_KEY=...
```

Both are baked in when Metro starts — restart with `--clear` after changing them.

## Run

```bash
# Backend (from the RideBuddy repo)
backend/.venv/bin/uvicorn --app-dir backend server:app --host 0.0.0.0 --port 8001

# This app — needs a dev build, react-native-maps cannot run in Expo Go
npx expo run:ios --device          # macOS
eas build -p android --profile development
npx expo start --dev-client
```

Sign in with **98765 43210** and any 6-digit code to land on the seeded demo
partner (Rajesh Singh), who already has trips assigned, one in progress and a
year of completed history feeding the Earnings screen. Any other number creates
a fresh partner account with no trips.

## Notes

- The backend **must** bind `0.0.0.0` for a phone to reach it.
- The in-memory dev DB resets on every backend restart — sign out and back in.
- `web` runs for a quick look, but `react-native-maps` has no web build, so the
  map falls back to a schematic route card there.
