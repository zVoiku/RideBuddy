/**
 * /admin: the two lists as CSV downloads and the site's analytics, behind HTTP
 * Basic auth — username "admin", password the ADMIN_PASSWORD secret.
 *
 *   GET /admin?days=1|7|30|90   dashboard (default 30 days)
 *   GET /admin/clients.csv      client waitlist
 *   GET /admin/buddies.csv      Buddy applications
 *   GET /admin/daily.csv        one row a day: visitors, page views, fares, signups
 *   GET /admin/exclude?on=1|0   stop / resume counting this browser
 */
import { clock, dailyHistory, headlineFor, statsFor } from './analytics.js';
import { LINK_PAGES, renderDashboard, shell } from './dashboard.js';
import { addHit, countHits, networkHash, ready, sha256Hex } from './db.js';
import { SOURCES } from './forms.js';
import { ADMIN_HEADERS, plain } from './http.js';
import { istDay, istStamp, shiftDay, toCsv } from './lib.js';

const ADMIN_FAILURE_CAP = 10;
const RANGES = [1, 7, 30, 90];

export async function handleAdmin(request, env, url, path) {
  // Basic auth sends the password with every request: never over plain HTTP.
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    return Response.redirect(`https://${url.host}${url.pathname}${url.search}`, 301);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return plain(405, 'Method not allowed.', { Allow: 'GET' });
  // No password set means locked, never open: these lists hold phone and licence numbers.
  if (!env.ADMIN_PASSWORD) return htmlPage(503, LOCKED);

  const db = env.DB;
  const salt = await ready(db);
  const bucket = `admin:${await networkHash(request, salt)}`;
  if (await countHits(db, bucket) >= ADMIN_FAILURE_CAP) return plain(429, 'Too many wrong passwords. Try again in an hour.');
  if (!(await authorized(request, env.ADMIN_PASSWORD))) {
    await addHit(db, bucket);
    return new Response('Password required.', {
      status: 401,
      headers: { ...ADMIN_HEADERS, 'WWW-Authenticate': 'Basic realm="RideBuddy admin", charset="UTF-8"' },
    });
  }

  if (path === '/admin') return htmlPage(200, await dashboard(request, env, url));
  if (path === '/admin/clients.csv') return download('clients', await clientsCsv(db));
  if (path === '/admin/buddies.csv') return download('buddies', await buddiesCsv(db));
  if (path === '/admin/daily.csv') return download('daily', await dailyCsv(request, env));
  if (path === '/admin/exclude') return exclude(url);
  return plain(404, 'Not found.');
}

/** Username "admin" (any case), password ADMIN_PASSWORD, compared in constant time. */
async function authorized(request, password) {
  const m = (request.headers.get('authorization') || '').match(/^Basic\s+([A-Za-z0-9+/=]+)\s*$/i);
  if (!m) return false;
  let decoded;
  try {
    decoded = new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)));
  } catch {
    return false;
  }
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  const [given, wanted] = await Promise.all([sha256Hex(decoded.slice(i + 1)), sha256Hex(password)]);
  let diff = 0;
  for (let k = 0; k < given.length; k += 1) diff |= given.charCodeAt(k) ^ wanted.charCodeAt(k);
  return diff === 0 && decoded.slice(0, i).trim().toLowerCase() === 'admin';
}

// ----- The dashboard -----------------------------------------------------------------------

const rangeOf = (url) => (RANGES.includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30);
const isExcluded = (request) => /(^|;\s*)rb_exclude=1(;|$)/.test(request.headers.get('cookie') || '');

async function dashboard(request, env, url) {
  const db = env.DB;
  const today = istDay(clock(request, env));
  const days = rangeOf(url);
  const from = shiftDay(today, 1 - days);
  const prevTo = shiftDay(from, -1);
  const prevFrom = shiftDay(prevTo, 1 - days);
  // statsFor first: it sums any finished days the other reads rely on.
  const stats = await statsFor(db, { from, to: today, today });
  const [lists, before, now, prev] = await Promise.all([
    listsSummary(db), headlineFor(db, { from: prevFrom, to: prevTo }), signupCounts(db, from, today), signupCounts(db, prevFrom, prevTo),
  ]);
  return renderDashboard({
    range: { days, from, to: today }, lists, stats, before, signups: { now, before: prev },
    excluded: isExcluded(request), link: campaignLink(url), stamp: istStamp,
  });
}

async function listsSummary(db) {
  const s = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM waitlist) AS clients,
      (SELECT COUNT(DISTINCT phone) FROM waitlist) AS client_phones,
      (SELECT MAX(created_at) FROM waitlist) AS client_last,
      (SELECT COUNT(*) FROM buddies) AS buddies,
      (SELECT COUNT(DISTINCT phone) FROM buddies) AS buddy_phones,
      (SELECT MAX(created_at) FROM buddies) AS buddy_last`).first();
  return {
    clients: s.clients, clientPhones: s.client_phones, clientLast: s.client_last,
    buddies: s.buddies, buddyPhones: s.buddy_phones, buddyLast: s.buddy_last,
  };
}

/** Midnight IST at the start of `day`, as the UTC timestamp the lists store. */
const istStart = (day) => new Date(Date.parse(`${day}T00:00:00+05:30`)).toISOString();

/** Waitlist signups and Buddy applications made on the IST days [from, to]. */
async function signupCounts(db, from, to) {
  const r = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM waitlist WHERE created_at >= ?1 AND created_at < ?2) AS waitlist,
      (SELECT COUNT(*) FROM buddies WHERE created_at >= ?1 AND created_at < ?2) AS buddies`)
    .bind(istStart(from), istStart(shiftDay(to, 1))).first();
  return { waitlist: r.waitlist, buddies: r.buddies };
}

const slug = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/** The campaign link the form below the dashboard asked for: utm_* before any #. */
function campaignLink(url) {
  const source = slug(url.searchParams.get('lm_source'));
  if (!source) return null;
  const page = LINK_PAGES.find(([p]) => p === url.searchParams.get('lm_page'))?.[0] || LINK_PAGES[0][0];
  const medium = slug(url.searchParams.get('lm_medium'));
  const campaign = slug(url.searchParams.get('lm_campaign'));
  const [path, hash] = page.split('#');
  const q = new URLSearchParams({ utm_source: source });
  if (medium) q.set('utm_medium', medium);
  if (campaign) q.set('utm_campaign', campaign);
  return { page, source, medium, campaign, url: `${url.origin}${path}?${q}${hash ? `#${hash}` : ''}` };
}

/**
 * Stop or resume counting this browser: a cookie on the admin's own browser,
 * for both ridebuddy.co.in and www, that /api/e drops beacons for. Visitors
 * never get it.
 */
function exclude(url) {
  const on = url.searchParams.get('on') === '1';
  const domain = /(^|\.)ridebuddy\.co\.in$/.test(url.hostname) ? '; Domain=ridebuddy.co.in' : '';
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  const cookie = `rb_exclude=${on ? '1' : ''}; Path=/; Max-Age=${on ? 5 * 365 * 86400 : 0}; HttpOnly; SameSite=Lax${secure}${domain}`;
  return new Response(null, {
    status: 303,
    headers: { ...ADMIN_HEADERS, 'Set-Cookie': cookie, Location: `/admin?days=${rangeOf(url)}#counting` },
  });
}

// ----- Downloads ---------------------------------------------------------------------------

const REPEAT = (table) => `EXISTS (SELECT 1 FROM ${table} p WHERE p.phone = t.phone AND p.id < t.id)`;

async function clientsCsv(db) {
  const { results } = await db.prepare(
    `SELECT id, created_at, phone, source, trip, ${REPEAT('waitlist')} AS is_repeat FROM waitlist t ORDER BY id`,
  ).all();
  return toCsv(
    ['ID', 'Submitted (IST)', 'Phone', 'Source', 'Trip', 'Repeat'],
    results.map((r) => [r.id, istStamp(r.created_at), r.phone, SOURCES[r.source] || r.source, r.trip || '', r.is_repeat ? '(repeat)' : '']),
  );
}

async function buddiesCsv(db) {
  const { results } = await db.prepare(
    `SELECT id, created_at, name, phone, licence, ${REPEAT('buddies')} AS is_repeat FROM buddies t ORDER BY id`,
  ).all();
  return toCsv(
    ['ID', 'Submitted (IST)', 'Name', 'Phone', 'Licence', 'Repeat'],
    results.map((r) => [r.id, istStamp(r.created_at), r.name, r.phone, r.licence, r.is_repeat ? '(repeat)' : '']),
  );
}

/** One row per IST day since the first: the analytics' daily totals plus the lists' signups. */
async function dailyCsv(request, env) {
  const db = env.DB;
  const today = istDay(clock(request, env));
  const live = (await statsFor(db, { from: today, to: today, today })).totals;
  const history = await dailyHistory(db);
  const liveGet = (metric, key = '') => live.get(`${metric}\u0000${key}`) || 0;
  if (liveGet('visitors')) history.set(today, { visitors: liveGet('visitors'), pageviews: liveGet('pageviews'), fares: liveGet('event', 'estimate_completed') });
  const perDay = (table) => db.prepare(`SELECT substr(datetime(created_at, '+330 minutes'), 1, 10) AS day, COUNT(*) AS n FROM ${table} GROUP BY day`);
  const [w, b] = (await db.batch([perDay('waitlist'), perDay('buddies')])).map((r) => new Map(r.results.map((x) => [x.day, x.n])));
  const days = [...new Set([...history.keys(), ...w.keys(), ...b.keys()])].sort();
  return toCsv(
    ['Date', 'Visitors', 'Page views', 'Fares shown', 'Waitlist signups', 'Buddy applications'],
    days.map((d) => {
      const x = history.get(d) || {};
      return [d, x.visitors || 0, x.pageviews || 0, x.fares || 0, w.get(d) || 0, b.get(d) || 0];
    }),
  );
}

function download(name, csv) {
  return new Response(csv, {
    headers: {
      ...ADMIN_HEADERS,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ridebuddy-${name}-${istDay()}.csv"`,
    },
  });
}

// ----- Pages -------------------------------------------------------------------------------

const LOCKED = `
  <section class="card">
    <h1>Admin is locked</h1>
    <p>Set a password to open it: Cloudflare → Workers &amp; Pages → <b>ridebuddy</b> → Settings → Variables and secrets →
    Add → type <b>Secret</b>, name <code>ADMIN_PASSWORD</code>. Then sign in here with username <b>admin</b>.</p>
    <p class="note">Waitlist signups, Buddy applications and visits are being saved in the meantime.</p>
  </section>`;

function htmlPage(status, body) {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  return new Response(shell(body, nonce), {
    status,
    headers: {
      ...ADMIN_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
    },
  });
}
