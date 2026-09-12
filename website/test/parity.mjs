/**
 * Website ↔ backend fare parity.
 *
 * Runs a grid of trips through src/estimate/fare-engine.js and through
 * `fare_breakdown` in backend/server.py (via the backend venv) and fails on the
 * first field that differs. This is the guarantee behind "the website quotes
 * what the app quotes": if either side changes, this goes red.
 *
 *   node website/test/parity.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fareBreakdown } from '../src/estimate/fare-engine.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PY = path.join(ROOT, 'backend', '.venv', 'bin', 'python');

// ---- the grid -------------------------------------------------------------
const kms = [0, 14.877, 60, 115, 112.4, 250, 300, 300.001, 445.2, 500, 520, 611.9];
const hoursList = [0, 1.5, 3, 4.25, 8, 11.99, 12, 12.01, 13, 18.5, 23.75];
const times = ['00:30', '05:59', '06:00', '09:00', '13:45', '16:00', '21:59', '22:00', '23:30'];
const dayCounts = [1, 2, 3, 6, 27];

const trips = [];
for (const km of kms) {
  for (const h of hoursList) {
    for (const time of times) {
      trips.push({ tripType: 'point_to_point', oneWay: true, distanceKm: km, durationHours: h, pickup: { date: '2026-09-12', time } });
    }
    trips.push({ tripType: 'point_to_point', oneWay: true, distanceKm: km, durationHours: h, pickup: null });
  }
  for (const days of dayCounts) {
    for (const customerStay of [false, true]) {
      for (const time of ['05:00', '09:00', '19:00']) {
        trips.push({ tripType: 'point_to_point', oneWay: false, distanceKm: km, durationHours: 6, days, customerStay, pickup: { date: '2026-09-12', time } });
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
                         scheduled_at=scheduled_at, customer_stay=t.get("customerStay", False))
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
const FIELDS = ['total', 'trip_days', 'night_trigger', 'per_day', 'overage', 'return_leg', 'food', 'stay', 'night', 'billable_km'];
let failures = 0;
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
console.log(`parity OK: ${trips.length} trips, ${FIELDS.length} fields each, identical to backend/server.py`);
