/**
 * The site's Worker (website/worker): the pure helpers first, then every
 * endpoint end to end under `wrangler dev` — the real Workers runtime, serving
 * website/dist, with a throwaway local D1 per run.
 *
 *   npm run build && npm run test:worker
 */
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { startDev } from './dev-server.mjs';
import {
  CODE_EXPIRED, CODE_NETWORK_LIMIT, CODE_NUMBER_LIMIT, CODE_SEND_FAILED, CODE_TOO_MANY, CODE_WRONG, CONSENT_ERROR, EMAIL_ERROR,
  GSTIN_ERROR, LINK_ONLY_ERROR, PHONE_ERROR, cleanComment, cleanText, csvCell, describeTrip, groupINR, isEmail, isGstin, istStamp,
  maskPhone, networkOf, normalizePhone, shiftDay, splitStoredTrip, toCsv, tripFare,
} from '../worker/lib.js';
import { startTwoFactorStub } from './twofactor-stub.mjs';
import {
  DAY_SQL, DIRECT, aheadBand, cleanEvents, deviceOf, fareBand, isBot, sourceOf, speedBand, summarize,
} from '../worker/stats.js';

/** A day's totals exactly as the Worker computes them: DAY_SQL on SQLite (here Node's), then summarize. */
function dayTotals(beacons, day) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE beacons (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT, at INTEGER, vid TEXT, device TEXT, city TEXT, country TEXT, events TEXT)');
  const insert = db.prepare("INSERT INTO beacons (day, at, vid, device, city, country, events) VALUES (?, 0, ?, ?, ?, '', ?)");
  for (const b of beacons) insert.run(b.day || day, b.vid, b.device, b.city, JSON.stringify(b.events));
  return summarize(DAY_SQL.map((sql) => db.prepare(sql).all(day)));
}
import { compact, renderDashboard } from '../worker/dashboard.js';

const PASSWORD = 'test-password-ʀʙ-2026';

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? '  ok ' : '  FAIL'} ${msg}`); if (!ok) failures += 1; };
const same = (got, want, msg) => check(got === want, got === want ? msg : `${msg} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// ----- Helpers (Node) ---------------------------------------------------------------

function units() {
  console.log('helpers');
  const phones = [
    ['98708 71324', '+919870871324'],
    ['+91 98708-71324', '+919870871324'],
    ['+919870871324', '+919870871324'],
    ['919870871324', '+919870871324'],
    ['09870871324', '+919870871324'],
    ['(987) 087-1324', '+919870871324'],
    ['6000000000', '+916000000000'],
    ['0172 270 0000', null], // a landline: a one-time code can't reach it
    ['+91 0172 2700000', null],
    ['5987654321', null], // Indian mobiles start 6–9
    ['0091 98708 71324', '+919870871324'],
    ['+44 7911 123456', null], // every form has a fixed +91: foreign numbers are refused
    ['0044 7911 123456', null],
    ['+1 (415) 555-2671', null],
    ['98708 7132', null], // a digit short
    ['+91 98708 7132', null],
    ['12345', null],
    ['9870871324 9870871324', null],
    ['call me', null],
    ['+1', null],
    ['', null],
    [undefined, null],
  ];
  for (const [input, want] of phones) {
    const r = normalizePhone(input);
    same(r.ok ? r.phone : null, want, `phone ${JSON.stringify(input)} -> ${want ?? 'refused'}`);
    if (!want) same(r.error, PHONE_ERROR, `  …with the field message`);
  }
  same(maskPhone('+919870871324'), '+91 XXXXX XX324', 'where a code went, without the number');

  same(describeTrip({ type: 'round', from: 'Sector 17', to: 'Shimla', date: '2026-10-12', ret: '2026-10-14', time: '09:00', fare: 5492 }),
    'Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00', 'trip: round (the fare has its own column)');
  same(describeTrip({ type: 'round', from: 'Mohali', to: 'Manali', date: '2026-10-30', ret: '2026-11-01', time: '06:00', fare: 7012 }),
    'Round trip · Mohali → Manali · 30 Oct – 1 Nov, 06:00', 'trip: round across a month end');
  same(describeTrip({ type: 'one', from: 'Sector 17', to: 'Shimla', date: '2026-10-12', time: '20:30', fare: 1860 }),
    'One way · Sector 17 → Shimla · 12 Oct, 20:30', 'trip: one way');
  same(describeTrip({ type: 'hourly', from: 'Sector 17', to: '', date: '2026-10-12', time: '09:00', hours: 4, fare: 996 }),
    'Hourly · 4 h from Sector 17 · 12 Oct, 09:00', 'trip: hourly');
  same([tripFare({ fare: 5492 }), tripFare({ fare: '5492' }), tripFare({ fare: 0 }), tripFare({ fare: 1e8 }), tripFare(null)].join(' '), '5492    ', 'trip fare: a whole positive number, else none');
  same(JSON.stringify(splitStoredTrip('Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00 · ₹5,492', null)),
    '{"trip":"Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00","fare":5492}', 'a row saved before the fare column: the fare is split off its trip');
  same(JSON.stringify(splitStoredTrip('One way · A → B · 12 Oct', 1860)), '{"trip":"One way · A → B · 12 Oct","fare":1860}', 'a current row is read as it is');

  same(JSON.stringify(['Too high', 'Too high, see https://cheaper.example/x', 'https://cheaper.example/x', 'www.cheaper.example', '  ', 'x'.repeat(400)].map((c) => cleanComment(c))),
    JSON.stringify([{ ok: true, text: 'Too high' }, { ok: true, text: 'Too high, see https://cheaper.example/x' }, { ok: false, error: LINK_ONLY_ERROR },
      { ok: false, error: LINK_ONLY_ERROR }, { ok: true, text: '' }, { ok: true, text: 'x'.repeat(280) }]), 'comments: words kept, links alone refused, capped at 280');
  check(isEmail('ops@tricitydrivers.in') && !isEmail('ops@') && !isEmail('ops tricity@x.in'), 'work email: looks like one, or not');
  check(isGstin('03ABCDE1234F1Z5') && !isGstin('03ABCDE1234F1Z') && !isGstin('03abcde1234f1z5') && !isGstin('03ABCDE1234F1Y5'), 'GSTIN: 15 characters in the GST pattern');
  same(describeTrip({ type: 'one', from: 'A\u0000\n B', to: 'x'.repeat(200), date: '12/10/2026', time: '9am', fare: '1860' }),
    `One way · A B → ${'x'.repeat(80)}`, 'trip: malformed parts are dropped, text is cleaned and capped');
  same(describeTrip({ type: 'boat' }), null, 'trip: unknown type -> none');
  same(describeTrip('Round trip to Shimla'), null, 'trip: not an object -> none');

  same([996, 5492, 123456, 12345678].map(groupINR).join(' '), '996 5,492 1,23,456 1,23,45,678', 'Indian digit grouping');
  same(istStamp('2026-09-25T08:33:00.000Z'), '2026-09-25 14:03', 'IST timestamp');
  same(istStamp('2026-09-25T20:00:00.000Z'), '2026-09-26 01:30', 'IST timestamp past midnight');

  same(networkOf('49.36.12.7'), '49.36.12.7', 'network: IPv4 as is');
  same(networkOf('2401:4900:1c2a:8e3f:1:2:3:4'), '2401:4900:1c2a:8e3f::/64', 'network: IPv6 cut to its /64');
  same(networkOf('2401:4900::1'), '2401:4900:0:0::/64', 'network: compressed IPv6');
  same(networkOf('::ffff:49.36.12.7'), '49.36.12.7', 'network: IPv4-mapped IPv6');
  same(networkOf(null), 'unknown', 'network: missing');

  same(csvCell('+919870871324'), '+919870871324', 'csv: a phone number stays as written');
  same(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`, 'csv: a formula opens as text');
  same(['-1', '@a', '+x'].map(csvCell).join(' '), "'-1 '@a '+x", 'csv: other formula starters neutralised');
  same(csvCell('PB01 2011, 0012345'), '"PB01 2011, 0012345"', 'csv: commas quoted');
  same(toCsv(['A', 'B'], [[1, 'x']]), '\uFEFFA,B\r\n1,x\r\n', 'csv: BOM + CRLF');
  same(cleanText('  Voiku \n\t Zavadschi\u0000 ', 100), 'Voiku Zavadschi', 'text: whitespace and control characters');
  same(cleanText('ab😀cd', 3), 'ab😀', 'text: capped by character, not UTF-16 unit');
  same([shiftDay('2026-09-26', 1), shiftDay('2026-03-01', -1), shiftDay('2026-12-31', 1)].join(' '), '2026-09-27 2026-02-28 2027-01-01', 'days move across month and year ends');
}

function analyticsUnits() {
  console.log('\nanalytics helpers');
  const events = cleanEvents({ e: [
    { n: 'pageview', p: '/beta/#contact', f: 1, r: 'L.Instagram.com', u: { source: 'WhatsApp', medium: 'group', x: 'no' } },
    { n: 'click', p: '/estimate/', l: '  Get\n Estimate ', w: 'estimate form', h: '/estimate/' },
    { n: 'estimate_completed', p: '/estimate/', d: { trip: 'one', fare: 1611.4, night: false, nested: { a: 1 }, 'Bad-Key': 1, pickup_area: 'x'.repeat(99) } },
    { n: 'Bad Name', p: '/' }, { n: 'pageview', p: 'https://evil.example/' }, { n: 'pageview', p: '/ok', f: 2, r: 'not a host!' }, null, 'x',
  ] });
  same(events.length, 4, 'events: malformed names, pages and entries are dropped');
  same(JSON.stringify(events[0]), '{"n":"pageview","p":"/beta/#contact","f":1,"r":"l.instagram.com","u":{"source":"whatsapp","medium":"group"}}', 'events: a landing view keeps its referrer and campaign, lower-cased');
  same(events[1].l, 'Get Estimate', 'events: labels are cleaned');
  same(JSON.stringify(events[2].d), `{"trip":"one","fare":1611.4,"night":false,"pickup_area":"${'x'.repeat(60)}"}`, 'events: details keep flat primitives only, capped');
  same(JSON.stringify(events[3]), '{"n":"pageview","p":"/ok"}', 'events: a bad referrer and a bad landing flag are dropped');
  same(cleanEvents({ e: Array(40).fill({ n: 'click', p: '/' }) }).length, 25, 'events: at most 25 per beacon');

  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const tablet = 'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
  const desktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  same([android, iphone, tablet, desktop].map(deviceOf).join(' '), 'Phone Phone Tablet Computer', 'device from the browser');
  const insta = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 Instagram 350.0';
  check(!isBot(android) && !isBot(insta) && isBot('Googlebot/2.1') && isBot('Mozilla/5.0 HeadlessChrome/129.0') && isBot(''), 'crawlers and headless browsers are not visitors; in-app browsers are');

  same([{ u: { source: 'whatsapp' } }, { r: 'www.google.co.in' }, { r: 'l.instagram.com' }, { r: 'lm.facebook.com' }, {}, { r: '(internal)' }, { r: 'www.tribuneindia.com' }].map(sourceOf).join(' | '),
    `WhatsApp | Google | Instagram | Facebook | ${DIRECT} | ${DIRECT} | tribuneindia.com`, 'where a visit came from');
  same([0, 2, 7, 20, 45].map(aheadBand).join(' | '), 'Same day | 1–3 days ahead | 4–7 days ahead | 8–30 days ahead | Over 30 days ahead', 'how far ahead, banded');
  same([999, 1611, 5492, 12000].map(fareBand).join(' | '), 'Under ₹1,000 | ₹1,000–1,999 | ₹5,000–9,999 | ₹10,000 and up', 'fares, banded');
  same([1200, 3100, 5200].map(speedBand).join(' '), 'Fast Slowish Slow', 'page speed, banded at 2.5 s and 4 s');
  same([999, 12900, 128400, 12900000].map(compact).join(' | '), '999 | 12,900 | 1.3 L | 1.3 Cr', 'big numbers in lakh and crore');

  // A day: A lands from Instagram, prices a trip and joins; B arrives by a tagged
  // WhatsApp link and applies to be a Buddy; C comes back from another page (internal).
  const totals = new Map(dayTotals([
    { vid: 'A', device: 'Phone', city: 'Chandigarh', events: [
      { n: 'pageview', p: '/estimate/', f: 1, r: 'l.instagram.com' }, { n: 'estimate_started', p: '/estimate/' },
      { n: 'estimate_completed', p: '/estimate/', d: { trip: 'one', pickup_area: 'Sector 17', pickup_city: 'Chandigarh', dest_city: 'Shimla', km: 114, fare: 1611, ahead: 1, weekday: 6, hour: 9 } },
    ] },
    { vid: 'B', device: 'Computer', city: 'Mohali', events: [
      { n: 'pageview', p: '/beta/', f: 1, u: { source: 'whatsapp', medium: 'group', campaign: 'drivers' } },
      { n: 'buddy_application_opened', p: '/beta/' }, { n: 'phone_invalid', p: '/beta/', d: { form: 'buddy' } },
      { n: 'buddy_application_submitted', p: '/beta/' }, { n: 'perf', p: '/beta/', d: { lcp: 4600, net: '3g' } },
    ] },
    { vid: 'A', device: 'Phone', city: 'Chandigarh', events: [
      { n: 'click', p: '/estimate/', w: 'estimate result', l: 'Join the Waitlist' }, { n: 'waitlist_joined', p: '/estimate/', d: { source: 'estimate' } },
      { n: 'place_refused', p: '/estimate/', d: { kind: 'pickup', area: 'Connaught Place', city: 'New Delhi' } },
    ] },
    { vid: 'C', device: 'Phone', city: 'Panchkula', events: [{ n: 'pageview', p: '/estimate/', f: 1, r: '(internal)' }] },
    // E's page view never arrived, but a fare did: E still reached every step before it.
    { vid: 'E', device: 'Phone', city: 'Zirakpur', events: [{ n: 'estimate_completed', p: '/estimate/', d: { trip: 'round', dest_city: 'Manali', fare: 6200 } }] },
    // Another day: not part of this one's totals.
    { day: '2026-09-25', vid: 'D', device: 'Phone', city: 'Delhi', events: [{ n: 'pageview', p: '/', f: 1 }] },
  ], '2026-09-26').map(([m, k, v]) => [`${m}|${k}`, v]));
  const got = (k) => totals.get(k) || 0;
  same([got('visitors|'), got('pageviews|'), got('page_views|/estimate/'), got('page_visitors|/estimate/')].join(' '), '4 3 2 2', 'a day: visitors, views, per page');
  same([got('source|Instagram'), got('source|WhatsApp'), got(`source|${DIRECT}`), got('campaign|whatsapp\tgroup\tdrivers')].join(' '), '1 1 2 1', 'a day: sources and the campaign');
  same(['1 opened', '2 started', '3 saw a fare', '4 joined the waitlist'].map((s) => got(`funnel_estimate|${s}`)).join(' '), '3 2 2 1', 'a day: the estimator funnel, in people; a later step implies the earlier ones');
  same([got('funnel_buddy|1 opened the form'), got('funnel_buddy|2 sent it'), got('buddy_source|WhatsApp'), got('signup_source|Instagram')].join(' '), '1 1 1 1', 'a day: Buddy recruitment and who signed up from where');
  same([got('dest|Shimla'), got('pickup|Sector 17, Chandigarh'), got('trip|One way'), got('ahead|1–3 days ahead'), got('weekday|Saturday'), got('fare_sum|'), got('km_sum|')].join(' '), '1 1 1 1 1 7811 114', 'a day: what was priced');
  same([got('refused|Pickup\tConnaught Place, New Delhi'), got('problem|Mistyped phone number (Buddy application)'), got('speed|/beta/\tSlow'), got('speed_net|3g\tSlow')].join(' '), '1 1 1 1', 'a day: refusals, problems and speed');
  same(got('click|/estimate/\testimate result\tJoin the Waitlist'), 1, 'a day: clicks by page, place and label');

  // The page escapes everything visitors can influence.
  const evil = '<img src=x onerror=alert(1)>';
  const html = renderDashboard({
    range: { days: 7, from: '2026-09-20', to: '2026-09-26' },
    lists: { clients: 0, clientPhones: 0, clientLast: null, buddies: 0, buddyPhones: 0, buddyLast: null },
    stats: { totals: new Map([[`click\u0000/\t${evil}\t${evil}`, 3], ['visitors\u0000', 1], [`source\u0000${evil}`, 1]]), days: Array.from({ length: 7 }, (_, i) => ({ day: shiftDay('2026-09-20', i), visitors: i, pageviews: i * 2 })) },
    before: new Map(), signups: { now: { waitlist: 0, buddies: 0 }, before: { waitlist: 0, buddies: 0 } },
    excluded: false, link: null, stamp: (x) => x,
  });
  check(!html.includes('<img') && html.includes('&#60;img src=x onerror=alert(1)&#62;'), 'dashboard: labels from visitors are escaped');
  check((html.match(/class="col"/g) || []).length === 7 && html.includes('Show as a table'), 'dashboard: one column a day, with the table beside it');
  const withVotes = visible(renderDashboard({
    range: { days: 7, from: '2026-09-20', to: '2026-09-26' },
    lists: { clients: 3, clientPhones: 2, clientLast: null, buddies: 1, buddyPhones: 1, buddyLast: null, agencies: 2, agencyPhones: 2, agencyLast: null },
    stats: { totals: new Map(), days: [] }, before: new Map(),
    signups: { now: { waitlist: 3, buddies: 1, agencies: 2, votes: { up: 5, down: 2, comments: 1 } }, before: { waitlist: 0, buddies: 0, agencies: 0 } },
    excluded: false, link: null, stamp: (x) => x,
  }));
  check(/Driver agencies 2 entries · 2 different numbers/.test(withVotes) && /Agency applications 2/.test(withVotes), 'dashboard: the driver agencies list and their tile');
  check(/👍 The fare works 5 👎 It doesn’t 2/.test(withVotes) && /1 vote came with a comment/.test(withVotes), 'dashboard: the 👍/👎 on fares');
}

// ----- Requests ------------------------------------------------------------------------

/** A request with full control of the headers (Host, Origin). */
function raw(base, { method = 'GET', path: p, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(p, base);
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function post(base, p, body, headers = {}) {
  return raw(base, {
    method: 'POST', path: p, body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Origin: base, ...headers },
  });
}

const basic = (user, pass) => `Basic ${Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')}`;
const admin = (base, p, { user = 'admin', pass = PASSWORD, ip, headers = {} } = {}) => raw(base, {
  path: p, headers: { Authorization: basic(user, pass), ...(ip ? { 'CF-Connecting-IP': ip } : {}), ...headers },
});
/** The dashboard's visible text, in one line. */
const visible = (html) => html.replace(/<style>[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
const json = (r) => { try { return JSON.parse(r.text); } catch { return null; } };
const csvRows = (text) => text.replace(/^\uFEFF/, '').trimEnd().split('\r\n');

// ----- Endpoints ------------------------------------------------------------------------

async function locked() {
  console.log('\nwithout ADMIN_PASSWORD');
  const dev = await startDev({ port: 8788 });
  try {
    const page = await raw(dev.base, { path: '/admin' });
    check(page.status === 503 && page.text.includes('ADMIN_PASSWORD'), `/admin is locked, with the setup steps (${page.status})`);
    const file = await admin(dev.base, '/admin/clients.csv');
    check(file.status === 503 && !file.text.includes('+91'), `the downloads are locked too, whatever the credentials (${file.status})`);
    // No TWOFACTOR_API_KEY either: no code can be sent, so nothing with a phone number saves.
    const refused = await post(dev.base, '/api/waitlist', { phone: '9870871324', source: 'contact', consent: true });
    check(refused.status === 503 && json(refused)?.reason === 'not_configured' && json(refused)?.error === CODE_SEND_FAILED,
      `without the 2Factor key, a signup is refused: "${json(refused)?.error}" (${refused.status})`);
    const app = await post(dev.base, '/api/buddy', { type: 'individual', name: 'A B', phone: '9870871324', licence: 'X1', city: 'Mohali' });
    same(app.status, 503, '…and so is a Buddy application');
    same((await post(dev.base, '/api/feedback', { estimate_id: 'est_nokey00000000001', vote: 'up' })).status, 200, 'a 👍 on a fare needs no code and still saves');
  } finally {
    await dev.stop();
  }
}

async function endpoints() {
  console.log('\nwith ADMIN_PASSWORD');
  // OTP_OFF (test servers only): this suite is about the forms' fields and lists; the one-time codes have their own.
  const dev = await startDev({ port: 8787, password: PASSWORD, vars: { RB_TEST: '1', OTP_OFF: '1' } });
  const B = dev.base;
  try {
    for (const [p, want] of [['/', 200], ['/beta/', 200], ['/estimate/', 200], ['/no-such-page', 404]]) {
      same((await raw(B, { path: p })).status, want, `static site still served: ${p}`);
    }

    // The client waitlist.
    for (const phone of ['98708 71324', '+91 98708-71324', '09870871324']) {
      const r = await post(B, '/api/waitlist', { phone, source: 'contact' });
      check(r.status === 200 && json(r)?.ok === true, `waitlist accepts "${phone}" (${r.status})`);
    }
    const trip = { type: 'round', from: 'Sector 17', to: 'Shimla', date: '2026-10-12', ret: '2026-10-14', time: '09:00', fare: 5492 };
    const oneWay = { type: 'one', from: 'Sector 17', to: 'Shimla', date: '2026-10-12', time: '20:30', fare: 1860 };
    const foreign = await post(B, '/api/waitlist', { phone: '+44 7911 123456', source: 'contact', consent: true });
    check(foreign.status === 400 && json(foreign)?.errors?.phone === PHONE_ERROR, `a foreign number is refused: every form is +91 (${foreign.status})`);
    const unticked = await post(B, '/api/waitlist', { phone: '9811100000', source: 'home', consent: false });
    check(unticked.status === 400 && json(unticked)?.errors?.consent === CONSENT_ERROR, `the consent tick is required where the form has it (${unticked.status})`);
    for (const [phone, source] of [['9811100001', 'home'], ['9811100002', 'how'], ['9811100003', 'about']]) {
      same((await post(B, '/api/waitlist', { phone, source, consent: true })).status, 200, `the Join the Waitlist pop-up saves from the ${source} page`);
    }
    same((await post(B, '/api/waitlist', { phone: '9811100004', source: 'estimate', consent: true, trip })).status, 200, 'an estimate signup carries its trip and fare');
    const bad = await post(B, '/api/waitlist', { phone: '98708 7132', source: 'contact' });
    check(bad.status === 400 && json(bad)?.errors?.phone === PHONE_ERROR, `a number a digit short is refused with the field message (${bad.status})`);
    same((await post(B, '/api/waitlist', { phone: '9870871324', source: 'homepage' })).status, 400, 'an unknown source is refused');
    same((await post(B, '/api/waitlist', { phone: '9000000009', source: 'contact', website: 'http://spam.example' })).status, 200, 'a filled honeypot gets a quiet 200…');

    // 👍/👎 on fares: one row per fare, phone blank unless that visitor joins from it.
    const est1 = 'est_test000000000001', est2 = 'est_test000000000002', est3 = 'est_test000000000003';
    same((await post(B, '/api/feedback', { estimate_id: est1, vote: 'up', trip: oneWay })).status, 200, 'a 👍 is saved, without a phone');
    const linkOnly = await post(B, '/api/feedback', { estimate_id: est1, vote: 'down', comment: 'https://cheaper.example/x' });
    check(linkOnly.status === 400 && json(linkOnly)?.errors?.comment === LINK_ONLY_ERROR, `a comment that is only a link is refused (${linkOnly.status})`);
    same((await post(B, '/api/feedback', { estimate_id: est1, vote: 'down', comment: 'Too high for a one-way trip', trip: oneWay })).status, 200, 'the vote changes to 👎, with a comment');
    same((await post(B, '/api/feedback', { estimate_id: est1, vote: 'up', trip: oneWay })).status, 200, '…and back to 👍; the comment stays');
    same((await post(B, '/api/waitlist', { phone: '9811100005', source: 'estimate', consent: true, estimate_id: est1, trip: oneWay })).status, 200, 'the voter joins from the same fare: their row gets the number');
    same((await post(B, '/api/waitlist', { phone: '9811100006', source: 'estimate', consent: true, estimate_id: est2, trip })).status, 200, 'another joins first…');
    same((await post(B, '/api/feedback', { estimate_id: est2, vote: 'down', comment: 'Expected under 5,000', trip })).status, 200, '…then votes 👎 with a comment on the same fare');
    same((await post(B, '/api/feedback', { estimate_id: est3, vote: 'down', trip })).status, 200, 'a 👎 from someone who never joins');
    same((await post(B, '/api/feedback', { estimate_id: 'est_x', vote: 'up' })).status, 400, 'a malformed estimate id is refused');
    same((await post(B, '/api/feedback', { estimate_id: est3, vote: 'meh' })).status, 400, 'a vote other than up or down is refused');

    // Requests a browser on our own pages would never send.
    same((await post(B, '/api/waitlist', { phone: '9870871324', source: 'contact' }, { Origin: 'https://evil.example' })).status, 403, 'another site\'s page is refused');
    same((await raw(B, { method: 'POST', path: '/api/waitlist', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403, 'no Origin is refused');
    same((await post(B, '/api/waitlist', 'phone=9870871324', { 'Content-Type': 'application/x-www-form-urlencoded' })).status, 415, 'a non-JSON body is refused');
    same((await post(B, '/api/waitlist', '{"phone":')).status, 400, 'broken JSON is refused');
    same((await post(B, '/api/waitlist', '[]')).status, 400, 'a JSON array is refused');
    same((await post(B, '/api/waitlist', { phone: '9870871324', source: 'contact', pad: 'x'.repeat(5000) })).status, 413, 'an oversized body is refused');
    same((await raw(B, { path: '/api/waitlist' })).status, 405, 'GET is not allowed');
    same((await post(B, '/api/nothing', {})).status, 404, 'unknown API paths are 404');

    // Buddy applications: individual Buddies and driver agencies, from a network of
    // their own so the waitlist posts above don't use up its hourly allowance.
    const apply = (body) => post(B, '/api/buddy', body, { 'CF-Connecting-IP': '198.51.100.20' });
    const empty = await apply({ type: 'individual', name: ' ', phone: '', licence: '', city: '' });
    check(empty.status === 400 && Object.keys(json(empty)?.errors || {}).join() === 'name,phone,licence,city', `an empty application reports all four fields (${empty.status})`);
    same((await apply({ type: 'individual', name: 'Voiku Zavadschi', phone: '+919870871324', licence: 'VNS8893', city: 'Mohali' })).status, 200, 'an application is saved, with the city');
    same((await apply({ name: '=HYPERLINK("http://x","click")', phone: '98708 71324', licence: 'PB01 2011, 0012345' })).status, 200, 'an application from a page cached before the city field is still saved');
    const agencyEmpty = await apply({ type: 'agency', agency: '', contact: '', phone: '', city: '' });
    check(agencyEmpty.status === 400 && Object.keys(json(agencyEmpty)?.errors || {}).join() === 'agency,contact,phone,city', `an empty agency application reports its four fields (${agencyEmpty.status})`);
    const agencyBad = await apply({ type: 'agency', agency: 'Tricity Drivers', contact: 'Gurpreet Kaur', phone: '9811122233', city: 'Panchkula', email: 'ops@', gstin: '03ABCDE1234F1Z' });
    check(agencyBad.status === 400 && json(agencyBad)?.errors?.email === EMAIL_ERROR && json(agencyBad)?.errors?.gstin === GSTIN_ERROR, `a mistyped email or GSTIN is refused, optional as they are (${agencyBad.status})`);
    same((await apply({ type: 'agency', agency: 'Tricity Drivers', contact: 'Gurpreet Kaur', phone: '9811122233', city: 'Panchkula', drivers: '6–20', email: 'Ops@TricityDrivers.in', gstin: '03abcde1234f1z5' })).status, 200, 'an agency application is saved');
    same((await apply({ type: 'agency', agency: 'Solo Cabs', contact: 'Aman', phone: '9811122233', city: 'Zirakpur', drivers: 'lots' })).status, 200, 'an agency with no optional fields (an unknown driver count is left out)');

    // The downloads.
    const clients = await admin(B, '/admin/clients.csv');
    same(clients.status, 200, 'clients.csv downloads with the password');
    check(/attachment; filename="ridebuddy-clients-\d{4}-\d{2}-\d{2}\.csv"/.test(clients.headers['content-disposition'] || ''), 'as a dated attachment');
    check(clients.text.startsWith('\uFEFF'), 'with a byte-order mark for Excel');
    const c = csvRows(clients.text);
    const after = (row) => row.replace(/^\d+,\d{4}-\d{2}-\d{2} \d{2}:\d{2},/, '');
    same(c[0], 'ID,Submitted (IST),Phone,Source,Trip,Fare (₹),👍/👎,Comment,Consent,Phone verified,Repeat', 'clients header');
    same(c.length, 11, 'nine signups and one vote from someone who never joined; the honeypot one is not listed');
    check(/^1,\d{4}-\d{2}-\d{2} \d{2}:\d{2},\+919870871324,Contact page,,,,,,,$/.test(c[1]), `first signup, normalised and timestamped in IST (${c[1]})`);
    check(c[2].endsWith(',+919870871324,Contact page,,,,,,,(repeat)') && c[3].endsWith('(repeat)'), 'the same number in other formats is marked (repeat)');
    same([c[4], c[5], c[6]].map(after).join(' | '), '+919811100001,Home page,,,,,Yes,, | +919811100002,How It Works page,,,,,Yes,, | +919811100003,About page,,,,,Yes,,',
      'pop-up signups: the page they joined from, and the consent (a page cached with How It Works still saves)');
    same(after(c[7]), '+919811100004,Estimate page,"Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00",5492,,,Yes,,', 'the estimate signup: trip and fare in their own columns');
    same(after(c[8]), '+919811100005,Estimate page,"One way · Sector 17 → Shimla · 12 Oct, 20:30",1860,👍,Too high for a one-way trip,Yes,,', 'vote first, then joined: one row, latest vote, the comment kept');
    same(after(c[9]), '+919811100006,Estimate page,"Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00",5492,👎,"Expected under 5,000",Yes,,', 'joined first, then voted: the same row');
    same(after(c[10]), ',Estimate page,"Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00",5492,👎,,,,', 'a vote from someone who never joined: no phone, never a repeat');

    const buddies = await admin(B, '/admin/buddies.csv', { user: 'Admin' });
    same(buddies.status, 200, 'buddies.csv downloads (username in any case)');
    const b = csvRows(buddies.text);
    same(b[0], 'ID,Submitted (IST),Name,Phone,Licence,City or base,Phone verified,Repeat', 'buddies header');
    check(b[1].endsWith(',Voiku Zavadschi,+919870871324,VNS8893,Mohali,,'), `an application row (${b[1]})`);
    check(b[2].endsWith(`,"'=HYPERLINK(""http://x"",""click"")",+919870871324,"PB01 2011, 0012345",,,(repeat)`), 'a formula-like name opens as text; a licence with a comma stays one cell; same phone is a repeat');

    const agencies = await admin(B, '/admin/agencies.csv');
    same(agencies.status, 200, 'agencies.csv downloads');
    const a = csvRows(agencies.text);
    same(a[0], 'ID,Submitted (IST),Agency name,Contact person,Phone,City or base,Drivers,Work email,GSTIN,Phone verified,Repeat', 'agencies header');
    same(a.slice(1).map(after).join(' | '), 'Tricity Drivers,Gurpreet Kaur,+919811122233,Panchkula,6–20,ops@tricitydrivers.in,03ABCDE1234F1Z5,, | Solo Cabs,Aman,+919811122233,Zirakpur,,,,,(repeat)',
      'agency rows: email lower-cased, GSTIN upper-cased, optional fields blank, a repeat number marked');

    const dash = await admin(B, '/admin');
    const dv = visible(dash.text);
    check(dash.status === 200 && /Client waitlist 9 entries · 7 different numbers/.test(dv) && /Buddy applications 2 entries · 1 number\b/.test(dv)
      && /Driver agencies 2 entries · 1 number\b/.test(dv), `the admin page counts entries and numbers; votes without a phone are not signups (${dv.match(/Client waitlist[^.]*?numbers?/)?.[0]})`);
    check(/👍 The fare works 1 👎 It doesn’t 2/.test(dv), 'the dashboard counts the latest vote on each fare');
    check(/One-time codes: no 2Factor key ?, so no phone form can save\. Add TWOFACTOR_API_KEY as a Secret/.test(dv), 'the admin page says when the 2Factor key is missing');
    check(dash.headers['cache-control'] === 'no-store' && /noindex/.test(dash.headers['x-robots-tag'] || ''), 'admin responses are never cached or indexed');

    // Getting in.
    const none = await raw(B, { path: '/admin' });
    check(none.status === 401 && /^Basic /.test(none.headers['www-authenticate'] || ''), `no credentials: asked for them (${none.status})`);
    same((await admin(B, '/admin', { pass: 'wrong' })).status, 401, 'a wrong password is refused');
    same((await admin(B, '/admin', { user: 'root' })).status, 401, 'a wrong username is refused');
    const tries = [];
    for (let i = 0; i < 10; i += 1) tries.push((await admin(B, '/admin', { pass: 'guess', ip: '203.0.113.9' })).status);
    same(tries.join(' '), Array(10).fill(401).join(' '), 'ten wrong passwords from one network…');
    same((await admin(B, '/admin', { ip: '203.0.113.9' })).status, 429, '…lock that network out for an hour, right password or not');
    same((await admin(B, '/admin', { ip: '203.0.113.10' })).status, 200, 'other networks are unaffected');
    const insecure = await raw(B, { path: '/admin', headers: { Host: 'www.ridebuddy.co.in' } });
    // wrangler dev rewrites the Location host back to its own http origin; on Cloudflare it is https://www.ridebuddy.co.in/admin.
    check(insecure.status === 301 && /\/admin$/.test(insecure.headers.location || ''), `plain-HTTP admin redirects to HTTPS (${insecure.status})`);

    // The flood cap: 20 per network per hour, both forms together.
    const flood = [];
    for (let i = 0; i < 21; i += 1) flood.push((await post(B, '/api/waitlist', { phone: '9000000001', source: 'contact' }, { 'CF-Connecting-IP': '198.51.100.7' })).status);
    same(flood.slice(0, 20).every((s) => s === 200) && flood[20], 429, 'the 21st submission in an hour from one network is refused');
    same((await post(B, '/api/buddy', { name: 'A B', phone: '9000000002', licence: 'X1' }, { 'CF-Connecting-IP': '198.51.100.7' })).status, 429, 'the cap covers both forms');
    same((await post(B, '/api/waitlist', { phone: '9000000003', source: 'contact' }, { 'CF-Connecting-IP': '198.51.100.8' })).status, 200, 'another network can still sign up');
  } finally {
    await dev.stop();
  }
}

async function analytics() {
  console.log('\nanalytics (test clock)');
  const dev = await startDev({ port: 8789, password: PASSWORD, vars: { RB_TEST: '1' } });
  const B = dev.base;
  const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
  const YESTERDAY = '2026-09-25T10:00:00+05:30';
  const TODAY = '2026-09-26T11:00:00+05:30';
  const beacon = (events, { ip = '49.36.9.9', now = TODAY, ua = UA, headers = {} } = {}) => raw(B, {
    method: 'POST', path: '/api/e', body: typeof events === 'string' ? events : JSON.stringify({ e: events }),
    headers: { 'Content-Type': 'text/plain;charset=UTF-8', Origin: B, 'User-Agent': ua, 'CF-Connecting-IP': ip, 'X-RB-Now': now, ...headers },
  });
  // Every request here carries the test clock. One on the real clock would sum
  // TODAY as a finished day once the real date has moved past it.
  const at = (now) => ({ headers: { 'X-RB-Now': now } });
  try {
    // Yesterday: A lands from Google and joins the waitlist under a fare.
    same((await beacon([
      { n: 'pageview', p: '/estimate/', f: 1, r: 'www.google.co.in' }, { n: 'estimate_started', p: '/estimate/' },
      { n: 'estimate_completed', p: '/estimate/', d: { trip: 'one', pickup_area: 'Sector 17', pickup_city: 'Chandigarh', dest_city: 'Shimla', km: 114, fare: 1611, ahead: 1, weekday: 6, hour: 9 } },
      { n: 'waitlist_joined', p: '/estimate/', d: { source: 'estimate' } },
    ], { ip: '49.36.1.1', now: YESTERDAY })).status, 204, 'a beacon is taken, answered with 204');
    // Today: B by a tagged WhatsApp link, mistypes a number on Contact, then joins.
    await beacon([
      { n: 'pageview', p: '/beta/', f: 1, u: { source: 'whatsapp', medium: 'group', campaign: 'launch' } }, { n: 'pageview', p: '/beta/#contact' },
      { n: 'phone_invalid', p: '/beta/#contact', d: { form: 'contact' } }, { n: 'waitlist_joined', p: '/beta/#contact', d: { source: 'contact' } },
      { n: 'click', p: '/beta/#contact', w: 'header', l: '<script>alert(1)</script>' }, { n: 'perf', p: '/beta/', d: { lcp: 1800, net: '4g' } },
    ], { ip: '49.36.2.2' });
    // C: a browser that sends neither Origin nor Sec-Fetch-Site is still taken.
    same((await raw(B, { method: 'POST', path: '/api/e', body: JSON.stringify({ e: [{ n: 'pageview', p: '/', f: 1 }] }), headers: { 'User-Agent': UA, 'CF-Connecting-IP': '49.36.3.3', 'X-RB-Now': TODAY } })).status, 204, 'a beacon without Origin is taken');
    // Not visitors, or not ours.
    await beacon([{ n: 'pageview', p: '/', f: 1 }], { ip: '49.36.4.4', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
    await beacon([{ n: 'pageview', p: '/', f: 1 }], { ip: '49.36.5.5', headers: { Cookie: 'theme=x; rb_exclude=1' } });
    same((await beacon([{ n: 'pageview', p: '/', f: 1 }], { ip: '49.36.6.6', headers: { Origin: 'https://evil.example' } })).status, 403, 'another site\'s page cannot post');
    same((await raw(B, { method: 'POST', path: '/api/e', body: '{"e":[]}', headers: { 'Sec-Fetch-Site': 'cross-site', 'User-Agent': UA } })).status, 403, 'a cross-site beacon without Origin is refused');
    same((await beacon('{"e":[')).status, 400, 'broken JSON is refused');
    same((await beacon(JSON.stringify({ e: [{ n: 'click', p: '/', l: 'x'.repeat(20000) }] }))).status, 413, 'an oversized beacon is refused');
    same((await raw(B, { path: '/api/e' })).status, 405, 'GET is not allowed');

    const week = await admin(B, '/admin?days=7', at(TODAY));
    same(week.status, 200, 'the dashboard opens');
    const w = visible(week.text);
    check(/Visitors 3 ▲ new/.test(w) && /Page views 4 /.test(w) && /Fares shown 1 /.test(w),
      `7 days: yesterday (summed) and today (live) together; crawler, excluded browser and others' pages not counted (${w.match(/Visitors [^A-Z]*/)?.[0]})`);
    check(/Opened the estimate page 1 Started filling it in 100% of the step before 1 Saw a fare 100% of the step before 1 Joined the waitlist there 100% of the step before 1 /.test(w), 'the estimator funnel');
    check(/Google 1/.test(w) && /WhatsApp 1/.test(w) && /Direct or an app 1/.test(w) && /whatsapp \/ group \/ launch 1/.test(w), 'sources and the campaign');
    check(/Shimla 1/.test(w) && /Sector 17, Chandigarh 1/.test(w) && /Average fare shown: ₹1,611/.test(w), 'what was priced');
    check(/Mistyped phone number \(Contact page\) 1/.test(w) && /Holding page \(\/\) 1/.test(w) && /Contact 1/.test(w), 'problems and pages');
    check(!week.text.includes('<script>alert') && week.text.includes('&#60;script&#62;alert(1)&#60;/script&#62;'), 'a label sent in a beacon is shown escaped, never run');
    check(/script-src 'nonce-[0-9a-f]{32}'/.test(week.headers['content-security-policy'] || '') && week.text.includes(`<script nonce="${(week.headers['content-security-policy'].match(/nonce-([0-9a-f]{32})/) || [])[1]}">`),
      'the page runs only its own script (CSP nonce)');

    const today = visible((await admin(B, '/admin?days=1', at(TODAY))).text);
    check(/Visitors 2 ▲ 100% vs yesterday/.test(today) && /Pick 7 days or more/.test(today), `Today: two visitors, compared with yesterday (${today.match(/Visitors [^A-Z]*/)?.[0]})`);

    const daily = await admin(B, '/admin/daily.csv', at(TODAY));
    same(csvRows(daily.text).join(' | '), 'Date,Visitors,Page views,Fares shown,Waitlist signups,Buddy applications,Agency applications | 2026-09-25,1,1,1,0,0,0 | 2026-09-26,2,3,0,0,0,0', 'the daily CSV: one row a day');

    const off = await admin(B, '/admin/exclude?on=1&days=7', at(TODAY));
    check(off.status === 303 && off.headers.location === '/admin?days=7#counting'
      && /^rb_exclude=1; Path=\/; Max-Age=157680000; HttpOnly; SameSite=Lax$/.test(off.headers['set-cookie']?.[0] || ''),
      `"Don't count this browser" sets a long-lived cookie (${off.headers['set-cookie']?.[0]})`);
    check(visible((await admin(B, '/admin', { headers: { Cookie: 'rb_exclude=1', 'X-RB-Now': TODAY } })).text).includes('This browser is not counted'), '…and the dashboard says so');
    check(/Max-Age=0/.test((await admin(B, '/admin/exclude?on=0', at(TODAY))).headers['set-cookie']?.[0] || ''), '"Count it again" clears it');

    const made = await admin(B, `/admin?days=7&lm_page=${encodeURIComponent('/beta/#apply')}&lm_source=WhatsApp+Group&lm_medium=status&lm_campaign=Drivers+Oct!`, at(TODAY));
    const want = `${B}/beta/?utm_source=whatsapp-group&utm_medium=status&utm_campaign=drivers-oct#apply`;
    check(made.text.includes(`value="${want.replaceAll('&', '&#38;')}"`), `the campaign link maker: ${want}`);

    // Totals outlive the detail: a day from 400 days ago is summed, then its beacons go.
    await beacon([{ n: 'pageview', p: '/', f: 1 }], { ip: '49.36.7.7', now: '2025-08-22T10:00:00+05:30' });
    await admin(B, '/admin?days=7', at(TODAY));
    check(csvRows((await admin(B, '/admin/daily.csv', at(TODAY))).text).includes('2025-08-22,1,1,0,0,0,0'), 'a day past 13 months keeps its daily totals');

    // A backlog of twelve unsummed days: summed newest first, eight per request,
    // with a notice until they're all in.
    for (let i = 3; i <= 14; i += 1) {
      await beacon([{ n: 'pageview', p: '/', f: 1 }], { ip: `49.36.8.${i}`, now: new Date(Date.parse(TODAY) - i * 86400000).toISOString() });
    }
    const first = visible((await admin(B, '/admin?days=30', at(TODAY))).text);
    check(/Still adding up 4 earlier days in this period/.test(first), `a backlog is summed in steps, and says so (${first.match(/Still adding up[^.]*/)?.[0] || 'no notice'})`);
    const second = visible((await admin(B, '/admin?days=30', at(TODAY))).text);
    check(!/Still adding up/.test(second) && /Visitors 15 /.test(second), `…and the next load completes it (${second.match(/Visitors [^A-Z]*/)?.[0]})`);
  } finally {
    await dev.stop();
  }
}

/** A database created before the vote, consent, city and agency columns: brought up to date in place. */
async function migration() {
  console.log('\nan older database');
  const seed = [
    'CREATE TABLE waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, phone TEXT NOT NULL, source TEXT NOT NULL, trip TEXT)',
    'CREATE TABLE buddies (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, licence TEXT NOT NULL)',
    "INSERT INTO waitlist (created_at, phone, source, trip) VALUES ('2026-10-01T05:00:00.000Z', '+919870871324', 'estimate', 'Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00 · ₹5,492')",
    "INSERT INTO waitlist (created_at, phone, source, trip) VALUES ('2026-10-01T06:00:00.000Z', '+447911123456', 'contact', NULL)",
    "INSERT INTO buddies (created_at, name, phone, licence) VALUES ('2026-10-01T07:00:00.000Z', 'Old Applicant', '+919000000001', 'PB01 1')",
  ].join('; ');
  const dev = await startDev({ port: 8786, password: PASSWORD, seed, vars: { RB_TEST: '1', OTP_OFF: '1' } });
  const B = dev.base;
  try {
    same((await post(B, '/api/feedback', { estimate_id: 'est_migration00000001', vote: 'down', comment: 'Fine otherwise', trip: { type: 'one', from: 'Mohali', to: 'Kasauli', date: '2026-10-20', time: '08:00', fare: 1650 } })).status, 200, 'a vote is saved into the older waitlist table');
    same((await post(B, '/api/buddy', { type: 'individual', name: 'New Applicant', phone: '9000000002', licence: 'PB01 2', city: 'Kharar' })).status, 200, 'an application with a city, into the older buddies table');
    same((await post(B, '/api/buddy', { type: 'agency', agency: 'Hill Drivers', contact: 'Ravi', phone: '9000000003', city: 'Mohali' })).status, 200, 'and an agency, into a table that did not exist');
    const c = csvRows((await admin(B, '/admin/clients.csv')).text).map((r) => r.replace(/^(\d+),[^,]+,/, '$1,'));
    same(c.slice(1).join(' | '), '1,+919870871324,Estimate page,"Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00",5492,,,,, | 2,+447911123456,Contact page,,,,,,, | 3,,Estimate page,"One way · Mohali → Kasauli · 20 Oct, 08:00",1650,👎,Fine otherwise,,,',
      'old rows keep their data, the old fare is split into its column, new rows have every column');
    const b = csvRows((await admin(B, '/admin/buddies.csv')).text).map((r) => r.replace(/^(\d+),[^,]+,/, '$1,'));
    same(b.slice(1).join(' | '), '1,Old Applicant,+919000000001,PB01 1,,, | 2,New Applicant,+919000000002,PB01 2,Kharar,,', 'the buddies table gains the city and phone-verified columns');
    same(csvRows((await admin(B, '/admin/agencies.csv')).text).length, 2, 'the agencies list exists and has the new application');
  } finally {
    await dev.stop();
  }
}

/** One-time codes on (otp.js), 2Factor played by test/twofactor-stub.mjs: nothing saves without the code sent to the number. */
async function otp() {
  console.log('\none-time codes');
  const stub = await startTwoFactorStub(8784);
  const dev = await startDev({
    port: 8785, password: PASSWORD,
    vars: { RB_TEST: '1', TWOFACTOR_API_KEY: 'test-key-0001', TWOFACTOR_TEMPLATE: 'RideBuddy OTP', TWOFACTOR_API_BASE: stub.url, OTP_DAILY_CAP: '30' },
  });
  const B = dev.base;
  const ip = (n) => ({ 'CF-Connecting-IP': `198.51.100.${n}` });
  const later = (sec, n) => ({ ...ip(n), 'X-RB-Now': new Date(Date.now() + sec * 1000).toISOString() });
  try {
    const join = { phone: '98111 00101', source: 'home', consent: true };
    const first = await post(B, '/api/waitlist', join, ip(1));
    same(first.status, 202, 'a signup first gets a code');
    same(JSON.stringify(['otp', 'sentTo', 'resendIn', 'expiresIn'].map((k) => json(first)?.[k])), '["sent","+91 XXXXX XX101",30,300]', '…and is told where it went, masked');
    const sms = stub.messages.at(-1);
    same(JSON.stringify([sms.method, sms.key, sms.phone, sms.template]), JSON.stringify(['GET', 'test-key-0001', '9811100101', 'RideBuddy OTP']),
      'the code goes to 2Factor with the API key, the 10-digit number and the named template');
    check(/^\d{6}$/.test(sms.code), `…and a 6-digit code made by the Worker (${sms.code})`);
    same(csvRows((await admin(B, '/admin/clients.csv')).text).length, 1, 'nothing is on the list before the code');
    check(/One-time codes: on ?\. Every phone form saves only after the code/.test(visible((await admin(B, '/admin')).text)), 'the admin page says the codes are on');

    const code = stub.codeFor('+919811100101');
    const wrong = code === '000000' ? '000001' : '000000';
    const w1 = await post(B, '/api/waitlist', { ...join, code: wrong }, ip(1));
    check(w1.status === 400 && json(w1)?.errors?.code === CODE_WRONG && json(w1)?.reason === 'wrong', `a wrong code is refused (${w1.status})`);
    await post(B, '/api/waitlist', { ...join, code: wrong }, ip(1));
    same(json(await post(B, '/api/waitlist', { ...join, code: wrong }, ip(1)))?.errors?.code, CODE_TOO_MANY, 'three wrong tries use the code up…');
    same(json(await post(B, '/api/waitlist', { ...join, code }, ip(1)))?.errors?.code, CODE_TOO_MANY, '…so even the right one no longer works');
    const soon = await post(B, '/api/waitlist', join, ip(1));
    check(soon.status === 429 && json(soon)?.reason === 'resend_wait' && /^Wait \d+ seconds, then ask for a new code\.$/.test(json(soon)?.error || ''),
      `a new code within 30 seconds is refused ("${json(soon)?.error}")`);
    same((await post(B, '/api/waitlist', join, later(31, 1))).status, 202, 'after 30 seconds, a new code');
    const code2 = stub.codeFor('+919811100101');
    same((await post(B, '/api/waitlist', { ...join, code: code2 }, later(40, 1))).status, 200, 'the right code saves the signup');
    same(json(await post(B, '/api/waitlist', { ...join, code: code2 }, later(45, 1)))?.errors?.code, CODE_EXPIRED, 'a code works once');

    const about = { phone: '9811100102', source: 'about', consent: true };
    await post(B, '/api/waitlist', about, ip(2));
    same(json(await post(B, '/api/waitlist', { ...about, code: stub.codeFor('+919811100102') }, later(301, 2)))?.errors?.code, CODE_EXPIRED, 'a code past 5 minutes has expired');

    const busy = { phone: '9811100103', source: 'home', consent: true };
    const sends = [];
    for (const sec of [0, 31, 62, 93]) sends.push(await post(B, '/api/waitlist', busy, later(sec, 3)));
    check(sends.slice(0, 3).every((r) => r.status === 202) && sends[3].status === 429 && json(sends[3])?.error === CODE_NUMBER_LIMIT,
      `three codes to a number an hour, then "${json(sends[3])?.error}"`);

    stub.failNext = 1;
    const refused = await post(B, '/api/waitlist', { phone: '9811100104', source: 'home', consent: true }, ip(4));
    check(refused.status === 502 && json(refused)?.error === CODE_SEND_FAILED && json(refused)?.reason === 'send_failed', `2Factor refusing the SMS (Status "Error", on HTTP 200) is reported (${refused.status})`);
    same((await post(B, '/api/waitlist', { phone: '9811100104', source: 'home', consent: true }, ip(4))).status, 202, '…and the visitor can ask again at once');

    const net = [];
    for (let i = 0; i < 11; i += 1) net.push(await post(B, '/api/waitlist', { phone: `98112002${String(i).padStart(2, '0')}`, source: 'home', consent: true }, ip(5)));
    check(net.slice(0, 10).every((r) => r.status === 202) && net[10].status === 429 && json(net[10])?.error === CODE_NETWORK_LIMIT,
      `ten codes from one network an hour, then "${json(net[10])?.error}"`);

    const quiet = stub.messages.length;
    same(json(await post(B, '/api/waitlist', { phone: '9811100106', source: 'home', consent: false }, ip(6)))?.errors?.consent, CONSENT_ERROR, 'a form that doesn\'t pass is refused before any code…');
    same((await post(B, '/api/waitlist', { phone: '9811100106', source: 'home', consent: true, website: 'http://spam.example' }, ip(6))).status, 200, '…and a filled honeypot gets its quiet 200…');
    same(stub.messages.length, quiet, '…neither sends an SMS');

    const individual = { type: 'individual', name: 'Harpreet Singh', phone: '9811100107', licence: 'PB01 20110012345', city: 'Mohali' };
    same((await post(B, '/api/buddy', individual, ip(7))).status, 202, 'a Buddy application gets a code…');
    same((await post(B, '/api/buddy', { ...individual, code: stub.codeFor('+919811100107') }, ip(7))).status, 200, '…and saves with it');
    const agency = { type: 'agency', agency: 'Hill Drivers', contact: 'Ravi', phone: '9811100108', city: 'Mohali' };
    same((await post(B, '/api/buddy', agency, ip(8))).status, 202, 'so does an agency application…');
    same((await post(B, '/api/buddy', { ...agency, code: stub.codeFor('+919811100108') }, ip(8))).status, 200, '…saved with its code');

    const trip = { type: 'one', from: 'Sector 17', to: 'Shimla', date: '2026-10-12', time: '09:00', fare: 1612 };
    same((await post(B, '/api/feedback', { estimate_id: 'est_otp0000000000001', vote: 'down', trip }, ip(9))).status, 200, 'a vote needs no code');
    const signup = { phone: '9811100109', source: 'estimate', consent: true, estimate_id: 'est_otp0000000000001', trip };
    same((await post(B, '/api/waitlist', signup, ip(9))).status, 202, 'joining under that fare gets a code…');
    same((await post(B, '/api/waitlist', { ...signup, code: stub.codeFor('+919811100109') }, ip(9))).status, 200, '…and lands on the vote\'s row');

    const after = (row) => row.replace(/^\d+,\d{4}-\d{2}-\d{2} \d{2}:\d{2},/, '');
    same(csvRows((await admin(B, '/admin/clients.csv')).text).slice(1).map(after).join(' | '),
      '+919811100101,Home page,,,,,Yes,Yes, | +919811100109,Estimate page,"One way · Sector 17 → Shimla · 12 Oct, 09:00",1612,👎,,Yes,Yes,',
      'the list: only numbers proven with a code, marked Phone verified');
    same(csvRows((await admin(B, '/admin/buddies.csv')).text).slice(1).map(after).join(), 'Harpreet Singh,+919811100107,PB01 20110012345,Mohali,Yes,', 'buddies.csv: Phone verified');
    same(csvRows((await admin(B, '/admin/agencies.csv')).text).slice(1).map(after).join(), 'Hill Drivers,Ravi,+919811100108,Mohali,,,,Yes,', 'agencies.csv: Phone verified');

    // The daily cap (OTP_DAILY_CAP, 30 here): past it, no more SMS today.
    let capped = null;
    for (let i = 0; i < 40 && !capped; i += 1) {
      const r = await post(B, '/api/waitlist', { phone: `98113003${String(i).padStart(2, '0')}`, source: 'home', consent: true }, ip(20 + i));
      if (r.status === 503) capped = r;
    }
    check(!!capped && json(capped)?.reason === 'daily_cap' && json(capped)?.error === CODE_SEND_FAILED && stub.messages.length === 30,
      `the site-wide daily cap stops the SMS at 30 (${stub.messages.length} sent)`);
  } finally {
    await dev.stop();
    await stub.close();
  }
}

async function main() {
  units();
  analyticsUnits();
  await locked();
  await endpoints();
  await migration();
  await otp();
  await analytics();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
