/**
 * RideBuddy website — fare estimate client (Phase 1).
 * The website holds no rates and does no fare maths. It sends the trip to the backend,
 * which prices it with live Google Directions data, and displays what comes back.
 *
 * Set ESTIMATE_ENDPOINT to the backend URL. While it is empty, a stand-in backend
 * (mock-backend.js) answers so the prototype keeps working. Delete mock-backend.js at go-live.
 *
 * Request  POST ESTIMATE_ENDPOINT
 * {
 *   trip_type: 'one' | 'round',
 *   pickup: { label },                 // Places result in production
 *   destination: { label },
 *   departure_date: 'YYYY-MM-DD',
 *   return_date: 'YYYY-MM-DD' | null,
 *   pickup_time: 'HH:MM',              // IST
 *   stay_arranged: boolean,            // round trips over 1 day
 *   visitor_id: string
 * }
 *
 * Response (200)
 * {
 *   ok: true,
 *   estimate_id: string,
 *   fare: { amount: number, currency: 'INR', tax_inclusive: true },
 *   route: {
 *     origin: { label, lat, lng }, destination: { label, lat, lng },
 *     one_way_km, one_way_minutes, total_km, total_minutes,
 *     static_map_url: string | null    // Google Static Maps with the route polyline
 *   },
 *   trip: { trip_days, overnights, stay_nights_charged, duty_hours_per_day },
 *   flags: { night_charge, stay_included, long_drive, rest_stop, drive_through }
 * }
 *
 * Refusal (200 or 422)
 * { ok: false, reason: 'destination_not_found' | 'pickup_outside_area' | 'return_before_departure' | 'trip_too_short', message: string }
 */
export const ESTIMATE_ENDPOINT = '';

export async function requestEstimate(req) {
  if (ESTIMATE_ENDPOINT) {
    const res = await fetch(ESTIMATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (res.status >= 500) throw new Error('estimate_unavailable');
    return res.json();
  }
  const { mockEstimate } = await import('./mock-backend.js');
  return mockEstimate(req);
}

// Pickup suggestions. In production these come from Google Places Autocomplete,
// restricted to the Chandigarh Tricity.
export const PICKUP_AREAS = [
  'Sector 17, Chandigarh', 'Sector 22, Chandigarh', 'Sector 35, Chandigarh',
  'Sector 43, Chandigarh', 'IT Park, Chandigarh', 'Manimajra, Chandigarh',
  'Phase 5, Mohali', 'Phase 7, Mohali', 'Sector 70, Mohali', 'Aerocity, Mohali',
  'Sector 5, Panchkula', 'Sector 11, Panchkula', 'Pinjore, Panchkula',
];

export const formatINR = (n) => '₹' + Number(n).toLocaleString('en-IN');
