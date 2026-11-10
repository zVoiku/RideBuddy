/**
 * ridebuddy.co.in — the site's own analytics. build.mjs adds this to every page.
 *
 * Page views, clicks and the pages' named moments (the `dataLayer` events the
 * pages already push) go to /api/e on this same site, where the Worker counts
 * them into D1 for /admin. No third party. Nothing anyone types is sent: a
 * click is recorded by the button's or link's own label, never a form's
 * contents, and places only by their area. The Worker keeps no IP address.
 *
 * Attribution: first-party cookies the Worker reads with every beacon and
 * every form (worker/lib.js attribution()) — `visitor_id` (12 months), the
 * first touch `rb_ft` (all five utm_* values, the referring site, the landing
 * page), the session `rb_sid` (until 30 minutes pass with nothing sent: PRD
 * 10.2's session_id) and `rb_internal`, set by ?internal=1 so the team's own
 * visits stay out of the counts. Campaign parameters ride along on internal
 * links, and a notice says the site uses cookies, with the Privacy Policy.
 * See website/README.md, "Analytics".
 */
(() => {
  const YEAR = 365 * 86400;
  const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const params = new URLSearchParams(location.search);
  const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const own = (h) => h.replace(/^www\./, '');
  /** The page a visitor is on. A #hash names a part of it (/contact/#apply). */
  const page = () => location.pathname + (/^#[a-z0-9-]{1,32}$/i.test(location.hash) ? location.hash : '');

  const getCookie = (k) => { const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${k}=([^;]*)`)); return m ? m[1] : ''; };
  const setCookie = (k, v, maxAge = YEAR) => {
    document.cookie = `${k}=${v}; Path=/; Max-Age=${maxAge}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  };
  const randomId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24);

  /** The session goes on while something is sent at least every 30 minutes; each call restarts the 30. */
  const SESSION = 30 * 60;
  function touchSession() {
    try {
      const sid = getCookie('rb_sid');
      setCookie('rb_sid', /^[a-z0-9]{8,40}$/.test(sid) ? sid : randomId(), SESSION);
    } catch (e) { /* cookies blocked: events go without a session */ }
  }

  // ----- Attribution cookies ------------------------------------------------------------

  try {
    if (!/^[a-z0-9]{12,40}$/.test(getCookie('visitor_id'))) setCookie('visitor_id', randomId());
    touchSession();
    // The first touch is kept as it was: later visits don't overwrite it.
    if (!getCookie('rb_ft')) {
      const ft = {};
      for (const k of UTM) { const v = clean(params.get(k), 100); if (v) ft[k] = v; }
      try {
        const from = document.referrer && new URL(document.referrer).host;
        if (from && own(from) !== own(location.host)) ft.referrer = from;
      } catch (e) { /* unparseable referrer: none */ }
      ft.landing_page = clean(page(), 200);
      setCookie('rb_ft', encodeURIComponent(JSON.stringify(ft)));
    }
    if (params.get('internal') === '1') setCookie('rb_internal', '1');
    if (params.get('internal') === '0') setCookie('rb_internal', '', 0);
  } catch (e) { /* cookies blocked: the forms still save, unattributed */ }

  // Campaign parameters (and ?internal) ride along to the site's other pages:
  // on every same-site link as it is clicked, and through rbCarry() for the
  // pages' scripted navigation (the header's "Get an Estimate", /beta's links).
  const CARRY = [...UTM, 'internal'];
  function carry(url) {
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin) return url;
      let changed = false;
      for (const k of CARRY) {
        const v = params.get(k);
        if (v && !u.searchParams.has(k)) { u.searchParams.set(k, v); changed = true; }
      }
      return changed ? u.pathname + u.search + u.hash : url;
    } catch (e) {
      return url;
    }
  }
  window.rbCarry = carry;
  addEventListener('click', (e) => {
    const a = e.target instanceof Element && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self')) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || /^[a-z]+:/i.test(href) && !/^https?:/i.test(href)) return;
    const next = carry(href);
    if (next !== href) a.setAttribute('href', next);
  }, true);

  // ----- Cookie notice --------------------------------------------------------------------

  // Placeholder wording until Product supplies CL-01; the Privacy Policy says the rest (PRD A5).
  const NOTICE = 'RideBuddy uses cookies to remember how you found us and to count visits. Nothing is shared with advertisers.';
  if (!getCookie('rb_cookie_ok')) {
    const bar = document.createElement('div');
    bar.id = 'rb-cookie';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Cookie notice');
    bar.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:65;max-width:560px;margin:0 auto;display:flex;gap:16px;align-items:center;'
      + 'padding:12px 12px 12px 18px;border-radius:12px;background:#1E1E1A;color:#F5F0E8;box-shadow:0 8px 24px rgba(30,30,26,.22);'
      + 'font:14px/1.5 "DM Sans",system-ui,-apple-system,sans-serif';
    const text = document.createElement('p');
    text.style.cssText = 'margin:0;flex:1 1 auto';
    text.textContent = `${NOTICE} `;
    const policy = document.createElement('a');
    policy.href = '/privacy/';
    policy.target = '_blank';
    policy.rel = 'noopener';
    policy.textContent = 'Privacy Policy';
    policy.style.cssText = 'color:#F5F0E8;text-decoration:underline;text-underline-offset:2px';
    text.append(policy);
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.textContent = 'OK';
    ok.style.cssText = 'flex:0 0 auto;min-width:64px;min-height:44px;padding:0 18px;border:none;border-radius:12px;cursor:pointer;'
      + 'background:#F5F0E8;color:#1E1E1A;font:500 15px "DM Sans",system-ui,-apple-system,sans-serif';
    ok.addEventListener('click', () => { setCookie('rb_cookie_ok', '1'); bar.remove(); });
    bar.append(text, ok);
    const show = () => document.body.appendChild(bar);
    if (document.body) show(); else addEventListener('DOMContentLoaded', show);
  }

  // ----- Analytics --------------------------------------------------------------------------

  // Automated browsers say so; they are not visitors. (test/verify.mjs opts in.)
  if (navigator.webdriver && !window.__rbCountAutomation) return;

  const ENDPOINT = '/api/e';
  const MAX_EVENTS = 300; // per page load: a runaway loop must not flood the counts
  const queue = [];
  let sent = 0;
  let timer = 0;

  const firstPage = page();

  function flush(leaving) {
    clearTimeout(timer);
    timer = 0;
    while (queue.length) {
      const body = JSON.stringify({ e: queue.splice(0, 25) });
      try {
        // sendBeacon survives the page closing; a string body goes as text/plain.
        if (leaving && navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) continue;
        fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
      } catch (e) { /* analytics never breaks the page */ }
    }
  }

  function send(ev) {
    if (sent >= MAX_EVENTS) return;
    sent += 1;
    touchSession();
    queue.push(Object.assign({ p: page() }, ev));
    if (!timer) timer = setTimeout(flush, 1500);
  }

  // ----- Page views, including /beta/'s in-page pages ------------------------------

  let lastPage = '';
  let landed = false;

  function view() {
    const p = page();
    if (p === lastPage) return;
    lastPage = p;
    const ev = { n: 'page_view', p };
    if (!landed) {
      // Where this visit came from, once per page load (f: this page load's
      // first view). Our own pages count as internal, www or not; campaign
      // links carry utm_* parameters.
      landed = true;
      ev.f = 1;
      try {
        if (document.referrer) {
          const from = new URL(document.referrer).host;
          ev.r = own(from) === own(location.host) ? '(internal)' : from;
        }
      } catch (e) { /* unparseable referrer: treat as direct */ }
      const u = {};
      for (const k of ['source', 'medium', 'campaign']) {
        const v = clean(params.get(`utm_${k}`), 60);
        if (v) u[k] = v;
      }
      if (Object.keys(u).length) ev.u = u;
    }
    send(ev);
  }

  const pushState = history.pushState;
  history.pushState = function () {
    const out = pushState.apply(this, arguments);
    setTimeout(view, 0);
    return out;
  };
  addEventListener('popstate', () => setTimeout(view, 0));
  // Back to a page kept in the browser's memory is a new view of it.
  addEventListener('pageshow', (e) => { if (e.persisted) { lastPage = ''; view(); } });

  // ----- Clicks on links and buttons, by their own label -----------------------------

  /** Header, footer, or the section the page names (data-screen-label / data-rb-region). */
  function region(el) {
    if (el.closest('header')) return 'header';
    if (el.closest('footer')) return 'footer';
    const s = el.closest('[data-screen-label], [data-rb-region]');
    return s ? clean(s.getAttribute('data-rb-region') || s.getAttribute('data-screen-label'), 40) : '';
  }

  function target(a) {
    const href = a.getAttribute('href') || '';
    const scheme = href.match(/^(mailto|tel|sms|whatsapp):/i);
    if (scheme) return scheme[1].toLowerCase(); // never the address itself
    try {
      const u = new URL(href, location.href);
      return u.host === location.host ? u.pathname + u.hash : u.host;
    } catch (e) {
      return '';
    }
  }

  addEventListener('click', (e) => {
    const el = e.target instanceof Element && e.target.closest('a[href], button, [role="button"], summary');
    if (!el) return;
    // Lists built from what the visitor typed (place suggestions) are counted
    // by kind only, never by their text.
    const privateList = el.closest('[data-rb-private]');
    const label = privateList
      ? privateList.getAttribute('data-rb-private') || 'private'
      : clean(el.getAttribute('data-rb-label') || el.getAttribute('aria-label') || el.textContent, 60) || el.tagName.toLowerCase();
    const ev = { n: 'click', l: label, w: region(el) };
    if (el.tagName === 'A') ev.h = target(el);
    send(ev);
  }, true);

  // ----- The pages' named moments ---------------------------------------------------

  // Both pages already push { event, ...details } to window.dataLayer (the
  // Google Tag Manager convention); forward each one, including those pushed
  // before this script ran.
  function forward(item) {
    if (!item || typeof item.event !== 'string' || item.event.startsWith('gtm.')) return;
    const d = Object.assign({}, item);
    delete d.event;
    send({ n: item.event, d });
  }
  const dl = (window.dataLayer = window.dataLayer || []);
  dl.forEach(forward);
  const dlPush = dl.push;
  dl.push = function () {
    for (let i = 0; i < arguments.length; i += 1) forward(arguments[i]);
    return dlPush.apply(this, arguments);
  };

  // ----- Speed and errors -----------------------------------------------------------

  let lcp = 0;
  try {
    new PerformanceObserver((list) => {
      const last = list.getEntries().pop();
      if (last) lcp = last.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) { /* not supported (Safari): the load time stands in */ }

  let perfSent = false;
  function sendPerf() {
    if (perfSent) return;
    perfSent = true;
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    const d = {};
    if (lcp) d.lcp = Math.round(lcp);
    if (nav && nav.loadEventEnd > 0) d.load = Math.round(nav.loadEventEnd);
    if (nav && nav.responseStart > 0) d.ttfb = Math.round(nav.responseStart);
    const net = navigator.connection && navigator.connection.effectiveType;
    if (net) d.net = net;
    if (d.lcp || d.load) send({ n: 'perf', p: firstPage, d });
  }

  let errors = 0;
  function oops(message) {
    errors += 1;
    if (errors <= 5) send({ n: 'js_error', l: clean(message || 'error', 120) });
  }
  addEventListener('error', (e) => { if (e instanceof ErrorEvent) oops(e.message); });
  addEventListener('unhandledrejection', (e) => oops(e.reason && (e.reason.message || e.reason)));

  // ----- Leaving: send what is queued -----------------------------------------------

  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { sendPerf(); flush(true); }
  });
  addEventListener('pagehide', () => { sendPerf(); flush(true); });

  view();
})();
