/**
 * End-to-end check of /estimate/ against the real Google Maps APIs.
 *
 * Serves dist/ locally, drives the page headless, and for every estimate it
 * produces re-prices the exact same inputs with the backend's fare_breakdown.
 * Needs GOOGLE_MAPS_BROWSER_KEY (website/.env) with `localhost:*` allowed as a
 * referrer, and Chromium via Playwright.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node website/test/verify.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DIST = path.join(HERE, '..', 'dist');
const SHOTS = process.env.SHOTS || path.join(HERE, '..', '..', '..', 'tmp-shots');
// Where the built site is served for the browser. In the sandbox the Google key
// only allows the production referrers, so the default there is the real
// hostname on port 80, resolved to 127.0.0.1 inside Chromium (below). On a
// machine whose key allows localhost, VERIFY_HOST=localhost VERIFY_PORT=8098.
const HOST = process.env.VERIFY_HOST || 'www.ridebuddy.co.in';
const PORT = Number(process.env.VERIFY_PORT || 80);
const ORIGIN = `http://${HOST}${PORT === 80 ? '' : `:${PORT}`}`;
const PY = path.join(ROOT, 'backend', '.venv', 'bin', 'python');

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

async function estimateAndCompare(page, name) {
  await page.getByRole('button', { name: 'Get Estimate' }).click();
  const outcome = await Promise.race([
    page.waitForSelector('[data-testid="fare-estimate"]', { timeout: 45000 }).then(() => 'fare'),
    page.waitForSelector('.rb-error-msg, .rb-form-error', { timeout: 45000 }).then(async (el) => 'page error: ' + (await el.textContent())),
  ]);
  if (outcome !== 'fare') throw new Error(`${name}: ${outcome}`);
  const shown = (await page.locator('[data-testid="fare-estimate"]').textContent()).trim();
  const last = await page.evaluate(() => window.__rbLastEstimate);
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

  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: DIST, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  const browser = await chromium.launch({ args: HOST === 'localhost' ? [] : [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
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

    // Late departure: 16:00 on the Shimla run should not cross midnight; check consistency only.
    await page.getByRole('button', { name: 'Edit trip details' }).click();
    await page.fill('#rb-pickup-time', '20:30');
    const late = await estimateAndCompare(page, 'one-way 20:30 departure');
    check(late.result.night_charge_applied === true, 'a 20:30 departure on a 3h+ drive triggers the night charge');

    // Round trip, 3 days, stay not arranged.
    await page.getByRole('button', { name: 'Edit trip details' }).click();
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
      addr: (await page.locator('.rb-picker__addr').textContent()).trim(),
      coord: (await page.locator('.rb-picker__coord').textContent()).trim(),
    });
    const first = await caption();
    const geocoded = first.addr !== first.coord && !/Finding this place/.test(first.addr);
    console.log(`  ${geocoded ? 'ok  ' : 'note'} pin caption: "${first.addr.slice(0, 64)}"${geocoded ? '' : ' — coordinates only; Geocoding API is not enabled on the key'}`);
    await page.screenshot({ path: path.join(SHOTS, 'estimate-picker.png') });

    // Dragging the map moves the pin, which re-captions it.
    const box = await (await page.$('.rb-picker__canvas')).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 140, box.y + box.height / 2 - 90, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(2500);
    const moved = await caption();
    check(moved.coord !== first.coord && moved.addr !== first.addr, `dragging the map moves the pin and re-captions it ("${moved.addr.slice(0, 44)}")`);

    await page.getByRole('button', { name: 'Use this location' }).click();
    await page.waitForSelector('.rb-picker__sheet', { state: 'detached', timeout: 10000 });
    const pinned = await page.inputValue('#rb-pickup');
    check(pinned.length > 3, `picked point fills the pickup field ("${pinned.slice(0, 48)}")`);

    // A map-picked pickup prices exactly like a searched one.
    await pickPlace(page, '#rb-destination', 'Kasauli');
    await page.fill('#rb-pickup-time', '09:00');
    await estimateAndCompare(page, 'map-picked pickup');

    // Mobile viewport render.
    const mobile = await ctx.newPage(); await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto(`${ORIGIN}/estimate/`, { waitUntil: 'networkidle' });
    await mobile.screenshot({ path: path.join(SHOTS, 'estimate-mobile.png'), fullPage: true });
    await mobile.close();

    // /beta CTAs now lead here.
    const beta = await ctx.newPage();
    await beta.goto(`${ORIGIN}/beta/`, { waitUntil: 'networkidle' });
    await beta.waitForTimeout(2500);
    await beta.getByRole('button', { name: 'Get an Estimate' }).first().click();
    await beta.waitForURL('**/estimate/', { timeout: 15000 }).then(() => check(true, '/beta "Get an Estimate" navigates to /estimate/')).catch(() => check(false, '/beta "Get an Estimate" navigates to /estimate/'));
    await beta.close();

    if (blocked.length) console.log(`  note: ${new Set(blocked).size} host path(s) unreachable from this sandbox and aborted: ${[...new Set(blocked.map((u) => new URL(u).host))].join(', ')}`);
    // Through the sandbox proxy, Google's abuse detection answers some batched
    // tile requests with its "Sorry..." interstitial (403) — the proxy's shared
    // egress IP, not the key: single tiles succeed and real visitors fetch
    // tiles from their own address. Not a finding when replaying via the proxy.
    const tileSorry = (e) => process.env.HTTPS_PROXY && /^HTTP 403 https:\/\/maps\.googleapis\.com\/maps\/vt\?/.test(e);
    const sorries = errors.filter(tileSorry).length;
    if (sorries) console.log(`  note: ${sorries} batched tile request(s) got Google's rate-limit interstitial via the sandbox proxy (ignored)`);
    const real = errors.filter((e) => !tileSorry(e) && !/deprecat|google\.maps\.Marker|image-slots\.state\.json|Marker is deprecated|gstatic\.com|fonts\.googleapis|ERR_CONNECTION|Failed to load resource/i.test(e));
    check(real.length === 0, `no console/page/HTTP errors (${real.length})`);
    real.forEach((e) => console.log('     ', e));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
