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
  PHONE_ERROR, cleanText, csvCell, describeTrip, groupINR, istStamp, networkOf, normalizePhone, shiftDay, toCsv,
} from '../worker/lib.js';
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
    ['0172 270 0000', '+911722700000'], // a landline with its STD code
    ['+91 0172 2700000', '+911722700000'],
    ['+44 7911 123456', '+447911123456'],
    ['0044 7911 123456', '+447911123456'],
    ['+1 (415) 555-2671', '+14155552671'],
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

  same(describeTrip({ type: 'round', from: 'Sector 17', to: 'Shimla', date: '2026-10-12', ret: '2026-10-14', time: '09:00', fare: 5492 }),
    'Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00 · ₹5,492', 'trip: round');
  same(describeTrip({ type: 'round', from: 'Mohali', to: 'Manali', date: '2026-10-30', ret: '2026-11-01', time: '06:00', fare: 7012 }),
    'Round trip · Mohali → Manali · 30 Oct – 1 Nov, 06:00 · ₹7,012', 'trip: round across a month end');
  same(describeTrip({ type: 'one', from: 'Sector 17', to: 'Shimla', date: '2026-10-12', time: '20:30', fare: 1860 }),
    'One way · Sector 17 → Shimla · 12 Oct, 20:30 · ₹1,860', 'trip: one way');
  same(describeTrip({ type: 'hourly', from: 'Sector 17', to: '', date: '2026-10-12', time: '09:00', hours: 4, fare: 996 }),
    'Hourly · 4 h from Sector 17 · 12 Oct, 09:00 · ₹996', 'trip: hourly');
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
    const saved = await post(dev.base, '/api/waitlist', { phone: '9870871324', source: 'contact' });
    check(saved.status === 200, `signups are still saved meanwhile (${saved.status})`);
  } finally {
    await dev.stop();
  }
}

async function endpoints() {
  console.log('\nwith ADMIN_PASSWORD');
  const dev = await startDev({ port: 8787, password: PASSWORD });
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
    same((await post(B, '/api/waitlist', { phone: '+44 7911 123456', source: 'estimate', trip })).status, 200, 'waitlist accepts a foreign number, with the trip priced');
    const bad = await post(B, '/api/waitlist', { phone: '98708 7132', source: 'contact' });
    check(bad.status === 400 && json(bad)?.errors?.phone === PHONE_ERROR, `a number a digit short is refused with the field message (${bad.status})`);
    same((await post(B, '/api/waitlist', { phone: '9870871324', source: 'homepage' })).status, 400, 'an unknown source is refused');
    same((await post(B, '/api/waitlist', { phone: '9000000009', source: 'contact', website: 'http://spam.example' })).status, 200, 'a filled honeypot gets a quiet 200…');

    // Requests a browser on our own pages would never send.
    same((await post(B, '/api/waitlist', { phone: '9870871324', source: 'contact' }, { Origin: 'https://evil.example' })).status, 403, 'another site\'s page is refused');
    same((await raw(B, { method: 'POST', path: '/api/waitlist', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403, 'no Origin is refused');
    same((await post(B, '/api/waitlist', 'phone=9870871324', { 'Content-Type': 'application/x-www-form-urlencoded' })).status, 415, 'a non-JSON body is refused');
    same((await post(B, '/api/waitlist', '{"phone":')).status, 400, 'broken JSON is refused');
    same((await post(B, '/api/waitlist', '[]')).status, 400, 'a JSON array is refused');
    same((await post(B, '/api/waitlist', { phone: '9870871324', source: 'contact', pad: 'x'.repeat(5000) })).status, 413, 'an oversized body is refused');
    same((await raw(B, { path: '/api/waitlist' })).status, 405, 'GET is not allowed');
    same((await post(B, '/api/nothing', {})).status, 404, 'unknown API paths are 404');

    // Buddy applications.
    const empty = await post(B, '/api/buddy', { name: ' ', phone: '', licence: '' });
    check(empty.status === 400 && Object.keys(json(empty)?.errors || {}).join() === 'name,phone,licence', `an empty application reports all three fields (${empty.status})`);
    same((await post(B, '/api/buddy', { name: 'Voiku Zavadschi', phone: '+919870871324', licence: 'VNS8893' })).status, 200, 'an application is saved');
    same((await post(B, '/api/buddy', { name: '=HYPERLINK("http://x","click")', phone: '98708 71324', licence: 'PB01 2011, 0012345' })).status, 200, 'an application with awkward text is saved');

    // The downloads.
    const clients = await admin(B, '/admin/clients.csv');
    same(clients.status, 200, 'clients.csv downloads with the password');
    check(/attachment; filename="ridebuddy-clients-\d{4}-\d{2}-\d{2}\.csv"/.test(clients.headers['content-disposition'] || ''), 'as a dated attachment');
    check(clients.text.startsWith('\uFEFF'), 'with a byte-order mark for Excel');
    const c = csvRows(clients.text);
    same(c[0], 'ID,Submitted (IST),Phone,Source,Trip,Repeat', 'clients header');
    same(c.length, 5, 'four signups listed; the honeypot one is not');
    check(/^1,\d{4}-\d{2}-\d{2} \d{2}:\d{2},\+919870871324,Contact page,,$/.test(c[1]), `first signup, normalised and timestamped in IST (${c[1]})`);
    check(c[2].endsWith(',+919870871324,Contact page,,(repeat)') && c[3].endsWith('(repeat)'), 'the same number in other formats is marked (repeat)');
    same(c[4].split(',').slice(2).join(','), '+447911123456,Estimate page,"Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00 · ₹5,492",', 'the estimate signup carries its trip');

    const buddies = await admin(B, '/admin/buddies.csv', { user: 'Admin' });
    same(buddies.status, 200, 'buddies.csv downloads (username in any case)');
    const b = csvRows(buddies.text);
    same(b[0], 'ID,Submitted (IST),Name,Phone,Licence,Repeat', 'buddies header');
    check(b[1].endsWith(',Voiku Zavadschi,+919870871324,VNS8893,'), `an application row (${b[1]})`);
    check(b[2].endsWith(`,"'=HYPERLINK(""http://x"",""click"")",+919870871324,"PB01 2011, 0012345",(repeat)`), 'a formula-like name opens as text; a licence with a comma stays one cell; same phone is a repeat');

    const dash = await admin(B, '/admin');
    check(dash.status === 200 && /4 entries · 2 different numbers/.test(dash.text) && /2 entries · 1 number\b/.test(dash.text), 'the admin page counts entries and numbers');
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
    same(csvRows(daily.text).join(' | '), 'Date,Visitors,Page views,Fares shown,Waitlist signups,Buddy applications | 2026-09-25,1,1,1,0,0 | 2026-09-26,2,3,0,0,0', 'the daily CSV: one row a day');

    const off = await admin(B, '/admin/exclude?on=1&days=7');
    check(off.status === 303 && off.headers.location === '/admin?days=7#counting'
      && /^rb_exclude=1; Path=\/; Max-Age=157680000; HttpOnly; SameSite=Lax$/.test(off.headers['set-cookie']?.[0] || ''),
      `"Don't count this browser" sets a long-lived cookie (${off.headers['set-cookie']?.[0]})`);
    check(visible((await admin(B, '/admin', { headers: { Cookie: 'rb_exclude=1' } })).text).includes('This browser is not counted'), '…and the dashboard says so');
    check(/Max-Age=0/.test((await admin(B, '/admin/exclude?on=0')).headers['set-cookie']?.[0] || ''), '"Count it again" clears it');

    const made = await admin(B, `/admin?days=7&lm_page=${encodeURIComponent('/beta/#apply')}&lm_source=WhatsApp+Group&lm_medium=status&lm_campaign=Drivers+Oct!`);
    const want = `${B}/beta/?utm_source=whatsapp-group&utm_medium=status&utm_campaign=drivers-oct#apply`;
    check(made.text.includes(`value="${want.replaceAll('&', '&#38;')}"`), `the campaign link maker: ${want}`);

    // Totals outlive the detail: a day from 400 days ago is summed, then its beacons go.
    await beacon([{ n: 'pageview', p: '/', f: 1 }], { ip: '49.36.7.7', now: '2025-08-22T10:00:00+05:30' });
    await admin(B, '/admin?days=7', at(TODAY));
    check(csvRows((await admin(B, '/admin/daily.csv', at(TODAY))).text).includes('2025-08-22,1,1,0,0,0'), 'a day past 13 months keeps its daily totals');

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

async function main() {
  units();
  analyticsUnits();
  await locked();
  await endpoints();
  await analytics();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
