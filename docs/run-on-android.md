# Run RideBuddy on an Android phone (from a fresh MacBook)

A complete, from-scratch setup. The app runs on your **phone**, talking to a backend +
Metro dev server on your **Mac** over the same Wi-Fi.

> `.env` files are **not** in the repo (they hold keys), so you create them locally in
> steps 2 and 4. Ask whoever shared the project for a **Google Maps API key** (or make
> your own in Google Cloud). Twilio/Razorpay are optional — without them, OTP and
> payments run in mock mode.

## Prerequisites (install once)
- **Node 20+** and **Git** — `brew install node git` (or from nodejs.org)
- **Python 3.10+** — `brew install python` (or python.org)
- **Watchman** (recommended) — `brew install watchman`
- A free **Expo account** — sign up at https://expo.dev (needed for the cloud build)
- An **Android phone** on the same Wi-Fi as the Mac

## 1. Clone the repo
```bash
git clone https://github.com/zVoiku/RideBuddy.git
cd RideBuddy
git checkout claude/epic-johnson-fo6eu5
```
(If the repo is private, you must be added as a collaborator first.)

## 2. Start the backend (in-memory DB — no database to install)
```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements-dev.txt
```
Create `backend/.env`:
```
DB_NAME=ridebuddy
USE_INMEMORY_DB=true
MONGO_URL=mongodb://localhost:27017
```
Leaving Twilio/Razorpay out ⇒ **OTP is mock** (any 6 digits) and **payments are mock**
(booking completes without a real charge). Add those keys later if you want the real flows.

Run it (leave this terminal open):
```bash
backend/.venv/bin/uvicorn --app-dir backend server:app --host 0.0.0.0 --port 8001
```
`--host 0.0.0.0` is what lets the phone reach it.

## 3. Find your Mac's Wi-Fi IP
```bash
ipconfig getifaddr "$(route -n get default | awk '/interface:/{print $2}')"
```
Example: `192.168.1.20`.

## 4. Create the frontend env
Create `frontend/.env` (use **your** IP and a Google Maps key):
```
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.20:8001
EXPO_PUBLIC_GOOGLE_MAPS_KEY=YOUR_GOOGLE_MAPS_KEY
```

## 5. Install JS dependencies
```bash
cd frontend
npm install
```

## 6. Build the Android app — EAS cloud (no Android Studio needed)
```bash
npm install -g eas-cli
eas login                       # your free Expo account
eas init                        # links a project under your account (writes projectId)
# make the Maps key available to the cloud build (it can't read your local .env):
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_KEY --value YOUR_GOOGLE_MAPS_KEY
eas build --profile development --platform android
```
Wait for the cloud build (~10–20 min). When it finishes, EAS gives a **link/QR to download
the APK**.

## 7. Install the APK on the phone
- Open the build link on the phone and download the `.apk`.
- Tap it to install; allow **"install from unknown sources / this source"** when prompted.

## 8. Run it
Two terminals on the Mac:
- **Backend** — already running from step 2.
- **Metro** — `cd frontend && npx expo start --dev-client`

Open the **RideBuddy** app on the phone (same Wi-Fi). If it shows a launcher, tap
**"Enter URL manually"** and type `http://192.168.1.20:8081` (your Mac IP, port 8081).

Log in with any 10-digit number + OTP `123456` (mock mode). Done. 🎉

Day-to-day after this: just start the **backend** + **`npx expo start --dev-client`** and
open the app. Rebuild (step 6) only when native dependencies change.

---

## Alternative: local build (no cloud account, but needs Android Studio)
1. Install **Android Studio** + the **Android SDK**; set `ANDROID_HOME` and add
   `platform-tools` to your `PATH`.
2. On the phone: enable **Developer options** (tap *Build number* 7×) and **USB debugging**,
   then connect via USB and authorize the Mac.
3. From `frontend/`:
   ```bash
   npx expo run:android
   ```
This reads `frontend/.env` directly, so **no EAS secret** is needed. It builds, installs,
and starts Metro. (Tip: over USB you can even skip Wi-Fi — `adb reverse tcp:8081 tcp:8081`
and `adb reverse tcp:8001 tcp:8001`, then use `localhost` URLs.)

## Troubleshooting
- **"Network request failed" in the app** → backend not running, or `EXPO_PUBLIC_BACKEND_URL`
  has the wrong IP. Phone + Mac must be on the same Wi-Fi. Test from the phone's browser:
  `http://<mac-ip>:8001/api/` → should show `{"message":"RideBuddy API"}`.
- **Map is blank** → the Google Maps key is missing/invalid, or these APIs aren't enabled on
  it: **Maps SDK for Android, Directions, Places, Geocoding, Maps Static**. If the key is
  restricted to specific apps, either use an unrestricted key or add this build's package
  `com.ridebuddy.app` + its SHA-1.
- **"No development servers found"** → enter the Metro URL manually: `http://<mac-ip>:8081`.
- **Mac's Wi-Fi IP changed** → update the IP in `frontend/.env` and restart Metro with
  `npx expo start --dev-client --clear`.
- **"User not found" after restarting the backend** → the in-memory DB resets on restart;
  just log out and log back in.
