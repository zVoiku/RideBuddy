# ridebuddy.co.in

| URL | What | Source |
|---|---|---|
| `/` | Holding page — "RideBuddy — Coming soon" | `src/index.html` |
| `/estimate/` | The fare estimator — the customer app's estimate flow, on the web | `src/estimate/` |
| `/beta/` | The design-canvas artboard, shared by link (`noindex`) | `../Webpage`, assembled by `build.mjs` |
| `/api/waitlist`, `/api/buddy` | Where the site's forms save | `worker/index.js` → D1 |
| `/admin` | The two lists as CSV downloads, behind a password | `worker/index.js` |

From the repo root, `npm run build` installs this folder's dependencies and
writes `website/dist` — the directory Cloudflare uploads. From here,
`npm run preview` builds and serves the site *and* the Worker on :8099 with
`wrangler dev` (local D1 under `../.wrangler/`; put `ADMIN_PASSWORD=…` in a
git-ignored `../.dev.vars` to open the local `/admin`).

## The estimator

`/estimate/` mirrors the app: the form in `frontend/app/home.tsx` and the
result in `frontend/app/booking/summary.tsx`.

- **Form** — trip type (Round Trip / One Way / Hourly), pickup and destination
  from Google Places, pickup date and time, return date and the stay question
  for round trips, hours for hourly. No booking: the result leads to the
  waitlist.
- **Map picker** — each place field carries a map button that opens a modal
  map. **Tap one of Google's places and it is selected by name** ("National
  Museum, New Delhi"), which is what a customer means when they point at a
  landmark; anywhere else, drag the map under the fixed centre pin to place an
  arbitrary point. Then "Use this location". For an address autocomplete can't
  pin precisely — a house, a gate, a spot on a highway. The point is what
  routing and the fare use; the name is only a caption, so the picker still
  works (captioned with coordinates) if the Geocoding API is ever removed from
  the key. A tapped place keeps its own name rather than being re-captioned
  with the street address its coordinates reverse-geocode to. The service
  radius gates a pinned point exactly as it gates a searched one.
- **Route** — Directions gives the one-way distance and drive time, exactly as
  the app's `getDirections()` does. Both feed the fare engine.
- **Fare** — `src/estimate/fare-engine.js` is a line-for-line port of
  `fare_breakdown` in `backend/server.py`, including the IST night window,
  §2.2 day rounding, the legacy ₹249/h hourly rate, and Python's
  half-to-even rounding. `npm test` runs 1,690 trips through both and fails on
  the first differing field.
- **Result** — one number and the app's inclusion lines verbatim, the route on
  an interactive map with tap-to-expand, "Edit trip details", then Book a
  Buddy → waitlist. No deposit line, no itemisation (§2.4). Joining the
  waitlist here saves the trip just priced with the number (see below).

**Service area.** Pickups within 25 km of Chandigarh (the Tricity);
destinations within 600 km (Delhi, Amritsar, Manali, Dharamshala, Rishikesh,
Jaipur). Autocomplete is restricted to a box of that size and the chosen place
is checked against the radius — constants at the top of `src/estimate/maps.js`.

**Time is IST.** Pickup date and time are Indian wall-clock time whatever the
visitor's browser zone, because the night charge and the calendar-day rule are
IST rules. The backend applies the same conversion.

**Google APIs it actually calls:** Maps JavaScript API, Places API (New),
Directions API, and Geocoding API (reverse geocoding for the map picker — the
browser `Geocoder`, not the web service, so the referrer-restricted key works).
`staticMapUrl()` exists for parity with the app but is unused, so Maps Static
API is optional on the key.

**Design.** Same tokens and components as the artboard: `_ds/` is copied to
`dist/_ds/` and `Button`, `Input`, `Chip`, `Badge` come from the design-system
bundle, with plain fallbacks so a bundle hiccup degrades to unstyled inputs
rather than a blank page.

## Forms, the lists and `/admin`

The site has three forms and nothing is emailed: they post JSON to the Worker
(`worker/index.js`), which validates, stores a row in Cloudflare D1 and
answers `{ ok: true }` — or an error the page shows under the field, so a
failed save is never shown as a success.

| Form | Where | Endpoint | D1 table |
|---|---|---|---|
| Join the waitlist | `/beta/#contact` | `POST /api/waitlist` (`source: contact`) | `waitlist` |
| Join the waitlist | under an `/estimate/` result | `POST /api/waitlist` (`source: estimate`, plus the trip) | `waitlist` |
| Apply to be a Buddy | `/beta/#contact`, the footer's "Become a Buddy", or `/beta/#apply` | `POST /api/buddy` | `buddies` |

- **Phone numbers** (`normalizePhone` in `worker/lib.js`): any format. Indian
  numbers must come to 10 digits once `+91` / `91` / `0` is gone and are stored
  as `+91XXXXXXXXXX`; a number starting with `+` or `00` and a country code other
  than 91 is foreign, accepted in any format and stored as `+` and its digits.
  Name and licence are required, free text, never format-checked.
- **The trip** of an estimate-page signup is worded by the Worker, not the
  page: `Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00 · ₹5,492`.
- **Every submission is kept.** The downloads mark a phone number already on
  the same list as `(repeat)`; nothing is merged or dropped.
- **Spam:** a hidden `website` field only bots fill in (the Worker answers 200
  and keeps nothing), same-origin JSON only, and at most 20 submissions per
  network per hour across both forms (IPv6 counted per /64). The network is
  stored as a salted hash and forgotten after an hour. If junk still gets
  through, Cloudflare Turnstile is the next step.
- **Tables create themselves** on first use (`CREATE TABLE IF NOT EXISTS`), so
  the database needed no setup step.

**`/admin`** (username `admin`, password the `ADMIN_PASSWORD` secret) shows
each list's count and a **Download CSV** button:
`ridebuddy-clients-YYYY-MM-DD.csv` (ID, Submitted (IST), Phone, Source, Trip,
Repeat) and `ridebuddy-buddies-YYYY-MM-DD.csv` (ID, Submitted (IST), Name,
Phone, Licence, Repeat). The CSVs are UTF-8 with a byte-order mark so Excel
shows ₹ and non-Latin names correctly, and a cell starting `=`, `+`, `-` or `@`
is prefixed with `'` so it opens as text (phone numbers excepted). Note that
Excel and Google Sheets display `+919870871324` as a number unless the column
is imported as text.

- With **no `ADMIN_PASSWORD`, `/admin` is locked** (503), never open: the lists
  hold phone and licence numbers. Set it under **Workers & Pages → ridebuddy →
  Settings → Variables and secrets → Add → Secret**. (The dashboard refuses
  secrets on an assets-only Worker; this one has a script now.)
- Ten wrong passwords lock that network out of `/admin` for an hour. Plain
  HTTP redirects to HTTPS first, since Basic auth sends the password each time.
- To delete a row: Cloudflare → **Storage & databases → D1 → ridebuddy →
  Console**, then `DELETE FROM waitlist WHERE id = 17;` (or `buddies`), using the
  ID column of the download.

## The Google Maps key

`src/estimate/maps.js` reads `GOOGLE_MAPS_BROWSER_KEY`, which `build.mjs`
compiles into `dist/estimate/app.js`. A browser key is public by design; its
protection is the HTTP-referrer restriction and the short list of APIs enabled
on it. It is **never committed**:

- locally, put `GOOGLE_MAPS_BROWSER_KEY=…` in `website/.env` (git-ignored);
- on Cloudflare, add it under **Workers → Settings → Build → Variables**.

The build **fails** in CI when the variable is missing, rather than deploying
an estimator whose map cannot load. Locally it warns and builds without it.

The app's key cannot be reused here: mobile apps send no referrer, so that key
has no referrer restriction. Keep the two separate.

## `../Webpage` is the source of truth for the artboard

The artboard is authored in Claude Design and committed to `Webpage/`. **Never
edit the copy under `dist/`** — it is regenerated on every build. Re-export the
canvas into `Webpage/` and rebuild.

`build.mjs` fixes up the artboard on the way through:

1. **`RideBuddy Website.dc.html` → `beta/index.html`.** The filename has a space
   in it; `/beta/` needs an index.
2. **Runtime CDN dependency removed.** `support.js` fetches React, ReactDOM and
   `@babel/standalone` from `unpkg.com` on load — the page renders *blank* if
   unpkg is unreachable. They are vendored from `node_modules` and the URLs
   rewritten to relative paths.
3. **Images re-encoded to WebP.** The three hero PNGs are 4.85 MB; at quality 82
   they are 374 KB with no visible difference.
4. **`noindex` injected** — a browser-compiled "coming soon" artboard must not
   rank for the brand.
5. **Every "Estimate" CTA navigates to `/estimate/`** — nav link, hero button,
   the Round/One-way cards, Book a Buddy. The artboard's own estimator is
   superseded; there is one estimator, not two.
6. **Real URLs.** Its pages switch in place, so they get hashes:
   `/beta/#how-it-works`, `#about`, `#contact` (Home is plain `/beta/`), with
   Back and Forward working and real `href`s on the links. `/beta/#apply`
   opens the Buddy application — one link to share with drivers.
7. **The forms save.** The Contact-page waitlist posts to `/api/waitlist`
   (before: it did nothing); Apply to be a Buddy posts to `/api/buddy` (before:
   it opened the visitor's mail app, and most phones have none set up) and
   confirms "Application received. We'll call you to take it forward."

5–7 are text patches listed in `artboard-patches.mjs`. Each must match the
artboard an exact number of times (once, unless it says otherwise). A canvas
re-export that changes one of those spots fails the build here, loudly,
instead of shipping a half-patched page.

## Tests

```bash
npm test                 # fare parity vs backend/server.py (needs backend/.venv)
npm run build && npm run test:worker
                         # the Worker: helpers, then every endpoint under
                         # `wrangler dev` with a throwaway local D1
NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  node test/verify.mjs   # end to end in a browser against real Google APIs
```

`test:worker` covers phone formats, the trip wording, CSV quoting and formula
neutralising, then over HTTP: the locked `/admin` without a password, saving
and refusing (field messages, wrong origin, non-JSON, oversize, honeypot),
`(repeat)` marking, the CSV layout, Basic auth and its lockout, the HTTPS
redirect, and the flood cap.

`verify.mjs` serves `dist/` and the Worker with `wrangler dev`, drives the
pages headless — one way, a late departure, a three-day round trip, hourly, an
out-of-area pickup, the map picker (open, drag, re-caption, tap a place,
confirm, then price the pinned point), fullscreen map, mobile viewport — and
re-prices every estimate with the backend's `fare_breakdown` on the exact
inputs the page used. Then the forms: joining the waitlist under an estimate,
the `/beta` Contact waitlist and a Buddy application from `/beta/#apply`, each
refused once with a bad number and then read back from the admin download;
plus `/beta`'s URLs, Back, and the CTA redirect.

Tapping a place icon is exercised by firing the click Google fires for one (a
click carrying a `placeId`) rather than hunting for the icon's pixel, which is
unreliable headlessly: that tests this page's handler, and leaves "are the
icons clickable" to Google's side of the contract.

By default it serves the build as **`www.ridebuddy.co.in` on port 80**, resolved
to 127.0.0.1 inside Chromium, so the browser sends the production referrer —
the one the key actually allows. Google's referrer patterns take no wildcard
port (`localhost:*/*` matches nothing); if your key allows an explicit
`localhost:8098/*`, run with `VERIFY_HOST=localhost VERIFY_PORT=8098`. When
`HTTPS_PROXY` is set (the Claude Code sandbox), every Google request is replayed
from Node through the proxy and fulfilled into the page, because Chromium's own
tunnels through that proxy fail; elsewhere the browser fetches directly.

## Deploying (Cloudflare Workers Builds)

One Worker: the static files in `./website/dist` plus the script
`./website/worker/index.js`, bound to the D1 database `ridebuddy`.
`wrangler.jsonc` lives at the **repository root** because Workers Builds runs
from there. Static files are served before the script runs, so the script only
sees `/api/*` and `/admin`.

| Field | Value |
|---|---|
| Repository | `zVoiku/RideBuddy` |
| Project name | `ridebuddy` (must match `name` in `wrangler.jsonc`) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Build variable | `GOOGLE_MAPS_BROWSER_KEY` |
| Secret (runtime) | `ADMIN_PASSWORD` — Settings → Variables and secrets |
| D1 binding | `DB` → `ridebuddy` (`database_id` in `wrangler.jsonc`) |

Preview builds of other branches (`wrangler versions upload`) bind the same
database, so test submissions from a preview land in the real lists.

Validate config changes locally with `npx wrangler deploy --dry-run`.

## Known limitations

- **One shared admin password**, no per-person accounts or audit trail. If
  more people need the lists, put `/admin` behind Cloudflare Access instead.
- The artboard's own estimator (unreachable since every Estimate link goes to
  `/estimate/`) still has its unwired waitlist; it is dead code, left as is.
- **Hourly is priced at the legacy ₹249/h** and is not in Rate Table v1.7; the
  backend marks it `uncovered_by_rate_table`.
- **`/beta/` is not server-rendered** — the artboard is compiled in the browser
  by Babel. Fine for a link-shared preview; hence `noindex`.
- **`.image-slots.state.json` 404s** in the `/beta/` console — an authoring-tool
  probe from `image-slot.js`, harmless.
- The map uses the classic `google.maps.Marker`; moving to Advanced Markers
  needs a Map ID from the Cloud console.
- Routing uses `google.maps.DirectionsService`, the browser twin of the
  Directions web service the app calls. Google marked it deprecated in
  February 2026 in favour of `google.maps.routes.Route.computeRoutes` (not
  scheduled for shutdown). Switching means enabling the Routes API on the key
  and migrating the app's `getDirections()` at the same time, so both sides
  keep pricing on the same route.
- Live routing puts Sector 17 → Shimla at ~114 km, so the calculator reads
  ₹1,611 against the marketing table's ₹1,612 at a nominal 115 km. Expected;
  the table is labelled "typical".
