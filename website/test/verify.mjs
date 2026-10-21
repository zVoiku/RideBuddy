/**
 * End-to-end check of the site: /estimate/ against the real Google Maps APIs,
 * and the forms on /estimate/ and /beta/ through the Worker into D1.
 *
 * Serves dist/ and the Worker with `wrangler dev` (throwaway local D1), drives
 * the pages headless, re-prices every estimate with the backend's
 * fare_breakdown, and reads each form's row back through the admin download.
 * Needs a built dist/, GOOGLE_MAPS_BROWSER_KEY (website/.env) and Chromium via
 * Playwright.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node website/test/verify.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { startDev } from './dev-server.mjs';
import { startTwilioStub } from './twilio-stub.mjs';

const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SHOTS = process.env.SHOTS || path.join(HERE, '..', '..', '..', 'tmp-shots');
// Where the built site is served for the browser. In the sandbox the Google key
// only allows the production referrers, so the default there is the real
// hostname on port 80, resolved to 127.0.0.1 inside Chromium (below). On a
// machine whose key allows localhost, VERIFY_HOST=localhost VERIFY_PORT=8098.
const HOST = process.env.VERIFY_HOST || 'www.ridebuddy.co.in';
const PORT = Number(process.env.VERIFY_PORT || 80);
const ORIGIN = `http://${HOST}${PORT === 80 ? '' : `:${PORT}`}`;
const PY = path.join(ROOT, 'backend', '.venv', 'bin', 'python');
const ADMIN_PASSWORD = 'verify-only';
const PHONE_ERROR = 'Enter a 10-digit mobile number.';
const CONSENT_ERROR = 'Tick the box to join the waitlist.';
const WAITLIST_JOINED = "You're on the waitlist. We'll message you once.";
const DISCLAIMER = 'Indicative fare for the route, date and time you entered, using the route’s standard drive time without traffic. This is not a booking or an offer. Rates can change before booking opens. Terms of Use apply.';
const CODE_WRONG = 'That code doesn’t match. Try again.';
const COMMENT = 'Too high for one way, we usually pay 1,200 a day.';
/** The result's condition lines (Rate Table v1.10 §2.4), as shown. */
const conds = (page) => page.locator('.rb-conds li').allTextContents().then((l) => l.map((t) => t.trim()));
const TOLLS = 'Tolls are extra, paid by you on the road.';
const EXTRA_TIME = 'Extra time is charged by the minute in the final fare.';
const NIGHT = 'Includes a night charge: more than 15 minutes of the trip fall between 10 PM and 6 AM.';

function backendTotal(inputs) {
  const script = `
import json, sys, importlib.util, os
os.environ.setdefault("USE_INMEMORY_DB", "true"); os.environ.setdefault("DB_NAME", "verify"); os.environ.setdefault("MONGO_URL", "mongodb://localhost:1")
spec = importlib.util.spec_from_file_location("server", ${JSON.stringify(path.join(ROOT, 'backend', 'server.py'))})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
t = json.load(sys.stdin); p = t.get("pickup")
b = m.fare_breakdown(trip_type=t["tripType"], one_way=t["oneWay"], distance_km=t["distanceKm"], duration_hours=t.get("durationHours", 0),
                     days=t.get("days", 0), scheduled_at=(f"{p['date']}T{p['time']}:00+05:30" if p else None), customer_stay=t.get("customerStay", False),
                     drive_through=t.get("driveThrough", False))
print(json.dumps({"total": b["total"], "trip_days": b["trip_days"], "night": b["night_trigger"]}))`;
  const r = spawnSync(PY, ['-c', script], { input: JSON.stringify(inputs), encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
}

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? '  ok ' : '  FAIL'} ${msg}`); if (!ok) failures += 1; };
let faresShown = 0; // estimates this run produced, to match against /admin

/** Everything the analytics stored (the beacons' events), read from the local D1's files. */
function storedBeacons(dir) {
  const py = `
import glob, sqlite3, sys
out = []
for p in glob.glob(sys.argv[1] + '/**/*.sqlite', recursive=True):
    try:
        out += [r[0] for r in sqlite3.connect('file:' + p + '?mode=ro', uri=True).execute('SELECT events FROM beacons')]
    except sqlite3.Error:
        pass
print('\\n'.join(out))`;
  return spawnSync('python3', ['-c', py, dir], { encoding: 'utf8' }).stdout || '';
}

async function pickPlace(page, inputSel, text) {
  await page.fill(inputSel, text);
  await page.waitForSelector('.rb-suggest__item', { timeout: 20000 });
  const first = await page.locator('.rb-suggest__item').first();
  const label = (await first.locator('.rb-suggest__main').textContent()).trim();
  await first.click();
  // Selected once the field shows the resolved description and nothing is still loading.
  await page.waitForFunction(([sel, typed]) => { const el = document.querySelector(sel); return el && el.value !== typed && !document.querySelector('.rb-suggest') && !document.querySelector('.rb-place__busy'); }, [inputSel, text], { timeout: 20000 });
  return label;
}

/** A list as the admin download serves it, one array per row (quoted cells kept whole). */
async function download(dev, list) {
  const res = await fetch(`${dev.base}/admin/${list}.csv`, { headers: { Authorization: `Basic ${Buffer.from(`admin:${ADMIN_PASSWORD}`).toString('base64')}` } });
  const text = (await res.text()).replace(/^\uFEFF/, '').trimEnd();
  return text.split('\r\n').slice(1).map((line) => line.match(/("(?:[^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')));
}

/**
 * The header's parts, measured the same way on /beta/ (the artboard) and
 * /estimate/: box, and the styles that make it look the way it does.
 */
function headerGeometry() {
  const box = (el) => { const b = el.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(Math.round).join(','); };
  const css = (el, ...props) => props.map((p) => getComputedStyle(el)[p]).join('|');
  const shown = (el) => !!el && getComputedStyle(el).display !== 'none';
  const header = document.querySelector('header');
  const nav = header.querySelector('nav');
  const brand = header.querySelector('a');
  const burger = [...header.querySelectorAll('button')].find((b) => /menu/i.test(b.getAttribute('aria-label') || ''));
  const links = shown(nav) ? [...nav.querySelectorAll('a')] : [];
  const cta = shown(nav) ? nav.querySelector('button') : null;
  return {
    header: `${box(header)}|${css(header, 'position', 'backgroundColor', 'boxShadow', 'borderBottom')}`,
    logo: box(brand.querySelector('img')),
    name: `${box(brand.querySelector('span'))}|${css(brand.querySelector('span'), 'fontFamily', 'fontSize', 'fontWeight', 'color')}`,
    links: links.map((a) => `${a.textContent.trim()}@${box(a)}|${css(a, 'fontSize', 'fontWeight')}`),
    cta: cta && `${cta.textContent.trim()}@${box(cta)}|${css(cta, 'backgroundColor', 'color', 'borderRadius', 'fontSize')}`,
    burger: shown(burger) ? box(burger) : null,
    // Which page is underlined as the current one: meant to differ between the two.
    current: links.find((a) => getComputedStyle(a).borderBottomColor !== 'rgba(0, 0, 0, 0)')?.textContent.trim() || null,
  };
}

/** The open mobile menu (the full-screen overlay), measured the same way on both pages. */
function menuGeometry() {
  const box = (el) => { const b = el.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(Math.round).join(','); };
  const menu = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).position === 'fixed' && getComputedStyle(d).zIndex === '60');
  if (!menu) return null;
  return [...menu.querySelectorAll('a, button')].map((el) => `${el.textContent.trim() || el.getAttribute('aria-label')}@${box(el)}|${getComputedStyle(el).fontSize}`);
}

async function estimateAndCompare(page, name) {
  await page.getByRole('button', { name: 'Get Estimate' }).click();
  const outcome = await Promise.race([
    page.waitForSelector('[data-testid="fare-estimate"]', { timeout: 45000 }).then(() => 'fare'),
    page.waitForSelector('.rb-error-msg, .rb-form-error', { timeout: 45000 }).then(async (el) => 'page error: ' + (await el.textContent())),
  ]);
  if (outcome !== 'fare') throw new Error(`${name}: ${outcome}`);
  const shown = (await page.locator('[data-testid="fare-estimate"]').textContent()).trim();
  const last = await page.evaluate(() => window.__rbLastEstimate);
  faresShown += 1;
  const py = backendTotal(last.inputs);
  check(last.result.total_fare === py.total, `${name}: page ₹${last.result.total_fare} == backend ₹${py.total} (shown "${shown}", ${last.inputs.distanceKm?.toFixed?.(2) ?? 0} km, ${(last.inputs.durationHours || 0).toFixed(2)} h)`);
  check(last.result.trip_days === py.trip_days && last.result.night_charge_applied === py.night, `${name}: days ${last.result.trip_days}/${py.trip_days}, night ${last.result.night_charge_applied}/${py.night}`);
  return last;
}

async function main() {
  // The radius gate applied to whatever place the visitor picks (maps.js).
  globalThis.__GOOGLE_MAPS_BROWSER_KEY__ = '';
  const { withinService } = await import('../src/estimate/maps.js');
  check(!withinService('pickup', { lat: 28.6315, lng: 77.2167 }).ok, 'radius gate: Connaught Place, New Delhi is refused as a pickup');
  check(withinService('pickup', { lat: 30.7046, lng: 76.7179 }).ok && withinService('pickup', { lat: 30.6942, lng: 76.8606 }).ok, 'radius gate: Mohali and Panchkula are accepted as pickups');
  check(withinService('destination', { lat: 31.1048, lng: 77.1734 }).ok && withinService('destination', { lat: 26.9124, lng: 75.7873 }).ok, 'radius gate: Shimla and Jaipur are accepted as destinations');
  check(!withinService('destination', { lat: 19.076, lng: 72.8777 }).ok, 'radius gate: Mumbai is refused as a destination');

  // The site as Cloudflare serves it: static files first, the Worker for /api and
  // /admin — with one-time codes on, Twilio played by test/twilio-stub.mjs.
  const stub = await startTwilioStub(8783);
  const dev = await startDev({
    port: PORT, password: ADMIN_PASSWORD,
    vars: { RB_TEST: '1', TWILIO_ACCOUNT_SID: 'ACverify', TWILIO_AUTH_TOKEN: 'verify-token', TWILIO_FROM: 'RIDEBD', TWILIO_API_BASE: stub.url },
  });
  /** Types the code the stand-in Twilio got for `phone` and verifies it, after one wrong try when `wrongFirst`. */
  const enterCode = async (pg, scope, fieldId, phone, wrongFirst = false) => {
    const code = stub.codeFor(phone);
    if (wrongFirst) {
      await pg.fill(fieldId, code === '000000' ? '000001' : '000000');
      await scope.getByRole('button', { name: 'Verify Number' }).click();
      const err = await scope.locator('[role="alert"], .rb-error-msg').first().textContent({ timeout: 10000 }).catch(() => '');
      check(err === CODE_WRONG, `${phone}: a wrong code is refused ("${err}")`);
    }
    await pg.fill(fieldId, code || '');
    await scope.getByRole('button', { name: 'Verify Number' }).click();
  };
  const browser = await chromium.launch({ args: HOST === 'localhost' ? [] : [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });
  // Counted like a visitor: a browser that doesn't call itself headless, and
  // site.js's opt-in for automation (it skips navigator.webdriver otherwise).
  const probe = await browser.newPage();
  const userAgent = (await probe.evaluate(() => navigator.userAgent)).replace('HeadlessChrome', 'Chrome');
  await probe.close();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, userAgent });
  await ctx.addInitScript(() => { window.__rbCountAutomation = true; });
  // In the Claude Code sandbox, outbound HTTPS only works through the agent
  // proxy, and Chromium's tunnels through it die while Node's succeed. So the
  // browser talks to localhost directly and every other request is replayed
  // from Node and fulfilled — transparent to the page. On a normal machine
  // HTTPS_PROXY is unset and none of this engages.
  const blocked = [];
  if (process.env.HTTPS_PROXY) {
    const rc = await request.newContext({ proxy: { server: process.env.HTTPS_PROXY }, ignoreHTTPSErrors: true });
    await ctx.route((u) => !(u.hostname === HOST || u.hostname === 'localhost' || u.hostname === '127.0.0.1'), async (route) => {
      try {
        const res = await rc.fetch(route.request(), { maxRedirects: 0, timeout: 30000 });
        await route.fulfill({ response: res });
      } catch (e) {
        blocked.push(route.request().url().split('?')[0]);
        await route.abort('connectionfailed').catch(() => {});
      }
    });
  }
  try {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`); });

    await page.goto(`${ORIGIN}/estimate/`, { waitUntil: 'networkidle' });
    check(!!(await page.$('#rb-pickup')), 'form rendered (design-system Input present)');
    check(await page.getByRole('button', { name: 'Hourly' }).count() === 0 && !(await page.$('#rb-hours')), 'no Hourly on the website: Round Trip and One Way only');
    const hourlyLink = await ctx.newPage();
    await hourlyLink.goto(`${ORIGIN}/estimate/?type=hourly`, { waitUntil: 'networkidle' });
    check(!!(await hourlyLink.waitForSelector('#rb-return-date', { timeout: 15000 }).catch(() => null)), 'an old ?type=hourly link opens a round trip');
    await hourlyLink.close();
    await page.screenshot({ path: path.join(SHOTS, 'estimate-form.png') });

    // One way: Sector 17 -> Shimla. Get Estimate stays disabled, saying what is
    // missing, until every field is valid.
    await page.getByRole('button', { name: 'One Way' }).click();
    const gate = async () => ({ off: await page.getByRole('button', { name: 'Get Estimate' }).isDisabled(), hint: await page.locator('.rb-hint').textContent().catch(() => '') });
    let g = await gate();
    check(g.off && g.hint === 'Choose your pickup from the suggestions or on the map.', `Get Estimate is disabled until there is a pickup ("${g.hint}")`);
    const pick = await pickPlace(page, '#rb-pickup', 'Sector 17');
    g = await gate();
    check(g.off && g.hint === 'Choose your destination from the suggestions or on the map.', `…then a destination ("${g.hint}")`);
    const dest = await pickPlace(page, '#rb-destination', 'Shimla');
    g = await gate();
    check(!g.off && !(await page.locator('.rb-hint').count()), 'enabled, with no hint, once the trip is complete');
    console.log(`  chose pickup "${pick}", destination "${dest}"`);
    await page.fill('#rb-pickup-time', '09:00');
    const one = await estimateAndCompare(page, 'one-way');
    await page.waitForSelector('.rb-map__canvas .gm-style', { timeout: 30000 }).then(() => check(true, 'Google map rendered on the result')).catch(() => check(false, 'Google map rendered on the result'));
    const drawn = await page.evaluate(() => !!document.querySelector('.rb-map__canvas path[stroke="#4A5C2F"], .rb-map__canvas path[stroke="#4a5c2f"]'));
    console.log(`  ${drawn ? 'ok ' : 'note'} route polyline ${drawn ? 'drawn on the map' : 'not detectable as SVG here — confirm visually on the live site'}`);
    await page.screenshot({ path: path.join(SHOTS, 'estimate-result.png'), fullPage: true });

    // Tap to expand
    await page.getByRole('button', { name: 'Tap to expand' }).click();
    check(!!(await page.$('.rb-map--full')), 'map expands to fullscreen');
    await page.screenshot({ path: path.join(SHOTS, 'estimate-map-full.png') });
    await page.getByRole('button', { name: 'Close' }).click();
    check(!(await page.$('.rb-map--full')), 'map closes again');

    // The trip under the map: drive time to the nearest 5 minutes, distance to the km (§2.4).
    const tiles = await page.locator('.rb-tile').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
    const km = Math.round(one.inputs.distanceKm);
    const t5 = Math.round(one.inputs.durationHours * 12) * 5;
    const wantTime = `${Math.floor(t5 / 60)} h${t5 % 60 ? ` ${t5 % 60} min` : ''}`;
    check(tiles.length === 2 && tiles[0].toUpperCase() === `EST. TRIP TIME ${wantTime} One way`.toUpperCase() && new RegExp(`^EST\\. DISTANCE ${km} km One way$`, 'i').test(tiles[1]),
      `one way: trip time (to 5 min) and distance tiles (${tiles.join(' | ')})`);
    const result = (await page.locator('.rb-result').innerText()).replace(/\s+/g, ' ');
    check(result.includes('Inclusive of all taxes') && !/Extra distance/.test(result) && result.includes('Final fare is calculated when your trip ends.'),
      'the fare says it includes all taxes; no "Extra distance" line; the final-fare line stays');
    const oneConds = await conds(page);
    check(JSON.stringify(oneConds) === JSON.stringify(["Includes 12 hours of your Buddy's time from pickup.", "Includes your Buddy's food.", TOLLS, EXTRA_TIME]),
      `one way, 9 AM: the §2.4 lines (${oneConds.join(' | ')})`);
    check((await page.locator('.rb-disclaimer').textContent()).trim() === DISCLAIMER, 'the disclaimer under the fare');

    // 👍/👎: a 👎 opens an optional comment; Send thanks the visitor.
    check(await page.getByText('Book a Buddy').count() === 0 && await page.getByText('Join the waitlist.').count() === 1, 'the result offers the waitlist and no "Book a Buddy"');
    await page.getByRole('button', { name: 'No, this fare doesn’t work for me' }).click();
    await page.fill('#rb-fare-comment', COMMENT);
    await page.locator('.rb-fb').getByRole('button', { name: 'Send' }).click();
    check(await page.waitForSelector('text=Thank you. Noted.', { timeout: 10000 }).then(() => true).catch(() => false), '👎 with a comment: "Thank you. Noted."');
    const voteRow = (await download(dev, 'clients')).at(-1) || [];
    check(voteRow[2] === '' && voteRow[6] === '👎' && voteRow[7] === COMMENT, `the vote is saved with no phone (${voteRow.slice(2, 9).join(', ')})`);

    // Joining the waitlist under the estimate: the same row gets the number.
    await page.fill('#rb-waitlist-phone', '98708 7132');
    await page.getByRole('button', { name: 'Join the Waitlist' }).click();
    const waErrs = await page.locator('.rb-waitlist .rb-error-msg').allTextContents();
    check(waErrs.join(' | ') === `${PHONE_ERROR} | ${CONSENT_ERROR}`, `a number a digit short, and no tick, are refused on the page (${waErrs.join(' | ')})`);
    await page.fill('#rb-waitlist-phone', '+91 98708 71324');
    check(await page.inputValue('#rb-waitlist-phone') === '9870871324', 'a pasted +91 number is cut to its 10 digits beside the fixed +91');
    await page.locator('label[for="rb-waitlist-consent"], label:has(#rb-waitlist-consent)').first().click();
    await page.getByRole('button', { name: 'Join the Waitlist' }).click();
    const sentTo = await page.waitForSelector('#rb-waitlist-code', { timeout: 10000 }).then(() => page.locator('.rb-sent').textContent()).catch(() => '');
    check(sentTo.startsWith('Code sent to +91 XXXXX XX324.') && await page.evaluate(() => document.activeElement?.id) === 'rb-waitlist-code',
      `estimate waitlist: a code goes to the number, and the code field takes the focus ("${sentTo}")`);
    check(/^Resend OTP in 0:[23]\d$/.test((await page.locator('.rb-resend').textContent()).trim()), 'estimate waitlist: "Resend OTP" counts down');
    await page.screenshot({ path: path.join(SHOTS, 'estimate-code.png'), fullPage: true });
    await enterCode(page, page.locator('.rb-waitlist'), '#rb-waitlist-code', '+919870871324', true);
    const joined = await page.waitForSelector("text=You're on the waitlist", { timeout: 10000 }).then(() => true).catch(() => false);
    check(joined, 'estimate waitlist: joined with the code');
    const clientsNow = await download(dev, 'clients');
    const waRow = clientsNow.at(-1) || [];
    const wantTrip = `One way · ${pick} → ${dest} · `;
    const shownFare = (await page.locator('[data-testid="fare-estimate"]').textContent()).replace(/\D/g, '');
    check(clientsNow.length === 1 && waRow[2] === '+919870871324' && waRow[3] === 'Estimate page' && waRow[4]?.startsWith(wantTrip) && waRow[4]?.endsWith('09:00')
      && waRow[5] === shownFare && waRow[6] === '👎' && waRow[7] === COMMENT && waRow[8] === 'Yes' && waRow[9] === 'Yes',
      `estimate waitlist: one row with the trip, fare, vote, comment, consent and the verified phone (${waRow.slice(2, 10).join('; ')})`);

    // Late departure: 16:00 on the Shimla run should not cross midnight; check consistency only.
    await page.getByRole('button', { name: 'Edit trip details' }).click();
    await page.fill('#rb-pickup-time', '20:30');
    const late = await estimateAndCompare(page, 'one-way 20:30 departure');
    check(late.result.night_charge_applied === true && (await conds(page)).includes(NIGHT), 'a 20:30 departure on a 3h+ drive triggers the night charge, and says so');

    // Round trip, 3 days, stay not arranged — back to the form through the header's
    // "Get an Estimate" this time, which keeps the trip and returns to the top.
    await page.locator('header').getByRole('button', { name: 'Get an Estimate' }).click();
    const refilled = await page.waitForSelector('#rb-pickup', { timeout: 5000 }).then(async () => (await page.inputValue('#rb-pickup')).length > 3).catch(() => false);
    const atTop = await page.waitForFunction(() => window.scrollY < 5, null, { timeout: 5000 }).then(() => true).catch(() => false);
    check(refilled && atTop, 'the header\'s "Get an Estimate" brings back the form, trip still filled in, at the top');
    await page.getByRole('button', { name: 'Round Trip' }).click();
    const depart = await page.inputValue('#rb-departure-date');
    const ret = new Date(Date.parse(depart) + 2 * 864e5).toISOString().slice(0, 10);
    await page.fill('#rb-return-date', new Date(Date.parse(depart) - 864e5).toISOString().slice(0, 10));
    g = await gate();
    check(g.off && g.hint === 'The return date is before the departure date.', `a return before the departure disables Get Estimate ("${g.hint}")`);
    await page.fill('#rb-return-date', ret);
    await page.fill('#rb-pickup-time', '09:00');
    const round = await estimateAndCompare(page, 'round trip 3 days');
    check(round.result.trip_days === 3 && round.result.stay_included === true, 'round trip bills 3 days with the stay included');
    const roundTiles = await page.locator('.rb-tile').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
    const each = Math.round(round.inputs.distanceKm); // the route one way
    check(new RegExp(`^EST\\. DISTANCE ${2 * each} km ${each} km each way$`, 'i').test(roundTiles[1] || '') && /each way$/.test(roundTiles[0] || ''),
      `round trip: the tiles give the total and each way (${roundTiles.join(' | ')})`);
    const roundConds = await conds(page);
    check(roundConds[0] === "Includes 12 hours of your Buddy's time from pickup, on each of the 3 days." && roundConds.includes("Includes your Buddy's stay for 2 nights."),
      `round trip: 12 hours on each of the 3 days, and the stay for 2 nights (${roundConds.slice(0, 3).join(' | ')})`);

    // A long drive (§1C): Jaipur and back the same day is about 18 hours of
    // driving. The safety warning, a rest stop by default, and the switch to
    // the drive-through price, each re-priced by the backend.
    await page.getByRole('button', { name: 'Edit trip details' }).click();
    await page.getByRole('button', { name: 'Round Trip' }).click();
    await page.fill('#rb-return-date', await page.inputValue('#rb-departure-date'));
    check(!(await page.$('.rb-stay')), 'a same-day round trip has no stay question');
    await pickPlace(page, '#rb-destination', 'Jaipur');
    await page.fill('#rb-pickup-time', '09:00');
    const jaipur = await estimateAndCompare(page, 'Jaipur and back, same day');
    const warn = (await page.locator('.rb-long__warn').textContent().catch(() => '')).replace(/\s+/g, ' ').trim();
    check(jaipur.result.long_drive && !jaipur.result.drive_through && jaipur.result.trip_days === 2
      && warn === 'This trip needs more than 12 hours of driving. Your Buddy needs rest for a safe trip. The fare includes a rest stop.',
      `long drive: the safety warning, rest stop included, a second Trip Day ("${warn}")`);
    check((await conds(page)).includes('Long drive: a rest stop is included.'), 'long drive: the rest-stop line');
    await page.screenshot({ path: path.join(SHOTS, 'estimate-long-drive.png'), fullPage: true });
    const restFare = jaipur.result.total_fare;
    await page.locator('label[for="rb-drive-through"]').click();
    const through = await page.waitForFunction((was) => window.__rbLastEstimate?.result?.drive_through && window.__rbLastEstimate.result.total_fare !== was ? window.__rbLastEstimate : null, restFare, { timeout: 5000 })
      .then((h) => h.jsonValue()).catch(() => null);
    const pyThrough = through ? backendTotal(through.inputs) : null;
    const shownThrough = (await page.locator('[data-testid="fare-estimate"]').textContent()).replace(/\D/g, '');
    check(!!through && through.result.total_fare === pyThrough.total && String(through.result.total_fare) === shownThrough && through.result.total_fare > restFare,
      `drive-through: ₹${through?.result.total_fare} shown, backend ₹${pyThrough?.total}, more than the rest stop's ₹${restFare}`);
    check((await conds(page)).includes('Long drive: drive-through selected.') && (await page.locator('.rb-long__warn').textContent()).includes('without the rest stop'),
      'drive-through: the line and the warning say so');
    await page.locator('label[for="rb-drive-through"]').click();
    check(await page.waitForFunction((was) => window.__rbLastEstimate?.result?.total_fare === was, restFare, { timeout: 5000 }).then(() => true).catch(() => false),
      'switching back restores the rest-stop fare');

    // The pickup box is restricted to the Tricity: a Delhi landmark may only
    // surface Tricity-local matches (Mohali has businesses named after it),
    // never New Delhi itself. The radius gate on the chosen place is unit-tested
    // at the top of this run.
    await page.getByRole('button', { name: 'Edit trip details' }).click();
    await page.getByRole('button', { name: 'One Way' }).click();
    await page.fill('#rb-pickup', 'Connaught Place');
    await page.waitForSelector('.rb-suggest__item', { timeout: 15000 }).catch(() => {});
    const subs = await page.$$eval('.rb-suggest__item', (els) => els.map((e) => e.textContent));
    const inRegion = /Chandigarh|Mohali|Panchkula|Sahibzada Ajit Singh Nagar|Zirakpur|Kharar|Punjab|Haryana/;
    check(subs.length > 0 && subs.every((t) => inRegion.test(t) && !/New Delhi/.test(t)), `Delhi query only surfaces Tricity-local pickups (${subs.length}, e.g. "${(subs[0] || '').slice(0, 58)}")`);
    check(!!(await page.$('#rb-pickup')) && !errors.some((e) => e.startsWith('PAGEERROR')), 'page still alive after editing a completed estimate (no uncaught errors)');

    // Map picker: drop a pin when the typed address isn't precise enough.
    check(!!(await page.$('.rb-place__map')), 'map button sits on the place fields');
    await page.locator('.rb-place__map').first().click();
    await page.waitForSelector('.rb-picker__sheet', { timeout: 10000 });
    const pickerMap = await page.waitForSelector('.rb-picker__canvas .gm-style', { timeout: 30000 }).then(() => true).catch(() => false);
    check(pickerMap, 'picker opens with a Google map');
    await page.waitForTimeout(2500);
    // Reverse geocoding needs the Geocoding API on the key. Without it the
    // picker still works and captions the pin with its coordinates, so this is
    // reported rather than failed: the address is a label, not an input.
    const caption = async () => ({
      name: (await page.locator('.rb-picker__addr').textContent()).trim(),
      addr: await page.locator('.rb-picker__sub').textContent().catch(() => ''),
      coord: (await page.locator('.rb-picker__coord').textContent()).trim(),
    });
    const first = await caption();
    const geocoded = !!first.addr && !/Finding this place/.test(first.name);
    console.log(`  ${geocoded ? 'ok  ' : 'note'} pin caption: "${first.name.slice(0, 50)}" / "${(first.addr || '').slice(0, 50)}"${geocoded ? '' : ' — coordinates only; Geocoding API is not enabled on the key'}`);
    await page.screenshot({ path: path.join(SHOTS, 'estimate-picker.png') });

    // Dragging the map moves the pin, which re-captions it.
    const box = await (await page.$('.rb-picker__canvas')).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 140, box.y + box.height / 2 - 90, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(2500);
    const moved = await caption();
    check(moved.coord !== first.coord && moved.name !== first.name, `dragging the map moves the pin and re-captions it ("${moved.name.slice(0, 44)}")`);

    await page.getByRole('button', { name: 'Use this location' }).click();
    await page.waitForSelector('.rb-picker__sheet', { state: 'detached', timeout: 10000 });
    const pinned = await page.inputValue('#rb-pickup');
    check(pinned.length > 3, `picked point fills the pickup field ("${pinned.slice(0, 48)}")`);

    // Tapping one of Google's place icons. Hunting for an icon's pixel is
    // unreliable headlessly, so this fires the event Google fires on such a
    // tap — a click carrying a placeId — which exercises the whole handler:
    // fetch the place, name the pin, move the point. That the icons are
    // clickable at all is Google's side of the contract (clickableIcons).
    await page.locator('.rb-place__map').last().click();
    await page.waitForSelector('.rb-picker__sheet', { timeout: 10000 });
    await page.waitForSelector('.rb-picker__canvas .gm-style', { timeout: 30000 });
    await page.waitForTimeout(2000);
    const tapped = await page.evaluate(async () => {
      const m = window.__rbPickerMap;
      if (!m) return null;
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await google.maps.importLibrary('places');
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: 'National Museum New Delhi', includedRegionCodes: ['in'], sessionToken: new AutocompleteSessionToken(),
      });
      const p = suggestions[0]?.placePrediction;
      if (!p) return null;
      google.maps.event.trigger(m, 'click', { placeId: p.placeId, latLng: m.getCenter(), stop() {} });
      return p.text?.text || p.placeId;
    });
    if (!tapped) {
      check(false, 'tapping a place icon selects it by name (could not resolve a place to tap)');
    } else {
      await page.waitForFunction(() => !!window.__rbPickerNamed, null, { timeout: 20000 }).catch(() => {});
      const named = await page.evaluate(() => window.__rbPickerNamed);
      check(!!named, `tapping a place icon selects it (tapped "${tapped.slice(0, 40)}")`);
      const cap = await caption();
      check(!!named && cap.name === named.main_text && /Museum/i.test(cap.name),
        `the pin takes the place's name, not a street address ("${cap.name.slice(0, 44)}")`);
      check(!!named && Math.abs(named.lat - 28.61) < 0.1, `the point moves to the place (${named ? named.lat.toFixed(4) + ', ' + named.lng.toFixed(4) : '—'})`);
      await page.screenshot({ path: path.join(SHOTS, 'estimate-picker-poi.png') });
      // Confirming carries the name and the place id into the field.
      await page.getByRole('button', { name: 'Use this location' }).click();
      await page.waitForSelector('.rb-picker__sheet', { state: 'detached', timeout: 10000 });
      const destText = await page.inputValue('#rb-destination');
      check(/Museum/i.test(destText), `the tapped place fills the destination field ("${destText.slice(0, 50)}")`);
      // Put a routable destination back for the pricing check below.
      await page.fill('#rb-destination', '');
    }

    // A map-picked pickup prices exactly like a searched one.
    await pickPlace(page, '#rb-destination', 'Kasauli');
    await page.fill('#rb-pickup-time', '09:00');
    await estimateAndCompare(page, 'map-picked pickup');

    // Mobile viewport render.
    const mobile = await ctx.newPage(); await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto(`${ORIGIN}/estimate/`, { waitUntil: 'networkidle' });
    await mobile.screenshot({ path: path.join(SHOTS, 'estimate-mobile.png'), fullPage: true });
    await mobile.close();

    // /beta: real URLs for its pages, and both of its forms save.
    const beta = await ctx.newPage();
    beta.on('pageerror', (e) => errors.push('PAGEERROR /beta ' + String(e).slice(0, 200)));
    beta.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
    await beta.goto(`${ORIGIN}/beta/#contact`, { waitUntil: 'networkidle' });
    const contactShown = await beta.waitForSelector('#rb-contact-phone', { timeout: 30000 }).then(() => true).catch(() => false);
    check(contactShown, '/beta/#contact opens the Contact page');
    await beta.screenshot({ path: path.join(SHOTS, 'beta-contact.png'), fullPage: true });
    const contactForm = beta.locator('#rb-contact-phone').locator('xpath=ancestor::div[.//button][1]');
    await beta.fill('#rb-contact-phone', '12345');
    await contactForm.getByRole('button', { name: 'Join the Waitlist' }).click();
    const cErrs = await beta.locator('[role="alert"]').allTextContents();
    check(cErrs.join(' | ') === `${PHONE_ERROR} | ${CONSENT_ERROR}`, `Contact waitlist: a short number, and no tick, are refused (${cErrs.join(' | ')})`);
    await beta.fill('#rb-contact-phone', '+44 7911 123456');
    check(await beta.inputValue('#rb-contact-phone') === '7911123456', 'the field beside the fixed +91 keeps 10 digits');
    await beta.fill('#rb-contact-phone', '98111 00001');
    await beta.locator('label:has(#rb-contact-consent)').click();
    await contactForm.getByRole('button', { name: 'Join the Waitlist' }).click();
    check(!!(await beta.waitForSelector('#rb-contact-code', { timeout: 10000 }).catch(() => null)) && await beta.getByText('Code sent to +91 XXXXX XX001.').count() === 1,
      'Contact waitlist: a code goes to the number');
    await enterCode(beta, beta.locator('#rb-contact-code').locator('xpath=ancestor::div[.//h2][1]'), '#rb-contact-code', '+919811100001');
    check(await beta.waitForSelector(`text=${WAITLIST_JOINED}`, { timeout: 10000 }).then(() => true).catch(() => false), 'Contact waitlist: joined with the code');
    const cRow = (await download(dev, 'clients')).at(-1) || [];
    check(cRow[2] === '+919811100001' && cRow[3] === 'Contact page' && cRow[8] === 'Yes' && cRow[9] === 'Yes',
      `Contact waitlist: row saved, with the consent and the verified phone (${[cRow[2], cRow[3], cRow[8], cRow[9]].join(', ')})`);

    const navHref = await beta.locator('header a', { hasText: 'About' }).first().getAttribute('href').catch(() => null);
    check(navHref === '#about', `nav links carry real URLs (About -> ${navHref})`);
    await beta.locator('header a', { hasText: 'About' }).first().click();
    check(beta.url().endsWith('/beta/#about') && !!(await beta.waitForSelector('#about-hero', { timeout: 10000 }).catch(() => null)), `clicking About shows it at ${new URL(beta.url()).pathname}${new URL(beta.url()).hash}`);
    await beta.goBack();
    // (Joined already, so the page shows the confirmation rather than the field.)
    check(beta.url().endsWith('/beta/#contact') && !!(await beta.waitForSelector(`text=${WAITLIST_JOINED}`, { timeout: 10000 }).catch(() => null)), 'Back returns to the Contact page');
    await beta.goForward();
    await beta.waitForSelector('#about-hero', { timeout: 10000 }).catch(() => null);
    const aboutText = await beta.evaluate(() => document.body.innerText);
    check(!/police/i.test(aboutText) && aboutText.includes('Every Buddy is verified, formally trained, and rated after every trip.') && aboutText.includes('Verification before the first trip.'),
      'About: Buddies are "verified", not "police-verified"');
    await beta.goBack();
    await beta.locator('header a', { hasText: 'Home' }).first().click();
    check(new URL(beta.url()).hash === '' && !!(await beta.waitForSelector('#home-hero', { timeout: 10000 }).catch(() => null)), 'Home is plain /beta/');
    const homeText = await beta.evaluate(() => document.body.innerText);
    check(!/police/i.test(homeText) && homeText.includes('Every Buddy is verified before their first trip.'), 'Home: "Every Buddy is verified before their first trip."');
    const linkTexts = await beta.$$eval('header a, footer a, a', (as) => as.map((a) => a.textContent.trim()));
    check(!linkTexts.some((t) => /how it works|full journey/i.test(t)) && !homeText.includes('Questions, answered.'),
      'no How It Works page: no link to it in the header, footer or Home, and no FAQ');
    const howTab = await ctx.newPage();
    await howTab.goto(`${ORIGIN}/beta/#how-it-works`, { waitUntil: 'networkidle' });
    check(!!(await howTab.waitForSelector('#home-hero', { timeout: 30000 }).catch(() => null)) && new URL(howTab.url()).hash === '',
      `an old /beta/#how-it-works link opens Home at a plain URL (${new URL(howTab.url()).pathname}${new URL(howTab.url()).hash})`);
    await howTab.close();

    // The hero's "Join the Waitlist" opens the waitlist pop-up: phone and tick, no code.
    check((await beta.getByRole('button', { name: /Book a Buddy/ }).count()) === 0, 'no "Book a Buddy" button on the home page');
    check(await beta.getByText('Plan the trip now. Book it soon.').count() === 1, 'the closing band reads "Plan the trip now. Book it soon."');
    await beta.getByRole('button', { name: 'Join the Waitlist' }).first().click(); // the hero's; the closing band has the other
    const wl = beta.getByRole('dialog', { name: 'Join the waitlist' });
    check(await wl.waitFor({ timeout: 5000 }).then(() => true).catch(() => false), 'the hero\'s "Join the Waitlist" opens the pop-up');
    await beta.fill('#rb-wl-phone', '98111 0000');
    await wl.getByRole('button', { name: 'Join the Waitlist' }).click();
    const wlErrs = await wl.locator('[role="alert"]').allTextContents();
    check(wlErrs.join(' | ') === `${PHONE_ERROR} | ${CONSENT_ERROR}`, `pop-up: a short number, and no tick, are refused (${wlErrs.join(' | ')})`);
    await beta.fill('#rb-wl-phone', '98111 00012');
    await wl.locator('label:has(#rb-wl-consent)').click();
    await wl.getByRole('button', { name: 'Join the Waitlist' }).click();
    check(!!(await beta.waitForSelector('#rb-wl-code', { timeout: 10000 }).catch(() => null)) && await wl.getByText('Code sent to +91 XXXXX XX012.').count() === 1
      && await beta.evaluate(() => document.activeElement?.id) === 'rb-wl-code', 'pop-up: a code goes to the number, and the code field takes the focus');
    check(await wl.getByText(/^Resend OTP in 0:[23]\d$/).count() === 1, 'pop-up: "Resend OTP" counts down');
    await beta.screenshot({ path: path.join(SHOTS, 'beta-waitlist-code.png') });
    await wl.getByRole('button', { name: 'Change number' }).click();
    check(await beta.inputValue('#rb-wl-phone') === '9811100012', '"Change number" goes back to the number, still filled in');
    await beta.fill('#rb-wl-phone', '98111 00002');
    await wl.getByRole('button', { name: 'Join the Waitlist' }).click();
    check(await wl.getByText('Code sent to +91 XXXXX XX002.').waitFor({ timeout: 10000 }).then(() => true).catch(() => false), '…and a code goes to the new number');
    await enterCode(beta, wl, '#rb-wl-code', '+919811100002');
    check(await wl.getByText(WAITLIST_JOINED).waitFor({ timeout: 10000 }).then(() => true).catch(() => false), 'pop-up: joined with the code');
    await beta.screenshot({ path: path.join(SHOTS, 'beta-waitlist-joined.png') });
    const hRow = (await download(dev, 'clients')).at(-1) || [];
    check(hRow[2] === '+919811100002' && hRow[3] === 'Home page' && hRow[8] === 'Yes' && hRow[9] === 'Yes',
      `pop-up: row saved with the page it was joined from and the verified phone (${[hRow[2], hRow[3], hRow[8], hRow[9]].join(', ')})`);
    await wl.getByRole('button', { name: 'Done' }).click();
    check(await beta.getByRole('dialog').count() === 0, 'Done closes the pop-up');

    // Apply to be a Buddy, from a shared /beta/#apply link.
    await beta.goto(`${ORIGIN}/beta/#apply`, { waitUntil: 'networkidle' });
    check(await beta.waitForSelector('#rb-full-name', { timeout: 30000 }).then(() => true).catch(() => false), '/beta/#apply opens the Buddy application');
    const applyDialog = beta.getByRole('dialog');
    const modalText = await applyDialog.textContent();
    check(!/email app/i.test(modalText), 'no "email app" wording in the form');
    await beta.getByRole('button', { name: 'Send Application' }).click();
    check((await applyDialog.locator('.rb-error-msg').count()) === 3 && (await applyDialog.getByText(PHONE_ERROR).count()) === 1, 'an empty application flags all four fields');
    await beta.fill('#rb-full-name', 'Voiku Zavadschi');
    await beta.fill('#apply-phone', '987087132');
    await beta.fill('#rb-driving-licence-number', 'VNS8893');
    await beta.fill('#rb-your-city-or-base', 'Mohali');
    await beta.getByRole('button', { name: 'Send Application' }).click();
    check(await applyDialog.getByText(PHONE_ERROR).count() === 1 && await applyDialog.locator('.rb-error-msg').count() === 0, 'Buddy application: a number a digit short is flagged under the field');
    await beta.fill('#apply-phone', '9870871324');
    await beta.getByRole('button', { name: 'Send Application' }).click();
    check(!!(await beta.waitForSelector('#apply-code', { timeout: 10000 }).catch(() => null)) && await applyDialog.getByText('Code sent to +91 XXXXX XX324.').count() === 1,
      'Buddy application: a code goes to the number');
    await beta.screenshot({ path: path.join(SHOTS, 'beta-apply-code.png') });
    await enterCode(beta, applyDialog, '#apply-code', '+919870871324');
    check(await beta.waitForSelector('text=Application received. We’ll contact you when onboarding opens.', { timeout: 10000 }).then(() => true).catch(() => false), 'Buddy application: received with the code');
    await beta.screenshot({ path: path.join(SHOTS, 'beta-apply-sent.png') });
    const bRow = (await download(dev, 'buddies')).at(-1) || [];
    check(bRow.slice(2, 7).join('; ') === 'Voiku Zavadschi; +919870871324; VNS8893; Mohali; Yes', `Buddy application: row saved, phone verified (${bRow.slice(2, 7).join('; ')})`);
    await beta.getByRole('button', { name: 'Done' }).click();
    check(new URL(beta.url()).hash === '', 'closing the form leaves a plain /beta/ URL');

    // A driver agency, through the same form.
    await beta.goto(`${ORIGIN}/beta/#apply`, { waitUntil: 'networkidle' });
    await beta.getByRole('radio', { name: /Driver agency/ }).click();
    check(await beta.waitForSelector('#rb-agency-name', { timeout: 5000 }).then(() => true).catch(() => false) && !(await beta.$('#rb-driving-licence-number')), 'choosing "Driver agency" swaps in the agency fields');
    await beta.fill('#rb-agency-name', 'Tricity Drivers');
    await beta.fill('#rb-contact-person', 'Gurpreet Kaur');
    await beta.fill('#apply-phone', '9811122233');
    await beta.fill('#rb-city-or-base', 'Panchkula');
    await applyDialog.getByText('6–20', { exact: true }).click();
    await beta.fill('#rb-work-email-\\(optional\\)', 'ops@tricitydrivers.in');
    await beta.fill('#rb-gstin-\\(optional\\)', '03ABCDE1234F1Z');
    await beta.getByRole('button', { name: 'Send Application' }).click();
    await applyDialog.locator('.rb-error-msg').first().waitFor({ timeout: 10000 }).catch(() => {}); // the Worker's answer
    const gErr = await applyDialog.locator('.rb-error-msg').allTextContents();
    check(gErr.join() === 'Enter the 15-character GSTIN, or leave it blank.', `agency: a GSTIN a character short is refused (${gErr.join(' | ')})`);
    await beta.fill('#rb-gstin-\\(optional\\)', '03ABCDE1234F1Z5');
    await beta.getByRole('button', { name: 'Send Application' }).click();
    check(!!(await beta.waitForSelector('#apply-code', { timeout: 10000 }).catch(() => null)), 'agency application: a code goes to the number');
    await enterCode(beta, applyDialog, '#apply-code', '+919811122233');
    check(await beta.waitForSelector('text=Application received. We’ll contact you when onboarding opens.', { timeout: 10000 }).then(() => true).catch(() => false), 'agency application: received with the code');
    const aRow = (await download(dev, 'agencies')).at(-1) || [];
    check(aRow.slice(2, 10).join('; ') === 'Tricity Drivers; Gurpreet Kaur; +919811122233; Panchkula; 6–20; ops@tricitydrivers.in; 03ABCDE1234F1Z5; Yes', `agency application: row saved in agencies.csv, phone verified (${aRow.slice(2, 10).join('; ')})`);
    await beta.getByRole('button', { name: 'Done' }).click();

    // Every Estimate CTA still leads to /estimate/.
    await beta.getByRole('button', { name: 'Get an Estimate' }).first().click();
    await beta.waitForURL('**/estimate/', { timeout: 15000 }).then(() => check(true, '/beta "Get an Estimate" navigates to /estimate/')).catch(() => check(false, '/beta "Get an Estimate" navigates to /estimate/'));
    await beta.close();

    // /estimate/ wears the main site's header: same parts in the same places, at
    // desktop and phone widths, open menu included; only the current page differs.
    for (const width of [1280, 390]) {
      const pages = {};
      for (const url of ['/beta/', '/estimate/']) {
        const p = await ctx.newPage();
        await p.setViewportSize({ width, height: 900 });
        await p.goto(`${ORIGIN}${url}`, { waitUntil: 'networkidle' });
        await p.waitForSelector('header nav', { state: 'attached', timeout: 30000 });
        await p.evaluate(() => document.fonts.ready);
        pages[url] = { p, geo: await p.evaluate(headerGeometry) };
      }
      const [b, e] = [pages['/beta/'].geo, pages['/estimate/'].geo];
      const diff = Object.keys(b).filter((k) => k !== 'current' && JSON.stringify(b[k]) !== JSON.stringify(e[k]));
      check(!diff.length, `at ${width}px the /estimate/ header matches /beta/'s${diff.length ? ` — differs in ${diff.map((k) => `${k}: ${JSON.stringify(b[k])} vs ${JSON.stringify(e[k])}`).join('; ')}` : ''}`);
      const est = pages['/estimate/'].p;
      if (width === 1280) {
        check(b.current === 'Home' && e.current === null, `…Home underlined on /beta/, nothing on /estimate/ (${b.current}, ${e.current})`);
        const hrefs = await est.$$eval('header nav a', (as) => as.map((a) => `${a.textContent.trim()}=${a.getAttribute('href')}`).join(' '));
        check(hrefs === 'Home=/beta/ About=/beta/#about Contact=/beta/#contact', `header links lead to the main site, no "Estimate Fare" or How It Works (${hrefs})`);
        await est.screenshot({ path: path.join(SHOTS, 'estimate-header.png'), clip: { x: 0, y: 0, width, height: 90 } });
      } else {
        for (const { p } of Object.values(pages)) {
          await p.locator('header').getByRole('button', { name: 'Menu' }).click();
          // The menu fades up over 250ms; measure where it settles.
          await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
        }
        const [bm, em] = [await pages['/beta/'].p.evaluate(menuGeometry), await est.evaluate(menuGeometry)];
        check(!!em && JSON.stringify(bm) === JSON.stringify(em), `the phone menu matches /beta/'s (${(em || []).map((x) => x.split('@')[0]).join(', ')})`);
        await est.screenshot({ path: path.join(SHOTS, 'estimate-menu.png') });
        await est.keyboard.press('Escape');
        check(!(await est.evaluate(menuGeometry)), 'Escape closes it');
        await est.locator('header').getByRole('button', { name: 'Menu' }).click();
        await est.locator('.rb-menu').getByRole('link', { name: 'About' }).click();
        await est.waitForURL('**/beta/#about', { timeout: 15000 }).catch(() => {});
        check(est.url().endsWith('/beta/#about') && !!(await est.waitForSelector('#about-hero', { timeout: 30000 }).catch(() => null)), 'its About link opens /beta/#about');
      }
      for (const { p } of Object.values(pages)) await p.close();
    }

    // Analytics: this whole run, as /admin counts it. Pages send beacons as
    // they go and when they close; give the last ones a moment to land.
    await new Promise((r) => setTimeout(r, 3000));
    const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, httpCredentials: { username: 'admin', password: ADMIN_PASSWORD } });
    try {
      const a = await adminCtx.newPage();
      a.on('pageerror', (e) => errors.push('PAGEERROR /admin ' + String(e).slice(0, 200)));
      a.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
      await a.goto(`${dev.base}/admin?days=7`, { waitUntil: 'load' });
      const text = (await a.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
      check(/Visitors 1 /.test(text), `the run counts as one visitor (${text.match(/Visitors [^A-Z]*/)?.[0]})`);
      check(new RegExp(`Fares shown ${faresShown} `).test(text), `every fare shown is counted (${faresShown}; ${text.match(/Fares shown [^A-Z]*/)?.[0]})`);
      check(/Waitlist signups 3 /.test(text) && /Buddy applications 1 /.test(text) && /Agency applications 1 /.test(text), 'signups and applications, counted from the lists (a vote alone is not a signup)');
      check(/👍 The fare works 0 👎 It doesn’t 1/.test(text), `the fare feedback (${text.match(/👍 The fare works.{0,30}/)?.[0]})`);
      check(/Saw a fare \d+% of the step before 1 Joined the waitlist there \d+% of the step before 1 /.test(text), 'the estimator funnel reaches the waitlist');
      check(/Opened the application 1 Sent it 100% of the step before 1 /.test(text), 'Buddy recruitment: opened from the shared #apply link, then sent');
      check(/Shimla \d/.test(text) && /Kasauli \d/.test(text), `destinations priced (${text.match(/Destinations .{0,60}/)?.[0]})`);
      check(['estimate page', 'Contact page', 'Join the Waitlist pop-up', 'Buddy application'].every((f) => text.includes(`Mistyped phone number (${f}) 1`)), `mistyped numbers, per form (${text.match(/Mistyped phone number \([^)]*\) \d+/g)?.join(', ')})`);
      check(/Get Estimate Estimate · estimate form \d/.test(text) && /place suggestion Estimate · estimate form \d/.test(text), 'clicks by label and place; suggestions counted without their text');
      check(text.includes('One-time code not confirmed (estimate page: wrong code) 1'), `a wrong code shows under Problems (${text.match(/One-time code not confirmed[^)]*\) \d+/g)?.join(', ')})`);
      await a.hover('#daily .col:last-child');
      const tip = (await a.locator('#daily .tip').textContent()).trim();
      check(/^1 visitor\d+ page views/.test(tip), `hovering a day shows its numbers ("${tip}")`);
      await a.screenshot({ path: path.join(SHOTS, 'admin.png'), fullPage: true });
      await a.setViewportSize({ width: 390, height: 844 });
      await a.screenshot({ path: path.join(SHOTS, 'admin-mobile.png'), fullPage: true });
    } finally {
      await adminCtx.close();
    }
    // Privacy: the analytics hold no phone numbers, names, licences or addresses.
    const stored = storedBeacons(dev.dir);
    const codes = stub.messages.map((m) => (m.Body.match(/\b\d{6}\b/) || [])[0]).filter(Boolean);
    const leaks = ['98708', '71324', '7911', '98111', '81112', 'Voiku', 'VNS8893', 'Gurpreet', 'Tricity Drivers', 'tricitydrivers', '03ABCDE', 'usually pay', pinned, pinned.split(',').slice(0, 2).join(','), ...codes].filter((x) => x && stored.includes(x));
    check(stored.includes('estimate_completed') && codes.length >= 6 && !leaks.length,
      `analytics store no phone numbers, one-time codes, names, licences, agency details, comments or addresses (${leaks.join(', ') || 'none found'})`);

    if (blocked.length) console.log(`  note: ${new Set(blocked).size} host path(s) unreachable from this sandbox and aborted: ${[...new Set(blocked.map((u) => new URL(u).host))].join(', ')}`);
    // Through the sandbox proxy, Google's abuse detection answers some batched
    // tile requests with its "Sorry..." interstitial (403) — the proxy's shared
    // egress IP, not the key: single tiles succeed and real visitors fetch
    // tiles from their own address. Not a finding when replaying via the proxy.
    const tileSorry = (e) => process.env.HTTPS_PROXY && /^HTTP 403 https:\/\/maps\.googleapis\.com\/maps\/vt\?/.test(e);
    const sorries = errors.filter(tileSorry).length;
    if (sorries) console.log(`  note: ${sorries} batched tile request(s) got Google's rate-limit interstitial via the sandbox proxy (ignored)`);
    // Google's own internal Maps RPCs (map viewport/attribution info) now and then
    // answer 5xx through the proxy — Google's side, not the key (which fails 403) or this page.
    const googleRpc = (e) => process.env.HTTPS_PROXY && /^HTTP 5\d\d https:\/\/maps\.googleapis\.com\/\$rpc\//.test(e);
    const rpcs = errors.filter(googleRpc).length;
    if (rpcs) console.log(`  note: ${rpcs} internal Google Maps RPC(s) answered 5xx via the sandbox proxy (ignored)`);
    // The forms' 400s are the refusals this run provokes on purpose (the GSTIN a character short).
    const provoked = (e) => /^HTTP 400 \S+\/api\/(waitlist|buddy)$/.test(e);
    const real = errors.filter((e) => !tileSorry(e) && !googleRpc(e) && !provoked(e) && !/deprecat|google\.maps\.Marker|image-slots\.state\.json|Marker is deprecated|gstatic\.com|fonts\.googleapis|ERR_CONNECTION|Failed to load resource/i.test(e));
    check(real.length === 0, `no console/page/HTTP errors (${real.length})`);
    real.forEach((e) => console.log('     ', e));

    // Codes off — no Twilio, as on the live site until it is set up: the forms save in one step.
    await dev.stop();
    const plain = await startDev({ port: PORT, password: ADMIN_PASSWORD });
    try {
      const off = await ctx.newPage();
      await off.goto(`${ORIGIN}/beta/`, { waitUntil: 'networkidle' });
      await off.getByRole('button', { name: 'Join the Waitlist' }).first().click();
      const d = off.getByRole('dialog', { name: 'Join the waitlist' });
      await off.fill('#rb-wl-phone', '9811100031');
      await d.locator('label:has(#rb-wl-consent)').click();
      await d.getByRole('button', { name: 'Join the Waitlist' }).click();
      check(await d.getByText(WAITLIST_JOINED).waitFor({ timeout: 10000 }).then(() => true).catch(() => false) && !(await off.$('#rb-wl-code')),
        'codes off: the pop-up joins in one step, no code asked');
      const row = (await download(plain, 'clients')).at(-1) || [];
      check(row[2] === '+919811100031' && row[8] === 'Yes' && row[9] === '', `codes off: saved, Phone verified left blank (${row[2]}, "${row[9]}")`);
      await off.close();
    } finally {
      await plain.stop();
    }
  } finally {
    await browser.close();
    await dev.stop();
    await stub.close();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
