/**
 * /beta/rate-config.js — the module the artboard imports for its rates and
 * fare maths, built from rates.json and the same engine as /estimate/ instead
 * of the canvas's own copy (../Webpage/rate-config.js), so no copy of the
 * rates can drift. The artboard's estimator is unreachable — every Estimate
 * CTA goes to /estimate/ — but the page still loads this file.
 *
 * Same exports as the canvas file: its place lists come across unchanged,
 * and `estimateFare` keeps its shape while pricing through fareBreakdown.
 */
import { FARE, fareBreakdown, formatINR } from './fare-engine.js';

export { DISTANCES, PICKUP_AREAS, lookupDistance } from '../../../Webpage/rate-config.js';
export { formatINR };
export const RATES = FARE;

export function estimateFare({ tripType, oneWayKm, driveHours, pickupTime, tripDays, stayArranged, driveThrough = false }) {
  const round = tripType === 'round';
  const b = fareBreakdown({
    tripType: 'point_to_point', oneWay: !round, distanceKm: oneWayKm, durationHours: driveHours, days: tripDays,
    pickup: { date: '2026-01-01', time: pickupTime || '09:00' }, customerStay: !!stayArranged, driveThrough,
  });
  return {
    amount: b.total, days: b.trip_days, km: round ? oneWayKm * 2 : oneWayKm, nightTrigger: b.night_trigger,
    stayNights: b.stay_units, overnights: b.overnights, longDrive: b.long_drive,
  };
}
