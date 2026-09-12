/**
 * Google Maps helpers for the website — the browser-side twin of
 * frontend/src/maps.ts. The app calls Google's web-service endpoints with a
 * plain fetch; a browser cannot (no CORS on those endpoints), so the same
 * features come from the Maps JavaScript API: Places (New) for autocomplete
 * and place details, DirectionsService for the route, Map for the view.
 *
 * Function names and return shapes mirror maps.ts on purpose.
 */

// Injected at build time from GOOGLE_MAPS_BROWSER_KEY (see build.mjs). A
// browser key is public by design; its protection is the HTTP-referrer
// restriction and the short list of APIs enabled on it.
const KEY = __GOOGLE_MAPS_BROWSER_KEY__;

export const CHANDIGARH = { lat: 30.7333, lng: 76.7794 };

// Service area. Pickups: the Tricity (~25 km around Chandigarh — Mohali,
// Panchkula, Zirakpur, Kharar, Pinjore). Destinations: within ~600 km, which
// covers Delhi, Amritsar, Manali, Dharamshala, Rishikesh and Jaipur.
export const PICKUP_RADIUS_KM = 25;
export const DESTINATION_RADIUS_KM = 600;

const KM_PER_DEG_LAT = 111.32;
const KM_PER_DEG_LNG = KM_PER_DEG_LAT * Math.cos((CHANDIGARH.lat * Math.PI) / 180);

/** A lat/lng box `km` around Chandigarh — what autocomplete is restricted to. */
function boundsAround(km) {
  return {
    north: CHANDIGARH.lat + km / KM_PER_DEG_LAT,
    south: CHANDIGARH.lat - km / KM_PER_DEG_LAT,
    east: CHANDIGARH.lng + km / KM_PER_DEG_LNG,
    west: CHANDIGARH.lng - km / KM_PER_DEG_LNG,
  };
}

export function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}

/** The box is coarse; the radius is the rule. Applied to the chosen place. */
export function withinService(kind, place) {
  const km = haversineKm(CHANDIGARH, place);
  if (kind === 'pickup' && km > PICKUP_RADIUS_KM) {
    return { ok: false, message: 'Pickups are within the Chandigarh Tricity for now.' };
  }
  if (kind === 'destination' && km > DESTINATION_RADIUS_KM) {
    return { ok: false, message: `We serve destinations within ${DESTINATION_RADIUS_KM} km of Chandigarh for now.` };
  }
  return { ok: true };
}

// ----- Loader ---------------------------------------------------------------

let loading = null;

/**
 * Loads the Maps JavaScript API once and resolves with `google.maps`. A key
 * Google rejects surfaces later as `gm_authFailure`, re-emitted here as a
 * DOM event so the page can explain itself instead of showing a grey box.
 */
export function loadGoogleMaps() {
  if (!KEY) return Promise.reject(new Error('Google Maps key is not configured'));
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    window.__rbMapsReady = () => resolve(window.google.maps);
    window.gm_authFailure = () => {
      window.dispatchEvent(new CustomEvent('rb-maps-auth-failure'));
      reject(new Error('Google Maps rejected the key'));
    };
    const params = new URLSearchParams({
      key: KEY, v: 'weekly', loading: 'async', callback: '__rbMapsReady', region: 'IN', language: 'en',
    });
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    s.async = true;
    s.onerror = () => reject(new Error('The Google Maps JavaScript API could not load'));
    document.head.appendChild(s);
  });
  return loading;
}

// ----- Places (New) ------------------------------------------------------------

/** One session per field-interaction; autocomplete + details bill as a unit. */
export async function newSession() {
  const g = await loadGoogleMaps();
  const { AutocompleteSessionToken } = await g.importLibrary('places');
  return new AutocompleteSessionToken();
}

/**
 * Mirrors placesAutocomplete() in maps.ts, restricted to the service area.
 * @returns {Promise<Array<{description, place_id, main_text, secondary_text, prediction}>>}
 */
export async function placesAutocomplete(input, { kind, sessionToken }) {
  if (!input || input.length < 2) return [];
  const g = await loadGoogleMaps();
  const { AutocompleteSuggestion } = await g.importLibrary('places');
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken,
    includedRegionCodes: ['in'],
    locationRestriction: boundsAround(kind === 'pickup' ? PICKUP_RADIUS_KM : DESTINATION_RADIUS_KM),
    origin: CHANDIGARH,
    language: 'en-IN',
    region: 'in',
  });
  return suggestions
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => ({
      description: p.text?.text || '',
      place_id: p.placeId,
      main_text: p.mainText?.text || p.text?.text || '',
      secondary_text: p.secondaryText?.text || '',
      prediction: p,
    }));
}

/** Mirrors getPlaceDetails(): the coordinates and address for a suggestion. */
export async function getPlaceDetails(suggestion) {
  const place = suggestion.prediction.toPlace();
  await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] });
  const loc = place.location;
  if (!loc) return null;
  return {
    address: place.formattedAddress || suggestion.description,
    lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
    lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng,
  };
}

// ----- Directions ---------------------------------------------------------------

/**
 * Mirrors getDirections(): distance, drive time and the polyline for the
 * route, plus the raw DirectionsResult so the map can render it.
 */
export async function getDirections(origin, destination) {
  const g = await loadGoogleMaps();
  const { DirectionsService } = await g.importLibrary('routes');
  const result = await new DirectionsService().route({
    origin: { lat: origin.lat, lng: origin.lng },
    destination: { lat: destination.lat, lng: destination.lng },
    travelMode: 'DRIVING',
    region: 'in',
  });
  const route = result.routes?.[0];
  const leg = route?.legs?.[0];
  if (!leg) return null;
  return {
    distance_km: leg.distance.value / 1000,
    duration_min: Math.round(leg.duration.value / 60),
    polyline: route.overview_polyline || '',
    start: { lat: leg.start_location.lat(), lng: leg.start_location.lng() },
    end: { lat: leg.end_location.lat(), lng: leg.end_location.lng() },
    result,
  };
}

// ----- Static Map (image fallback while the interactive map loads) -----------------

/** Mirrors staticMapUrl(); brand markers A (green) and B (red). */
export function staticMapUrl({ pickup, drop, polyline, width = 600, height = 360 }) {
  const params = [`size=${width}x${height}`, 'scale=2', 'maptype=roadmap'];
  if (pickup) params.push(`markers=color:0x4A5C2F%7Clabel:A%7C${pickup.lat},${pickup.lng}`);
  if (drop) params.push(`markers=color:0xC62828%7Clabel:B%7C${drop.lat},${drop.lng}`);
  if (polyline) params.push(`path=color:0x4A5C2Fcc%7Cweight:5%7Cenc:${encodeURIComponent(polyline)}`);
  params.push(`key=${encodeURIComponent(KEY)}`);
  return `https://maps.googleapis.com/maps/api/staticmap?${params.join('&')}`;
}
