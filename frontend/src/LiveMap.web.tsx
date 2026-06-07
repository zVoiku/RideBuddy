// LiveMap (web fallback) — react-native-maps does not render on web.
// We reuse the existing SVG RouteMap component for a static visual.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RouteMap, { decodePolyline } from './RouteMap';
import { theme } from './theme';

interface Props {
  polyline?: string;
  pickup?: { lat: number; lng: number; label?: string };
  drop?: { lat: number; lng: number; label?: string };
  driverLocation?: { lat: number; lng: number };
  simulate?: boolean;
  height?: number | string;
}

export default function LiveMap({ polyline, pickup, drop, simulate = true, height = 360 }: Props) {
  const route = useMemo(() => (polyline ? decodePolyline(polyline) : []), [polyline]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!simulate || route.length < 2) return;
    setIdx(0);
    const t = setInterval(() => setIdx((p) => (p + 1) % route.length), 1200);
    return () => clearInterval(t);
  }, [simulate, route.length]);

  const progress = route.length ? Math.round((idx / Math.max(1, route.length - 1)) * 100) : 0;
  const h = typeof height === 'number' ? height : 380;

  return (
    <View style={[styles.wrap, { height: h as any }]}>
      {polyline ? (
        <RouteMap polyline={polyline} height={h} />
      ) : (
        <View style={[styles.empty, { height: h }]}>
          <Ionicons name="map" size={48} color={theme.colors.primary} />
          <Text style={styles.emptyText}>Map preview not available in web mode</Text>
        </View>
      )}
      <View style={styles.overlay}>
        <View style={styles.car}>
          <Ionicons name="car-sport" size={20} color="#fff" />
        </View>
        <Text style={styles.progressText}>Progress {progress}%</Text>
        <Text style={styles.hint}>Live map preview in mobile builds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: theme.colors.primarySoft, position: 'relative' },
  empty: { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.softCard },
  emptyText: { color: theme.colors.textSecondary },
  overlay: { position: 'absolute', left: 14, right: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  car: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  progressText: { fontWeight: '900', color: theme.colors.textPrimary },
  hint: { color: theme.colors.textSecondary, fontSize: 11, marginLeft: 'auto' },
});
