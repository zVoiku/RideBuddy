// Google Maps helpers — uses REST APIs only (no native module needed for Expo preview)
// API key from EXPO_PUBLIC_GOOGLE_MAPS_KEY in .env
//
// Search, place lookup and routing use Places API (New) and the Routes API: the
// legacy Places and Directions web services aren't available on the apps' key.

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

// Places API (New) and the Routes API take the key and a field mask (which
// response fields to return) as headers, and answer errors as { error: { message } }.
async function googleJson(url: string, fieldMask: string, body?: object): Promise<any> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': fieldMask },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

export interface PlaceSuggestion {
  description: string;
  place_id: string;
  main_text: string;
  secondary_text: string;
}

export interface PlaceDetails {
  address: string;
  lat: number;
  lng: number;
}

export interface RouteInfo {
  distance_km: number;
  duration_min: number;
  polyline: string;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
}

// ----- Places Autocomplete (Places API (New)) -----
export async function placesAutocomplete(input: string): Promise<PlaceSuggestion[]> {
  if (!input || input.length < 2 || !KEY) return [];
  try {
    const data = await googleJson(
      'https://places.googleapis.com/v1/places:autocomplete',
      'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
      { input, includedRegionCodes: ['in'] }
    );
    return (data.suggestions || [])
      .map((s: any) => s.placePrediction)
      .filter((p: any) => p?.placeId)
      .map((p: any) => ({
        description: p.text?.text || '',
        place_id: p.placeId,
        main_text: p.structuredFormat?.mainText?.text || p.text?.text || '',
        secondary_text: p.structuredFormat?.secondaryText?.text || '',
      }));
  } catch (e) {
    console.warn('Places autocomplete failed', e);
    return [];
  }
}

// ----- Place details (lat/lng for a place_id) -----
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!placeId || !KEY) return null;
  try {
    const data = await googleJson(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, 'formattedAddress,location');
    const loc = data.location;
    return loc ? { address: data.formattedAddress, lat: loc.latitude, lng: loc.longitude } : null;
  } catch {
    return null;
  }
}

// ----- Geocode raw address (fallback when no place_id) -----
export async function geocodeAddress(addr: string): Promise<PlaceDetails | null> {
  if (!addr || !KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&components=country:IN&key=${KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.length) return null;
    const r = data.results[0];
    return { address: r.formatted_address, lat: r.geometry.location.lat, lng: r.geometry.location.lng };
  } catch {
    return null;
  }
}

// "30.7333,76.7794" -> a lat/lng waypoint; anything else is sent as an address.
function waypoint(s: string) {
  const m = s.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  return m ? { location: { latLng: { latitude: Number(m[1]), longitude: Number(m[2]) } } } : { address: s };
}

// ----- Routes API (gets distance/duration + encoded polyline) -----
export async function getDirections(originLatLng: string, destLatLng: string): Promise<RouteInfo | null> {
  if (!originLatLng || !destLatLng || !KEY) return null;
  try {
    const data = await googleJson(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.startLocation,routes.legs.endLocation',
      { origin: waypoint(originLatLng), destination: waypoint(destLatLng), travelMode: 'DRIVE' }
    );
    const r = data.routes?.[0];
    const leg = r?.legs?.[0];
    if (!r || !leg) return null;
    return {
      distance_km: (r.distanceMeters || 0) / 1000,
      duration_min: Math.round(parseFloat(r.duration || '0') / 60), // "1253s"
      polyline: r.polyline?.encodedPolyline || '',
      start: { lat: leg.startLocation.latLng.latitude, lng: leg.startLocation.latLng.longitude },
      end: { lat: leg.endLocation.latLng.latitude, lng: leg.endLocation.latLng.longitude },
    };
  } catch {
    return null;
  }
}

// ----- Static Map URL builder -----
export function staticMapUrl(opts: {
  pickup?: { lat: number; lng: number };
  drop?: { lat: number; lng: number };
  car?: { lat: number; lng: number };
  polyline?: string;
  width?: number;
  height?: number;
  zoom?: number;
}): string {
  const w = opts.width || 600;
  const h = opts.height || 360;
  const params: string[] = [`size=${w}x${h}`, 'scale=2', 'maptype=roadmap'];
  if (opts.pickup) params.push(`markers=color:0x4A5C2F%7Clabel:A%7C${opts.pickup.lat},${opts.pickup.lng}`);
  if (opts.drop) params.push(`markers=color:0xC62828%7Clabel:B%7C${opts.drop.lat},${opts.drop.lng}`);
  if (opts.car) params.push(`markers=color:0x4A5C2F%7Csize:mid%7C${opts.car.lat},${opts.car.lng}`);
  if (opts.polyline) params.push(`path=color:0x4A5C2Fcc%7Cweight:5%7Cenc:${encodeURIComponent(opts.polyline)}`);
  params.push(`key=${KEY}`);
  return `https://maps.googleapis.com/maps/api/staticmap?${params.join('&')}`;
}
