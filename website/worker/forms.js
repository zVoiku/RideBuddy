/**
 * The site's two forms: the client waitlist (Contact page, /estimate/) and
 * "Apply to be a Buddy". Validated here, stored in D1, downloaded from /admin.
 */
import { addHit, networkHash, ready } from './db.js';
import { json, sameOrigin } from './http.js';
import { LICENCE_ERROR, NAME_ERROR, cleanText, describeTrip, normalizePhone } from './lib.js';

export const SOURCES = { contact: 'Contact page', estimate: 'Estimate page' };

// Per network per rolling hour. High enough that people sharing a mobile
// carrier's address never meet it; low enough that one machine can't flood.
const FORM_CAP = 20;

const TOO_MANY = 'Too many tries from your network. Please try again later.';

export async function handleForm(request, env, kind) {
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
