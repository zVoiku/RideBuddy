/**
 * Measures the city pages' trips (src/cities) the way a visitor's tap on one
 * of their cards does: opens the estimator with the card's link, lets it look
 * up the city's pickup point and the destination with Google (maps.findPlace),
 * and prices the trip for a 9 AM pickup. Writes what Google gave each trip, one
 * way — the road distance in metres, the drive time in seconds, and the places
 * the words were taken as — to src/cities/routes.json, which the build turns
 * into the cards' distances, drive times and "From" fares.
 *
 * Run it again when the trips or the pickup points change, or to refresh the
 * numbers before a launch; then rebuild. Needs what test/verify.mjs needs: a
 * built dist/ with GOOGLE_MAPS_BROWSER_KEY, and Chromium via Playwright.
 *
 *   npm --prefix website run build
 *   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node website/test/measure-routes.mjs
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { startDev } from './dev-server.mjs';
import { CITY_PAGES, TRIP_DAYS, estimateLink, tripOf } from '../src/cities/cities.mjs';

const require = createRequire(import.meta.url);
const { chromium, request } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'src', 'cities', 'routes.json');
// As in test/verify.mjs: the Google key allows the production addresses, so the
// site is served on the real hostname, resolved to this machine inside Chromium.
const HOST = process.env.VERIFY_HOST || 'www.ridebuddy.co.in';
const PORT = Number(process.env.VERIFY_PORT || 80);
const ORIGIN = `http://${HOST}${PORT === 80 ? '' : `:${PORT}`}`;
/** A date two weeks ahead, in IST, as the date fields take it; and n days after it. */
const day = (n) => new Date(Date.now() + (330 + (14 + n) * 1440) * 60000).toISOString().slice(0, 10);

async function measure(page, slug, route) {
  const days = TRIP_DAYS[route.type];
  await page.goto(`${ORIGIN}${estimateLink(slug, route)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#rb-destination', { timeout: 30000 });
  // Both places looked up: nothing loading.
  await page.waitForFunction(() => !document.querySelector('.rb-place__busy'), null, { timeout: 30000 });
  const pickup = await page.inputValue('#rb-pickup');
  const destination = await page.inputValue('#rb-destination');
  const round = tripOf(route) === 'round';
  await page.fill(round ? '#rb-departure-date' : '#rb-pickup-date', day(0));
  if (round) await page.fill('#rb-return-date', day(days - 1));
  await page.selectOption('#rb-pickup-hour', '9');
  await page.selectOption('#rb-pickup-minute', '0');
  // Get Estimate turns on only once both places are chosen; the line under it says what is missing.
  const go = page.getByRole('button', { name: 'Get Estimate' });
  if (await go.isDisabled()) {
    const why = await page.locator('.rb-hint').textContent().catch(() => '');
    throw new Error(`${slug} → ${route.dest}: the link's places were not taken ("${pickup}", "${destination}"): ${why}`);
  }
  await go.click();
  await page.waitForSelector('[data-testid="fare-estimate"]', { timeout: 45000 });
  const { inputs, result } = await page.evaluate(() => window.__rbLastEstimate);
  if (result.trip_days !== days) throw new Error(`${slug} → ${route.dest}: priced as ${result.trip_days} days, the card says ${route.type}`);
  return {
    metres: Math.round(inputs.distanceKm * 1000),
    seconds: Math.round(inputs.durationHours * 3600),
    pickup,
    destination,
    fare: result.total_fare,
  };
}

async function main() {
  const dev = await startDev({ port: PORT });
  const browser = await chromium.launch({ args: HOST === 'localhost' ? [] : [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addCookies([{ name: 'rb_cookie_ok', value: '1', domain: HOST, path: '/' }]);
  // In the Claude Code sandbox Chromium can't reach Google through the agent
  // proxy; Node can, so every outside request is replayed from here (as in verify).
  if (process.env.HTTPS_PROXY) {
    const rc = await request.newContext({ proxy: { server: process.env.HTTPS_PROXY }, ignoreHTTPSErrors: true });
    await ctx.route((u) => !(u.hostname === HOST || u.hostname === 'localhost' || u.hostname === '127.0.0.1'), async (route) => {
      try {
        await route.fulfill({ response: await rc.fetch(route.request(), { maxRedirects: 0, timeout: 15000 }) });
      } catch {
        await route.abort('connectionfailed').catch(() => {});
      }
    });
  }
  const routes = {};
  try {
    const page = await ctx.newPage();
    for (const [slug, city] of Object.entries(CITY_PAGES)) {
      routes[slug] = {};
      for (const r of city.routes) {
        const m = await measure(page, slug, r);
        routes[slug][r.id] = { metres: m.metres, seconds: m.seconds, pickup: m.pickup, destination: m.destination };
        console.log(`  ${city.name} → ${r.dest}: ${(m.metres / 1000).toFixed(1)} km, ${Math.floor(m.seconds / 3600)} h ${Math.round((m.seconds % 3600) / 60)} min, ₹${m.fare}  (${m.pickup} → ${m.destination})`);
      }
    }
  } finally {
    await browser.close();
    await dev.stop();
  }
  const out = {
    _about: 'What Google gave each city page trip, one way, from the city\'s pickup point (src/cities/cities.mjs): road distance in metres, drive time in seconds, and the places the link\'s words were taken as. Written by test/measure-routes.mjs; the build turns it into the cards\' distances, drive times and "From" fares.',
    measured: new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10),
    routes,
  };
  await writeFile(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\nWrote ${path.relative(process.cwd(), OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
