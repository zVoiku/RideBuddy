/**
 * The site's own analytics, server side. POST /api/e takes the beacons that
 * src/site.js sends; /admin reads the totals back (statsFor).
 *
 * Privacy: visitors get no cookies and no IP address is stored. A visitor is a
 * hash of the day's random salt, their network and their browser: it changes
 * every day, and once the day's salt is deleted it can't be recomputed.
 *
 * Storage: one D1 row per beacon (a batch of a page's events), kept 13 months.
 * Finished days are summed into daily_totals — kept for good — the first time
 * /admin is opened after them. D1 does the adding up (stats.js, DAY_SQL), so
 * the Worker's CPU stays small however busy a day was.
 */
import { ready, sha256Hex } from './db.js';
import { sameOrigin } from './http.js';
import { cleanText, istDay, networkOf, shiftDay } from './lib.js';
import { DAY_SQL, cleanEvents, deviceOf, isBot, summarize } from './stats.js';

const KEEP_DAYS = 396; // detailed beacons, ~13 months; daily totals stay for good
// D1's free plan allows 100,000 rows written a day, the forms' included. A
// beacon costs two (row + index), so analytics stops writing for the day at
// this many: a traffic spike or a flood can't leave the waitlist unable to save.
const DAILY_BEACON_CAP = 30000;
const PER_NETWORK = 200; // beacons per network per 10 minutes, per Worker instance
// Days summed per /admin request, newest first: two D1 calls each, and the
// free plan allows ~50 per request.
const ROLLUP_DAYS = 8;

const EMPTY = (status) => new Response(null, { status });

/** "Now". Tests (RB_TEST=1) may set it with an X-RB-Now header to post and read on chosen days. */
export function clock(request, env) {
  if (env.RB_TEST === '1') {
    const t = Date.parse(request.headers.get('x-rb-now') || '');
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

// ----- In: POST /api/e ------------------------------------------------------------------

const recent = new Map();

/** A crude per-instance flood limit; the daily cap is the real backstop. */
function allowed(net, now) {
  const w = Math.floor(now / 600000);
  const cur = recent.get(net);
  if (!cur || cur.w !== w) {
    if (recent.size > 10000) recent.clear();
    recent.set(net, { w, n: 1 });
    return true;
  }
  cur.n += 1;
  return cur.n <= PER_NETWORK;
}

export async function ingest(request, env, ctx) {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  // Only from our own pages. Some browsers leave Origin off a same-site
  // beacon; Sec-Fetch-Site then vouches for it.
  const fetchSite = request.headers.get('sec-fetch-site');
  if (request.headers.get('origin') ? !sameOrigin(request) : fetchSite && fetchSite !== 'same-origin') return EMPTY(403);
  if (Number(request.headers.get('content-length')) > 16384) return EMPTY(413);

  const ua = request.headers.get('user-agent') || '';
  // Crawlers, and browsers the admin marked "don't count" (a cookie only /admin sets).
  if (isBot(ua) || /(^|;\s*)rb_exclude=1(;|$)/.test(request.headers.get('cookie') || '')) return EMPTY(204);
  const now = clock(request, env);
  const net = networkOf(request.headers.get('cf-connecting-ip'));
  if (!allowed(net, now)) return EMPTY(204);

  const raw = await request.text();
  if (raw.length > 16384) return EMPTY(413);
  let events;
  try { events = cleanEvents(JSON.parse(raw)); } catch { return EMPTY(400); }
  if (!events.length) return EMPTY(204);

  const beacon = {
    day: istDay(now), at: Math.floor(now / 1000), net, ua, device: deviceOf(ua),
    city: cleanText(request.cf?.city, 60), country: cleanText(request.cf?.country, 2), events,
  };
  const saving = store(env.DB, beacon).catch((e) => console.error('analytics: not stored', e?.message || e));
  // Answer at once and write after; tests wait for the write so they can read it back.
  if (env.RB_TEST === '1') await saving; else ctx.waitUntil(saving);
  return EMPTY(204);
}

async function store(db, b) {
  await ready(db);
  if (!(await underCap(db, b.day))) return;
  const salt = await daySalt(db, b.day);
  const vid = (await sha256Hex(`${salt}|${b.net}|${b.ua}`)).slice(0, 16);
  await db.prepare('INSERT INTO beacons (day, at, vid, device, city, country, events) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(b.day, b.at, vid, b.device, b.city, b.country, JSON.stringify(b.events)).run();
}

let salted = { day: '', salt: '' };

/** Today's salt for the visitor hash, created on first use; every other day's is deleted. */
async function daySalt(db, day) {
  if (salted.day === day) return salted.salt;
  const key = `salt:${day}`;
  const results = await db.batch([
    db.prepare('INSERT OR IGNORE INTO meta (k, v) VALUES (?, ?)').bind(key, crypto.randomUUID()),
    db.prepare('SELECT v FROM meta WHERE k = ?').bind(key),
    db.prepare("DELETE FROM meta WHERE k LIKE 'salt:%' AND k <> ?").bind(key),
  ]);
  salted = { day, salt: results[1].results[0].v };
  return salted.salt;
}

let tally = { day: '', since: 0, known: -1 };

/** Beacons written today, counted in D1 every 20 per instance (one write per 20). */
async function underCap(db, day) {
  if (tally.day !== day) tally = { day, since: 0, known: -1 };
  tally.since += 1;
  if (tally.known < 0 || tally.since >= 20) {
    const n = tally.since;
    tally.since = 0;
    const total = await db.prepare(
      'INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = CAST(v AS INTEGER) + ? RETURNING v',
    ).bind(`beacons:${day}`, String(n), n).first('v');
    tally.known = Number(total);
  }
  return tally.known <= DAILY_BEACON_CAP;
}

// ----- Out: the totals /admin shows --------------------------------------------------------

/** One day's totals, added up by D1 in a single batch (stats.js). */
async function aggregateDay(db, day) {
  const results = await db.batch(DAY_SQL.map((sql) => db.prepare(sql).bind(day)));
  return summarize(results.map((r) => r.results));
}

/** INSERT statements for a day's totals, 25 rows each (D1 takes up to 100 bound values a statement). */
function insertTotals(db, day, rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += 25) {
    const chunk = rows.slice(i, i + 25);
    out.push(db.prepare(`INSERT OR REPLACE INTO daily_totals (day, metric, key, value) VALUES ${chunk.map(() => '(?, ?, ?, ?)').join(', ')}`)
      .bind(...chunk.flatMap(([metric, key, value]) => [day, metric, key, value])));
  }
  return out;
}

/**
 * Sums finished days that have beacons but no totals yet — newest first, so
 * the days on screen are done first, and at most ROLLUP_DAYS per request —
 * then drops beacons older than 13 months, only from days already summed, so
 * nothing is lost if /admin went unopened for a long time.
 */
export async function rollUp(db, today) {
  await ready(db);
  const { results } = await db.prepare(
    "SELECT DISTINCT day FROM beacons WHERE day < ? AND day NOT IN (SELECT day FROM daily_totals WHERE metric = 'rolled') ORDER BY day DESC LIMIT ?",
  ).bind(today, ROLLUP_DAYS).all();
  for (const { day } of results) {
    await db.batch(insertTotals(db, day, [...(await aggregateDay(db, day)), ['rolled', '', 1]]));
  }
  await db.batch([
    db.prepare("DELETE FROM beacons WHERE day < ? AND day IN (SELECT day FROM daily_totals WHERE metric = 'rolled')")
      .bind(shiftDay(today, -KEEP_DAYS)),
    db.prepare("DELETE FROM meta WHERE k LIKE 'beacons:%' AND k < ?").bind(`beacons:${shiftDay(today, -1)}`),
  ]);
}

/**
 * Everything /admin shows for [from, to]: `totals` (metric\0key -> sum over the
 * days), `days` ([{ day, visitors, pageviews }] for the chart), and `pending`:
 * finished days in the range still waiting to be summed (shown as a notice).
 * Finished days come from daily_totals; today is summed live.
 */
export async function statsFor(db, { from, to, today }) {
  await rollUp(db, today);
  const totals = new Map();
  const add = (metric, key, value) => {
    const k = `${metric}\u0000${key}`;
    totals.set(k, (totals.get(k) || 0) + value);
  };
  const perDay = new Map();
  const [summed, series, waiting] = await db.batch([
    db.prepare("SELECT metric, key, SUM(value) AS value FROM daily_totals WHERE day BETWEEN ? AND ? AND metric <> 'rolled' GROUP BY metric, key").bind(from, to),
    db.prepare("SELECT day, metric, value FROM daily_totals WHERE day BETWEEN ? AND ? AND key = '' AND metric IN ('visitors', 'pageviews')").bind(from, to),
    db.prepare("SELECT COUNT(DISTINCT day) AS n FROM beacons WHERE day >= ? AND day < ? AND day NOT IN (SELECT day FROM daily_totals WHERE metric = 'rolled')").bind(from, today),
  ]);
  for (const r of summed.results) add(r.metric, r.key, r.value);
  for (const r of series.results) perDay.set(r.day, { ...(perDay.get(r.day) || {}), [r.metric]: r.value });
  if (from <= today && today <= to) {
    const live = {};
    for (const [metric, key, value] of await aggregateDay(db, today)) {
      add(metric, key, value);
      if (key === '' && (metric === 'visitors' || metric === 'pageviews')) live[metric] = value;
    }
    perDay.set(today, live);
  }
  const days = [];
  for (let day = from; day <= to; day = shiftDay(day, 1)) {
    const d = perDay.get(day) || {};
    days.push({ day, visitors: d.visitors || 0, pageviews: d.pageviews || 0 });
  }
  return { totals, days, pending: waiting.results[0].n };
}

/** Headline sums for an earlier period (finished days only), for the tiles' "vs before". */
export async function headlineFor(db, { from, to }) {
  const { results } = await db.prepare(
    `SELECT metric, key, SUM(value) AS value FROM daily_totals WHERE day BETWEEN ? AND ?
       AND ((metric IN ('visitors', 'pageviews') AND key = '') OR (metric = 'event' AND key = 'estimate_completed'))
     GROUP BY metric, key`,
  ).bind(from, to).all();
  return new Map(results.map((r) => [`${r.metric}\u0000${r.key}`, r.value]));
}

/** Every day's headline numbers since the first, for the daily CSV. */
export async function dailyHistory(db) {
  const { results } = await db.prepare(
    `SELECT day, metric, key, value FROM daily_totals
      WHERE (metric IN ('visitors', 'pageviews') AND key = '') OR (metric = 'event' AND key = 'estimate_completed')
      ORDER BY day`,
  ).all();
  const byDay = new Map();
  for (const r of results) {
    const d = byDay.get(r.day) || { visitors: 0, pageviews: 0, fares: 0 };
    if (r.metric === 'event') d.fares = r.value; else d[r.metric] = r.value;
    byDay.set(r.day, d);
  }
  return byDay;
}
