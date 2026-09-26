/**
 * ridebuddy.co.in — the Worker behind the static site.
 *
 * Cloudflare serves website/dist first; only requests no file matches reach
 * this code:
 *
 *   POST /api/waitlist   client waitlist (Contact page, /estimate/)  forms.js
 *   POST /api/buddy      "Apply to be a Buddy"                       forms.js
 *   POST /api/e          the site's own analytics (src/site.js)      analytics.js
 *   GET  /admin …        lists, analytics, downloads, behind a password  admin.js
 *
 * Nothing is emailed: the lists and the analytics live in D1 (binding DB).
 * The tables create themselves on first use. See website/README.md.
 */
import { handleAdmin } from './admin.js';
import { ingest } from './analytics.js';
import { handleForm } from './forms.js';
import { json, plain } from './http.js';

const SAVE_FAILED = 'We couldn’t save that just now. Please try again.';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/api/waitlist') return await handleForm(request, env, 'waitlist');
      if (path === '/api/buddy') return await handleForm(request, env, 'buddy');
      if (path === '/api/e') return await ingest(request, env, ctx);
      if (path.startsWith('/api/')) return json(404, { ok: false, error: 'Not found.' });
      if (path === '/admin' || path.startsWith('/admin/')) return await handleAdmin(request, env, url, path);
    } catch (e) {
      console.error('worker error', e?.stack || e);
      return path.startsWith('/api/') ? json(500, { ok: false, error: SAVE_FAILED }) : plain(500, 'Something went wrong.');
    }
    return env.ASSETS.fetch(request);
  },
};
