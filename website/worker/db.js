/**
 * D1: the tables (created on first use, so a fresh database needs no setup
 * step), the salt for hashing network addresses, and the per-network hit
 * counter behind the forms' flood cap and the admin lockout.
 */
import { networkOf } from './lib.js';

const SCHEMA = [
  // The lists. The client waitlist also holds the thumbs on fares shown at
  // /estimate/: one row per estimate voted on, phone '' until (unless) that
  // visitor joins from the same estimate. `estimate_id` ties the two together.
  // `verified` is 1 where the number was proven with a one-time code (otp.js).
  `CREATE TABLE IF NOT EXISTS waitlist (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     created_at TEXT NOT NULL,
     phone TEXT NOT NULL,
     source TEXT NOT NULL,
     trip TEXT,
     fare INTEGER,
     vote TEXT,
     comment TEXT,
     consent INTEGER,
     estimate_id TEXT,
     updated_at TEXT,
     verified INTEGER
   )`,
  'CREATE INDEX IF NOT EXISTS waitlist_phone ON waitlist (phone, id)',
  `CREATE TABLE IF NOT EXISTS buddies (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     created_at TEXT NOT NULL,
     name TEXT NOT NULL,
     phone TEXT NOT NULL,
     licence TEXT NOT NULL,
     city TEXT,
     verified INTEGER
   )`,
  'CREATE INDEX IF NOT EXISTS buddies_phone ON buddies (phone, id)',
  `CREATE TABLE IF NOT EXISTS agencies (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     created_at TEXT NOT NULL,
     agency TEXT NOT NULL,
     contact TEXT NOT NULL,
     phone TEXT NOT NULL,
     city TEXT NOT NULL,
     drivers TEXT,
     email TEXT,
     gstin TEXT,
     verified INTEGER
   )`,
  'CREATE INDEX IF NOT EXISTS agencies_phone ON agencies (phone, id)',
  // One-time codes (otp.js): the latest code sent to a number, kept as a salted
  // hash for five minutes and three tries. `who` is a salted hash of the number.
  `CREATE TABLE IF NOT EXISTS otp_codes (
     who TEXT PRIMARY KEY,
     hash TEXT NOT NULL,
     expires_at INTEGER NOT NULL,
     tries INTEGER NOT NULL DEFAULT 0,
     sent_at INTEGER NOT NULL
   )`,
  // Codes sent per IST day, site-wide: the daily cap on SMS spend.
  'CREATE TABLE IF NOT EXISTS otp_daily (day TEXT PRIMARY KEY, n INTEGER NOT NULL)',
  // Recent submissions per network, for the flood cap. Rows older than an hour
  // are deleted as new ones arrive; the network is stored only as a salted hash.
  'CREATE TABLE IF NOT EXISTS hits (bucket TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS hits_bucket ON hits (bucket, at)',
  'CREATE INDEX IF NOT EXISTS hits_at ON hits (at)',
  'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)',
  // Analytics: one row per beacon from src/site.js, kept 13 months; `vid` is a
  // visitor-of-the-day hash (no IP stored). Finished days are summed into
  // daily_totals, which are kept for good.
  `CREATE TABLE IF NOT EXISTS beacons (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     day TEXT NOT NULL,
     at INTEGER NOT NULL,
     vid TEXT NOT NULL,
     device TEXT NOT NULL,
     city TEXT NOT NULL DEFAULT '',
     country TEXT NOT NULL DEFAULT '',
     events TEXT NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS beacons_day ON beacons (day)',
  `CREATE TABLE IF NOT EXISTS daily_totals (
     day TEXT NOT NULL,
     metric TEXT NOT NULL,
     key TEXT NOT NULL,
     value INTEGER NOT NULL,
     PRIMARY KEY (day, metric, key)
   )`,
];

/**
 * Columns added after launch, for databases created before them (CREATE TABLE
 * IF NOT EXISTS leaves an existing table as it is). ALTER TABLE has no "if not
 * exists": a column that is already there fails as a duplicate, which is fine.
 * SCHEMA_VERSION in meta records that this has run.
 */
const SCHEMA_VERSION = '3';
const ADDED_COLUMNS = [
  // 2: votes, consent and cities
  ['waitlist', 'fare INTEGER'], ['waitlist', 'vote TEXT'], ['waitlist', 'comment TEXT'], ['waitlist', 'consent INTEGER'],
  ['waitlist', 'estimate_id TEXT'], ['waitlist', 'updated_at TEXT'], ['buddies', 'city TEXT'],
  // 3: one-time codes
  ['waitlist', 'verified INTEGER'], ['buddies', 'verified INTEGER'], ['agencies', 'verified INTEGER'],
];
const AFTER_COLUMNS = ['CREATE INDEX IF NOT EXISTS waitlist_estimate ON waitlist (estimate_id)'];

let readyOnce = null;

/**
 * Creates the tables on first use (idempotent), brings older tables up to the
 * current columns, and returns the salt used to hash network addresses. Once
 * per isolate; retried if it failed.
 */
export function ready(db) {
  readyOnce ??= (async () => {
    const results = await db.batch([
      ...SCHEMA.map((sql) => db.prepare(sql)),
      db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('salt', ?)").bind(crypto.randomUUID()),
      db.prepare("SELECT v FROM meta WHERE k = 'salt'"),
      db.prepare("SELECT v FROM meta WHERE k = 'schema'"),
    ]);
    if (results.at(-1).results[0]?.v !== SCHEMA_VERSION) {
      for (const [table, column] of ADDED_COLUMNS) {
        try {
          await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column}`).run();
        } catch (e) {
          if (!/duplicate column/i.test(String(e?.message || e))) throw e;
        }
      }
      await db.batch([
        ...AFTER_COLUMNS.map((sql) => db.prepare(sql)),
        db.prepare("INSERT OR REPLACE INTO meta (k, v) VALUES ('schema', ?)").bind(SCHEMA_VERSION),
      ]);
    }
    return results.at(-2).results[0].v;
  })().catch((e) => { readyOnce = null; throw e; });
  return readyOnce;
}

export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function networkHash(request, salt) {
  const net = networkOf(request.headers.get('cf-connecting-ip'));
  return (await sha256Hex(`${salt}|${net}`)).slice(0, 32);
}

/** Records one hit for `bucket` and returns how many it has had in the last hour. */
export async function addHit(db, bucket) {
  const now = Math.floor(Date.now() / 1000);
  const results = await db.batch([
    db.prepare('DELETE FROM hits WHERE at < ?').bind(now - 3600),
    db.prepare('INSERT INTO hits (bucket, at) VALUES (?, ?)').bind(bucket, now),
    db.prepare('SELECT COUNT(*) AS n FROM hits WHERE bucket = ? AND at >= ?').bind(bucket, now - 3600),
  ]);
  return results[2].results[0].n;
}

export async function countHits(db, bucket) {
  const now = Math.floor(Date.now() / 1000);
  return db.prepare('SELECT COUNT(*) AS n FROM hits WHERE bucket = ? AND at >= ?').bind(bucket, now - 3600).first('n');
}
