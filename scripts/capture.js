/**
 * RideBuddy visual capture — drives the full user journey on the Expo *web*
 * build with Playwright and saves a phone-sized screenshot of every screen.
 *
 * Prereqs: the Expo web server and the backend must be running, e.g.
 *   backend/.venv/bin/uvicorn --app-dir backend server:app --host 0.0.0.0 --port 8001 &
 *   (cd frontend && BROWSER=none npx expo start --web --offline --port 8081 &)
 *
 * Run (Claude Code on the web image provides Playwright at /opt):
 *   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node scripts/capture.js
 *
 * Config via env: BASE_URL (default http://localhost:8081), OUT_DIR (default
 * /tmp/ridebuddy-shots).
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:8081';
const DIR = process.env.OUT_DIR || '/tmp/ridebuddy-shots';
fs.mkdirSync(DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', String(e).split('\n')[0]));

  let n = 0;
  const shot = async (name) => {
    n++;
    const f = `${DIR}/${String(n).padStart(2, '0')}_${name}.png`;
    await page.screenshot({ path: f });
    console.log('shot', f);
  };
  const sel = (id) => `[data-testid="${id}"]`;
  const waitId = (id, t = 30000) => page.waitForSelector(sel(id), { timeout: t });
  const tap = async (id) => { await waitId(id); await page.click(sel(id)); };
  const fill = async (id, v) => { await waitId(id); await page.fill(sel(id), v); };

  const phone = '9' + Math.floor(100000000 + Math.random() * 899999999); // fresh user each run

  // Login
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await waitId('phone-input', 180000);
  await page.waitForTimeout(800);
  await shot('login');
  await fill('phone-input', phone);
  await tap('send-otp-btn');

  // OTP
  await waitId('otp-0');
  for (let i = 0; i < 6; i++) await fill(`otp-${i}`, String(i + 1));
  await page.waitForTimeout(400);
  await shot('otp');
  await tap('verify-otp-btn');

  // Profile (new user)
  await waitId('profile-name');
  await fill('profile-name', 'Voiku Z');
  await fill('profile-email', 'voiku@example.com');
  await page.waitForTimeout(400);
  await shot('profile');
  await tap('profile-continue');

  // Car make / model
  await waitId('make-maruti');
  await page.waitForTimeout(1000);
  await shot('car_make');
  await tap('make-maruti');
  await waitId('model-swift');
  await page.waitForTimeout(800);
  await tap('model-swift');
  await shot('car_model');
  await tap('model-continue');

  // Home + drawer
  await waitId('fare-estimate-btn');
  await page.waitForTimeout(1200);
  await shot('home');
  await tap('menu-btn');
  await waitId('menu-logout');
  await page.waitForTimeout(500);
  await shot('drawer');
  await tap('drawer-close');
  await page.waitForTimeout(400);

  // Summary -> payment
  await tap('fare-estimate-btn');
  await waitId('confirm-pay-btn');
  await page.getByText('Total Amount').waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await shot('summary');
  await tap('confirm-pay-btn');
  await waitId('pay-now-btn');
  await page.waitForTimeout(800);
  await shot('payment');

  // Finding (transient) -> tracking
  await tap('pay-now-btn');
  try { await waitId('finding-screen', 6000); await shot('finding'); } catch (_) {}
  await waitId('trip-code', 25000);
  await page.waitForTimeout(1200);
  await shot('tracking_assigned');

  // Start trip with the live code -> on-trip + live map
  const startCode = (await page.textContent(sel('trip-code')) || '').trim();
  await tap('start-trip-btn');
  await fill('code-input', startCode);
  await tap('modal-confirm');
  await waitId('sos-btn', 15000);
  await page.waitForTimeout(1000);
  await shot('on_trip');
  try {
    await tap('live-map-btn');
    await page.waitForTimeout(2500);
    await shot('live_map');
    await tap('map-close');
    await page.waitForTimeout(500);
  } catch (_) {}

  // Bookings list + account
  await page.goto(BASE + '/bookings', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await shot('bookings');
  await page.goto(BASE + '/account', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await shot('account');

  console.log('DONE — ' + n + ' screenshots in ' + DIR);
  await browser.close();
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
