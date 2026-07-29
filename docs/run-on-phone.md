# Run RideBuddy on your phone (Expo Go)

The quickest way to test on a real iPhone/Android. Everything runs on **your
computer**; your phone loads the app over Wi-Fi via the **Expo Go** app.

> This can't be done from Claude Code on the web (that sandbox is network-isolated
> from your phone and from Expo). Run the steps below on your own machine.

## Prerequisites (one-time)
- **Node 20+** and **Git** installed
- **Python 3.10+** installed
- **Expo Go** app on each phone (App Store / Google Play) — use the latest version
- Phone **and** computer on the **same Wi-Fi** network

## 1. Get the code
```bash
git clone https://github.com/zVoiku/RideBuddy.git
cd RideBuddy
git checkout claude/epic-johnson-fo6eu5
```

## 2. Start the backend (in-memory DB — no MongoDB install)
Create `backend/.env` with:
```
DB_NAME=ridebuddy
USE_INMEMORY_DB=true
MONGO_URL=mongodb://localhost:27017
# Optional: paste your Twilio keys here to get a real SMS to your verified number.
# Leave blank for mock OTP (any 6-digit code works).
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_VERIFIED_NUMBERS=
```
Then, from the repo root:

**macOS / Linux**
```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements-dev.txt
backend/.venv/bin/uvicorn --app-dir backend server:app --host 0.0.0.0 --port 8001
```
**Windows (PowerShell)**
```powershell
python -m venv backend\.venv
backend\.venv\Scripts\pip install -r backend\requirements-dev.txt
backend\.venv\Scripts\uvicorn --app-dir backend server:app --host 0.0.0.0 --port 8001
```
Leave this terminal running. `--host 0.0.0.0` is what lets your phone reach it.

## 3. Find your computer's LAN IP
- **macOS:** `ipconfig getifaddr en0`  (if blank, try `en1`)
- **Linux:** `hostname -I | awk '{print $1}'`
- **Windows:** `ipconfig` → your Wi-Fi adapter's **IPv4 Address**

Example result: `192.168.1.20`

## 4. Point the app at that backend
Create `frontend/.env` (use **your** IP, not localhost):
```
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.20:8001
```

## 5. Start Expo (new terminal)
```bash
cd frontend
yarn install        # or: npm install
npx expo start
```

## 6. Open it on your phone
- **iPhone:** open the **Camera** app, point at the QR in the terminal, tap the banner.
- **Android:** open **Expo Go** → "Scan QR code".

Log in with any 10-digit number + OTP `123456` (or your real verified number to get
a Twilio SMS). Edit any file and it hot-reloads on the phone.

---

## Troubleshooting
- **App won't load / "timed out":** phone and computer must be on the *same* Wi-Fi.
  A firewall may block Node (port 8081) — allow it, or temporarily disable the firewall.
- **App loads but login/data fails:** the backend isn't reachable. In your phone's
  browser open `http://<YOUR_LAN_IP>:8001/api/` — you should see
  `{"message":"RideBuddy API"}`. If not: backend not running, wrong IP, or a
  firewall is blocking port 8001.
- **Changed `frontend/.env`?** Restart Expo: stop it (Ctrl+C) and run `npx expo start --clear`
  (`EXPO_PUBLIC_*` values are baked in at start).
- **Guest/corporate Wi-Fi** often blocks phone↔computer traffic. Easiest fix: turn on
  your **phone's hotspot** and connect the computer to it (then re-read the LAN IP),
  or use `npx expo start --tunnel`.
- **Maps:** in Expo Go, iOS shows Apple Maps and Android uses Expo's Google key. Your
  own `app.json` Google Maps key only applies in an EAS build.

## Later: a standalone build (real Google Maps, no dev server)
```bash
npm install -g eas-cli
eas login              # free Expo account
eas init
eas build -p android --profile preview   # installable APK
eas build -p ios --profile preview       # needs Apple Developer account for device install
```
