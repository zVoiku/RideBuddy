/**
 * STAND-IN BACKEND — prototype only. Not part of the website; delete at go-live.
 * Answers requestEstimate() in the same shape as the real backend (see estimate-api.js),
 * using the v1.10 engine and placeholder distances in rate-config.js.
 */
import { estimateFare, lookupDistance, COORDS, TRICITY_CENTRE } from './rate-config.js';

const TRICITY = ['chandigarh', 'mohali', 'panchkula', 'zirakpur', 'kharar'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function mockEstimate(req) {
  await wait(750);
  const refuse = (reason, message) => ({ ok: false, reason, message });

  const pickupLabel = String(req.pickup?.label || '').trim();
  if (!TRICITY.some((c) => pickupLabel.toLowerCase().includes(c)) && !COORDS[pickupLabel]) {
    return refuse('pickup_outside_area', 'Pickups are in the Chandigarh Tricity: Chandigarh, Mohali and Panchkula.');
  }
  const match = lookupDistance(req.destination?.label);
  if (!match) return refuse('destination_not_found', 'Pick a destination from the list above, or type a city we serve.');

  let tripDays = 1;
  if (req.trip_type === 'round') {
    const a = new Date(req.departure_date + 'T00:00:00');
    const b = new Date(req.return_date + 'T00:00:00');
    tripDays = Math.round((b - a) / 864e5) + 1;
    if (!(tripDays >= 1)) return refuse('return_before_departure', 'Return date falls before departure.');
  }

  const r = estimateFare({
    tripType: req.trip_type, oneWayKm: match.km, driveHours: match.hours,
    pickupTime: req.pickup_time, tripDays, stayArranged: !!req.stay_arranged,
  });
  const o = COORDS[pickupLabel] || TRICITY_CENTRE;
  const d = COORDS[match.name] || o;
  const round = req.trip_type === 'round';
  return {
    ok: true,
    estimate_id: 'est_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    fare: { amount: r.amount, currency: 'INR', tax_inclusive: true },
    route: {
      origin: { label: pickupLabel, lat: o[0], lng: o[1] },
      destination: { label: match.name, lat: d[0], lng: d[1] },
      one_way_km: match.km, one_way_minutes: match.hours * 60,
      total_km: round ? match.km * 2 : match.km, total_minutes: (round ? 2 : 1) * match.hours * 60,
      static_map_url: null,
    },
    trip: { trip_days: r.days, overnights: r.overnights, stay_nights_charged: r.stayNights, duty_hours_per_day: 12 },
    flags: {
      night_charge: r.nightTrigger, stay_included: r.stayNights > 0,
      long_drive: r.longDrive, rest_stop: r.longDrive, drive_through: false,
    },
  };
}
