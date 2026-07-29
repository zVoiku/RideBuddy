import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

// Namespaced separately from the client app's `rb_token` so both apps can be
// installed on the same device without clobbering each other's session.
const TOKEN_KEY = 'rbp_token';

export type TripStatus =
  | 'pending' | 'searching' | 'assigned' | 'en_route'
  | 'arrived' | 'in_progress' | 'completed' | 'cancelled';

export type Trip = {
  id: string;
  status: TripStatus;
  customer: string;          // masked — "Aarti M."
  trip_type: string;
  one_way: boolean;
  round_trip: boolean;
  pickup_address: string;
  drop_address: string | null;  // withheld for round trips until the day
  drop_area: string | null;
  pickup_lat: number; pickup_lng: number;
  drop_lat: number | null; drop_lng: number | null;
  distance_km: number;
  duration_hours: number;
  days: number;
  transmission: 'Manual' | 'Automatic';
  car: string | null;
  make: string | null;
  model: string | null;
  scheduled_at: string | null;
  return_at: string | null;
  schedule_now: boolean;
  intersect_at_owner: boolean;
  earnings: number;
  created_at: string;
  left_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  rating: number | null;
  comment: string | null;
};

export type Partner = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  licence: string | null;
  photo: string | null;
  rating: number;
  trips: number;
  aadhaar_verified: boolean;
  police_verified: boolean;
  available: boolean;
  is_new: boolean;
  joined: string;
};

export type Earnings = {
  lifetime: number;
  trips_completed: number;
  commission_rate: number;
  trips: {
    id: string;
    earnings: number;
    fare: number;
    completed_at: string | null;
    pickup_address: string;
    drop_address: string | null;
    rating: number | null;
  }[];
};

async function authHeaders() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// A phone can't reach the backend on `localhost`, so a misconfigured
// EXPO_PUBLIC_BACKEND_URL fails at the transport layer. RN reports every such
// failure as the bare string "Network request failed" — no URL, no cause — and
// without a timeout the UI just spins until the OS gives up. Both are fixed
// here so the error names the address it actually tried.
const TIMEOUT_MS = 12000;

async function request(method: string, path: string, body?: any) {
  if (!BASE) throw new Error('EXPO_PUBLIC_BACKEND_URL is not set — check RideBuddy-partner/.env');
  const headers: any = { 'Content-Type': 'application/json', ...(await authHeaders()) };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error(`No response from ${BASE} after ${TIMEOUT_MS / 1000}s. On a device, check it is the Mac's LAN IP (not localhost) and that the backend runs with --host 0.0.0.0.`);
    }
    throw new Error(`Cannot reach ${BASE} — ${e?.message || 'network request failed'}`);
  } finally {
    clearTimeout(timer);
  }

  const txt = await res.text();
  const data = txt ? JSON.parse(txt) : null;
  if (!res.ok) throw new Error(data?.detail || `Request failed ${res.status}`);
  return data;
}

export const api = {
  sendOtp: (phone: string) => request('POST', '/driver/auth/send-otp', { phone }),
  verifyOtp: (phone: string, otp: string): Promise<{ token: string; partner: Partner }> =>
    request('POST', '/driver/auth/verify-otp', { phone, otp }),

  me: (): Promise<Partner> => request('GET', '/driver/me'),
  updateMe: (data: { name?: string; email?: string; licence?: string }): Promise<Partner> =>
    request('PUT', '/driver/me', data),
  setAvailability: (available: boolean): Promise<{ available: boolean }> =>
    request('PATCH', '/driver/availability', { available }),

  trips: (): Promise<Trip[]> => request('GET', '/driver/trips'),
  trip: (id: string): Promise<Trip> => request('GET', `/driver/trips/${id}`),

  leftForPickup: (id: string): Promise<Trip> => request('POST', `/driver/trips/${id}/left-for-pickup`),
  arrived: (id: string): Promise<Trip> => request('POST', `/driver/trips/${id}/arrived`),
  // The partner types the 4-digit code the owner reads out to them.
  verifyStart: (id: string, code: string): Promise<Trip> =>
    request('POST', `/driver/trips/${id}/verify-start`, { code }),
  dropTrip: (id: string) => request('POST', `/driver/trips/${id}/cancel`),

  earnings: (): Promise<Earnings> => request('GET', '/driver/earnings'),
};

export const saveToken = (t: string) => AsyncStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => AsyncStorage.removeItem(TOKEN_KEY);
export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);
