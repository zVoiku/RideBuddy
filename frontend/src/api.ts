import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function authHeaders() {
  const token = await AsyncStorage.getItem('rb_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(method: string, path: string, body?: any) {
  const headers: any = { 'Content-Type': 'application/json', ...(await authHeaders()) };
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  const data = txt ? JSON.parse(txt) : null;
  if (!res.ok) throw new Error(data?.detail || `Request failed ${res.status}`);
  return data;
}

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
  listBookings: () => request('GET', '/bookings'),
  getBooking: (id: string) => request('GET', `/bookings/${id}`),
  verifyStart: (id: string, code: string) => request('POST', `/bookings/${id}/verify-start`, { code }),
  verifyEnd: (id: string, code: string) => request('POST', `/bookings/${id}/verify-end`, { code }),
  cancelBooking: (id: string) => request('POST', `/bookings/${id}/cancel`),
  simulateArrived: (id: string) => request('POST', `/bookings/${id}/simulate-arrived`),
};

export const saveToken = (t: string) => AsyncStorage.setItem('rb_token', t);
export const clearToken = () => AsyncStorage.removeItem('rb_token');
export const getToken = () => AsyncStorage.getItem('rb_token');
