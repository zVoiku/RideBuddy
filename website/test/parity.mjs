/**
 * Website ↔ backend fare parity.
 *
 * Runs a grid of trips through src/estimate/fare-engine.js and through
 * `fare_breakdown` in backend/server.py (via the backend venv) and fails on the
 * first field that differs. This is the guarantee behind "the website quotes
 * what the app quotes": if either side changes, this goes red. Both engines
 * read the rates from rates.json; the rate table's own worked examples (v1.10
 * §2.3 and §5.4) are priced through both and must come out to the rupee.
 *
 *   node website/test/parity.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fareBreakdown } from '../src/estimate/fare-engine.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PY = path.join(ROOT, 'backend', '.venv', 'bin', 'python');

// ---- the rate table's worked examples (v1.10 §2.3, §5.4) ------------------
const hm = (h, m = 0) => h + m / 60;
const one = (km, hours, time, driveThrough = false) => ({ tripType: 'point_to_point', oneWay: true, distanceKm: km, durationHours: hours, pickup: { date: '2026-10-25', time }, driveThrough });
const round = (km, hours, time, days, { customerStay = false, driveThrough = false } = {}) => ({ tripType: 'point_to_point', oneWay: false, distanceKm: km, durationHours: hours, days, pickup: { date: '2026-10-25', time }, customerStay, driveThrough });
const EXAMPLES = [
  ['Chandigarh → Shimla, 9 AM', one(115, hm(3, 15), '09:00'), 1613],
  ['Chandigarh → Delhi, 9 AM', one(250, hm(4, 30), '09:00'), 1747],
  ['Chandigarh → Manali, 9 AM', one(300, 8, '09:00'), 1796],
  ['Chandigarh → Jaipur, 9 AM', one(500, 9, '09:00'), 1994],
  ['Chandigarh → Shimla, 5 AM', one(115, hm(3, 15), '05:00'), 1862],
  ['Chandigarh → Manali, 6 PM (arrives 2 AM)', one(300, 8, '18:00'), 2045],
  ['Chandigarh → Delhi, 10 PM', one(250, hm(4, 30), '22:00'), 1996],
  ['Chandigarh → Shimla, 6:55 PM (10 night minutes)', one(115, hm(3, 15), '18:55'), 1613],
  ['Chandigarh → Leh, rest stop', one(688, hm(15, 30), '09:00'), 4178],
  ['Chandigarh → Leh, drive through', one(688, hm(15, 30), '09:00', true), 4427],
  ['Manali, 3 days, stay not arranged', round(300, 8, '09:00', 3), 5495],
  ['Manali, 3 days, stay arranged', round(300, 8, '09:00', 3, { customerStay: true }), 4497],
  ['Shimla, same day, 9 AM', round(115, hm(3, 15), '09:00', 1), 1499],
  ['Shimla, same day, 4 PM (home 10:30 PM)', round(115, hm(3, 15), '16:00', 1), 1748],
  ['Jaipur, same day, rest stop', round(500, 9, '09:00', 1), 3497],
  ['Jaipur, same day, drive through (home 3 AM)', round(500, 9, '09:00', 1, { driveThrough: true }), 3746],
];

// ---- the grid -------------------------------------------------------------
const kms = [0, 14.877, 60, 115, 112.4, 250, 300, 300.001, 445.2, 500, 520, 611.9, 688];
const hoursList = [0, 1.5, 3, hm(3, 15), 4.25, 8, 11.99, 12, 12.01, 13, hm(15, 30), 18.5, 23.75, 24, 30];
const times = ['00:30', '05:44', '05:45', '05:59', '06:00', '09:00', '13:45', '16:00', '18:55', '19:00', '21:59', '22:00', '23:30'];
const dayCounts = [1, 2, 3, 6, 27];

const trips = EXAMPLES.map(([, t]) => t);
for (const km of kms) {
  for (const h of hoursList) {
    for (const time of times) {
      for (const driveThrough of [false, true]) {
        trips.push({ tripType: 'point_to_point', oneWay: true, distanceKm: km, durationHours: h, pickup: { date: '2026-09-12', time }, driveThrough });
      }
    }
    trips.push({ tripType: 'point_to_point', oneWay: true, distanceKm: km, durationHours: h, pickup: null });
  }
  for (const days of dayCounts) {
    for (const h of [3, 6, hm(6, 30), 9, 13]) {
      for (const customerStay of [false, true]) {
        for (const driveThrough of [false, true]) {
          for (const time of ['05:00', '09:00', '16:00', '19:00']) {
            trips.push({ tripType: 'point_to_point', oneWay: false, distanceKm: km, durationHours: h, days, customerStay, driveThrough, pickup: { date: '2026-09-12', time } });
          }
        }
      }
    }
  }
}
for (const h of [0, 0.5, 1, 1.5, 2.5, 3, 4, 7.75, 12, 24]) {
  trips.push({ tripType: 'hourly', oneWay: true, distanceKm: 0, durationHours: h, pickup: { date: '2026-09-12', time: '09:00' } });
}

// ---- the Python side ------------------------------------------------------
const pyScript = `
import json, sys, importlib.util, os
os.environ.setdefault("USE_INMEMORY_DB", "true"); os.environ.setdefault("DB_NAME", "parity"); os.environ.setdefault("MONGO_URL", "mongodb://localhost:1")
spec = importlib.util.spec_from_file_location("server", ${JSON.stringify(path.join(ROOT, 'backend', 'server.py'))})
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
out = []
for t in json.load(sys.stdin):
    p = t.get("pickup")
    scheduled_at = f"{p['date']}T{p['time']}:00+05:30" if p else None
    b = m.fare_breakdown(trip_type=t["tripType"], one_way=t["oneWay"], distance_km=t["distanceKm"],
                         duration_hours=t.get("durationHours", 0), days=t.get("days", 0),
                         scheduled_at=scheduled_at, customer_stay=t.get("customerStay", False),
                         drive_through=t.get("driveThrough", False))
    out.append(b)
json.dump(out, sys.stdout)
`;
const py = spawnSync(PY, ['-c', pyScript], { input: JSON.stringify(trips), encoding: 'utf8', maxBuffer: 64 << 20 });
if (py.status !== 0) {
  console.error(py.stderr);
  process.exit(1);
}
const expected = JSON.parse(py.stdout);

// ---- compare --------------------------------------------------------------
const FIELDS = ['total', 'trip_days', 'night_trigger', 'per_day', 'extra_time', 'return_leg', 'food', 'stay', 'night',
  'overnights', 'added_days', 'stay_units', 'long_drive', 'drive_through', 'one_way_km'];
let failures = 0;
EXAMPLES.forEach(([name, , want], i) => {
  const js = fareBreakdown(trips[i]).total, py = expected[i].total;
  if (js !== want || py !== want) {
    failures += 1;
    console.error(`WORKED EXAMPLE ${name}: want ₹${want}, website ₹${js}, backend ₹${py}`);
  }
});
trips.forEach((trip, i) => {
  const js = fareBreakdown(trip);
  const py = expected[i];
  for (const f of FIELDS) {
    const a = js[f], b = py[f];
    const same = typeof a === 'number' && typeof b === 'number' ? Object.is(a, b) || a === b : a === b;
    if (!same) {
      failures += 1;
      if (failures <= 15) console.error(`MISMATCH ${f}: js=${a} py=${b}  trip=${JSON.stringify(trip)}`);
    }
  }
});

if (failures) {
  console.error(`\n${failures} mismatching field(s) across ${trips.length} trips`);
  process.exit(1);
}
console.log(`parity OK: ${trips.length} trips, ${FIELDS.length} fields each, identical to backend/server.py; all ${EXAMPLES.length} worked examples of Rate Table v1.10 to the rupee`);
