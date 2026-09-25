/**
 * ridebuddy.co.in — the Worker behind the static site.
 *
 * Cloudflare serves website/dist first; only requests no file matches reach
 * this code:
 *
 *   POST /api/waitlist      client waitlist (Contact page, /estimate/) -> D1 `waitlist`
 *   POST /api/buddy         "Apply to be a Buddy"                       -> D1 `buddies`
 *   GET  /admin             entry counts and the downloads, behind ADMIN_PASSWORD
 *   GET  /admin/clients.csv
 *   GET  /admin/buddies.csv
 *
 * Nothing is emailed: the lists live in D1 (binding DB) and leave as CSV.
 * The tables create themselves on first use, so a fresh database needs no
 * setup step. See website/README.md.
 */
import {
  LICENCE_ERROR, NAME_ERROR, cleanText, describeTrip, escapeHtml, istDay, istStamp, networkOf, normalizePhone, toCsv,
} from './lib.js';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS waitlist (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     created_at TEXT NOT NULL,
     phone TEXT NOT NULL,
     source TEXT NOT NULL,
     trip TEXT
   )`,
  'CREATE INDEX IF NOT EXISTS waitlist_phone ON waitlist (phone, id)',
  `CREATE TABLE IF NOT EXISTS buddies (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     created_at TEXT NOT NULL,
     name TEXT NOT NULL,
     phone TEXT NOT NULL,
     licence TEXT NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS buddies_phone ON buddies (phone, id)',
  // Recent submissions per network, for the flood cap. Rows older than an hour
  // are deleted as new ones arrive; the network is stored only as a salted hash.
  'CREATE TABLE IF NOT EXISTS hits (bucket TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS hits_bucket ON hits (bucket, at)',
  'CREATE INDEX IF NOT EXISTS hits_at ON hits (at)',
  'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)',
];

const SOURCES = { contact: 'Contact page', estimate: 'Estimate page' };

// Per network per rolling hour. High enough that people sharing a mobile
// carrier's address never meet it; low enough that one machine can't flood.
const FORM_CAP = 20;
const ADMIN_FAILURE_CAP = 10;

const SAVE_FAILED = 'We couldn’t save that just now. Please try again.';
const TOO_MANY = 'Too many tries from your network. Please try again later.';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/api/waitlist') return await handleForm(request, env, 'waitlist');
      if (path === '/api/buddy') return await handleForm(request, env, 'buddy');
      if (path.startsWith('/api/')) return json(404, { ok: false, error: 'Not found.' });
      if (path === '/admin' || path.startsWith('/admin/')) return await handleAdmin(request, env, url, path);
    } catch (e) {
      console.error('worker error', e?.stack || e);
      return path.startsWith('/api/') ? json(500, { ok: false, error: SAVE_FAILED }) : plain(500, 'Something went wrong.');
    }
    return env.ASSETS.fetch(request);
  },
};

// ----- Forms ------------------------------------------------------------------------

async function handleForm(request, env, kind) {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: 'POST' });
  // The forms post to their own origin. This stops other sites' pages from
  // submitting on a visitor's behalf; it is not bot protection by itself.
  if (!sameOrigin(request)) return json(403, { ok: false, error: 'Forbidden.' });
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return json(415, { ok: false, error: 'Expected JSON.' });
  }
  // The forms send a few hundred bytes. Refuse big bodies before reading them.
  if (Number(request.headers.get('content-length')) > 4096) return json(413, { ok: false, error: 'Too large.' });
  const raw = await request.text();
  if (raw.length > 4096) return json(413, { ok: false, error: 'Too large.' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: 'Bad request.' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { ok: false, error: 'Bad request.' });

  const db = env.DB;
  const salt = await ready(db);
  const bucket = `form:${await networkHash(request, salt)}`;
  if (await addHit(db, bucket) > FORM_CAP) return json(429, { ok: false, error: TOO_MANY });

  // The field people never see was filled in: a bot. Thank it and keep nothing.
  if (typeof body.website === 'string' && body.website.trim()) return json(200, { ok: true });

  const now = new Date().toISOString();
  if (kind === 'waitlist') {
    if (!Object.hasOwn(SOURCES, body.source)) return json(400, { ok: false, error: 'Bad request.' });
    const phone = normalizePhone(body.phone);
    if (!phone.ok) return invalid({ phone: phone.error });
    const trip = body.source === 'estimate' ? describeTrip(body.trip) : null;
    await db.prepare('INSERT INTO waitlist (created_at, phone, source, trip) VALUES (?, ?, ?, ?)')
      .bind(now, phone.phone, body.source, trip).run();
  } else {
    const name = cleanText(body.name, 100);
    const licence = cleanText(body.licence, 40);
    const phone = normalizePhone(body.phone);
    const errors = {};
    if (!name) errors.name = NAME_ERROR;
    if (!phone.ok) errors.phone = phone.error;
    if (!licence) errors.licence = LICENCE_ERROR;
    if (Object.keys(errors).length) return invalid(errors);
    await db.prepare('INSERT INTO buddies (created_at, name, phone, licence) VALUES (?, ?, ?, ?)')
      .bind(now, name, phone.phone, licence).run();
  }
  return json(200, { ok: true });
}

/** Field errors, keyed by field; `error` repeats the first for callers that show one line. */
const invalid = (errors) => json(400, { ok: false, error: Object.values(errors)[0], errors });

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

// ----- D1 -------------------------------------------------------------------------------

let readyOnce = null;

/**
 * Creates the tables on first use (idempotent) and returns the salt used to
 * hash network addresses. Once per isolate; retried if it failed.
 */
function ready(db) {
  readyOnce ??= db.batch([
    ...SCHEMA.map((sql) => db.prepare(sql)),
    db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('salt', ?)").bind(crypto.randomUUID()),
    db.prepare("SELECT v FROM meta WHERE k = 'salt'"),
  ]).then((results) => results.at(-1).results[0].v)
    .catch((e) => { readyOnce = null; throw e; });
  return readyOnce;
}

async function networkHash(request, salt) {
  const net = networkOf(request.headers.get('cf-connecting-ip'));
  return (await sha256Hex(`${salt}|${net}`)).slice(0, 32);
}

/** Records one hit for `bucket` and returns how many it has had in the last hour. */
async function addHit(db, bucket) {
  const now = Math.floor(Date.now() / 1000);
  const results = await db.batch([
    db.prepare('DELETE FROM hits WHERE at < ?').bind(now - 3600),
    db.prepare('INSERT INTO hits (bucket, at) VALUES (?, ?)').bind(bucket, now),
    db.prepare('SELECT COUNT(*) AS n FROM hits WHERE bucket = ? AND at >= ?').bind(bucket, now - 3600),
  ]);
  return results[2].results[0].n;
}

async function countHits(db, bucket) {
  const now = Math.floor(Date.now() / 1000);
  return db.prepare('SELECT COUNT(*) AS n FROM hits WHERE bucket = ? AND at >= ?').bind(bucket, now - 3600).first('n');
}

// ----- Admin ----------------------------------------------------------------------------

const ADMIN_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

async function handleAdmin(request, env, url, path) {
  // Basic auth sends the password with every request: never over plain HTTP.
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    return Response.redirect(`https://${url.host}${url.pathname}${url.search}`, 301);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return plain(405, 'Method not allowed.', { Allow: 'GET' });
  // No password set means locked, never open: these lists hold phone and licence numbers.
  if (!env.ADMIN_PASSWORD) return page(503, LOCKED);

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

  if (path === '/admin') return page(200, await dashboard(db));
  if (path === '/admin/clients.csv') return download('clients', await clientsCsv(db));
  if (path === '/admin/buddies.csv') return download('buddies', await buddiesCsv(db));
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

async function dashboard(db) {
  const s = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM waitlist) AS clients,
      (SELECT COUNT(DISTINCT phone) FROM waitlist) AS client_phones,
      (SELECT MAX(created_at) FROM waitlist) AS client_last,
      (SELECT COUNT(*) FROM buddies) AS buddies,
      (SELECT COUNT(DISTINCT phone) FROM buddies) AS buddy_phones,
      (SELECT MAX(created_at) FROM buddies) AS buddy_last`).first();
  const card = (title, n, phones, last, file) => `
    <section>
      <h2>${title}</h2>
      <p class="n">${n} ${n === 1 ? 'entry' : 'entries'} · ${phones} ${phones === 1 ? 'number' : 'different numbers'}</p>
      <p class="meta">${last ? `Latest: ${escapeHtml(istStamp(last))} IST` : 'Nothing yet.'}</p>
      <a class="btn" href="/admin/${file}.csv">Download CSV</a>
    </section>`;
  return `
    <h1>RideBuddy lists</h1>
    ${card('Client waitlist', s.clients, s.client_phones, s.client_last, 'clients')}
    ${card('Buddy applications', s.buddies, s.buddy_phones, s.buddy_last, 'buddies')}
    <p class="note">Every submission is kept; a phone number already on the same list is marked “(repeat)”.
    To delete a row: Cloudflare → Storage &amp; databases → D1 → <b>ridebuddy</b> → Console, then
    <code>DELETE FROM waitlist WHERE id = 17;</code> (or <code>buddies</code>), using the ID column of the download.</p>`;
}

const LOCKED = `
    <h1>Admin is locked</h1>
    <p>Set a password to open it: Cloudflare → Workers &amp; Pages → <b>ridebuddy</b> → Settings → Variables and secrets →
    Add → type <b>Secret</b>, name <code>ADMIN_PASSWORD</code>. Then sign in here with username <b>admin</b>.</p>
    <p class="note">Waitlist signups and Buddy applications are being saved in the meantime.</p>`;

function page(status, body) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>RideBuddy admin</title><style>
  body{margin:0;background:#F5F0E8;color:#1E1E1A;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
  main{max-width:560px;margin:0 auto;padding:40px 16px}
  h1{font-size:28px;letter-spacing:-.02em;margin:0 0 24px}
  h2{font-size:18px;margin:0 0 4px}
  section{background:#fff;border-radius:16px;padding:20px;margin:0 0 16px;box-shadow:0 1px 3px rgba(30,30,26,.08)}
  .n{margin:0;font-weight:600}.meta,.note{color:#6B675F;font-size:14px;margin:4px 0 0}.note{margin-top:20px}
  .btn{display:inline-block;margin-top:14px;background:#4A5C2F;color:#F5F0E8;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:12px}
  code{background:#EBE5D9;padding:1px 5px;border-radius:5px;font-size:13px}
</style></head><body><main>${body}</main></body></html>`;
  return new Response(html, { status, headers: { ...ADMIN_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
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

// ----- Responses and hashing -----------------------------------------------------------

function json(status, data, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

function plain(status, text, extra = {}) {
  return new Response(text, { status, headers: { ...ADMIN_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...extra } });
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
