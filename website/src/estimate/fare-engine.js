/**
 * Rate Table v1.7 fare engine — a line-for-line port of `fare_breakdown` in
 * backend/server.py, so the website quotes exactly what the app quotes.
 *
 * Parity is enforced, not assumed: test/parity.mjs runs a grid of trips through
 * this file and through the Python function and diffs every field. If the rates
 * or the rules change on the backend, that test is what fails.
 *
 * Two things are deliberately identical to Python and would be easy to get
 * subtly wrong:
 *   - the total is summed from *unrounded* components, in the same order, and
 *     only then rounded to whole rupees with Python's half-to-even `round()`;
 *   - the night window and calendar-day rules are IST wall-clock rules, so all
 *     time arithmetic here is done on IST components, never on the visitor's
 *     browser timezone.
 */

/** Mirrors the FARE dict in backend/server.py. Never hardcode a rate elsewhere. */
export const FARE = Object.freeze({
  per_day_rate: 1199,
  daily_km_inclusion: 300,
  daily_hour_inclusion: 12,
  overage_per_km: 3.99,
  return_per_km: 0.99,
  food_per_day: 299,
  night_charge: 249,
  stay_per_night: 499,
  night_start_hour: 22, // arrival at or after 22:00 triggers
  night_end_hour: 6, // pickup before 06:00 triggers
  hourly_rate: 249, // legacy; hourly is not covered by Rate Table v1.7
});

export const DEPOSIT_PCT = 20;

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

/**
 * Python's `round(x, 2)`. A true tie at the third decimal is only possible when
 * x*100 is exactly k+0.5 (e.g. 280.125), where Python goes to even; everywhere
 * else both languages pick the nearest representable value.
 */
export function roundTo2(x) {
  const scaled = x * 100;
  if (scaled - Math.floor(scaled) === 0.5) return roundHalfEven(scaled) / 100;
  return Number(x.toFixed(2));
}

/**
 * Pickup moment as IST wall-clock components.
 * @typedef {{ date: string, time: string }} Pickup  'YYYY-MM-DD' and 'HH:MM'
 */

function pickupMinutes({ time }) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Whole IST days between the pickup and the moment `hours` later. */
function daysCrossed(pickup, hours) {
  return Math.floor((pickupMinutes(pickup) + hours * 60) / 1440);
}

function arrivalHour(pickup, hours) {
  const total = pickupMinutes(pickup) + hours * 60;
  return Math.floor((total - daysCrossed(pickup, hours) * 1440) / 60);
}

/** Port of `_night_trigger`: pickup before 06:00 IST or arrival at/after 22:00 IST. */
export function nightTrigger(pickup, durationHours) {
  if (!pickup) return false;
  if (Math.floor(pickupMinutes(pickup) / 60) < FARE.night_end_hour) return true;
  const hours = Math.max(0, durationHours);
  return arrivalHour(pickup, hours) >= FARE.night_start_hour || daysCrossed(pickup, hours) > 0;
}

/** Port of `_one_way_days` (§2.2). */
export function oneWayDays(durationHours, pickup) {
  const hours = Math.max(0, durationHours);
  let days = hours ? Math.max(1, Math.ceil(hours / FARE.daily_hour_inclusion)) : 1;
  if (pickup && daysCrossed(pickup, hours) > 0) days = Math.max(days, 2);
  return days;
}

/**
 * Port of `fare_breakdown`. `distanceKm` is always the one-way distance from
 * the routing API; a round trip covers it twice.
 *
 * @param {object} t
 * @param {'point_to_point'|'hourly'} t.tripType
 * @param {boolean} t.oneWay
 * @param {number} t.distanceKm
 * @param {number} [t.durationHours]
 * @param {number} [t.days]           round trips: return date − outbound date + 1
 * @param {Pickup} [t.pickup]
 * @param {boolean} [t.customerStay]  round trips: the customer puts the Buddy up
 */
export function fareBreakdown({ tripType, oneWay, distanceKm, durationHours = 0, days = 0, pickup = null, customerStay = false }) {
  if (tripType === 'hourly') {
    const base = roundTo2(Math.max(1, durationHours) * FARE.hourly_rate);
    return {
      per_day: base, overage: 0, return_leg: 0, food: 0, stay: 0, night: 0,
      trip_days: 0, billable_km: 0, night_trigger: false, total: base,
      uncovered_by_rate_table: true,
    };
  }

  let trip_days, billable_km, return_leg, stay;
  if (oneWay) {
    trip_days = oneWayDays(durationHours, pickup);
    billable_km = Math.max(0, distanceKm);
    return_leg = FARE.return_per_km * billable_km;
    stay = 0; // §2.1: no stay charges on one-way trips
  } else {
    trip_days = Math.max(1, days);
    billable_km = Math.max(0, distanceKm) * 2;
    return_leg = 0; // §5.1 #3: the Buddy returns driving the customer's car
    const overnights = Math.max(0, trip_days - 1);
    stay = customerStay ? 0 : FARE.stay_per_night * overnights;
  }

  const per_day = FARE.per_day_rate * trip_days;
  const included_km = FARE.daily_km_inclusion * trip_days;
  const overage = FARE.overage_per_km * Math.max(0, billable_km - included_km);
  const food = FARE.food_per_day * trip_days;
  const night_trigger = nightTrigger(pickup, durationHours);
  const night = night_trigger ? FARE.night_charge : 0;

  // Same operands, same order as Python: the doubles sum bit-for-bit.
  const total = per_day + overage + return_leg + food + stay + night;
  return {
    per_day: roundTo2(per_day),
    overage: roundTo2(overage),
    return_leg: roundTo2(return_leg),
    food: roundTo2(food),
    stay: roundTo2(stay),
    night,
    trip_days,
    billable_km: roundTo2(billable_km),
    night_trigger,
    total: roundHalfEven(total), // customers are quoted whole rupees
  };
}

/** The customer-facing shape the `/bookings/estimate` endpoint returns. */
export function estimate(trip) {
  const b = fareBreakdown(trip);
  const total = b.total;
  const oneWay = trip.tripType === 'hourly' || trip.oneWay;
  return {
    total_fare: total,
    deposit: roundHalfEven(total * DEPOSIT_PCT / 100),
    deposit_pct: DEPOSIT_PCT,
    trip_days: b.trip_days,
    included_km: FARE.daily_km_inclusion * b.trip_days,
    included_hours: FARE.daily_hour_inclusion * b.trip_days,
    night_charge_applied: b.night_trigger,
    stay_included: !oneWay && b.stay > 0,
    overnights: oneWay ? 0 : Math.max(0, b.trip_days - 1),
    hourly: trip.tripType === 'hourly',
    hours: trip.tripType === 'hourly' ? Math.max(1, trip.durationHours || 0) : 0,
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
