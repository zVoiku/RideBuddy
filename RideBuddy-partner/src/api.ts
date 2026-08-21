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

export type ChatMessage = {
  id: string;
  booking_id: string;
  sender_role: 'user' | 'driver';
  sender_id: string;
  body: string;
  created_at: string;
};

// Who the thread is with. On this side that is the owner, so `phone` and
// `photo` are always null — partners get the masked name only.
export type ChatCounterparty = {
  name: string;
  photo: string | null;
  phone: string | null;
  rating: number | null;
};

export type ChatThread = {
  booking_id: string;
  status: TripStatus;
  closed: boolean;
  with: ChatCounterparty;
  pickup_address: string | null;
  drop_address: string | null;
  scheduled_at: string | null;
  last_message: ChatMessage | null;
  unread: number;
};

export type ChatConversation = {
  thread: ChatThread;
  me: 'user' | 'driver';
  messages: ChatMessage[];
};

// ── Ops console ─────────────────────────────────────────────────────────────
export type OpsUser = { phone: string; name: string | null };

export type OpsMetrics = {
  total: number; completed: number; in_progress: number; confirmed: number;
  pending: number; cancelled: number;
  completion_rate: number; cancellation_rate: number; avg_fare: number;
  top_cancel_reason: string;
  active_buddies: number; on_duty: number; available: number;
  utilisation_pct: number; avg_rating: number; utilisation: number;
  applied: number; in_verification: number; verified_ready: number;
  in_pipeline: number; onboarding: number; dormant: number;
  avg_days_in_pipeline: number; punjab: number; himachal: number;
  earnings_per_buddy: number;
  payment_rate: number; payments_failed: number;
  deposits_collected: number; balance_collected: number;
  refunds_pending: number; refunds_pending_value: number;
  revenue: number; commission_pct: number;
};

// Ops sees customers in full — this is the founder's console, not a partner's.
export type OpsBooking = {
  id: string;
  status: TripStatus;
  label: string;               // the design's vocabulary: Received, Confirmed, …
  customer: { id: string | null; name: string | null; phone: string | null; email: string | null };
  buddy: { id: string; name: string | null; phone: string | null; rating: number | null } | null;
  pickup_address: string | null;
  drop_address: string | null;
  one_way: boolean;
  days: number;
  distance_km: number;
  scheduled_at: string | null;
  return_at: string | null;
  created_at: string;
  fare: number;
  deposit: number;
  balance: number;
  paid_amount: number;
  payment_failed: boolean;
  refund_done: boolean;
  cancel_reason: string | null;
  rating: number | null;
  transmission: string | null;
  // detail only
  breakdown?: Record<string, any>;
  payout?: number;
  commission?: { commission: number; gst: number; net_revenue: number; commission_pct: number };
  car?: string | null;
  plate?: string | null;
  comment?: string | null;
  customer_stay?: boolean;
  timeline?: Record<string, string | null>;
};

export type OpsBuddy = {
  id: string;
  name: string | null;
  phone: string;
  licence: string | null;
  photo: string | null;
  rating: number;
  trips: number;
  active: boolean;
  available: boolean;
  onboarding: boolean;
  stage: 'applied' | 'verification' | 'verified' | null;
  joined: string | null;
  applied_at: string | null;
  region: 'Punjab' | 'Himachal';
  trips_in_system: number;
  completed: number;
  earnings: number;
  on_duty: boolean;
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
  let data: any = null;
  if (txt) {
    try {
      data = JSON.parse(txt);
    } catch {
      // Something answered, but it isn't this API — almost always
      // EXPO_PUBLIC_BACKEND_URL pointing at the Metro dev server (8081) rather
      // than the backend (8001). Raw "JSON Parse error: Unexpected character"
      // gives nothing to act on, so name the address and quote the reply.
      const snippet = txt.slice(0, 60).replace(/\s+/g, ' ').trim();
      throw new Error(
        `${BASE} answered ${res.status} with "${snippet}", which is not the RideBuddy API. Check EXPO_PUBLIC_BACKEND_URL — the backend runs on port 8001.`,
      );
    }
  }
  if (!res.ok) throw new Error(data?.detail || `Request failed ${res.status}`);
  return data;
}

export const api = {
  sendOtp: (phone: string) => request('POST', '/driver/auth/send-otp', { phone }),
  // One login endpoint for both apps: `role` says which shell to open, and only
  // the matching payload is present.
  verifyOtp: (phone: string, otp: string): Promise<{
    role: 'ops' | 'driver'; token: string; partner: Partner; ops?: OpsUser;
  }> =>
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

  // Chat. These routes are shared with the client app — the backend tells the
  // two sides apart by token role, and `me` echoes which side we are so a
  // message can be rendered as ours without trusting local state.
  chatThreads: (): Promise<ChatThread[]> => request('GET', '/chat/threads'),
  chatMessages: (id: string): Promise<ChatConversation> => request('GET', `/chat/${id}/messages`),
  chatSend: (id: string, body: string): Promise<ChatMessage> =>
    request('POST', `/chat/${id}/messages`, { body }),
  chatRead: (id: string) => request('POST', `/chat/${id}/read`),
  chatUnread: (): Promise<{ unread: number }> => request('GET', '/chat/unread'),

  // Ops console. Same login endpoint as the partner app — the backend decides
  // the role from the number, and these routes 403 for a driver token.
  opsMe: (): Promise<OpsUser> => request('GET', '/ops/me'),
  opsMetrics: (): Promise<OpsMetrics> => request('GET', '/ops/metrics'),
  opsBookings: (scope = 'open', sort = 'status'): Promise<OpsBooking[]> =>
    request('GET', `/ops/bookings?scope=${scope}&sort=${sort}`),
  opsBooking: (id: string): Promise<OpsBooking> => request('GET', `/ops/bookings/${id}`),
  opsAssign: (id: string, buddyId: string): Promise<OpsBooking> =>
    request('POST', `/ops/bookings/${id}/assign`, { buddy_id: buddyId }),
  opsRefund: (id: string) => request('POST', `/ops/bookings/${id}/refund`),
  opsBuddies: (): Promise<OpsBuddy[]> => request('GET', '/ops/buddies'),
  opsBuddy: (id: string): Promise<OpsBuddy & { recent: OpsBooking[] }> =>
    request('GET', `/ops/buddies/${id}`),
  opsAddBuddy: (data: { phone: string; name?: string; licence?: string; email?: string }) =>
    request('POST', '/ops/buddies', data),
  opsPatchBuddy: (id: string, data: { active?: boolean; stage?: string }) =>
    request('PATCH', `/ops/buddies/${id}`, data),
  // One-way: nothing in the partner app comes back here.
  opsSwitchToPartner: (): Promise<{ token: string; partner: Partner }> =>
    request('POST', '/ops/switch-to-partner'),
};

export const saveToken = (t: string) => AsyncStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => AsyncStorage.removeItem(TOKEN_KEY);
export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);
