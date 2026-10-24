/**
 * One-time codes: a number is proven by a 6-digit code sent to it by SMS before
 * a form saves it (forms.js). On when 2Factor (2factor.in) is configured — the
 * TWOFACTOR_API_KEY secret — and off otherwise, when the forms save as they
 * always have.
 *
 * The code is made here, and D1 keeps only a salted hash of it, for five
 * minutes and three tries. 2Factor's SMS OTP API only delivers it, in a
 * DLT-approved OTP template: 2Factor's default one, or RideBuddy's own once
 * TWOFACTOR_TEMPLATE names it (website/README.md).
 * The limits are the Phase 1 design's: a new code after 30 seconds, three
 * codes per number and ten per network an hour, plus a site-wide daily cap
 * so a flood can never run up the SMS bill.
 */
import { addHit, sha256Hex } from './db.js';
import {
  CODE_EXPIRED, CODE_NETWORK_LIMIT, CODE_NUMBER_LIMIT, CODE_SEND_FAILED, CODE_TOO_MANY, CODE_WRONG, codeWait, istDay, maskPhone,
} from './lib.js';

export const CODE_TTL = 300; // seconds a code stays good
export const CODE_TRIES = 3; // tries before a code is void
export const RESEND_AFTER = 30; // seconds before another code to the same number
const PER_NUMBER = 3; // codes to one number an hour
const PER_NETWORK = 10; // codes one network can ask for an hour
const DAILY = 300; // codes a day, site-wide; OTP_DAILY_CAP overrides

export const otpOn = (env) => !!env.TWOFACTOR_API_KEY;

const who = async (salt, phone) => (await sha256Hex(`${salt}|otp|${phone}`)).slice(0, 32);
const codeHash = (salt, phone, code) => sha256Hex(`${salt}|code|${phone}|${code}`);

/** Six digits, uniformly: values past the last whole million are drawn again. */
function newCode() {
  const limit = 2 ** 32 - (2 ** 32 % 1e6);
  const n = new Uint32Array(1);
  do { crypto.getRandomValues(n); } while (n[0] >= limit);
  return String(n[0] % 1e6).padStart(6, '0');
}

/**
 * Sends a fresh code to `phone` (+91XXXXXXXXXX), replacing any earlier one.
 * `at` is now, in seconds (forms.js).
 * @returns {Promise<{ok: true, sentTo: string, resendIn: number, expiresIn: number}
 *   | {ok: false, status: number, reason: string, error: string, resendIn?: number}>}
 */
export async function sendCode({ env, db, salt, network, at }, phone) {
  const t = at;
  const key = await who(salt, phone);
  const last = await db.prepare('SELECT sent_at FROM otp_codes WHERE who = ?').bind(key).first('sent_at');
  if (last != null && t - last < RESEND_AFTER) {
    const wait = RESEND_AFTER - (t - last);
    return { ok: false, status: 429, reason: 'resend_wait', error: codeWait(wait), resendIn: wait };
  }
  if (await addHit(db, `otp:${key}`) > PER_NUMBER) return { ok: false, status: 429, reason: 'number_limit', error: CODE_NUMBER_LIMIT };
  if (await addHit(db, `otpnet:${network}`) > PER_NETWORK) return { ok: false, status: 429, reason: 'network_limit', error: CODE_NETWORK_LIMIT };
  const cap = Number(env.OTP_DAILY_CAP) > 0 ? Number(env.OTP_DAILY_CAP) : DAILY;
  const sentToday = await db.prepare('INSERT INTO otp_daily (day, n) VALUES (?, 1) ON CONFLICT (day) DO UPDATE SET n = n + 1 RETURNING n')
    .bind(istDay(t * 1000)).first('n');
  if (sentToday > cap) {
    console.error('otp: the daily cap of codes is reached', cap);
    return { ok: false, status: 503, reason: 'daily_cap', error: CODE_SEND_FAILED };
  }

  const code = newCode();
  await db.batch([
    db.prepare('DELETE FROM otp_codes WHERE expires_at < ?').bind(t - 3600),
    db.prepare('INSERT OR REPLACE INTO otp_codes (who, hash, expires_at, tries, sent_at) VALUES (?, ?, ?, 0, ?)')
      .bind(key, await codeHash(salt, phone, code), t + CODE_TTL, t),
  ]);
  if (!(await twoFactorSend(env, phone, code))) {
    // Nothing went out: no code to wait for, so the visitor can try again at once.
    await db.prepare('DELETE FROM otp_codes WHERE who = ?').bind(key).run();
    return { ok: false, status: 502, reason: 'send_failed', error: CODE_SEND_FAILED };
  }
  return { ok: true, sentTo: maskPhone(phone), resendIn: RESEND_AFTER, expiresIn: CODE_TTL };
}

/**
 * Checks a code against the latest one sent to `phone`. Every check uses up a
 * try, the right one included, and the right one is then used up.
 * @returns {Promise<{ok: true} | {ok: false, reason: string, error: string}>}
 */
export async function checkCode({ db, salt, at }, phone, code) {
  const t = at;
  const key = await who(salt, phone);
  const row = await db.prepare('UPDATE otp_codes SET tries = tries + 1 WHERE who = ? AND tries < ? AND expires_at > ? RETURNING hash, tries')
    .bind(key, CODE_TRIES, t).first();
  if (!row) {
    const left = await db.prepare('SELECT expires_at FROM otp_codes WHERE who = ?').bind(key).first('expires_at');
    return left != null && left > t
      ? { ok: false, reason: 'too_many', error: CODE_TOO_MANY }
      : { ok: false, reason: 'expired', error: CODE_EXPIRED };
  }
  const digits = String(code).replace(/\D/g, '');
  if (digits.length === 6 && await codeHash(salt, phone, digits) === row.hash) {
    await db.prepare('DELETE FROM otp_codes WHERE who = ?').bind(key).run();
    return { ok: true };
  }
  return row.tries >= CODE_TRIES
    ? { ok: false, reason: 'too_many', error: CODE_TOO_MANY }
    : { ok: false, reason: 'wrong', error: CODE_WRONG };
}

/**
 * One code by SMS through 2Factor: GET /API/V1/{key}/SMS/{10-digit number}/{code},
 * plus /{template} when TWOFACTOR_TEMPLATE names one. 2Factor answers
 * {"Status": "Success" | "Error", "Details": …}, an error sometimes with HTTP
 * 200, so Status decides. The URL carries the key, so it is never logged; nor
 * is a number that 2Factor's Details may quote.
 */
async function twoFactorSend(env, phone, code) {
  // Test servers only (RB_TEST): a stand-in for 2Factor, so tests send nothing.
  const base = env.RB_TEST === '1' && env.TWOFACTOR_API_BASE ? env.TWOFACTOR_API_BASE : 'https://2factor.in';
  const path = [env.TWOFACTOR_API_KEY, 'SMS', phone.slice(-10), code, env.TWOFACTOR_TEMPLATE].filter(Boolean).map(encodeURIComponent).join('/');
  try {
    const res = await fetch(`${base}/API/V1/${path}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.Status === 'Success') return true;
    console.error('otp: 2Factor refused the message', res.status, String(data.Details ?? '').replace(/\d{6,}/g, '…').slice(0, 120));
  } catch (e) {
    console.error('otp: 2Factor unreachable', String(e?.message || e).slice(0, 120));
  }
  return false;
}
