/**
 * RideBuddy shared fare-engine configuration.
 * Source of truth: Rate Table & Fare Estimation Logic v1.7 (locked, founder sign-off).
 * Variable names mirror the app fare engine — one config serves both. Never hardcode a rate.
 */
export const RATES = {
  per_day_rate: 1199,
  daily_km_inclusion: 300,
  daily_hour_inclusion: 12,
  overage_per_km: 3.99,
  return_per_km: 0.99,
  food_per_day: 299,
  night_charge: 249,
  stay_per_night: 499,
  night_start: '22:00',
  night_end: '06:00',
};

/**
 * Stand-in for Google Distance Matrix. In production, km + drive hours come from the
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

export function lookupDistance(destination) {
  const q = String(destination || '').trim().toLowerCase();
  if (!q) return null;
  return DISTANCES.find((d) => d.name.toLowerCase() === q)
    || DISTANCES.find((d) => q.includes(d.name.toLowerCase()) || d.name.toLowerCase().includes(q))
    || null;
}

/**
 * Fare engine — implements Rate Table v1.7 §2 exactly.
 * Returns the single customer-facing amount plus the flags the conditions list needs.
 * NOTE: internal itemisation is never surfaced — locked PRD display rule.
 *
 * Open item: PRD Open Question #1 — a one-way leg over daily_hour_inclusion hours but
 * under daily_km_inclusion km. Implemented here as "over 12 hours rolls to 2 days";
 * mirrors whatever the fare engine finally decides.
 */
export function estimateFare({ tripType, oneWayKm, driveHours, pickupTime, tripDays, stayArranged }, R = RATES) {
  const nightStartH = parseInt(R.night_start, 10);
  const nightEndH = parseInt(R.night_end, 10);
  const [ph, pm] = String(pickupTime || '09:00').split(':').map(Number);
  const pickupDecimal = ph + pm / 60;
  const arrivalDecimal = pickupDecimal + driveHours;
  const nightTrigger = pickupDecimal < nightEndH || arrivalDecimal >= nightStartH || arrivalDecimal >= 24 + nightEndH;

  let days;
  if (tripType === 'round') {
    days = Math.max(1, tripDays);
  } else {
    days = driveHours > R.daily_hour_inclusion || arrivalDecimal >= 24 ? 2 : 1;
  }

  const km = tripType === 'round' ? oneWayKm * 2 : oneWayKm;
  const overage = R.overage_per_km * Math.max(0, km - R.daily_km_inclusion * days);

  let fare = days * R.per_day_rate + overage + R.food_per_day * days;
  let stayNights = 0;
  if (tripType === 'one') {
    fare += R.return_per_km * oneWayKm;
  } else if (!stayArranged) {
    stayNights = Math.max(0, days - 1);
    fare += R.stay_per_night * stayNights;
  }
  if (nightTrigger) fare += R.night_charge;

  return { amount: Math.round(fare), days, km, nightTrigger, stayNights };
}

export const formatINR = (n) => '₹' + Number(n).toLocaleString('en-IN');
