/**
 * The analytics' pure parts: what a beacon from src/site.js may contain, the
 * SQL that adds up a day's beacons, and how its results become the totals
 * /admin shows. No bindings and no I/O: test/worker.mjs runs them under Node,
 * the SQL against Node's own SQLite.
 */
import { cleanText } from './lib.js';

// ----- What the browser may send ------------------------------------------------------

const NAME = /^[a-z][a-z0-9_]{0,39}$/;
const PROP = /^[a-z][a-z0-9_]{0,23}$/;
const HOST = /^(\(internal\)|[a-z0-9.-]{1,100}(:\d{1,5})?)$/i;

/** A page view: PRD 10.2's page_view, or pageview from pages cached before it. */
export const isView = (n) => n === 'page_view' || n === 'pageview';
const VIEWS = "('page_view', 'pageview')";

/**
 * A beacon's events, each checked and trimmed; anything malformed is dropped.
 * Event: { n: name, p: page, l?: label, w?: region, h?: link target,
 *          r?: referrer host, u?: {source, medium, campaign}, f?: 1 (landing),
 *          d?: details (flat, primitives only) }.
 */
export function cleanEvents(body) {
  const list = body && Array.isArray(body.e) ? body.e.slice(0, 25) : [];
  const out = [];
  for (const e of list) {
    if (!e || typeof e !== 'object' || typeof e.n !== 'string' || !NAME.test(e.n)) continue;
    if (typeof e.p !== 'string' || !/^\/\S{0,99}$/.test(e.p)) continue;
    const ev = { n: e.n, p: e.p };
    for (const [k, max] of [['l', 120], ['w', 40], ['h', 100]]) {
      const v = cleanText(e[k], max);
      if (v) ev[k] = v;
    }
    if (isView(e.n)) {
      if (e.f === 1) ev.f = 1;
      if (typeof e.r === 'string' && HOST.test(e.r)) ev.r = e.r.toLowerCase();
      if (e.u && typeof e.u === 'object') {
        const u = {};
        for (const k of ['source', 'medium', 'campaign']) {
          const v = cleanText(e.u[k], 60).toLowerCase();
          if (v) u[k] = v;
        }
        if (Object.keys(u).length) ev.u = u;
      }
    }
    if (e.d && typeof e.d === 'object' && !Array.isArray(e.d)) {
      const d = {};
      for (const [k, v] of Object.entries(e.d).slice(0, 16)) {
        if (!PROP.test(k)) continue;
        if (typeof v === 'string') { const t = cleanText(v, 60); if (t) d[k] = t; }
        else if (typeof v === 'number' && Number.isFinite(v)) d[k] = Math.round(v * 100) / 100;
        else if (typeof v === 'boolean') d[k] = v;
      }
      if (Object.keys(d).length) ev.d = d;
    }
    out.push(ev);
  }
  return out;
}

/** Crawlers, monitors and automation: not visitors. Real in-app browsers (Instagram, Facebook) are kept. */
export const isBot = (ua) => !ua || /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|python|curl|wget|httpclient|java\//i.test(ua);

export function deviceOf(ua = '') {
  if (/iPad|Tablet|PlayBook|Silk|Kindle|SM-T\d|Nexus (7|9|10)\b/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'Tablet';
  if (/Mobi|iPhone|iPod|Android|Opera Mini|IEMobile/i.test(ua)) return 'Phone';
  return 'Computer';
}

// ----- Labels for the dashboard ---------------------------------------------------------

const SITES = [
  [/(^|\.)google\.[a-z.]+$/, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)yahoo\.[a-z.]+$/, 'Yahoo'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)facebook\.com$|^fb\.me$|^m\.me$/, 'Facebook'],
  [/(^|\.)whatsapp\.(com|net)$|^wa\.me$/, 'WhatsApp'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X (Twitter)'],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn'],
  [/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube'],
  [/(^|\.)reddit\.com$/, 'Reddit'],
];
const TAGGED = { whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', google: 'Google', youtube: 'YouTube', linkedin: 'LinkedIn', twitter: 'X (Twitter)', x: 'X (Twitter)' };

export const DIRECT = 'Direct or an app';

/**
 * Where a visit came from: a tagged link's utm_source first, else the site that
 * linked here, else "Direct or an app" — typed or bookmarked, or opened from an
 * app such as WhatsApp, which usually passes no referrer.
 */
export function sourceOf(view) {
  const tagged = view && view.u && view.u.source;
  if (tagged) return TAGGED[tagged] || tagged;
  const r = view && view.r;
  if (!r || r === '(internal)') return DIRECT;
  const host = r.replace(/:\d+$/, '');
  for (const [re, name] of SITES) if (re.test(host)) return name;
  return host.replace(/^www\./, '');
}

export const aheadBand = (n) => (n <= 0 ? 'Same day' : n <= 3 ? '1–3 days ahead' : n <= 7 ? '4–7 days ahead' : n <= 30 ? '8–30 days ahead' : 'Over 30 days ahead');
export const fareBand = (f) => (f < 1000 ? 'Under ₹1,000' : f < 2000 ? '₹1,000–1,999' : f < 5000 ? '₹2,000–4,999' : f < 10000 ? '₹5,000–9,999' : '₹10,000 and up');
export const hourBand = (h) => (h < 6 ? 'Before 6 am' : h < 12 ? 'Morning, 6–12' : h < 17 ? 'Afternoon, 12–5 pm' : h < 22 ? 'Evening, 5–10 pm' : 'Night, after 10 pm');
/** Largest paint, banded at FAST_MS / SLOW_MS (Google's Core Web Vitals lines). */
export const speedBand = (ms) => (ms <= FAST_MS ? 'Fast' : ms <= SLOW_MS ? 'Slowish' : 'Slow');
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TRIPS = { round: 'Round trip', one: 'One way', hourly: 'Hourly' };
/** A form, by PRD 10.2's `form` (signup, buddy, feedback) or the names pages cached before it sent. */
const FORMS = {
  signup: 'a sign-up form', buddy: 'Buddy application', feedback: 'fare 👍/👎',
  contact: 'Contact page', estimate: 'estimate page', waitlist: 'Join the Waitlist pop-up', agency: 'agency application',
};
/** Where a one-time code was asked for, by PRD 10.2's `source`. */
const CODE_SOURCES = { estimate: 'under an estimate', hero: 'Join the Waitlist', buddy: 'Buddy application' };
/**
 * Why a one-time code didn't go through: otp_failed's `cause` (the Worker's own
 * reason, where it says more) or `reason` (PRD 10.2), or `kind` from before.
 */
const CODE_FAILURES = {
  wrong_code: 'wrong code', too_many_attempts: 'too many tries', expired: 'code expired', send_failed: 'SMS not sent',
  wrong: 'wrong code', too_many: 'too many tries',
  resend_wait: 'asked again too soon', number_limit: 'too many codes', network_limit: 'too many codes', daily_cap: 'SMS not sent',
  not_configured: 'no 2Factor key on Cloudflare',
};
/** estimate_refused reasons (PRD 6.3) that refuse a place: the refused list, by place. */
const REFUSED = { pickup_out_of_area: 'Pickup', destination_too_far: 'Destination', too_short: 'Under 40 km' };
/** …and those that are a lookup going wrong: problems. */
const LOOKUP = {
  route_not_found: 'No driving route between the two places', route_failed: 'Route lookup failed', maps_failed: 'Google Maps did not load',
};

/** Every event named on the dashboard as a problem, and how it reads there. */
export const PROBLEMS = {
  phone_invalid: (d) => `Mistyped phone number (${FORMS[d.form] || d.form || 'a form'})`,
  form_invalid: (d) => `Form sent incomplete (${FORMS[d.form] || d.form || 'a form'})`,
  save_failed: (d) => `A form could not be saved (${FORMS[d.form] || d.form || 'a form'})`,
  otp_failed: (d) => `One-time code not confirmed (${CODE_SOURCES[d.source] || FORMS[d.form] || d.form || 'a form'}: ${CODE_FAILURES[d.kind] || 'other'})`,
  estimate_refused: (d) => LOOKUP[d.kind] || null,
  // Named so before PRD 6.3's single estimate_refused:
  maps_failed: () => LOOKUP.maps_failed,
  route_not_found: () => LOOKUP.route_not_found,
  route_failed: () => LOOKUP.route_failed,
  js_error: () => 'Script error on a page',
};

// ----- A day of beacons -> totals ---------------------------------------------------------

/** Google's Core Web Vitals line for the largest paint: 2.5 s good, 4 s poor. */
export const FAST_MS = 2500;
export const SLOW_MS = 4000;

/**
 * Where a waitlist signup was made, as the dashboard names it: under an
 * estimate, or a Join the Waitlist button (source hero) on the page it was sent
 * from. Pages cached from before sent the page as the source.
 */
const JOINED_FROM = {
  estimate: 'Under an estimate', contact: 'Contact page', home: 'Home page', how: 'How It Works page', about: 'About page',
};
const HERO_PAGES = [[/^\/contact\//, 'Contact page'], [/^\/about\//, 'About page'], [/^\/(beta\/)?(#|$)/, 'Home page']];
function joinedFrom(source, page) {
  if (source !== 'hero') return JOINED_FROM[source] || 'Other';
  const hit = HERO_PAGES.find(([re]) => re.test(page || ''));
  return hit ? hit[1] : 'Other';
}
/** A signup: PRD 10.2's signup_completed, or waitlist_joined from before. */
const SIGNUPS = "('signup_completed', 'waitlist_joined')";
const DETAIL_EVENTS = ['place_refused', 'waitlist_joined', 'signup_completed', ...Object.keys(PROBLEMS)].map((n) => `'${n}'`).join(', ');

/** Every event of the day (?1), one row each, with its fields pulled out of the JSON. */
const EV = `WITH ev AS (
  SELECT b.id AS bid, b.vid AS vid, j.key AS k,
    json_extract(j.value, '$.n') AS n, json_extract(j.value, '$.p') AS p,
    json_extract(j.value, '$.l') AS l, json_extract(j.value, '$.w') AS w,
    json_extract(j.value, '$.f') AS f, json_extract(j.value, '$.r') AS r,
    json_extract(j.value, '$.u') AS u, json_extract(j.value, '$.d') AS d
  FROM beacons b, json_each(b.events) j
  WHERE b.day = ?1)`;

/**
 * One day's totals, added up by D1 rather than the Worker: Workers' free plan
 * allows ~10 ms of CPU a request, which JavaScript adding up a busy day's
 * beacons would exceed. Seven statements, run as one batch; `summarize` turns
 * their (small) results into totals.
 */
export const DAY_SQL = [
  // 0 · every event, by name
  `${EV} SELECT n, COUNT(*) AS c FROM ev GROUP BY n`,
  // 1 · page views, and the people behind them
  `${EV} SELECT p, COUNT(*) AS views, COUNT(DISTINCT vid) AS people FROM ev WHERE n IN ${VIEWS} GROUP BY p`,
  // 2 · clicks by page, place and label
  `${EV} SELECT p, COALESCE(w, '') AS w, COALESCE(l, '') AS l, COUNT(*) AS c FROM ev WHERE n = 'click' GROUP BY 1, 2, 3`,
  // 3 · page speed, banded
  `${EV}, perf AS (
     SELECT p, COALESCE(json_extract(d, '$.lcp'), json_extract(d, '$.load')) AS ms, COALESCE(json_extract(d, '$.net'), '') AS net
     FROM ev WHERE n = 'perf')
   SELECT p, net, CASE WHEN ms <= ${FAST_MS} THEN 'Fast' WHEN ms <= ${SLOW_MS} THEN 'Slowish' ELSE 'Slow' END AS band, COUNT(*) AS c
   FROM perf WHERE ms > 0 GROUP BY 1, 2, 3`,
  // 4 · the fares shown
  `${EV} SELECT json_extract(d, '$.trip') AS trip, json_extract(d, '$.dest_city') AS dest,
     json_extract(d, '$.pickup_area') AS area, json_extract(d, '$.pickup_city') AS city,
     json_extract(d, '$.ahead') AS ahead, json_extract(d, '$.fare') AS fare, json_extract(d, '$.weekday') AS weekday,
     json_extract(d, '$.hour') AS hour, json_extract(d, '$.km') AS km, COUNT(*) AS c
   FROM ev WHERE n = 'estimate_completed' GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9`,
  // 5 · named events that carry details: refusals, signups, problems. `kind`
  //     is the most specific reason an event gives (cause, reason, or kind).
  `${EV} SELECT n, COALESCE(json_extract(d, '$.cause'), json_extract(d, '$.reason'), json_extract(d, '$.kind')) AS kind,
     json_extract(d, '$.area') AS area, json_extract(d, '$.city') AS city,
     json_extract(d, '$.source') AS source, json_extract(d, '$.form') AS form, CASE WHEN n = 'js_error' THEN l END AS msg,
     CASE WHEN n IN ${SIGNUPS} THEN p END AS page, COUNT(*) AS c
   FROM ev WHERE n IN (${DETAIL_EVENTS}) GROUP BY 1, 2, 3, 4, 5, 6, 7, 8`,
  // 6 · one row per visitor: device and city (first beacon), where they came from
  //     (first arrival from outside the site), and how far they got
  `${EV},
   firsts AS (SELECT vid, device, city FROM (
     SELECT vid, device, city, ROW_NUMBER() OVER (PARTITION BY vid ORDER BY id) AS rn FROM beacons WHERE day = ?1) WHERE rn = 1),
   lands AS (SELECT vid, r, u FROM (
     SELECT vid, r, u, ROW_NUMBER() OVER (PARTITION BY vid ORDER BY bid, k) AS rn
     FROM ev WHERE n IN ${VIEWS} AND f = 1 AND COALESCE(r, '') <> '(internal)') WHERE rn = 1),
   flags AS (SELECT vid,
       MAX(n IN ${VIEWS} AND p LIKE '/estimate/%') AS opened, MAX(n = 'estimate_started') AS started,
       MAX(n = 'estimate_completed') AS fare, MAX(n IN ${SIGNUPS} AND json_extract(d, '$.source') = 'estimate') AS joined_here,
       MAX(n IN ${SIGNUPS}) AS joined, MAX(n = 'buddy_application_opened') AS b_open,
       MAX(n IN ('buddy_interest_submitted', 'buddy_application_submitted')) AS b_sent
     FROM ev GROUP BY vid)
   SELECT fi.vid, fi.device, fi.city, l.r, l.u, g.opened, g.started, g.fare, g.joined_here, g.joined, g.b_open, g.b_sent
   FROM firsts fi LEFT JOIN flags g ON g.vid = fi.vid LEFT JOIN lands l ON l.vid = fi.vid`,
];

/**
 * DAY_SQL's seven result sets -> [metric, key, value] rows. Every value is a
 * count (or a sum), so /admin adds days together; "visitors" are counted per
 * day, as the visitor hash changes daily. Keys that combine two things use a
 * tab between them.
 */
export function summarize([counts, pages, clicks, perf, fares, details, people]) {
  const t = new Map();
  const add = (metric, key, n = 1) => {
    const k = `${metric}\u0000${key}`;
    t.set(k, (t.get(k) || 0) + n);
  };

  for (const r of counts) {
    if (isView(r.n)) add('pageviews', '', r.c);
    else if (r.n !== 'click' && r.n !== 'perf') add('event', r.n, r.c);
  }
  for (const r of pages) { add('page_views', r.p, r.views); add('page_visitors', r.p, r.people); }
  for (const r of clicks) add('click', `${r.p}\t${r.w}\t${r.l}`, r.c);
  for (const r of perf) {
    add('speed', `${r.p}\t${r.band}`, r.c);
    if (r.net) add('speed_net', `${r.net}\t${r.band}`, r.c);
  }
  for (const r of fares) {
    add('trip', TRIPS[r.trip] || 'Other', r.c);
    if (r.dest) add('dest', r.dest, r.c);
    add('pickup', [r.area, r.city].filter(Boolean).join(', ') || 'Unknown', r.c);
    if (typeof r.ahead === 'number') add('ahead', aheadBand(r.ahead), r.c);
    if (typeof r.fare === 'number') {
      add('fare_band', fareBand(r.fare), r.c);
      add('fare_sum', '', Math.round(r.fare) * r.c);
      add('fare_n', '', r.c);
    }
    if (typeof r.weekday === 'number' && WEEKDAYS[r.weekday]) add('weekday', WEEKDAYS[r.weekday], r.c);
    if (typeof r.hour === 'number') add('hour', hourBand(r.hour), r.c);
    if (r.km) { add('km_sum', '', Math.round(r.km) * r.c); add('km_n', '', r.c); }
  }
  const where = (r) => [r.area, r.city].filter(Boolean).join(', ') || 'Unknown';
  for (const r of details) {
    const problem = PROBLEMS[r.n] && PROBLEMS[r.n]({ form: r.form, kind: r.kind, source: r.source });
    if (problem) add('problem', problem, r.c);
    if (r.n === 'js_error') add('js_error', r.msg || 'error', r.c);
    if (r.n === 'estimate_refused' && REFUSED[r.kind]) add('refused', `${REFUSED[r.kind]}\t${where(r)}`, r.c);
    if (r.n === 'place_refused') add('refused', `${r.kind === 'destination' ? 'Destination' : 'Pickup'}\t${where(r)}`, r.c);
    if (r.n === 'signup_completed' || r.n === 'waitlist_joined') add('waitlist', joinedFrom(r.source, r.page), r.c);
  }
  for (const v of people) {
    let u = null;
    try { u = v.u ? JSON.parse(v.u) : null; } catch { /* a damaged campaign counts as none */ }
    const source = sourceOf({ r: v.r, u });
    add('visitors', '');
    add('device', v.device || 'Unknown');
    add('city', v.city || 'Unknown');
    add('source', source);
    if (u) add('campaign', `${u.source || '—'}\t${u.medium || '—'}\t${u.campaign || '—'}`);
    // The estimator, step by step, in people rather than clicks. Reaching a
    // step implies the ones before it (a page-view beacon can be lost, a visit
    // can straddle midnight), so each step counts at least those after it.
    const est = [v.opened, v.started, v.fare, v.joined_here];
    ['1 opened', '2 started', '3 saw a fare', '4 joined the waitlist'].forEach((step, i) => {
      if (est.slice(i).some(Boolean)) add('funnel_estimate', step);
    });
    if (v.b_open || v.b_sent) add('funnel_buddy', '1 opened the form');
    if (v.b_sent) { add('funnel_buddy', '2 sent it'); add('buddy_source', source); }
    if (v.joined) add('signup_source', source);
  }

  return [...t].map(([k, value]) => {
    const [metric, key] = k.split('\u0000');
    return [metric, key, value];
  });
}
