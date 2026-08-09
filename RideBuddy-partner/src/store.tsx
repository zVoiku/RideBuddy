// App-wide state: session, the partner's trips (3s polling, matching the client
// app's cadence) and the toast host.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api, clearToken, getToken, Partner, Trip } from './api';
import { ACTIVE_STATES } from './theme';

type ToastSpec = { type?: 'success' | 'info' | 'error'; title: string; body?: string };

type Ctx = {
  partner: Partner | null;
  trips: Trip[];
  loading: boolean;
  ready: boolean;
  error: string | null;
  toast: (ToastSpec & { key: number }) | null;
  activeTrip: Trip | null;
  unread: number;
  showToast: (t: ToastSpec) => void;
  hideToast: () => void;
  refresh: () => Promise<void>;
  signIn: (partner: Partner) => void;
  signOut: () => Promise<void>;
  setAvailability: (v: boolean) => Promise<void>;
  tripById: (id?: string) => Trip | undefined;
};

const RBContext = createContext<Ctx | null>(null);

const POLL_MS = 3000;

export function Provider({ children }: { children: React.ReactNode }) {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<(ToastSpec & { key: number }) | null>(null);
  const [unread, setUnread] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((t: ToastSpec) => setToast({ ...t, key: Date.now() }), []);
  const hideToast = useCallback(() => setToast(null), []);

  const refresh = useCallback(async () => {
    try {
      const list = await api.trips();
      setTrips(list);
      setError(null);
      // Rides on the same poll as trips so the tab badge stays live without a
      // second timer. A chat failure must not blank the trip list.
      try {
        setUnread((await api.chatUnread()).unread);
      } catch {}
    } catch (e: any) {
      // A dead session (in-memory DB restart) must not spin forever.
      if (/Partner not found|Invalid token|Missing auth/i.test(e?.message || '')) {
        await clearToken();
        setPartner(null);
      }
      setError(e?.message || 'Could not reach the server');
    }
  }, []);

  // Restore an existing session on cold start.
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const me = await api.me();
          setPartner(me);
          await refresh();
        } catch {
          await clearToken();
        }
      }
      setReady(true);
    })();
  }, []);

  // Poll while signed in and foregrounded.
  useEffect(() => {
    const stop = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
    const start = () => {
      stop();
      if (!partner) return;
      timer.current = setInterval(refresh, POLL_MS);
    };
    start();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => {
      stop();
      sub.remove();
    };
  }, [partner, refresh]);

  const signIn = useCallback((p: Partner) => {
    setPartner(p);
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const signOut = useCallback(async () => {
    await clearToken();
    setPartner(null);
    setTrips([]);
    setUnread(0);
  }, []);

  const setAvailability = useCallback(async (v: boolean) => {
    // Optimistic: the toggle should feel instant.
    setPartner((p) => (p ? { ...p, available: v } : p));
    try {
      await api.setAvailability(v);
    } catch (e: any) {
      setPartner((p) => (p ? { ...p, available: !v } : p));
      showToast({ type: 'error', title: 'Could not update your status.' });
    }
  }, [showToast]);

  const tripById = useCallback((id?: string) => trips.find((t) => t.id === id), [trips]);

  const activeTrip = trips.find((t) => ACTIVE_STATES.includes(t.status)) || null;

  return (
    <RBContext.Provider
      value={{
        partner, trips, loading, ready, error, toast, activeTrip, unread,
        showToast, hideToast, refresh, signIn, signOut, setAvailability, tripById,
      }}
    >
      {children}
    </RBContext.Provider>
  );
}

export function useRB() {
  const ctx = useContext(RBContext);
  if (!ctx) throw new Error('useRB must be used inside <Provider>');
  return ctx;
}
