// Google Maps helpers — uses REST APIs only (no native module needed for Expo preview)
// API key from EXPO_PUBLIC_GOOGLE_MAPS_KEY in .env

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

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

// ----- Places Autocomplete -----
export async function placesAutocomplete(input: string): Promise<PlaceSuggestion[]> {
  if (!input || input.length < 2 || !KEY) return [];
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:in&key=${KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('Places autocomplete error', data.status, data.error_message);
      return [];
    }
    return (data.predictions || []).map((p: any) => ({
      description: p.description,
      place_id: p.place_id,
      main_text: p.structured_formatting?.main_text || p.description,
      secondary_text: p.structured_formatting?.secondary_text || '',
    }));
  } catch (e) {
    console.warn('Places autocomplete fetch failed', e);
    return [];
  }
}

// ----- Place details (lat/lng for a place_id) -----
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!placeId || !KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return null;
    const loc = data.result.geometry?.location;
    return loc ? { address: data.result.formatted_address, lat: loc.lat, lng: loc.lng } : null;
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

// ----- Directions API (gets distance/duration + encoded polyline) -----
export async function getDirections(originLatLng: string, destLatLng: string): Promise<RouteInfo | null> {
  if (!originLatLng || !destLatLng || !KEY) return null;
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originLatLng)}&destination=${encodeURIComponent(destLatLng)}&mode=driving&key=${KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' || !data.routes?.length) return null;
    const r = data.routes[0];
    const leg = r.legs[0];
    return {
      distance_km: leg.distance.value / 1000,
      duration_min: Math.round(leg.duration.value / 60),
      polyline: r.overview_polyline?.points || '',
      start: { lat: leg.start_location.lat, lng: leg.start_location.lng },
      end: { lat: leg.end_location.lat, lng: leg.end_location.lng },
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
