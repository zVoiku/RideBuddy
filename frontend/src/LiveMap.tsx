// LiveMap (native) — interactive react-native-maps in a dev/production build.
//
// react-native-maps ships native code that is NOT bundled in Expo Go (SDK 54);
// importing it there throws a TurboModuleRegistry error. So we only load it in a
// dev/standalone build, and in Expo Go we fall back to a Google Static Maps image
// (real map tiles + route + pins) — or the SVG RouteMap if no API key is set.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Image, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';
import RouteMap, { decodePolyline } from './RouteMap';
import { staticMapUrl } from './maps';

const isExpoGo =
  Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';

// Only require the native module outside Expo Go (where it would throw on load).
let Maps: any = null;
if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Maps = require('react-native-maps');
  } catch {
    Maps = null;
  }
}

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

interface Props {
  polyline?: string;
  pickup?: { lat: number; lng: number; label?: string };
  drop?: { lat: number; lng: number; label?: string };
  driverLocation?: { lat: number; lng: number };
  simulate?: boolean; // animate the car along the polyline
  height?: number | string;
}

export default function LiveMap({ polyline, pickup, drop, driverLocation, simulate = true, height = '100%' as any }: Props) {
  const route = useMemo(() => (polyline ? decodePolyline(polyline) : []), [polyline]);
  const [idx, setIdx] = useState(0);
  const mapRef = useRef<any>(null);

  // Simulated car position
  const [car, setCar] = useState<{ latitude: number; longitude: number } | null>(
    driverLocation ? { latitude: driverLocation.lat, longitude: driverLocation.lng } : null
  );

  useEffect(() => {
    if (!simulate || route.length < 2) return;
    setIdx(0);
    const timer = setInterval(() => {
      setIdx((prev) => {
        const next = prev + 1;
        if (next >= route.length) return 0;
        return next;
      });
    }, 1200);
    return () => clearInterval(timer);
  }, [simulate, route.length]);

  useEffect(() => {
    if (!simulate || route.length === 0) return;
    const [lat, lng] = route[Math.min(idx, route.length - 1)];
    setCar({ latitude: lat, longitude: lng });
  }, [idx, route, simulate]);

  // Compute initial region to fit the route or pickup/drop
  const region = useMemo(() => {
    const pts: Array<[number, number]> = [];
    if (route.length) pts.push(...route);
    if (pickup) pts.push([pickup.lat, pickup.lng]);
    if (drop) pts.push([drop.lat, drop.lng]);
    if (!pts.length) {
      // Default Mumbai
      return { latitude: 19.076, longitude: 72.8777, latitudeDelta: 0.5, longitudeDelta: 0.5 };
    }
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const dLat = Math.max(0.04, (maxLat - minLat) * 1.4);
    const dLng = Math.max(0.04, (maxLng - minLng) * 1.4);
    return { latitude: midLat, longitude: midLng, latitudeDelta: dLat, longitudeDelta: dLng };
  }, [route, pickup, drop]);

  // Convert polyline to MapView format
  const coords = useMemo(() => route.map(([la, ln]) => ({ latitude: la, longitude: ln })), [route]);

  // Google Static Map URL for the Expo Go / no-native-maps fallback (fetched once;
  // we intentionally omit the moving car here to avoid re-fetching every tick).
  const staticUri = useMemo(
    () => (GOOGLE_KEY ? staticMapUrl({ pickup, drop, polyline, width: 640, height: 480 }) : ''),
    [pickup, drop, polyline]
  );

  // ----- Expo Go / no native maps available -----
  if (!Maps?.default) {
    const h = typeof height === 'number' ? height : 380;
    if (staticUri) {
      return (
        <View style={[styles.wrap, { height: h }]}>
          <Image source={{ uri: staticUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </View>
      );
    }
    // No API key configured — show the lightweight SVG route instead of a blank map.
    return (
      <View style={[styles.wrap, { height: h }]}>
        <RouteMap polyline={polyline || ''} height={h} />
      </View>
    );
  }

  // ----- Dev / standalone build: full interactive map -----
  const { default: MapView, Marker, Polyline: MapPolyline, PROVIDER_GOOGLE } = Maps;

  return (
    <View style={[styles.wrap, { height: height as any }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {coords.length > 1 && (
          <MapPolyline
            coordinates={coords}
            strokeColor={theme.colors.primary}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}
        {pickup && (
          <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} title={pickup.label || 'Pickup'} pinColor={theme.colors.primary}>
            <View style={[styles.pin, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="location" size={16} color="#fff" />
            </View>
          </Marker>
        )}
        {drop && (
          <Marker coordinate={{ latitude: drop.lat, longitude: drop.lng }} title={drop.label || 'Drop'} pinColor={theme.colors.error}>
            <View style={[styles.pin, { backgroundColor: theme.colors.error }]}>
              <Ionicons name="flag" size={14} color="#fff" />
            </View>
          </Marker>
        )}
        {car && (
          <Marker coordinate={car} title="Your Ride" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.carPin}>
              <Ionicons name="car-sport" size={20} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: theme.colors.primarySoft },
  pin: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  carPin: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
});
