/**
 * RideBuddy shared fare-engine configuration.
 * Source of truth: Rate Table & Fare Estimation Logic v1.10 (locked, founder sign-off 11 Oct 2026).
 * Variable names mirror the app fare engine — one config serves both. Never hardcode a rate.
 */
export const RATES = {
  per_day_rate: 1200,            // internal, never shown
  daily_duty_minutes: 720,
  daily_km_ceiling: 600,         // planning ceiling, not billed
  extra_time_per_min: 1.99,
  grace_min: 15,                 // each end
  night_cover_min: 60,
  return_per_km: 0.99,
  food_per_day: 299,
  stay_per_night: 499,           // round-trip overnights; long-drive added days
  night_charge: 249,
  night_start: '22:00',
  night_end: '06:00',
  long_drive_threshold_h: 12,
  rest_hours: 9,
};

/**
 * Stand-in for Google Directions (driving, standard duration, no traffic). In production, km + drive hours come from the
 * live API (same source the app fare engine uses). Distances are one-way road km from
 * the Chandigarh Tricity.
 */
export const DISTANCES = [
  { name: 'Shimla', km: 115, hours: 3.5 },
  { name: 'Manali', km: 300, hours: 8 },
  { name: 'Kasauli', km: 60, hours: 1.75 },
  { name: 'Dharamshala', km: 245, hours: 6 },
  { name: 'Delhi', km: 250, hours: 4.5 },
  { name: 'Amritsar', km: 230, hours: 4.5 },
  { name: 'Dalhousie', km: 320, hours: 7.5 },
  { name: 'Rishikesh', km: 220, hours: 5 },
  { name: 'Jaipur', km: 520, hours: 9 },
  { name: 'Mussoorie', km: 200, hours: 5 },
];

export const PICKUP_AREAS = [
  'Sector 17, Chandigarh', 'Sector 22, Chandigarh', 'Sector 35, Chandigarh',
  'Sector 43, Chandigarh', 'IT Park, Chandigarh', 'Manimajra, Chandigarh',
  'Phase 5, Mohali', 'Phase 7, Mohali', 'Sector 70, Mohali', 'Aerocity, Mohali',
  'Sector 5, Panchkula', 'Sector 11, Panchkula', 'Pinjore, Panchkula',
];

/**
 * Stand-in coordinates [lat, lng] for the static route map. In production the map image +
 * route polyline come from the same Google Directions response as km + hours.
 */
export const COORDS = {
  Shimla: [31.104, 77.173], Manali: [32.240, 77.189], Kasauli: [30.898, 76.965],
  Dharamshala: [32.219, 76.323], Delhi: [28.614, 77.209], Amritsar: [31.634, 74.872],
  Dalhousie: [32.539, 75.971], Rishikesh: [30.087, 78.268], Jaipur: [26.912, 75.787],
  Mussoorie: [30.459, 78.066],
  'Sector 17, Chandigarh': [30.741, 76.779], 'Sector 22, Chandigarh': [30.733, 76.772],
  'Sector 35, Chandigarh': [30.723, 76.761], 'Sector 43, Chandigarh': [30.719, 76.749],
  'IT Park, Chandigarh': [30.727, 76.846], 'Manimajra, Chandigarh': [30.718, 76.833],
  'Phase 5, Mohali': [30.712, 76.719], 'Phase 7, Mohali': [30.707, 76.728],
  'Sector 70, Mohali': [30.699, 76.717], 'Aerocity, Mohali': [30.667, 76.783],
  'Sector 5, Panchkula': [30.695, 76.855], 'Sector 11, Panchkula': [30.684, 76.849],
  'Pinjore, Panchkula': [30.798, 76.917],
};
export const TRICITY_CENTRE = [30.733, 76.779];

export function lookupDistance(destination) {
  const q = String(destination || '').trim().toLowerCase();
  if (!q) return null;
  return DISTANCES.find((d) => d.name.toLowerCase() === q)
    || DISTANCES.find((d) => q.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(q))
    || null;
}

/**
 * Fare engine — Rate Table v1.10 (time-based). Returns the single customer-facing amount
 * plus the flags the conditions list needs. Internal itemisation is never surfaced.
 *
 * - A Trip Day = 12 h of duty from the booked pickup. Distance is not charged, except the
 *   one-way return (₹0.99/km). Estimate duty = drive time, so extra time is always 0 here.
 * - Long drive (> 12 h driving on a leg, or a same-day round trip): days = ceil(drive / 12 h),
 *   ₹499 per added day. Rest stop (default) = 12 h duty, 9 h rest, continue. Drive-through
 *   = continuous. On a round trip, rest-stop added days follow the stay question.
 * - Night charge: once per trip when > 15 min of duty fall between 22:00 and 06:00 on any leg.
 * - Calculate unrounded; round only the total (halves up).
 */
export function estimateFare({ tripType, oneWayKm, driveHours, pickupTime, tripDays, stayArranged, driveThrough = false }, R = RATES) {
  const [ph, pm] = String(pickupTime || '09:00').split(':').map(Number);
  const pickupMin = ph * 60 + (pm || 0);
  const legMin = driveHours * 60;
  const dutyMax = R.daily_duty_minutes;
  const restMin = R.rest_hours * 60;

  // Duty intervals [start, end] in minutes from midnight of departure day.
  const legIntervals = (start, minutes) => {
    if (driveThrough || minutes <= dutyMax) return [[start, start + minutes]];
    const out = []; let t = start, left = minutes;
    while (left > 0) { const d = Math.min(dutyMax, left); out.push([t, t + d]); left -= d; t += d + restMin; }
    return out;
  };
  const addedDays = (minutes) => Math.max(0, Math.ceil(minutes / dutyMax - 1e-9) - 1);

  let baseDays, longDays = 0, overnights = 0;
  const intervals = [];
  if (tripType === 'round') {
    const nDays = Math.max(1, tripDays || 1);
    if (nDays === 1) {
      baseDays = 1;
      longDays = addedDays(legMin * 2);
      intervals.push(...legIntervals(pickupMin, legMin * 2));
    } else {
      baseDays = nDays;
      overnights = nDays - 1;
      longDays = addedDays(legMin) * 2;
      intervals.push(...legIntervals(pickupMin, legMin));
      intervals.push(...legIntervals(pickupMin + (nDays - 1) * 1440, legMin));
    }
  } else {
    baseDays = 1;
    longDays = addedDays(legMin);
    intervals.push(...legIntervals(pickupMin, legMin));
  }
  const days = baseDays + longDays;
  const longDrive = longDays > 0;

  const ns = parseInt(R.night_start, 10) * 60, ne = parseInt(R.night_end, 10) * 60;
  let nightMin = 0;
  for (const [a, b] of intervals) {
    for (let k = Math.floor(a / 1440) - 1; k <= Math.ceil(b / 1440); k++) {
      const ws = k * 1440 + ns, we = (k + 1) * 1440 + ne;
      nightMin += Math.max(0, Math.min(b, we) - Math.max(a, ws));
    }
  }
  const nightTrigger = nightMin > R.grace_min;

  let fare = days * R.per_day_rate + days * R.food_per_day;
  let stayNights = 0;
  if (tripType === 'one') {
    fare += R.return_per_km * oneWayKm;
    stayNights = longDays;
  } else {
    stayNights = (stayArranged ? 0 : overnights) + ((driveThrough || !stayArranged) ? longDays : 0);
  }
  fare += R.stay_per_night * stayNights;
  if (nightTrigger) fare += R.night_charge;

  const km = tripType === 'round' ? oneWayKm * 2 : oneWayKm;
  // secondDay: a one-way leg that needed more than one Trip Day (long drive) — used by fare_feedback.
  const secondDay = tripType === 'one' && days > 1;
  return { amount: Math.floor(fare + 0.5 + 1e-9), days, km, nightTrigger, stayNights, overnights, longDrive, secondDay };
}

export const formatINR = (n) => '₹' + Number(n).toLocaleString('en-IN');
