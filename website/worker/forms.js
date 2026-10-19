/**
 * The site's forms: the client waitlist (every page's "Join the Waitlist", the
 * Contact page, /estimate/), the thumbs on fares shown at /estimate/, and
 * "Apply to be a Buddy" for individual Buddies and driver agencies. Validated
 * here, stored in D1, downloaded from /admin.
 */
import { addHit, networkHash, ready } from './db.js';
import { json, sameOrigin } from './http.js';
import {
  AGENCY_ERROR, CITY_ERROR, CONSENT_ERROR, CONTACT_ERROR, EMAIL_ERROR, GSTIN_ERROR, LICENCE_ERROR, NAME_ERROR,
  cleanComment, cleanText, describeTrip, isEmail, isGstin, normalizePhone, tripFare,
} from './lib.js';

/** Where a waitlist signup was made: the page the visitor was on. */
export const SOURCES = { home: 'Home page', how: 'How It Works page', about: 'About page', contact: 'Contact page', estimate: 'Estimate page' };

/** What a driver agency can tick for "Drivers you can supply". */
export const DRIVERS = ['1–5', '6–20', '21–50', '50+'];

// Per network per rolling hour. High enough that people sharing a mobile
// carrier's address never meet it; low enough that one machine can't flood.
const FORM_CAP = 20;
// Votes are one tap and can be changed, so they get their own, larger allowance.
const VOTE_CAP = 60;

/** The id /estimate/ gives each fare it shows; it ties a vote to a signup. */
const ESTIMATE_ID = /^est_[a-z0-9]{8,40}$/;

const TOO_MANY = 'Too many tries from your network. Please try again later.';
const BAD = () => json(400, { ok: false, error: 'Bad request.' });

/** @param {'waitlist' | 'feedback' | 'buddy'} kind */
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
  try { body = JSON.parse(raw); } catch { return BAD(); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return BAD();

  const db = env.DB;
  const salt = await ready(db);
  const network = await networkHash(request, salt);
  const [bucket, cap] = kind === 'feedback' ? [`vote:${network}`, VOTE_CAP] : [`form:${network}`, FORM_CAP];
  if (await addHit(db, bucket) > cap) return json(429, { ok: false, error: TOO_MANY });

  // The field people never see was filled in: a bot. Thank it and keep nothing.
  if (typeof body.website === 'string' && body.website.trim()) return json(200, { ok: true });

  const now = new Date().toISOString();
  if (kind === 'waitlist') return waitlist(db, body, now);
  if (kind === 'feedback') return feedback(db, body, now);
  return buddy(db, body, now);
}

async function waitlist(db, body, now) {
  if (!Object.hasOwn(SOURCES, body.source)) return BAD();
  const phone = normalizePhone(body.phone);
  const errors = {};
  if (!phone.ok) errors.phone = phone.error;
  // Every form now has the consent tick and sends `consent`. A page cached from
  // before the tick sends nothing; its signup is kept, with consent left blank.
  if (Object.hasOwn(body, 'consent') && body.consent !== true) errors.consent = CONSENT_ERROR;
  if (Object.keys(errors).length) return invalid(errors);
  const consent = body.consent === true ? 1 : null;

  if (body.source !== 'estimate') {
    await db.prepare('INSERT INTO waitlist (created_at, phone, source, consent) VALUES (?, ?, ?, ?)')
      .bind(now, phone.phone, body.source, consent).run();
    return json(200, { ok: true });
  }

  const trip = describeTrip(body.trip);
  const fare = tripFare(body.trip);
  const est = typeof body.estimate_id === 'string' && ESTIMATE_ID.test(body.estimate_id) ? body.estimate_id : null;
  if (est) {
    // The visitor voted on this fare first: that row becomes the signup, so the
    // vote and the number sit on one line of the download.
    const r = await db.prepare(`UPDATE waitlist SET created_at = ?1, updated_at = ?1, phone = ?2, consent = ?3,
        trip = COALESCE(?4, trip), fare = COALESCE(?5, fare)
      WHERE id = (SELECT id FROM waitlist WHERE estimate_id = ?6 AND phone = '' ORDER BY id LIMIT 1)`)
      .bind(now, phone.phone, consent, trip, fare, est).run();
    if (r.meta.changes) return json(200, { ok: true });
  }
  // A new row; a second number joining from the same fare carries its vote too.
  await db.prepare(`INSERT INTO waitlist (created_at, phone, source, trip, fare, consent, estimate_id, vote, comment)
    VALUES (?1, ?2, 'estimate', ?3, ?4, ?5, ?6,
      (SELECT vote FROM waitlist WHERE estimate_id = ?6 ORDER BY id DESC LIMIT 1),
      (SELECT comment FROM waitlist WHERE estimate_id = ?6 ORDER BY id DESC LIMIT 1))`)
    .bind(now, phone.phone, trip, fare, consent, est).run();
  return json(200, { ok: true });
}

/**
 * 👍 or 👎 on a fare, and the comment that may follow a 👎. One row per fare
 * shown: the latest vote wins, and a comment stays when the vote changes.
 */
async function feedback(db, body, now) {
  const est = typeof body.estimate_id === 'string' && ESTIMATE_ID.test(body.estimate_id) ? body.estimate_id : null;
  if (!est || !['up', 'down'].includes(body.vote)) return BAD();
  let comment = null;
  if (body.comment != null && body.comment !== '') {
    const c = cleanComment(body.comment);
    if (!c.ok) return invalid({ comment: c.error });
    comment = c.text || null;
  }
  // One transaction: update the fare's row(s) if there are any, else add one.
  await db.batch([
    db.prepare('UPDATE waitlist SET vote = ?1, comment = COALESCE(?2, comment), updated_at = ?3 WHERE estimate_id = ?4')
      .bind(body.vote, comment, now, est),
    db.prepare(`INSERT INTO waitlist (created_at, updated_at, phone, source, trip, fare, vote, comment, estimate_id)
      SELECT ?1, ?1, '', 'estimate', ?2, ?3, ?4, ?5, ?6 WHERE NOT EXISTS (SELECT 1 FROM waitlist WHERE estimate_id = ?6)`)
      .bind(now, describeTrip(body.trip), tripFare(body.trip), body.vote, comment, est),
  ]);
  return json(200, { ok: true });
}

async function buddy(db, body, now) {
  const phone = normalizePhone(body.phone);
  const city = cleanText(body.city, 60);
  const errors = {};
  if (body.type === 'agency') {
    const agency = cleanText(body.agency, 100);
    const contact = cleanText(body.contact, 100);
    const email = cleanText(body.email, 120).toLowerCase();
    const gstin = cleanText(body.gstin, 30).toUpperCase().replace(/\s+/g, '');
    if (!agency) errors.agency = AGENCY_ERROR;
    if (!contact) errors.contact = CONTACT_ERROR;
    if (!phone.ok) errors.phone = phone.error;
    if (!city) errors.city = CITY_ERROR;
    if (email && !isEmail(email)) errors.email = EMAIL_ERROR;
    if (gstin && !isGstin(gstin)) errors.gstin = GSTIN_ERROR;
    if (Object.keys(errors).length) return invalid(errors);
    const drivers = DRIVERS.includes(body.drivers) ? body.drivers : null;
    await db.prepare('INSERT INTO agencies (created_at, agency, contact, phone, city, drivers, email, gstin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(now, agency, contact, phone.phone, city, drivers, email || null, gstin || null).run();
    return json(200, { ok: true });
  }
  const name = cleanText(body.name, 100);
  const licence = cleanText(body.licence, 40);
  if (!name) errors.name = NAME_ERROR;
  if (!phone.ok) errors.phone = phone.error;
  if (!licence) errors.licence = LICENCE_ERROR;
  // A page cached from before the city field sends no `type`; keep its application.
  if (!city && body.type !== undefined) errors.city = CITY_ERROR;
  if (Object.keys(errors).length) return invalid(errors);
  await db.prepare('INSERT INTO buddies (created_at, name, phone, licence, city) VALUES (?, ?, ?, ?, ?)')
    .bind(now, name, phone.phone, licence, city || null).run();
  return json(200, { ok: true });
}

/** Field errors, keyed by field; `error` repeats the first for callers that show one line. */
const invalid = (errors) => json(400, { ok: false, error: Object.values(errors)[0], errors });
