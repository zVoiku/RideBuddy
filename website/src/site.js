/**
 * ridebuddy.co.in — the site's own analytics. build.mjs adds this to every page.
 *
 * Page views, clicks and the pages' named moments (the `dataLayer` events the
 * pages already push) go to /api/e on this same site, where the Worker counts
 * them into D1 for /admin. No cookies and no third party. Nothing anyone types
 * is sent: a click is recorded by the button's or link's own label, never a
 * form's contents, and places only by their area. The Worker keeps no IP
 * address. See website/README.md, "Analytics".
 */
(() => {
  // Automated browsers say so; they are not visitors. (test/verify.mjs opts in.)
  if (navigator.webdriver && !window.__rbCountAutomation) return;

  const ENDPOINT = '/api/e';
  const MAX_EVENTS = 300; // per page load: a runaway loop must not flood the counts
  const queue = [];
  let sent = 0;
  let timer = 0;

  /** The page a visitor is on. /beta/'s pages differ only by their #hash. */
  const page = () => location.pathname + (/^#[a-z0-9-]{1,32}$/i.test(location.hash) ? location.hash : '');
  const firstPage = page();
  const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

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
    const ev = { n: 'pageview', p };
    if (!landed) {
      // Where this visit came from, once per page load (f: this page load's
      // first view). Our own pages count as internal, www or not; campaign
      // links carry utm_* parameters.
      landed = true;
      ev.f = 1;
      try {
        if (document.referrer) {
          const from = new URL(document.referrer).host;
          const own = (h) => h.replace(/^www\./, '');
          ev.r = own(from) === own(location.host) ? '(internal)' : from;
        }
      } catch (e) { /* unparseable referrer: treat as direct */ }
      const q = new URLSearchParams(location.search);
      const u = {};
      for (const k of ['source', 'medium', 'campaign']) {
        const v = clean(q.get(`utm_${k}`), 60);
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
