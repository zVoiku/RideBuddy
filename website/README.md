# ridebuddy.co.in

| URL | What | Source |
|---|---|---|
| `/` | Holding page — "RideBuddy — Coming soon" | `src/index.html` |
| `/estimate/` | The fare estimator — the customer app's estimate flow, on the web | `src/estimate/` |
| `/beta/` | The design-canvas artboard, shared by link (`noindex`) | `../Webpage`, assembled by `build.mjs` |
| `/api/waitlist`, `/api/feedback`, `/api/buddy` | Where the site's forms and the fare 👍/👎 save | `worker/forms.js` → D1 |
| `/site.js`, `/api/e` | The site's own analytics: the script on every page, and where it reports | `src/site.js`, `worker/analytics.js` → D1 |
| `/admin` | The three lists as CSV downloads and the analytics dashboard, behind a password | `worker/admin.js`, `worker/dashboard.js` |

From the repo root, `npm run build` installs this folder's dependencies and
writes `website/dist` — the directory Cloudflare uploads. From here,
`npm run preview` builds and serves the site *and* the Worker on :8099 with
`wrangler dev` (local D1 under `../.wrangler/`; put `ADMIN_PASSWORD=…` in a
git-ignored `../.dev.vars` to open the local `/admin`).

## The estimator

`/estimate/` mirrors the app: the form in `frontend/app/home.tsx` and the
result in `frontend/app/booking/summary.tsx`.

- **Header** — the main site's header, element for element: logo, Home ·
  How It Works · About · Contact, "Get an Estimate", and the full-screen menu
  below 1120px (`SiteHeader` in `src/estimate/app.jsx`, styles in
  `src/estimate/index.html`, CTA from the same design-system `Button`). There
  is no "Estimate Fare" link — "Get an Estimate" goes to the same page — so
  nothing is underlined here; on this page "Get an Estimate" brings back the
  form, trip kept, instead of reloading. The links point at `/beta/` through
  one constant, `SITE` — change it when the site moves to the root.
  `verify.mjs` measures this header and `/beta/`'s (and both phone menus) and
  fails if they drift apart.
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
- **Fare** — Rate Table v1.10. `src/estimate/fare-engine.js` is a
  line-for-line port of `fare_breakdown` in `backend/server.py`: Trip Days of
  12 hours' duty, the one-way return charge, the long-drive rule (rest stop or
  drive-through), the night charge on more than 15 minutes of duty between
  10 PM and 6 AM IST, and the legacy ₹249/h hourly rate, summed exactly from
  whole metres and seconds and rounded once, halves up. The rates themselves
  are `../rates.json` (see "The rates" below). `npm test` runs over 10,000
  trips through both engines and fails on the first differing field, and
  prices all sixteen of the rate table's worked examples through both.
- **Get Estimate** stays disabled until the trip is complete, with one line
  under it saying what is still missing (a pickup chosen from the suggestions
  or the map, a destination, a date that hasn't passed, a return on or after
  the departure, a time, the hours).
- **Result** — the route on an interactive map with tap-to-expand, and under
  it two tiles: EST. TRIP TIME and EST. DISTANCE (time to the nearest 5
  minutes, distance to the km, as §2.4 says; the fare uses the exact values;
  a round trip shows the total and "… each way", one way says "One way"; none
  for hourly). Past 12 hours of driving, the safety warning ("This trip needs
  more than 12 hours of driving. Your Buddy needs rest for a safe trip. The
  fare includes a rest stop.") and a switch, "Drive through without the rest
  stop — only if you and your Buddy both agree", that re-prices the same route
  on the drive-through plan as a new estimate. Then one number, "Inclusive of
  all taxes", and 👍/👎 beside it ("Does this fare work for you?"): a 👎 opens
  an optional comment (280 characters, Send, then "Thank you. Noted."). The
  §2.4 lines follow — 12 hours of your Buddy's time from pickup (on each day),
  food, the stay, the night charge and the long-drive plan when they apply;
  tolls extra, paid on the road; extra time charged by the minute in the final
  fare — the same lines the app shows,
  then "Final fare is calculated when your trip ends." and the disclaimer
  ("Indicative fare for the route, date and time you entered, … Terms of Use
  apply."; hourly has its own wording). Then "Edit trip details" and the
  waitlist (+91 field and the consent tick). No "Book a Buddy" until booking
  opens; no deposit line, no itemisation (§2.4). A vote and a signup made on
  the same fare land on the same row of the clients list (see below).

**The stay question** ("Will you arrange your Buddy's overnight stay?") shows
only on round trips over more than one day (§5.2); a same-day round trip long
enough for a rest stop includes its stay.

**The rates.** Every rate is in `rates.json` at the repo root — Rate Table
v1.10 §3.4, plus the deposit and the legacy hourly rate. The backend reads it
at startup; `build.mjs` compiles it into `/estimate/` and into `/beta/`'s
`rate-config.js` (built from `src/estimate/artboard-rates.js`, so the
artboard's copy of the rates is never shipped). To change a rate: edit
`rates.json`, run `npm test` (parity) and the backend tests, restart the
backend, and merge to main so Cloudflare rebuilds the site. Money is in rupees
with at most two decimals; the backend refuses anything finer.

**Service area.** Pickups within 25 km of Chandigarh (the Tricity);
destinations within 600 km (Delhi, Amritsar, Manali, Dharamshala, Rishikesh,
Jaipur). Autocomplete is restricted to a box of that size and the chosen place
is checked against the radius — constants at the top of `src/estimate/maps.js`.

**Time is IST.** Pickup date and time are Indian wall-clock time whatever the
visitor's browser zone, because the night window and the round trip's return
day are IST rules. The backend applies the same conversion.

**Google APIs it actually calls:** Maps JavaScript API, Places API (New),
Directions API, and Geocoding API (reverse geocoding for the map picker — the
browser `Geocoder`, not the web service, so the referrer-restricted key works).
`staticMapUrl()` exists for parity with the app but is unused, so Maps Static
API is optional on the key.

**Design.** Same tokens and components as the artboard: `_ds/` is copied to
`dist/_ds/` and `Button`, `Input`, `Chip` come from the design-system
bundle, with plain fallbacks so a bundle hiccup degrades to unstyled inputs
rather than a blank page.

## Forms, the lists and `/admin`

The site's forms email nothing: they post JSON to the Worker
(`worker/index.js`), which validates, stores a row in Cloudflare D1 and
answers `{ ok: true }` — or an error the page shows under the field, so a
failed save is never shown as a success. No form sends a code by SMS.

| Form | Where | Endpoint | D1 table |
|---|---|---|---|
| Join the Waitlist pop-up | `/beta/`'s hero and the closing band on every page | `POST /api/waitlist` (`source: home \| how \| about \| contact`, the page it was opened on) | `waitlist` |
| Join the waitlist | `/beta/#contact` | `POST /api/waitlist` (`source: contact`) | `waitlist` |
| Join the waitlist | under an `/estimate/` result | `POST /api/waitlist` (`source: estimate`, the trip and its `estimate_id`) | `waitlist` |
| 👍/👎 on a fare, and a 👎's comment | an `/estimate/` result | `POST /api/feedback` (`estimate_id`, `vote: up \| down`, optional `comment`, the trip) | `waitlist` |
| Apply to be a Buddy — Individual Buddy | `/beta/#contact`, the footer's "Become a Buddy", or `/beta/#apply` | `POST /api/buddy` (`type: individual`) | `buddies` |
| Apply to be a Buddy — Driver agency | the same form, "Driver agency" chosen | `POST /api/buddy` (`type: agency`) | `agencies` |

- **Phone numbers** (`normalizePhone` in `worker/lib.js`): Indian mobiles only.
  Every form shows a fixed `+91` beside a 10-digit field; whatever is typed or
  pasted must come to 10 digits once a `+91` / `0091` / `91` / `0` prefix is
  gone, and is stored as `+91XXXXXXXXXX`. Any other country code is refused.
- **Consent.** Every waitlist form has the tick "Send me an SMS or WhatsApp
  when booking opens. I agree to the Privacy Policy and Terms of Use." and
  can't be sent without it; the row's Consent column says Yes. A page cached
  from before the tick sends no `consent` at all: that signup is kept with
  Consent blank. The Buddy form has no tick.
- **Buddy applications.** Individual: full name, mobile, driving licence
  number, city or base — all required, free text. Agency: agency name, contact
  person, mobile and city or base (required); drivers you can supply (1–5,
  6–20, 21–50, 50+), work email and GSTIN (optional; an email must look like
  one, a GSTIN must be 15 characters in the GST pattern). A page cached from
  before the city field is still accepted without it.
- **Votes on fares.** `/estimate/` gives each fare it shows a random
  `estimate_id`. The first 👍/👎 on that fare adds a waitlist row with Phone
  blank; changing it updates the row (the latest vote wins, a comment stays).
  Joining the waitlist from the same fare fills in that row's phone, so vote
  and number sit on one line; a vote cast after joining lands on the signup's
  row. A 👎 comment from someone who never joins stays on its row with no
  phone. A comment that is only a link is refused. Votes are never counted as
  signups.
- **The trip** of an estimate-page row is worded by the Worker, not the page:
  `Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00`, with the fare in its
  own column. Rows saved before that column existed carry the fare at the end
  of the trip; the download splits it off.
- **Every submission is kept.** The downloads mark a phone number already on
  the same list as `(repeat)`; nothing is merged or dropped.
- **Spam:** a hidden `website` field only bots fill in (the Worker answers 200
  and keeps nothing), same-origin JSON only, and at most 20 form submissions
  per network per hour across the forms, plus 60 votes (IPv6 counted per /64).
  The network is stored as a salted hash and forgotten after an hour. If junk
  still gets through, Cloudflare Turnstile is the next step.
- **Tables create themselves** on first use (`CREATE TABLE IF NOT EXISTS`), so
  the database needed no setup step. Columns added since are added to an older
  database in place the first time the Worker opens it (`ADDED_COLUMNS` in
  `worker/db.js`); existing rows keep their data, with the new columns blank.

**`/admin`** (username `admin`, password the `ADMIN_PASSWORD` secret) shows
each list's count and a **Download CSV** button:

| File | Columns |
|---|---|
| `ridebuddy-clients-YYYY-MM-DD.csv` | ID, Submitted (IST), Phone, Source, Trip, Fare (₹), 👍/👎, Comment, Consent, Repeat |
| `ridebuddy-buddies-YYYY-MM-DD.csv` | ID, Submitted (IST), Name, Phone, Licence, City or base, Repeat |
| `ridebuddy-agencies-YYYY-MM-DD.csv` | ID, Submitted (IST), Agency name, Contact person, Phone, City or base, Drivers, Work email, GSTIN, Repeat |

In the clients list, Phone is blank on a vote from someone who didn't join;
Comment is only ever a 👎's. The CSVs are UTF-8 with a byte-order mark so Excel
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
  Console**, then `DELETE FROM waitlist WHERE id = 17;` (or `buddies`,
  `agencies`), using the ID column of the download.

## Analytics

The site counts its own visits: no Google Analytics, no cookies on visitors,
nothing sent anywhere but this Worker. `build.mjs` adds `/site.js` (from
`src/site.js`, minified, ~1.6 KB gzipped) to every page; it batches events and
posts them to `POST /api/e`, and `/admin` shows the numbers.

**What is recorded**

| Event | When | Details kept |
|---|---|---|
| `pageview` | every page, and each `/beta/#…` page | the page; on arrival, the referring site and any `utm_*` |
| `click` | any link or button | its own label, the page, the part of the page (header, footer, the artboard's section, the estimate form…), a link's target page |
| named events | the pages' existing `dataLayer` pushes | e.g. `estimate_completed` with trip type, pickup area and city, destination city, distance, fare, days ahead, weekday, hour |
| `perf` | when a page is left | largest-paint time, load time, connection type |
| `js_error` | a script error | the message (first 120 characters) |

Named events: `estimator_opened`, `estimate_started`, `estimate_completed`,
`place_refused` (pickup outside the Tricity, destination past 600 km — area and
city only), `route_not_found`, `route_failed`, `maps_failed`, `map_point_picked`,
`fare_feedback` (`vote: up | down`, and whether a comment was sent — never
its text), `waitlist_opened` (the pop-up, and the page it was opened on),
`waitlist_joined` (`source: home | how | about | contact | estimate`),
`phone_invalid`, `form_invalid`, `save_failed` (`form: …`),
`buddy_application_opened` (including from a `/beta/#apply` link),
`buddy_application_submitted` (`type: individual | agency`).

**Never recorded:** anything typed into a form — phone numbers, names,
licences, agency details, comments — and no street addresses: places are reduced to their area and city
("Sector 17", "Chandigarh") from Google's address parts in `maps.js`, and
suggestion lists are marked `data-rb-private`, so a click on one counts as
"place suggestion" without its text. `verify.mjs` reads the stored events back
after a full run and fails if a phone number, name, licence, agency detail,
comment or address appears.

**Visitors without cookies or IPs.** A visitor is a hash of the day's random
salt, their network (IPv4 address, or IPv6 /64) and their browser's user agent.
The salt changes daily and old ones are deleted, so visitors are counted per
day and can't be followed across days or traced back; no IP is stored.
Crawlers (by user agent), automated browsers (`navigator.webdriver`) and
browsers marked "Don't count this browser" on `/admin` (an `rb_exclude` cookie
set only there, for both `ridebuddy.co.in` and `www`) aren't counted. Script
blockers hide visits, as with any analytics.

**Storage.** One D1 row per beacon (`beacons`), kept 13 months. Finished days
are summed into `daily_totals` — kept for good — the first time `/admin` is
opened after them, newest first and at most eight days per page load (Workers'
free plan allows ~50 D1 calls a request); the page says so while older days
are still waiting. D1 does the adding up (`DAY_SQL` in `worker/stats.js`), so
the Worker's CPU stays small however busy a day was. Analytics stop writing
for the day at 30,000 beacons, well inside D1's free 100,000 rows written a
day, so a spike or a flood can never leave the forms unable to save.

**The dashboard** (`/admin?days=1|7|30|90`): headline numbers against the
previous period (signups, Buddy and agency applications counted from the lists
themselves), the 👍/👎 on fares (the latest vote on each fare, and how many
came with a comment),
visitors per day (hover a day; a table twin below), the estimator step by step
(opened → started → saw a fare → joined the waitlist) and Buddy recruitment
(opened → sent) in people, where visitors came from and who signed up from
where, pages, campaign links, devices, cities, what people price (destinations,
pickup areas, trip types, how far ahead, fares, travel day, pickup time,
refused places), clicks, problems (mistyped numbers per form, failed saves,
map and route failures, script errors) and page speed (by page and
connection). Below: the campaign-link maker, "Don't count this browser", and
`/admin/daily.csv` — one row a day since the first visit (visitors, page
views, fares shown, waitlist signups, Buddy applications, agency applications).

**Campaign links.** The link maker on `/admin` adds `utm_source`,
`utm_medium`, `utm_campaign` to a page's address (before any `#`). Visits
through such a link show under the source you named ("WhatsApp") and in the
campaign table with the details.

## The Google Maps key

`src/estimate/maps.js` reads `GOOGLE_MAPS_BROWSER_KEY`, which `build.mjs`
compiles into `dist/estimate/app.js`. A browser key is public by design; its
protection is the HTTP-referrer restriction and the short list of APIs enabled
on it. It is **never committed**:

- locally, put `GOOGLE_MAPS_BROWSER_KEY=…` in `website/.env` (git-ignored);
- on Cloudflare, add it under **Workers → Settings → Build → Variables**.

It is compiled in, so a changed variable takes effect only with the next build
— a push to `main` starts one.

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
   the Round/One-way cards, the closing band. The artboard's own estimator is
   superseded; there is one estimator, not two.
6. **Real URLs.** Its pages switch in place, so they get hashes:
   `/beta/#how-it-works`, `#about`, `#contact` (Home is plain `/beta/`), with
   Back and Forward working and real `href`s on the links. `/beta/#apply`
   opens the Buddy application — one link to share with drivers.
7. **The forms save, as in the Phase 1 design.** The Contact-page waitlist
   (a fixed `+91` field and the consent tick) posts to `/api/waitlist`. Apply
   to be a Buddy is the Phase 1 pop-up — "Individual Buddy" or "Driver agency"
   and their fields — without its consent tick and verification code: "Send
   Application" posts to `/api/buddy` and confirms "Application received.
   We’ll contact you when onboarding opens."
8. **Booking isn't open yet.** The home hero's "Book a Buddy · Coming soon"
   becomes the design's "Join the Waitlist", which opens a pop-up: the `+91`
   field and the tick, no code ("You're on the waitlist. We'll message you
   once."). Every page ends with the design's closing band, "Plan the trip
   now. Book it soon." — "Get an Estimate" and "Join the Waitlist". The
   header and phone menu have no "Estimate Fare" link, since "Get an
   Estimate" goes to the same page (the footer keeps its links). Escape
   closes the pop-ups.
9. **The FAQ** on How It Works is the Phase 1 design's eight questions, less
   its "The stay cost will be shown in your price breakdown" sentence.
10. **Analytics.** The forms report mistyped numbers and failed saves, and a
   Buddy form opened from a `/beta/#apply` link counts as opened. `/site.js` is
   added to the page like every other.

5–10 are text patches listed in `artboard-patches.mjs`. Each must match the
artboard an exact number of times (once, unless it says otherwise). A canvas
re-export that changes one of those spots fails the build here, loudly,
instead of shipping a half-patched page.

## Tests

```bash
npm test                 # fare parity vs backend/server.py and the rate table's
                         # worked examples (needs backend/.venv)
npm run build && npm run test:worker
                         # the Worker: helpers, then every endpoint under
                         # `wrangler dev` with a throwaway local D1
NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  node test/verify.mjs   # end to end in a browser against real Google APIs
```

`test:worker` covers phone formats (foreign numbers refused), the trip
wording and its fare, comments (links alone refused), email and GSTIN checks,
CSV quoting and formula neutralising, the dashboard's lists and votes, the analytics' event cleaning, devices, sources and bands, and a
day's totals computed by running `DAY_SQL` on Node's own SQLite; then over
HTTP: the locked `/admin` without a password, saving and refusing (field
messages, the consent tick, every waitlist source, wrong origin, non-JSON,
oversize, honeypot), votes saved without a phone and joined to the signup made
from the same fare (either order, the latest vote winning, the comment kept),
individual and agency applications, `(repeat)` marking, all three CSV layouts,
Basic auth and its lockout, the HTTPS redirect, the flood cap; an older
database (the columns and rows production had before votes, consent, cities
and agencies) upgraded in place with its rows intact —
and, with a test clock (`RB_TEST=1` plus an `X-RB-Now` header, test servers
only), analytics across days: what is and isn't counted (crawlers, excluded
browsers, other sites' pages), yesterday summed plus today live, every
dashboard section, a label sent to inject HTML shown escaped, the daily CSV,
"Don't count this browser", the campaign link maker, totals outliving 13
months, and a backlog summed eight days at a time.

`verify.mjs` serves `dist/` and the Worker with `wrangler dev`, drives the
pages headless — one way, a late departure, a three-day round trip, hourly, a
same-day Jaipur round trip long enough for the long-drive rule (warning, rest
stop, then the drive-through switch and back), an out-of-area pickup, the map
picker (open, drag, re-caption, tap a place, confirm, then price the pinned
point), fullscreen map, mobile viewport — and re-prices every estimate with
the backend's `fare_breakdown` on the exact inputs the page used — with Get
Estimate disabled and its hint until the trip is complete, the trip-time and
distance tiles, "Inclusive of all taxes", the §2.4 lines, and the
disclaimers. Then the forms: a 👎 with a comment,
then joining the waitlist under the same estimate (one row with the vote), the
`/beta` Contact waitlist, the hero's Join the Waitlist pop-up, an individual
Buddy application and a driver agency's from `/beta/#apply`, each refused once
(a short number, no tick, a short GSTIN) and then read back from the admin
download; plus `/beta`'s URLs, Back, the closing band and the CTA redirect. The two headers are measured side by side at 1280px
and 390px — every part's box, font and colour, and the open phone menu — and
must match except for the current page. Last, `/admin` must count the run
exactly (one visitor, every fare shown, signups and both kinds of
application, the 👎, the funnels, destinations, mistyped numbers per form,
clicks), its chart must show a day on hover, and the stored events must hold
no phone number, name, licence, agency detail, comment or address.

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
- **Analytics are a floor, not a census**: script blockers and browsers that
  never ran `/site.js` aren't counted, and WhatsApp and other apps usually
  hide where a visit came from ("Direct or an app") — campaign links fix that.
  Cities come from the visitor's connection, so mobile data often shows a big
  city nearby.
- **Free-plan headroom.** The dashboard's work per load is bounded (eight days
  summed, D1 doing the adding up) and analytics cap their own writes, but a
  very busy site is better served by Workers Paid ($5/month): 30 s CPU, 1,000
  D1 calls a request, 50M rows written a month.
- The artboard's own estimator (unreachable since every Estimate link goes to
  `/estimate/`) still has its unwired waitlist; it is dead code, left as is.
- **"Privacy Policy" and "Terms of Use"** in the consent tick and the
  disclaimer are plain text: there are no such pages yet to link to.
- **Hourly is priced at the legacy ₹249/h** and is not in Rate Table v1.10;
  the backend marks it `uncovered_by_rate_table`.
- **Drive-through is estimate-only.** The website shows its price behind the
  switch (§1C, Phase 1); a booking is always the rest stop, since the
  drive-through needs both Terms of Use to allow it first (compliance item 4).
  The app shows the warning and the rest-stop fare only.
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
- Live routing puts Sector 17 → Shimla at ~114 km and 3 h 14 min, so the
  calculator reads ₹1,612 against the rate table's illustrative ₹1,613 at
  115 km. Expected: §2.3's distances are illustrative, and the pass rule is the
  formula applied to Google's values.
