/**
 * The /admin page as HTML: the two lists, then the site's analytics. Pure —
 * everything shown is passed in — so tests render it without a server.
 *
 * Charts follow one rule set: a single series per chart in Trail Green on white,
 * thin marks with 4px rounded ends, hairline grid, values in text colours, the
 * hover detail repeated in a table. Light only, like the rest of the site.
 */
import { escapeHtml as h, groupINR } from './lib.js';
import { DIRECT, WEEKDAYS } from './stats.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS3 = WEEKDAYS.map((d) => d.slice(0, 3));

/** 1,284 · 12.9 L · 1.2 Cr — Indian grouping, lakh and crore beyond. */
export function compact(n) {
  const v = Math.round(n);
  if (v >= 1e7) return `${(v / 1e7).toFixed(1).replace(/\.0$/, '')} Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1).replace(/\.0$/, '')} L`;
  return groupINR(v);
}

const num = (n) => groupINR(Math.round(n));
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
const dateOf = (day) => new Date(`${day}T00:00:00Z`);
export const shortDay = (day) => { const d = dateOf(day); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
const longDay = (day) => `${DAYS3[dateOf(day).getUTCDay()]} ${shortDay(day)}`;

const get = (totals, metric, key = '') => totals.get(`${metric}\u0000${key}`) || 0;

/** A metric's keys and values, biggest first. */
function rows(totals, metric) {
  const out = [];
  for (const [k, v] of totals) if (k.startsWith(`${metric}\u0000`)) out.push([k.slice(metric.length + 1), v]);
  return out.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Same, in a fixed order (bands, weekdays), leaving out the empty ones. */
const ordered = (totals, metric, keys) => keys.map((k) => [k, get(totals, metric, k)]).filter(([, v]) => v > 0);

// ----- Building blocks ---------------------------------------------------------------------

function tile(label, value, before, period) {
  let delta = '';
  if (before !== undefined && (value || before)) {
    if (!before) delta = `<div class="tile__delta"><span class="up">▲ new</span> vs ${h(period)}</div>`;
    else {
      const d = Math.round(((value - before) / before) * 100);
      const cls = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
      const sign = d > 0 ? `▲ ${d}%` : d < 0 ? `▼ ${-d}%` : '● same';
      delta = `<div class="tile__delta"><span class="${cls}">${sign}</span> vs ${h(period)}</div>`;
    }
  }
  return `<div class="tile"><div class="tile__label">${h(label)}</div><div class="tile__value">${compact(value)}</div>${delta}</div>`;
}

/**
 * A table whose rows carry a thin bar for their share of the largest — the
 * table is the chart's own accessible form. `limit` folds the tail into "Other".
 */
function barTable(list, { head = ['', ''], limit = 10, empty = 'Nothing yet.', label = (k) => h(k) } = {}) {
  if (!list.length) return `<p class="empty">${h(empty)}</p>`;
  const shown = list.slice(0, limit);
  const rest = list.slice(limit);
  if (rest.length) shown.push([`Other (${rest.length})`, rest.reduce((s, r) => s + r[1], 0), true]);
  const max = Math.max(...shown.map((r) => r[1])) || 1;
  const body = shown.map(([k, v, other]) => `<tr>
      <th scope="row">${other ? h(k) : label(k)}</th>
      <td class="num">${num(v)}</td>
      <td class="meter" aria-hidden="true"><span style="width:${Math.max(1, Math.round((v / max) * 100))}%"></span></td>
    </tr>`).join('');
  return `<table class="bars"><thead><tr><th scope="col">${h(head[0])}</th><th scope="col" class="num">${h(head[1])}</th><th aria-hidden="true"></th></tr></thead><tbody>${body}</tbody></table>`;
}

/** Steps as a share of the first, with what each keeps of the step before. */
function funnel(steps, empty) {
  const first = steps[0]?.[1] || 0;
  if (!first) return `<p class="empty">${h(empty)}</p>`;
  const body = steps.map(([label, n], i) => {
    const kept = i === 0 ? '' : `<span class="kept">${pct(n, steps[i - 1][1])}% of the step before</span>`;
    return `<tr>
      <th scope="row">${h(label)}${kept}</th>
      <td class="num">${num(n)}</td>
      <td class="meter" aria-hidden="true"><span style="width:${Math.min(100, Math.max(1, pct(n, first)))}%"></span></td>
    </tr>`;
  }).join('');
  return `<table class="bars funnel"><thead><tr><th scope="col">Step</th><th scope="col" class="num">People</th><th aria-hidden="true"></th></tr></thead><tbody>${body}</tbody></table>`;
}

const niceMax = (v) => {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
};

/**
 * Visitors per day: one column per day, hover or focus a day for its numbers
 * (the whole column is the target), and the same numbers as a table below.
 */
function dailyChart(days) {
  const max = niceMax(Math.max(...days.map((d) => d.visitors)));
  const cols = days.map((d) => {
    const tip = `${longDay(d.day)}|${num(d.visitors)} ${d.visitors === 1 ? 'visitor' : 'visitors'}|${num(d.pageviews)} page ${d.pageviews === 1 ? 'view' : 'views'}`;
    const hgt = d.visitors ? Math.max(1.5, (d.visitors / max) * 100) : 0;
    return `<div class="col" tabindex="0" data-tip="${h(tip)}" aria-label="${h(tip.replaceAll('|', ', '))}"><span class="bar" style="height:${hgt.toFixed(1)}%"></span></div>`;
  }).join('');
  const n = days.length;
  const marks = n <= 7 ? days.map((d, i) => [i, `${DAYS3[dateOf(d.day).getUTCDay()]} ${dateOf(d.day).getUTCDate()}`])
    : [[0, shortDay(days[0].day)], [Math.floor((n - 1) / 2), shortDay(days[Math.floor((n - 1) / 2)].day)], [n - 1, shortDay(days[n - 1].day)]];
  // On a phone, seven labels don't fit: keep the first, the middle and the last.
  const keep = new Set([0, Math.floor((n - 1) / 2), n - 1]);
  const xlabels = marks.map(([i, t]) => `<span${keep.has(i) ? '' : ' class="mid"'} style="grid-column:${i + 1}">${h(t)}</span>`).join('');
  const grid = [max, max / 2, 0].map((v) => `<div class="gridline" style="bottom:${(v / max) * 100}%"><span>${num(v)}</span></div>`).join('');
  const table = days.map((d) => `<tr><th scope="row">${h(longDay(d.day))}</th><td class="num">${num(d.visitors)}</td><td class="num">${num(d.pageviews)}</td></tr>`).join('');
  return `<figure class="chart" id="daily" style="--n:${n}">
    <div class="plot">${grid}<div class="cols${n > 45 ? ' dense' : ''}">${cols}</div></div>
    <div class="xlabels">${xlabels}</div>
    <div class="tip" role="status" hidden></div>
  </figure>
  <details class="twin"><summary>Show as a table</summary>
    <table class="plain"><thead><tr><th scope="col">Day</th><th scope="col" class="num">Visitors</th><th scope="col" class="num">Page views</th></tr></thead><tbody>${table}</tbody></table>
  </details>`;
}

const card = (title, sub, body, { id = '', wide = false } = {}) => `
  <section class="card${wide ? ' wide' : ''}"${id ? ` id="${id}"` : ''}>
    <h2>${h(title)}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}
    ${body}
  </section>`;

const pageName = (p) => ({
  '/': 'Holding page (/)', '/beta/': 'Home (/beta/)', '/beta/#how-it-works': 'How It Works', '/beta/#about': 'About',
  '/beta/#contact': 'Contact', '/beta/#apply': 'Apply to be a Buddy (link)', '/estimate/': 'Estimate',
}[p] || p);

// ----- The page ---------------------------------------------------------------------------

const RANGES = [[1, 'Today'], [7, '7 days'], [30, '30 days'], [90, '90 days']];
const AHEAD = ['Same day', '1–3 days ahead', '4–7 days ahead', '8–30 days ahead', 'Over 30 days ahead'];
const FARES = ['Under ₹1,000', '₹1,000–1,999', '₹2,000–4,999', '₹5,000–9,999', '₹10,000 and up'];
const HOURS = ['Before 6 am', 'Morning, 6–12', 'Afternoon, 12–5 pm', 'Evening, 5–10 pm', 'Night, after 10 pm'];
const WEEK = [...WEEKDAYS.slice(1), WEEKDAYS[0]];
export const LINK_PAGES = [
  ['/beta/', 'Home'], ['/estimate/', 'Estimate'], ['/beta/#apply', 'Apply to be a Buddy'], ['/beta/#contact', 'Contact'], ['/', 'Holding page'],
];

/**
 * @param {object} v
 *   range: { days, from, to }, lists: { clients, clientPhones, clientLast, buddies, buddyPhones, buddyLast },
 *   stats: { totals, days }, before: headline Map of the previous period, signups: { now, before } ({ waitlist, buddies }),
 *   excluded: boolean, link: { page, source, medium, campaign, url } | null, stamp: (iso) => string
 */
export function renderDashboard(v) {
  const { range, lists, stats, before, signups, excluded, link, stamp } = v;
  const t = stats.totals;
  const period = range.days === 1 ? 'yesterday' : `the ${range.days} days before`;
  const prev = (metric, key = '') => before.get(`${metric}\u0000${key}`) || 0;

  const rangeNav = RANGES.map(([d, label]) => `<a href="/admin?days=${d}"${d === range.days ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const span = range.days === 1 ? `Today, ${shortDay(range.to)}` : `${shortDay(range.from)} – ${shortDay(range.to)}`;

  const listCard = (title, n, phones, last, file) => `
    <div class="list">
      <h3>${h(title)}</h3>
      <p class="n">${num(n)} ${n === 1 ? 'entry' : 'entries'} · ${num(phones)} ${phones === 1 ? 'number' : 'different numbers'}</p>
      <p class="meta">${last ? `Latest: ${h(stamp(last))} IST` : 'Nothing yet.'}</p>
      <a class="btn" href="/admin/${file}.csv">Download CSV</a>
    </div>`;

  const visitors = get(t, 'visitors');
  const kpis = `<div class="kpis">
    ${tile('Visitors', visitors, prev('visitors'), period)}
    ${tile('Page views', get(t, 'pageviews'), prev('pageviews'), period)}
    ${tile('Fares shown', get(t, 'event', 'estimate_completed'), prev('event', 'estimate_completed'), period)}
    ${tile('Waitlist signups', signups.now.waitlist, signups.before.waitlist, period)}
    ${tile('Buddy applications', signups.now.buddies, signups.before.buddies, period)}
  </div>`;

  const chart = range.days === 1
    ? '<p class="empty">Pick 7 days or more for the day-by-day chart.</p>'
    : visitors ? dailyChart(stats.days) : '<p class="empty">No visits in this period yet.</p>';

  const steps = (metric, names) => names.map(([key, label]) => [label, get(t, metric, key)]);
  const estFunnel = funnel(steps('funnel_estimate', [
    ['1 opened', 'Opened the estimate page'], ['2 started', 'Started filling it in'],
    ['3 saw a fare', 'Saw a fare'], ['4 joined the waitlist', 'Joined the waitlist there'],
  ]), 'Nobody has opened the estimator in this period yet.');
  const buddyFunnel = funnel(steps('funnel_buddy', [['1 opened the form', 'Opened the application'], ['2 sent it', 'Sent it']]),
    'Nobody has opened the application in this period yet.');

  const faresN = get(t, 'fare_n');
  const avg = faresN ? ` Average fare shown: <b>₹${num(get(t, 'fare_sum') / faresN)}</b>.` : '';
  const avgKm = get(t, 'km_n') ? ` Average distance: <b>${num(get(t, 'km_sum') / get(t, 'km_n'))} km</b> one way.` : '';

  const speedRows = (() => {
    const byPage = new Map();
    for (const [k, n] of rows(t, 'speed')) {
      const [page, band] = k.split('\t');
      const r = byPage.get(page) || { Fast: 0, Slowish: 0, Slow: 0 };
      r[band] = (r[band] || 0) + n;
      byPage.set(page, r);
    }
    if (!byPage.size) return '<p class="empty">No page loads measured yet.</p>';
    const body = [...byPage].sort((a, b) => sum(b[1]) - sum(a[1])).map(([page, r]) => `<tr>
        <th scope="row">${h(pageName(page))}</th><td class="num">${num(sum(r))}</td>
        <td class="num">${pct(r.Fast, sum(r))}%</td><td class="num">${pct(r.Slow, sum(r))}%</td></tr>`).join('');
    return `<table class="plain"><thead><tr><th scope="col">Page</th><th scope="col" class="num">Loads</th><th scope="col" class="num">Fast</th><th scope="col" class="num">Slow</th></tr></thead><tbody>${body}</tbody></table>
      <p class="note">Fast: the main content showed within 2.5 seconds. Slow: over 4 seconds (Google's thresholds).</p>`;
  })();
  const netRows = (() => {
    const byNet = new Map();
    for (const [k, n] of rows(t, 'speed_net')) {
      const [net, band] = k.split('\t');
      const r = byNet.get(net) || { Fast: 0, Slowish: 0, Slow: 0 };
      r[band] = (r[band] || 0) + n;
      byNet.set(net, r);
    }
    return [...byNet].map(([net, r]) => [`${net.toUpperCase()} connection: ${pct(r.Slow, sum(r))}% slow`, sum(r)]);
  })();

  const clicks = rows(t, 'click').map(([k, n]) => {
    const [page, where, label] = k.split('\t');
    return [`${label}\u0001${where}\u0001${page}`, n];
  });
  const clickLabel = (k) => {
    const [label, where, page] = k.split('\u0001');
    return `${h(label)} <span class="where">${h([pageName(page), where].filter(Boolean).join(' · '))}</span>`;
  };

  const campaigns = rows(t, 'campaign').map(([k, n]) => [k.split('\t').join(' / '), n]);
  const refused = rows(t, 'refused').map(([k, n]) => [k.replace('\t', ': '), n]);

  const linkMaker = `
    <form class="linkmaker" method="get" action="/admin">
      <input type="hidden" name="days" value="${range.days}">
      <label><span>Page</span><select name="lm_page">${LINK_PAGES.map(([p, name]) => `<option value="${h(p)}"${link?.page === p ? ' selected' : ''}>${h(name)}</option>`).join('')}</select></label>
      <label><span>Where you'll share it</span><input name="lm_source" list="lm-sources" placeholder="whatsapp" value="${h(link?.source || '')}" required></label>
      <label><span>Kind of post <span class="opt">· optional</span></span><input name="lm_medium" list="lm-media" placeholder="group" value="${h(link?.medium || '')}"></label>
      <label><span>Campaign name <span class="opt">· optional</span></span><input name="lm_campaign" placeholder="launch-oct" value="${h(link?.campaign || '')}"></label>
      <button class="btn" type="submit">Make the link</button>
    </form>
    <datalist id="lm-sources"><option value="whatsapp"><option value="instagram"><option value="facebook"><option value="google"><option value="youtube"><option value="flyer"><option value="qr"><option value="sms"></datalist>
    <datalist id="lm-media"><option value="group"><option value="status"><option value="story"><option value="post"><option value="ad"><option value="print"><option value="dm"></datalist>
    ${link?.url ? `<div class="made"><input id="made-link" readonly value="${h(link.url)}" aria-label="Your link"><button class="btn" type="button" data-copy="made-link">Copy</button><a class="btn ghost" href="${h(link.url)}" target="_blank" rel="noopener">Open</a></div>` : ''}
    <p class="note">Share this link instead of the plain address. Visits through it show under “Where visitors come from” with the name you gave, and under “Campaign links” with the details.</p>`;

  return `
  <header class="top">
    <h1>RideBuddy admin</h1>
    <nav class="range" aria-label="Period">${rangeNav}</nav>
    <p class="span">${h(span)} · India time</p>
  </header>

  <section class="card wide">
    <h2>The lists</h2>
    <div class="lists">
      ${listCard('Client waitlist', lists.clients, lists.clientPhones, lists.clientLast, 'clients')}
      ${listCard('Buddy applications', lists.buddies, lists.buddyPhones, lists.buddyLast, 'buddies')}
    </div>
    <p class="note">All-time totals. Every submission is kept; a phone number already on the same list is marked “(repeat)” in the download.</p>
  </section>

  ${stats.pending ? `<p class="notice" role="status">Still adding up ${stats.pending} earlier ${stats.pending === 1 ? 'day' : 'days'} in this period. Reload in a moment to include ${stats.pending === 1 ? 'it' : 'them'}.</p>` : ''}
  ${kpis}
  <p class="note under-kpis">Signups and applications are counted from the lists; everything else from visits. Browsers that block scripts, and your own marked browsers, aren't counted.</p>

  ${card('Visitors per day', 'Each person counts once a day.', chart, { wide: true })}

  <div class="grid">
    ${card('The estimator, step by step', 'People who reached each step.', estFunnel)}
    ${card('Buddy recruitment', 'People who opened and sent the application.', `${buddyFunnel}
      <h3>Where applicants came from</h3>${barTable(rows(t, 'buddy_source'), { head: ['Source', 'People'], empty: 'No applications sent in this period yet.' })}`)}
    ${card('Where visitors come from', `“${DIRECT}”: typed in, a bookmark, or a link opened from an app such as WhatsApp, which hides where it came from.`,
      barTable(rows(t, 'source'), { head: ['Source', 'Visitors'] }) + `<h3>Who joined the waitlist, by source</h3>${barTable(rows(t, 'signup_source'), { head: ['Source', 'People'], empty: 'No waitlist signups in this period yet.' })}`)}
    ${card('Pages', 'Views, busiest first.', barTable(rows(t, 'page_views'), { head: ['Page', 'Views'], label: (p) => h(pageName(p)) }))}
    ${card('Campaign links', 'Visits through links made below.', barTable(campaigns, { head: ['Source / kind / campaign', 'Visitors'], empty: 'No tagged links used in this period yet.' }))}
    ${card('Phones or computers', '', barTable(rows(t, 'device'), { head: ['Device', 'Visitors'] }) + `<h3>Cities</h3>${barTable(rows(t, 'city'), { head: ['City', 'Visitors'], limit: 8 })}<p class="note">From the visitor's internet connection, so mobile data often shows a nearby big city.</p>`)}
  </div>

  ${card('What people price', `From every fare shown on the estimate page.${avg}${avgKm}`, `<div class="grid inner">
      <div><h3>Destinations</h3>${barTable(rows(t, 'dest'), { head: ['City', 'Fares'] })}</div>
      <div><h3>Pickup areas</h3>${barTable(rows(t, 'pickup'), { head: ['Area', 'Fares'] })}</div>
      <div><h3>Trip type</h3>${barTable(rows(t, 'trip'), { head: ['Type', 'Fares'] })}</div>
      <div><h3>How far ahead</h3>${barTable(ordered(t, 'ahead', AHEAD), { head: ['Booked', 'Fares'], limit: 99 })}</div>
      <div><h3>Fares</h3>${barTable(ordered(t, 'fare_band', FARES), { head: ['Fare', 'Fares'], limit: 99 })}</div>
      <div><h3>Travel day</h3>${barTable(ordered(t, 'weekday', WEEK), { head: ['Day', 'Fares'], limit: 99 })}</div>
      <div><h3>Pickup time</h3>${barTable(ordered(t, 'hour', HOURS), { head: ['Time', 'Fares'], limit: 99 })}</div>
      <div><h3>Outside the service area</h3>${barTable(refused, { head: ['Refused', 'Times'], empty: 'No one asked for a place outside the area yet.' })}
        <p class="note">Pickups asked for beyond the Tricity, destinations beyond 600 km: where to grow next.</p></div>
    </div>`, { wide: true })}

  ${card('Clicks', 'Buttons and links, most clicked first. Place suggestions are counted without their text.',
    barTable(clicks, { head: ['Button or link', 'Clicks'], limit: 25, label: clickLabel }), { wide: true })}

  <div class="grid">
    ${card('Problems', 'Things that went wrong for visitors.', barTable(rows(t, 'problem'), { head: ['What', 'Times'], empty: 'Nothing went wrong in this period.' })
      + (rows(t, 'js_error').length ? `<h3>Script errors</h3>${barTable(rows(t, 'js_error'), { head: ['Message', 'Times'], limit: 5 })}` : ''))}
    ${card('Page speed', 'How quickly each page showed its main content.', speedRows + (netRows.length ? `<h3>By connection</h3>${barTable(netRows, { head: ['Connection', 'Loads'] })}` : ''))}
  </div>

  ${card('Make a campaign link', 'For WhatsApp groups, Instagram, flyers or QR codes: see which ones bring people.', linkMaker, { id: 'links', wide: true })}

  <div class="grid">
    ${card('This browser', '', (excluded
      ? `<p>This browser <b>is not counted</b> in the numbers.</p><a class="btn ghost" href="/admin/exclude?on=0&amp;days=${range.days}">Count it again</a>`
      : `<p>This browser <b>is counted</b> like any visitor.</p><a class="btn" href="/admin/exclude?on=1&amp;days=${range.days}">Don't count this browser</a>`)
      + '<p class="note">Do this once on each phone and computer you use to look at the site.</p>', { id: 'counting' })}
    ${card('Downloads', '', `<p><a class="btn ghost" href="/admin/daily.csv">Daily numbers (CSV)</a></p>
      <p class="note">One row a day since the first visit: visitors, page views, fares shown, waitlist signups, Buddy applications.
      Detailed visit records are kept 13 months; the daily numbers are kept for good.</p>
      <p class="note">To delete a list entry: Cloudflare → Storage &amp; databases → D1 → <b>ridebuddy</b> → Console, then
      <code>DELETE FROM waitlist WHERE id = 17;</code> (or <code>buddies</code>), using the ID column of the download.</p>`)}
  </div>`;
}

const sum = (r) => Object.values(r).reduce((a, b) => a + b, 0);

/** The page around the content: styles (chart roles as custom properties) and the small script. */
export function shell(body, nonce) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>RideBuddy admin</title><style>
  :root {
    color-scheme: light;
    --page: #F5F0E8; --surface: #FFFFFF; --ink: #1E1E1A; --ink-2: #6B675F; --ink-3: #8A857B;
    --hair: #ECE7DE; --series: #4A5C2F; --series-hover: #384522; --track: #EDF0E8;
    --good: #2E7D32; --bad: #C62828;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--ink); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 1040px; margin: 0 auto; padding: 28px 16px 64px; }
  h1 { font-size: 26px; letter-spacing: -.02em; margin: 0; }
  h2 { font-size: 17px; margin: 0; }
  h3 { font-size: 14px; margin: 18px 0 6px; color: var(--ink); }
  a { color: var(--series); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .top { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; margin-bottom: 18px; }
  .range { display: flex; gap: 6px; flex-wrap: wrap; }
  .range a { padding: 7px 14px; border-radius: 999px; background: var(--surface); color: var(--ink); text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 1px 2px rgba(30,30,26,.06); }
  .range a[aria-current] { background: var(--series); color: #F5F0E8; }
  .span { margin: 0; color: var(--ink-2); font-size: 14px; width: 100%; }
  .card { background: var(--surface); border-radius: 16px; padding: 20px; margin: 0 0 16px; box-shadow: 0 1px 3px rgba(30,30,26,.07); min-width: 0; }
  .sub { color: var(--ink-2); font-size: 14px; margin: 2px 0 12px; }
  .note { color: var(--ink-2); font-size: 13px; margin: 10px 0 0; }
  .under-kpis { margin: -6px 0 16px; }
  .notice { background: #FFF6E5; color: var(--ink); border-radius: 12px; padding: 10px 14px; margin: 0 0 16px; font-size: 14px; }
  .empty { color: var(--ink-3); font-size: 14px; margin: 8px 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 0 16px; }
  .grid.inner { gap: 0 24px; }
  .grid > .card { margin-bottom: 16px; }
  .lists { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 12px; }
  .list { border: 1px solid var(--hair); border-radius: 12px; padding: 14px; }
  .list h3 { margin: 0 0 4px; font-size: 15px; }
  .n { margin: 0; font-weight: 600; }
  .meta { color: var(--ink-2); font-size: 13px; margin: 2px 0 0; }
  .btn { display: inline-block; margin-top: 12px; background: var(--series); color: #F5F0E8; text-decoration: none; font: inherit; font-weight: 600; padding: 9px 16px; border-radius: 10px; border: 0; cursor: pointer; }
  .btn:hover { background: var(--series-hover); }
  .btn.ghost { background: transparent; color: var(--series); box-shadow: inset 0 0 0 1.5px var(--series); }
  code { background: #EFEAE1; padding: 1px 5px; border-radius: 5px; font-size: 12.5px; }
  /* Stat tiles */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
  .tile { background: var(--surface); border-radius: 16px; padding: 16px 18px; box-shadow: 0 1px 3px rgba(30,30,26,.07); }
  .tile__label { color: var(--ink-2); font-size: 13px; }
  .tile__value { font-size: 30px; font-weight: 650; letter-spacing: -.02em; margin-top: 2px; }
  .tile__delta { color: var(--ink-3); font-size: 12.5px; margin-top: 2px; }
  .tile__delta .up { color: var(--good); font-weight: 600; } .tile__delta .down { color: var(--bad); font-weight: 600; } .tile__delta .flat { color: var(--ink-2); font-weight: 600; }
  /* Tables with thin bars */
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .bars th, .bars td, .plain th, .plain td { padding: 6px 0; border-bottom: 1px solid var(--hair); text-align: left; vertical-align: middle; font-weight: 400; }
  thead th { color: var(--ink-2); font-size: 12.5px; font-weight: 500 !important; }
  .bars th[scope="row"] { padding-right: 10px; overflow-wrap: break-word; }
  .num { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap; padding-right: 10px !important; }
  .meter { width: 34%; }
  .meter span { display: block; height: 8px; border-radius: 0 4px 4px 0; background: var(--series); }
  .bars tbody tr td.meter { background: linear-gradient(var(--track), var(--track)) left center / 100% 8px no-repeat; }
  .funnel .kept { display: block; color: var(--ink-2); font-size: 12.5px; }
  .where { color: var(--ink-3); font-size: 12.5px; }
  /* Visitors per day */
  .chart { margin: 8px 0 0; position: relative; }
  .plot { position: relative; height: 190px; margin-left: 34px; }
  .gridline { position: absolute; left: 0; right: 0; border-top: 1px solid var(--hair); }
  .gridline span { position: absolute; right: calc(100% + 6px); top: -8px; font-size: 11.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; }
  .cols { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(var(--n), 1fr); gap: 2px; align-items: end; }
  .cols.dense { gap: 1px; }
  .col { height: 100%; display: flex; align-items: flex-end; justify-content: center; cursor: default; outline: none; border-radius: 4px; }
  .col:focus-visible { box-shadow: 0 0 0 2px var(--series); }
  .bar { display: block; width: min(24px, 100%); background: var(--series); border-radius: 4px 4px 0 0; }
  .col:hover .bar, .col:focus-visible .bar { background: var(--series-hover); }
  .xlabels { display: grid; grid-template-columns: repeat(var(--n), 1fr); margin: 6px 0 0 34px; font-size: 11.5px; color: var(--ink-3); }
  .xlabels span { white-space: nowrap; justify-self: center; }
  .xlabels span:first-child { justify-self: start; }
  .xlabels span:last-child { justify-self: end; }
  @media (max-width: 560px) { .xlabels .mid { display: none; } }
  .tip { position: absolute; top: -6px; transform: translate(-50%, -100%); background: var(--ink); color: #F5F0E8; padding: 8px 10px; border-radius: 8px; font-size: 13px; pointer-events: none; white-space: nowrap; }
  .tip strong { font-size: 15px; }
  .tip .day { color: #CFCAC0; font-size: 12px; }
  .twin summary { cursor: pointer; color: var(--ink-2); font-size: 13px; margin-top: 12px; }
  /* Campaign links */
  .linkmaker { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; align-items: end; }
  .linkmaker label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--ink-2); }
  .linkmaker .opt { color: var(--ink-3); font-size: 12px; }
  .linkmaker input, .linkmaker select, .made input { font: inherit; color: var(--ink); padding: 9px 10px; border-radius: 10px; border: 1px solid #DAD4C8; background: #FBF9F5; min-width: 0; }
  .linkmaker .btn { margin: 0; }
  .made { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 14px; }
  .made input { flex: 1 1 280px; }
  .made .btn { margin: 0; }
</style></head><body><main>${body}</main>
<script nonce="${nonce}">
(() => {
  const fig = document.getElementById('daily');
  if (fig) {
    const tip = fig.querySelector('.tip');
    const show = (col) => {
      const [day, visitors, views] = col.dataset.tip.split('|');
      const line = (text, tag, cls) => { const el = document.createElement(tag); el.textContent = text; if (cls) el.className = cls; return el; };
      tip.replaceChildren(line(visitors, 'strong'), line(views, 'div'), line(day, 'div', 'day'));
      tip.hidden = false;
      const f = fig.getBoundingClientRect(); const c = col.getBoundingClientRect();
      const x = Math.max(tip.offsetWidth / 2, Math.min(f.width - tip.offsetWidth / 2, c.left - f.left + c.width / 2));
      tip.style.left = x + 'px';
    };
    fig.querySelectorAll('.col').forEach((c) => { c.addEventListener('pointerenter', () => show(c)); c.addEventListener('focus', () => show(c)); });
    fig.addEventListener('pointerleave', () => { tip.hidden = true; });
    fig.addEventListener('focusout', (e) => { if (!fig.contains(e.relatedTarget)) tip.hidden = true; });
  }
  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const field = document.getElementById(b.dataset.copy);
    try { await navigator.clipboard.writeText(field.value); b.textContent = 'Copied'; } catch (e) { field.select(); }
    setTimeout(() => { b.textContent = 'Copy'; }, 1600);
  }));
})();
</script></body></html>`;
}
