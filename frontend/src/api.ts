import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function authHeaders() {
  const token = await AsyncStorage.getItem('rb_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const TIMEOUT_MS = 12000;

async function request(method: string, path: string, body?: any) {
  if (!BASE) throw new Error('EXPO_PUBLIC_BACKEND_URL is not set — check frontend/.env');
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
    // React Native reports every transport failure as the bare string "Network
    // request failed" — no URL, no cause. On a device that is almost always a
    // backend URL the phone cannot route to.
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
      // EXPO_PUBLIC_BACKEND_URL pointing at the Metro dev server rather than
      // the backend (8001).
      const snippet = txt.slice(0, 60).replace(/\s+/g, ' ').trim();
      throw new Error(
        `${BASE} answered ${res.status} with "${snippet}", which is not the RideBuddy API. Check EXPO_PUBLIC_BACKEND_URL — the backend runs on port 8001.`,
      );
    }
  }
  if (!res.ok) throw new Error(data?.detail || `Request failed ${res.status}`);
  return data;
}

export type ChatMessage = {
  id: string;
  booking_id: string;
  sender_role: 'user' | 'driver';
  sender_id: string;
  body: string;
  created_at: string;
};

// Who the thread is with. On this side that is the partner, so unlike the
// partner app's view of us it carries their photo, phone and rating.
export type ChatCounterparty = {
  name: string;
  photo: string | null;
  phone: string | null;
  rating: number | null;
};

export type ChatThread = {
  booking_id: string;
  status: string;
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

export const api = {
  sendOtp: (phone: string) => request('POST', '/auth/send-otp', { phone }),
  verifyOtp: (phone: string, otp: string) => request('POST', '/auth/verify-otp', { phone, otp }),
  me: () => request('GET', '/users/me'),
  updateMe: (data: any) => request('PUT', '/users/me', data),
  listCars: () => request('GET', '/users/me/cars'),
  addCar: (data: any) => request('POST', '/users/me/cars', data),
  deleteCar: (id: string) => request('DELETE', `/users/me/cars/${id}`),
  estimate: (data: any) => request('POST', '/bookings/estimate', data),
  createBooking: (data: any) => request('POST', '/bookings', data),
  createOrder: (amount: number) => request('POST', '/payments/create-order', { amount }),
  verifyPayment: (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    request('POST', '/payments/verify', data),
  listBookings: () => request('GET', '/bookings'),
  getBooking: (id: string) => request('GET', `/bookings/${id}`),
  verifyStart: (id: string, code: string) => request('POST', `/bookings/${id}/verify-start`, { code }),
  verifyEnd: (id: string, code: string) => request('POST', `/bookings/${id}/verify-end`, { code }),
  cancelBooking: (id: string) => request('POST', `/bookings/${id}/cancel`),
  simulateArrived: (id: string) => request('POST', `/bookings/${id}/simulate-arrived`),

  // Chat. Shared with the partner app — the backend tells the two sides apart
  // by token role, and `me` echoes which side we are so a message renders as
  // ours without trusting local state.
  chatThreads: (): Promise<ChatThread[]> => request('GET', '/chat/threads'),
  chatMessages: (id: string): Promise<ChatConversation> => request('GET', `/chat/${id}/messages`),
  chatSend: (id: string, body: string): Promise<ChatMessage> =>
    request('POST', `/chat/${id}/messages`, { body }),
  chatRead: (id: string) => request('POST', `/chat/${id}/read`),
  chatUnread: (): Promise<{ unread: number }> => request('GET', '/chat/unread'),
};

export const saveToken = (t: string) => AsyncStorage.setItem('rb_token', t);
export const clearToken = () => AsyncStorage.removeItem('rb_token');
export const getToken = () => AsyncStorage.getItem('rb_token');
