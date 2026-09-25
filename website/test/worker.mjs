/**
 * The site's Worker (website/worker): the pure helpers first, then every
 * endpoint end to end under `wrangler dev` — the real Workers runtime, serving
 * website/dist, with a throwaway local D1 per run.
 *
 *   npm run build && npm run test:worker
 */
import http from 'node:http';
import { startDev } from './dev-server.mjs';
import {
  PHONE_ERROR, cleanText, csvCell, describeTrip, groupINR, istStamp, networkOf, normalizePhone, toCsv,
} from '../worker/lib.js';

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
const admin = (base, p, { user = 'admin', pass = PASSWORD, ip } = {}) => raw(base, {
  path: p, headers: { Authorization: basic(user, pass), ...(ip ? { 'CF-Connecting-IP': ip } : {}) },
});
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

async function main() {
  units();
  await locked();
  await endpoints();
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
