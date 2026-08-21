# Hosting RideBuddy on ridebuddy.co.in (India-first)

Decision record for putting a public website on `www.ridebuddy.co.in` and moving the
backend off localhost, with the assumption that **nearly all traffic originates in India**.

## TL;DR — the stack

| Layer | Pick | Cost (MVP) |
|---|---|---|
| Domain + DNS | **Cloudflare** (free plan, nameservers moved to CF) | ₹0 (domain ~₹700–1,200/yr) |
| Marketing site `www.ridebuddy.co.in` | **Cloudflare Pages** — static, free, ~8 Indian PoPs | ₹0 |
| API `api.ridebuddy.co.in` | **DigitalOcean App Platform, Bangalore (BLR1)** | ~$5/mo |
| Database | **MongoDB Atlas, AWS Mumbai (`ap-south-1`)** | ₹0 on M0 |

Total to go live: the domain, plus roughly **$5/month**. Everything stays inside India.

Single-vendor alternative: run all of it in **AWS Mumbai (`ap-south-1`)** — Amplify Hosting
for the static site, App Runner or Lightsail for the API, Atlas peered into the same region.
More moving parts, but AWS India (AISPL) invoices in **INR with GST**, which matters if
RideBuddy is a GST-registered entity claiming input tax credit.

## Why region, not brand, is the decision

The customer app polls booking status every 3s and does an OTP → estimate → book →
poll round-trip before a driver is assigned. Round-trip time from an Indian mobile
network, approximately:

| API region | Typical RTT |
|---|---|
| Mumbai / Bangalore | 20–40 ms |
| Singapore | 60–90 ms |
| Frankfurt | 120–160 ms |
| US East | 220–260 ms |

A US-hosted API adds ~0.2s to *every* call. Across the booking flow that is the
difference between "instant" and "laggy" on a ₹199 booking. Host the API in India.

Static assets are less sensitive because a CDN caches them at the edge either way —
but Cloudflare's free tier already has PoPs in Mumbai, Delhi, Chennai, Bengaluru,
Hyderabad and Kolkata, so there is no reason to take less.

## What we deliberately did *not* pick

- **Shared cPanel hosting** (Hostinger India / BigRock / GoDaddy India / Bluehost India).
  It will happily serve a static landing page, and then dead-ends: `server.py` is an
  **ASGI app that needs a long-lived `uvicorn` process**, which shared hosting does not
  give you. You would have to re-platform the moment `/api/*` goes live. Skip it.
- **Vercel / Netlify.** Fine for the static half, but their India function regions are
  paid-plan features and you would still need a separate home for FastAPI. Two vendors
  for the price of the problem Cloudflare Pages solves for free.
- **Render.** Good DX, but no Indian region — nearest is Singapore, +60–90 ms.
- **A single VPS running everything** (DO Droplet / Hetzner / EC2). Cheapest on paper,
  but you own TLS renewal, systemd, log rotation, backups and the 3am reboot. Worth it
  later; not for launch.

## India-specific gates that will actually block launch

Not legal advice — but these are the ones that bite in practice:

1. **Razorpay live-mode activation requires public policy pages** on the website:
   Terms & Conditions, Privacy Policy, Refund / Cancellation Policy, service-delivery
   terms, Pricing, and a Contact Us page carrying a real address and phone number.
   The site is a prerequisite for taking real money — design the routes for it now.
2. **Play Store and App Store both require a public Privacy Policy URL.** Same site.
3. **DPDP Act 2023.** Phone numbers plus pickup/drop coordinates are personal data.
   Keeping it in an Indian region is the simplest defensible posture.
4. **Card data:** never store it. The current code only HMAC-verifies the Razorpay
   signature server-side, which is correct — keep it that way and RBI's payment-data
   localisation rules stay Razorpay's problem, not ours.
5. **CERT-In (April 2022 directions):** retain logs ~180 days and sync server clocks to
   NIC/NPL NTP. Cheap to do on day one, annoying to retrofit.

## Do not ship the Expo web bundle as the marketing site

`frontend/app.json` sets `web.output: "static"`, so `npx expo export --platform web`
produces a static folder that Cloudflare Pages can host directly. That is the right
tool for a **browser-usable version of the app** — but it is a multi-megabyte
React-Native-Web bundle with client-side routing, which is poor for SEO and slow on
Indian 4G.

Split them:

- `www.ridebuddy.co.in` → a small hand-written static landing page (hero, how it
  works, pricing, app store links, and the policy pages Razorpay demands).
- `app.ridebuddy.co.in` (optional, later) → the Expo web export, if a browser booking
  flow is ever wanted.

## Setup order

1. **DNS.** Move the `.co.in` nameservers to Cloudflare. Records:
   - `ridebuddy.co.in` + `www` → Cloudflare Pages (proxied)
   - `api` → the App Platform hostname (proxied, so the origin IP stays hidden)
2. **Database.** Create an Atlas cluster in **AWS `ap-south-1` (Mumbai)**. Set
   `USE_INMEMORY_DB=false` and point `MONGO_URL` at it — the in-memory store loses every
   user and booking on restart, which reads to users as "User not found" 401s.
3. **API.** Deploy `backend/` to DO App Platform (BLR1), run command:
   `uvicorn server:app --host 0.0.0.0 --port $PORT`. Set `MONGO_URL`, `DB_NAME`,
   `JWT` secret, `RAZORPAY_*`, `TWILIO_*` as app-level secrets — never in git.
4. **Lock down CORS.** `backend/server.py:1094` sets `allow_origins=["*"]` alongside
   `allow_credentials=True` (line 1093). That pairing is fine while only the native apps
   call the API, but it is the exact combination browsers refuse for credentialed
   requests — so it breaks the moment a browser origin exists. Replace the wildcard with
   an explicit list: `["https://ridebuddy.co.in", "https://www.ridebuddy.co.in"]`.
   (Auth travels as an `Authorization: Bearer` header, not a cookie, so nothing else
   needs to change.)
5. **Split the Google Maps key.** `src/maps.ts` reads `EXPO_PUBLIC_GOOGLE_MAPS_KEY`
   from the JS bundle, so on web that key is **publicly readable**. Issue a *separate*
   browser key restricted by HTTP referrer to `*.ridebuddy.co.in`, and keep the
   existing native key restricted by bundle ID / package name.
6. **Point the apps at production.** `EXPO_PUBLIC_BACKEND_URL=https://api.ridebuddy.co.in`
   in both `frontend/.env` and `RideBuddy-partner/.env`. These are baked in at Metro
   start / build time, so rebuild — don't just edit and reload.

## When to spend more

| Signal | Move |
|---|---|
| API CPU pegged, or >~50 concurrent bookings | App Platform Basic → Professional ($12→$25/mo) |
| Atlas M0 connection limit / 512MB full | M10 (~$57/mo), same Mumbai region |
| Need staging + prod | Second App Platform app on a `staging.` subdomain |
| Real-time driver tracking replaces 3s polling | WebSockets — App Platform supports them; revisit region pinning first |
