/**
 * Pure helpers for the site's Worker: validation, formatting, CSV. No
 * bindings and no I/O, so test/worker.mjs runs them unchanged under Node.
 */

export const PHONE_ERROR = 'Enter a 10-digit number. Outside India? Start with + and the country code.';
export const NAME_ERROR = 'Enter your full name.';
export const LICENCE_ERROR = 'Enter your licence number.';

/**
 * Control characters out, runs of whitespace collapsed, trimmed, and capped at
 * `max` characters (code points, so a name is never cut mid-character).
 */
export function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  const flat = value.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(flat).slice(0, max).join('').trim();
}

/**
 * Phone numbers, in whatever format they were typed.
 *
 * Indian numbers must come to exactly 10 digits once a +91, 91 or 0 prefix is
 * gone, and are stored as +91XXXXXXXXXX. A number that starts with + (or the
 * 00 international prefix) and a country code other than 91 is foreign: any
 * format is accepted and it is stored as + and its digits (E.164 allows 7-15).
 *
 * @returns {{ok: true, phone: string} | {ok: false, error: string}}
 */
export function normalizePhone(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw || raw.length > 40) return { ok: false, error: PHONE_ERROR };
  const digits = raw.replace(/\D/g, '');

  let intl = null;
  if (raw.startsWith('+')) intl = digits;
  else if (raw.startsWith('00')) intl = digits.slice(2);
  if (intl !== null && !intl.startsWith('91')) {
    return intl.length >= 7 && intl.length <= 15 ? { ok: true, phone: `+${intl}` } : { ok: false, error: PHONE_ERROR };
  }

  let national = intl !== null ? intl.slice(2) : digits;
  if (intl === null && national.length === 12 && national.startsWith('91')) national = national.slice(2);
  if (national.length === 11 && national.startsWith('0')) national = national.slice(1);
  return national.length === 10 ? { ok: true, phone: `+91${national}` } : { ok: false, error: PHONE_ERROR };
}

// ----- The trip behind an estimate-page signup ------------------------------------

const TRIP_LABEL = { round: 'Round trip', one: 'One way', hourly: 'Hourly' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoDate(v) {
  const m = typeof v === 'string' && v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? { y, mo, d } : null;
}

const day = (t) => `${t.d} ${MONTHS[t.mo - 1]}`;

/** 12–14 Oct, or 30 Oct – 1 Nov across a month end. */
function dayRange(a, b) {
  return a.y === b.y && a.mo === b.mo ? `${a.d}–${day(b)}` : `${day(a)} – ${day(b)}`;
}

/** 5492 -> "5,492", 123456 -> "1,23,456" (Indian grouping, no Intl dependency). */
export function groupINR(n) {
  const s = String(n);
  if (s.length <= 3) return s;
  return `${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${s.slice(-3)}`;
}

/**
 * One line for the Trip column of the clients list, e.g.
 * "Round trip · Sector 17 → Shimla · 12–14 Oct, 09:00 · ₹5,492".
 *
 * Built here rather than in the browser so every row reads the same way and
 * nothing the page sends is stored unchecked. Anything malformed is left out;
 * an unusable trip gives null, and the signup is kept without it.
 */
export function describeTrip(trip) {
  if (!trip || typeof trip !== 'object' || !Object.hasOwn(TRIP_LABEL, trip.type)) return null;
  const from = cleanText(trip.from, 80);
  const to = cleanText(trip.to, 80);
  const date = isoDate(trip.date);
  const ret = isoDate(trip.ret);
  const time = typeof trip.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(trip.time) ? trip.time : '';
  const hours = Number(trip.hours);
  const fare = Number.isInteger(trip.fare) && trip.fare > 0 && trip.fare < 1e7 ? trip.fare : null;

  const parts = [TRIP_LABEL[trip.type]];
  if (trip.type === 'hourly') {
    parts.push([hours > 0 && hours <= 72 ? `${hours} h` : '', from && `from ${from}`].filter(Boolean).join(' '));
  } else if (from || to) {
    parts.push(`${from || '?'} → ${to || '?'}`);
  }
  let when = '';
  if (date) when = trip.type === 'round' && ret ? dayRange(date, ret) : day(date);
  if (when && time) when += `, ${time}`;
  parts.push(when);
  if (fare) parts.push(`₹${groupINR(fare)}`);
  return parts.filter(Boolean).join(' · ');
}

// ----- Time -------------------------------------------------------------------------

const IST_MS = 330 * 60000;

/** "2026-09-25T08:33:00.000Z" -> "2026-09-25 14:03" (India Standard Time). */
export function istStamp(iso) {
  const t = new Date(Date.parse(iso) + IST_MS).toISOString();
  return `${t.slice(0, 10)} ${t.slice(11, 16)}`;
}

/** Today's date in IST, for download filenames. */
export const istDay = (ms = Date.now()) => new Date(ms + IST_MS).toISOString().slice(0, 10);

// ----- Rate limiting ----------------------------------------------------------------

/**
 * The network a request came from: an IPv4 address as is, an IPv6 address cut
 * to its /64 — the block one home connection or phone is given, and within
 * which a client can pick fresh addresses at will.
 */
export function networkOf(ip) {
  if (!ip) return 'unknown';
  const v4 = ip.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) return v4[1];
  if (!ip.includes(':')) return ip;
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

// ----- CSV --------------------------------------------------------------------------

/**
 * One cell. RFC 4180 quoting, and a cell a spreadsheet would run as a formula
 * (=, +, -, @ first) gets a leading apostrophe so it opens as text — except
 * phone numbers, which this Worker writes itself as + and digits only.
 */
export function csvCell(value) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^\+\d+$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A whole file, with a byte-order mark so Excel reads ₹ and non-Latin names as UTF-8. */
export function toCsv(header, rows) {
  return `\uFEFF${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

/** HTML text escaping for the admin page. */
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
