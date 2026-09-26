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
const PHONE_ERROR = 'Enter a 10-digit number. Outside India? Start with + and the country code.';

function backendTotal(inputs) {
  const script = `
import json, sys, importlib.util, os
os.environ.setdefault("USE_INMEMORY_DB", "true"); os.environ.setdefault("DB_NAME", "verify"); os.environ.setdefault("MONGO_URL", "mongodb://localhost:1")
spec = importlib.util.spec_from_file_location("server", ${JSON.stringify(path.join(ROOT, 'backend', 'server.py'))})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
t = json.load(sys.stdin); p = t.get("pickup")
b = m.fare_breakdown(trip_type=t["tripType"], one_way=t["oneWay"], distance_km=t["distanceKm"], duration_hours=t.get("durationHours", 0),
                     days=t.get("days", 0), scheduled_at=(f"{p['date']}T{p['time']}:00+05:30" if p else None), customer_stay=t.get("customerStay", False))
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

  // The site as Cloudflare serves it: static files first, the Worker for /api and /admin.
  const dev = await startDev({ port: PORT, password: ADMIN_PASSWORD });
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
    await page.screenshot({ path: path.join(SHOTS, 'estimate-form.png') });

    // One way: Sector 17 -> Shimla
    await page.getByRole('button', { name: 'One Way' }).click();
    const pick = await pickPlace(page, '#rb-pickup', 'Sector 17');
    const dest = await pickPlace(page, '#rb-destination', 'Shimla');
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

    // Booking isn't open: the result leads straight to the waitlist.
    check(await page.getByText('Book a Buddy').count() === 0 && await page.getByText('Join the waitlist.').count() === 1, 'the result offers the waitlist and no "Book a Buddy"');

    // Joining the waitlist under the estimate saves the number with the trip just priced.
    await page.fill('#rb-whatsapp-number', '98708 7132');
    await page.getByRole('button', { name: 'Join the Waitlist' }).click();
    const waErr = await page.waitForSelector('.rb-waitlist .rb-error-msg', { timeout: 10000 }).then((e) => e.textContent()).catch(() => '');
    check(waErr === PHONE_ERROR, `a number a digit short is refused on the page ("${waErr.slice(0, 40)}…")`);
    await page.fill('#rb-whatsapp-number', '+91 98708 71324');
    await page.getByRole('button', { name: 'Join the Waitlist' }).click();
    const joined = await page.waitForSelector("text=You're on the waitlist", { timeout: 10000 }).then(() => true).catch(() => false);
    check(joined, 'estimate waitlist: joined');
    const waRow = (await download(dev, 'clients')).at(-1) || [];
    const wantTrip = `One way · ${pick} → ${dest} · `;
    check(waRow[2] === '+919870871324' && waRow[3] === 'Estimate page' && waRow[4]?.startsWith(wantTrip) && waRow[4]?.endsWith(`09:00 · ${(await page.locator('[data-testid="fare-estimate"]').textContent()).trim()}`),
      `estimate waitlist: row saved with the trip ("${waRow[4]}")`);

    // Late departure: 16:00 on the Shimla run should not cross midnight; check consistency only.
    await page.getByRole('button', { name: 'Edit trip details' }).click();
    await page.fill('#rb-pickup-time', '20:30');
    const late = await estimateAndCompare(page, 'one-way 20:30 departure');
    check(late.result.night_charge_applied === true, 'a 20:30 departure on a 3h+ drive triggers the night charge');

    // Round trip, 3 days, stay not arranged — back to the form through the header's
    // "Get an Estimate" this time, which keeps the trip and returns to the top.
    await page.locator('header').getByRole('button', { name: 'Get an Estimate' }).click();
    const refilled = await page.waitForSelector('#rb-pickup', { timeout: 5000 }).then(async () => (await page.inputValue('#rb-pickup')).length > 3).catch(() => false);
    const atTop = await page.waitForFunction(() => window.scrollY < 5, null, { timeout: 5000 }).then(() => true).catch(() => false);
    check(refilled && atTop, 'the header\'s "Get an Estimate" brings back the form, trip still filled in, at the top');
    await page.getByRole('button', { name: 'Round Trip' }).click();
    const depart = await page.inputValue('#rb-departure-date');
    const ret = new Date(Date.parse(depart) + 2 * 864e5).toISOString().slice(0, 10);
    await page.fill('#rb-return-date', ret);
    await page.fill('#rb-pickup-time', '09:00');
    const round = await estimateAndCompare(page, 'round trip 3 days');
    check(round.result.trip_days === 3 && round.result.stay_included === true, 'round trip bills 3 days with the stay included');
    check((await page.locator('.rb-conds').textContent()).includes("Includes the Buddy's stay for 2 nights"), 'stay line reads "2 nights"');

    // Hourly: 4 hours -> 996
    await page.getByRole('button', { name: 'Edit trip details' }).click();
    await page.getByRole('button', { name: 'Hourly' }).click();
    check(!(await page.$('#rb-destination')), 'hourly hides the destination field');
    await page.fill('#rb-hours', '4');
    const hourly = await estimateAndCompare(page, 'hourly 4h');
    check(hourly.result.total_fare === 996, 'hourly 4h is ₹996 (legacy 249/h)');

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
    const contactShown = await beta.waitForSelector('#rb-phone-or-whatsapp-number', { timeout: 30000 }).then(() => true).catch(() => false);
    check(contactShown, '/beta/#contact opens the Contact page');
    await beta.screenshot({ path: path.join(SHOTS, 'beta-contact.png'), fullPage: true });
    await beta.fill('#rb-phone-or-whatsapp-number', '12345');
    await beta.getByRole('button', { name: 'Join the Waitlist' }).click();
    const cErr = await beta.waitForSelector('.rb-error-msg', { timeout: 10000 }).then((e) => e.textContent()).catch(() => '');
    check(cErr === PHONE_ERROR, `Contact waitlist: a short number is refused ("${cErr.slice(0, 40)}…")`);
    await beta.fill('#rb-phone-or-whatsapp-number', '+44 7911 123456');
    await beta.getByRole('button', { name: 'Join the Waitlist' }).click();
    check(await beta.waitForSelector("text=You're on the waitlist. We'll message you once.", { timeout: 10000 }).then(() => true).catch(() => false), 'Contact waitlist: joined');
    const cRow = (await download(dev, 'clients')).at(-1) || [];
    check(cRow[2] === '+447911123456' && cRow[3] === 'Contact page', `Contact waitlist: row saved (${cRow.slice(2, 4).join(', ')})`);

    const navHref = await beta.locator('header a', { hasText: 'About' }).first().getAttribute('href').catch(() => null);
    check(navHref === '#about', `nav links carry real URLs (About -> ${navHref})`);
    await beta.locator('header a', { hasText: 'About' }).first().click();
    check(beta.url().endsWith('/beta/#about') && !!(await beta.waitForSelector('#about-hero', { timeout: 10000 }).catch(() => null)), `clicking About shows it at ${new URL(beta.url()).pathname}${new URL(beta.url()).hash}`);
    await beta.goBack();
    // (Joined already, so the page shows the confirmation rather than the field.)
    check(beta.url().endsWith('/beta/#contact') && !!(await beta.waitForSelector("text=You're on the waitlist. We'll message you once.", { timeout: 10000 }).catch(() => null)), 'Back returns to the Contact page');
    await beta.locator('header a', { hasText: 'Home' }).first().click();
    check(new URL(beta.url()).hash === '' && !!(await beta.waitForSelector('#home-hero', { timeout: 10000 }).catch(() => null)), 'Home is plain /beta/');

    // The hero's "Book a Buddy · Coming soon" is information: shown, not a button, inert on hover.
    const bookInfo = beta.locator('div', { hasText: /^\s*Book a Buddy\s*Coming soon\s*$/ }).last();
    const before = await bookInfo.evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => null);
    await bookInfo.hover().catch(() => {});
    const hovered = await bookInfo.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, cursor: getComputedStyle(el).cursor, tab: el.tabIndex })).catch(() => null);
    check(!!hovered && (await beta.getByRole('button', { name: /Book a Buddy/ }).count()) === 0 && hovered.bg === before && hovered.cursor === 'default' && hovered.tab === -1,
      `the hero's "Book a Buddy · Coming soon" is shown but inert (${JSON.stringify(hovered)})`);

    // Apply to be a Buddy, from a shared /beta/#apply link.
    await beta.goto(`${ORIGIN}/beta/#apply`, { waitUntil: 'networkidle' });
    check(await beta.waitForSelector('#rb-full-name', { timeout: 30000 }).then(() => true).catch(() => false), '/beta/#apply opens the Buddy application');
    const modalText = await beta.locator('text=Apply to be a Buddy.').locator('xpath=ancestor::div[3]').textContent();
    check(!/email app/i.test(modalText), 'no "email app" wording left in the form');
    await beta.getByRole('button', { name: 'Send Application' }).click();
    check((await beta.locator('.rb-error-msg').count()) === 3, 'an empty application flags all three fields');
    await beta.fill('#rb-full-name', 'Voiku Zavadschi');
    await beta.fill('#rb-phone-number', '98708 7132');
    await beta.fill('#rb-driving-licence-number', 'VNS8893');
    await beta.getByRole('button', { name: 'Send Application' }).click();
    const pErr = await beta.waitForSelector('#rb-phone-number >> xpath=ancestor::div[contains(@class,"rb-field")]//span[contains(@class,"rb-error-msg")]', { timeout: 10000 }).then((e) => e.textContent()).catch(() => '');
    check(pErr === PHONE_ERROR, `Buddy application: the server's phone message shows under the field ("${pErr.slice(0, 40)}…")`);
    await beta.fill('#rb-phone-number', '+91 98708 71324');
    await beta.getByRole('button', { name: 'Send Application' }).click();
    check(await beta.waitForSelector("text=Application received. We'll call you to take it forward.", { timeout: 10000 }).then(() => true).catch(() => false), 'Buddy application: received');
    await beta.screenshot({ path: path.join(SHOTS, 'beta-apply-sent.png') });
    const bRow = (await download(dev, 'buddies')).at(-1) || [];
    check(bRow.slice(2, 5).join('; ') === 'Voiku Zavadschi; +919870871324; VNS8893', `Buddy application: row saved (${bRow.slice(2, 5).join('; ')})`);
    await beta.getByRole('button', { name: 'Done' }).click();
    check(new URL(beta.url()).hash === '', 'closing the form leaves a plain /beta/ URL');

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
        check(hrefs === 'Home=/beta/ How It Works=/beta/#how-it-works About=/beta/#about Contact=/beta/#contact', `header links lead to the main site, no "Estimate Fare" (${hrefs})`);
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
      check(/Waitlist signups 2 /.test(text) && /Buddy applications 1 /.test(text), 'signups and applications, counted from the lists');
      check(/Saw a fare \d+% of the step before 1 Joined the waitlist there \d+% of the step before 1 /.test(text), 'the estimator funnel reaches the waitlist');
      check(/Opened the application 1 Sent it 100% of the step before 1 /.test(text), 'Buddy recruitment: opened from the shared #apply link, then sent');
      check(/Shimla \d/.test(text) && /Kasauli \d/.test(text), `destinations priced (${text.match(/Destinations .{0,60}/)?.[0]})`);
      check(['estimate page', 'Contact page', 'Buddy application'].every((f) => text.includes(`Mistyped phone number (${f}) 1`)), 'mistyped numbers, per form');
      check(/Get Estimate Estimate · estimate form \d/.test(text) && /place suggestion Estimate · estimate form \d/.test(text), 'clicks by label and place; suggestions counted without their text');
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
    const leaks = ['98708', '71324', '7911', 'Voiku', 'VNS8893', pinned, pinned.split(',').slice(0, 2).join(',')].filter((x) => x && stored.includes(x));
    check(stored.includes('estimate_completed') && !leaks.length, `analytics store no phone numbers, names, licences or addresses (${leaks.join(', ') || 'none found'})`);

    if (blocked.length) console.log(`  note: ${new Set(blocked).size} host path(s) unreachable from this sandbox and aborted: ${[...new Set(blocked.map((u) => new URL(u).host))].join(', ')}`);
    // Through the sandbox proxy, Google's abuse detection answers some batched
    // tile requests with its "Sorry..." interstitial (403) — the proxy's shared
    // egress IP, not the key: single tiles succeed and real visitors fetch
    // tiles from their own address. Not a finding when replaying via the proxy.
    const tileSorry = (e) => process.env.HTTPS_PROXY && /^HTTP 403 https:\/\/maps\.googleapis\.com\/maps\/vt\?/.test(e);
    const sorries = errors.filter(tileSorry).length;
    if (sorries) console.log(`  note: ${sorries} batched tile request(s) got Google's rate-limit interstitial via the sandbox proxy (ignored)`);
    // The forms' 400s are the refusals this run provokes on purpose (a number a digit short).
    const provoked = (e) => /^HTTP 400 \S+\/api\/(waitlist|buddy)$/.test(e);
    const real = errors.filter((e) => !tileSorry(e) && !provoked(e) && !/deprecat|google\.maps\.Marker|image-slots\.state\.json|Marker is deprecated|gstatic\.com|fonts\.googleapis|ERR_CONNECTION|Failed to load resource/i.test(e));
    check(real.length === 0, `no console/page/HTTP errors (${real.length})`);
    real.forEach((e) => console.log('     ', e));
  } finally {
    await browser.close();
    await dev.stop();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
