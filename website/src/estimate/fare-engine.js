/**
 * Rate Table v1.10 fare engine — a line-for-line port of `fare_breakdown` in
 * backend/server.py, so the website quotes exactly what the app quotes. One
 * way and round trips only: the website doesn't offer Hourly, which the
 * backend still prices for the app (outside the rate table).
 *
 * The rates are not in this file: they are rates.json at the repo root, the
 * same file the backend reads, compiled into the page by the build. Change a
 * rate there and both sides follow.
 *
 * Parity is enforced, not assumed: test/parity.mjs runs a grid of trips through
 * this file and through the Python function and diffs every field, and checks
 * both against the rate table's own worked examples. If the rules change on the
 * backend, that test is what fails.
 *
 * Two things are deliberately identical to Python and would be easy to get
 * subtly wrong:
 *   - money is summed exactly, in whole paise from whole metres, and only the
 *     total is rounded to rupees, halves up (§1A) — no float rounding on the way;
 *   - the night window is an IST wall-clock rule, so all time arithmetic here is
 *     done on IST components, never on the visitor's browser timezone.
 */
import RATES from '../../../rates.json' with { type: 'json' };

/** The rates (rates.json without its notes). Never hardcode a rate elsewhere. */
export const FARE = Object.freeze(Object.fromEntries(Object.entries(RATES).filter(([k]) => !k.startsWith('_'))));

export const DEPOSIT_PCT = FARE.deposit_pct;

/**
 * Python's `round(x)` on a float: nearest integer, ties to even. JavaScript's
 * Math.round breaks ties upward, which differs on every ₹x.5 total.
 */
export function roundHalfEven(x) {
  const f = Math.floor(x);
  const d = x - f; // exact for doubles of this magnitude
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

/** `_half_up`: nearest integer, halves up (§1A). */
const halfUp = (x) => Math.floor(x + 0.5);
const paise = (rupees) => halfUp(rupees * 100);
const clock = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 3600 + m * 60; };

/**
 * Pickup moment as IST wall-clock components.
 * @typedef {{ date: string, time: string }} Pickup  'YYYY-MM-DD' and 'HH:MM'
 */

/** `_added_days`: past 12 hours of driving, Trip Days = ceiling(drive time / 12 h) (§1C). */
function addedDays(driveS) {
  if (driveS <= FARE.long_drive_threshold_h * 3600) return 0;
  return Math.ceil(driveS / (FARE.daily_duty_minutes * 60)) - 1;
}

/** `_duty`: a leg's duty periods; a long rest-stop leg is driven in 12-hour stretches with a 9-hour rest between. */
function duty(start, driveS, driveThrough) {
  const day = FARE.daily_duty_minutes * 60;
  if (driveThrough || driveS <= day) return [[start, start + driveS]];
  const out = [];
  let t = start, left = driveS;
  while (left > 0) {
    const d = Math.min(day, left);
    out.push([t, t + d]);
    left -= d;
    t += d + FARE.rest_hours * 3600;
  }
  return out;
}

/** `_night_seconds`: seconds of duty inside the night window (22:00–06:00 IST) on any night. */
function nightSeconds(periods) {
  const ns = clock(FARE.night_start), ne = clock(FARE.night_end);
  const span = ne <= ns ? 86400 + ne - ns : ne - ns;
  let total = 0;
  for (const [a, b] of periods) {
    for (let k = Math.floor(a / 86400) - 1; k <= Math.floor(b / 86400); k++) {
      const ws = k * 86400 + ns;
      total += Math.max(0, Math.min(b, ws + span) - Math.max(a, ws));
    }
  }
  return total;
}

/**
 * Port of `fare_breakdown` for point-to-point trips. `distanceKm` and
 * `durationHours` are the one-way route; a round trip drives it twice.
 *
 * @param {object} t
 * @param {'point_to_point'} t.tripType
 * @param {boolean} t.oneWay
 * @param {number} t.distanceKm
 * @param {number} [t.durationHours]
 * @param {number} [t.days]           round trips: return date − departure date + 1
 * @param {Pickup} [t.pickup]
 * @param {boolean} [t.customerStay]  round trips: the customer puts the Buddy up
 * @param {boolean} [t.driveThrough]  long drives: the drive-through instead of the rest stop
 */
export function fareBreakdown({ oneWay, distanceKm, durationHours = 0, days = 0, pickup = null, customerStay = false, driveThrough = false }) {
  const metres = halfUp(Math.max(0, distanceKm) * 1000);
  const driveS = halfUp(Math.max(0, durationHours) * 3600);
  const start = pickup ? clock(pickup.time) : null;
  const at = start ?? 0;
  let added, trip_days, overnights, legs, stay_units, returnMp;
  if (oneWay) {
    added = addedDays(driveS);
    trip_days = 1 + added;
    overnights = 0;
    legs = [duty(at, driveS, driveThrough)];
    stay_units = added; // §1C: ₹499 per added day on both plans
    returnMp = paise(FARE.return_per_km) * metres; // thousandths of a paise
  } else {
    const calendarDays = Math.max(1, days);
    overnights = calendarDays - 1;
    if (calendarDays === 1) {
      added = addedDays(2 * driveS); // §5.3: out, and back on arrival
      legs = [duty(at, 2 * driveS, driveThrough)];
    } else {
      added = 2 * addedDays(driveS);
      legs = [duty(at, driveS, driveThrough), duty(at + overnights * 86400, driveS, driveThrough)];
    }
    trip_days = calendarDays + added;
    stay_units = (customerStay ? 0 : overnights) + (driveThrough || !customerStay ? added : 0); // §5.2
    returnMp = 0; // §5.1 #3: the Buddy returns driving the customer's car
  }

  // §1B, checked on every leg; flat, once per trip.
  const night_trigger = start !== null && legs.some((leg) => nightSeconds(leg) > FARE.grace_min * 60);

  const perDay = paise(FARE.per_day_rate) * trip_days;
  const food = paise(FARE.food_per_day) * trip_days;
  const stay = paise(FARE.stay_per_night) * stay_units;
  const night = night_trigger ? paise(FARE.night_charge) : 0;
  const totalMp = (perDay + food + stay + night) * 1000 + returnMp;
  return {
    per_day: perDay / 100,
    extra_time: 0, // §1B: an estimate's duty is its drive time
    return_leg: Math.floor((returnMp + 500) / 1000) / 100,
    food: food / 100,
    stay: stay / 100,
    night: night / 100,
    trip_days,
    overnights,
    added_days: added,
    stay_units,
    long_drive: added > 0,
    drive_through: added > 0 && driveThrough,
    night_trigger,
    one_way_km: metres / 1000,
    total: Math.floor((totalMp + 50000) / 100000), // whole rupees, halves up
    uncovered_by_rate_table: false,
  };
}

/** The customer-facing shape: `estimate_summary` in backend/server.py. */
export function estimate(trip) {
  const b = fareBreakdown(trip);
  const total = b.total;
  const nights = b.stay_units - (b.drive_through ? b.added_days : 0);
  return {
    total_fare: total,
    deposit: roundHalfEven(total * DEPOSIT_PCT / 100),
    deposit_pct: DEPOSIT_PCT,
    trip_days: b.trip_days,
    duty_hours_per_day: FARE.daily_duty_minutes / 60,
    night_charge_applied: b.night_trigger,
    stay_included: nights > 0,
    stay_nights: nights,
    long_drive: b.long_drive,
    drive_through: b.drive_through,
    night_start: FARE.night_start,
    night_end: FARE.night_end,
    night_grace_min: FARE.grace_min,
    long_drive_hours: FARE.long_drive_threshold_h,
  };
}

/** ₹ with Indian digit grouping, as the app renders it. */
export function formatINR(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

/** Round-trip billing days: return date − outbound date + 1 (§5.3). */
export function roundTripDays(departDate, returnDate) {
  const a = Date.UTC(...departDate.split('-').map(Number).map((v, i) => (i === 1 ? v - 1 : v)));
  const b = Date.UTC(...returnDate.split('-').map(Number).map((v, i) => (i === 1 ? v - 1 : v)));
  return Math.round((b - a) / 864e5) + 1;
}
