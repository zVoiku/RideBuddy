// Polyline decoder + RouteMap component — renders the encoded polyline as inline SVG.
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { theme } from './theme';

// Decode Google's encoded polyline into [lat,lng] points.
export function decodePolyline(encoded: string): Array<[number, number]> {
  if (!encoded) return [];
  const pts: Array<[number, number]> = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let result = 0, shift = 0, b;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    result = 0; shift = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
}

interface Props {
  polyline: string;
  height?: number;
  showMarkers?: boolean;
}

export default function RouteMap({ polyline, height = 180, showMarkers = true }: Props) {
  const pts = useMemo(() => decodePolyline(polyline), [polyline]);
  if (pts.length < 2) {
    return <View style={[styles.empty, { height }]} />;
  }
  // Normalise to 0..1 then to SVG view-box 1000x500
  const lats = pts.map((p) => p[0]); const lngs = pts.map((p) => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const pad = 0.08;
  const W = 1000, H = Math.round((height / 320) * 500); // proportional viewbox height
  const project = ([la, ln]: [number, number]) => {
    const x = ((ln - minLng) / Math.max(1e-9, maxLng - minLng)) * (1 - pad * 2) * W + pad * W;
    const y = (1 - (la - minLat) / Math.max(1e-9, maxLat - minLat)) * (1 - pad * 2) * H + pad * H;
    return [x, y];
  };
  const [sx, sy] = project(pts[0]);
  const [ex, ey] = project(pts[pts.length - 1]);
  const d = pts.map((p, i) => {
    const [x, y] = project(p);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  return (
    <View style={[styles.wrap, { height }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Subtle grid backdrop */}
        <Path d={`M0 ${H * 0.5} L${W} ${H * 0.5}`} stroke="rgba(0,0,0,0.04)" strokeWidth={1} />
        <Path d={`M${W * 0.5} 0 L${W * 0.5} ${H}`} stroke="rgba(0,0,0,0.04)" strokeWidth={1} />
        {/* Route */}
        <Path d={d} stroke={theme.colors.primary} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {showMarkers && (
          <>
            <Circle cx={sx} cy={sy} r={14} fill={theme.colors.primary} stroke="#fff" strokeWidth={4} />
            <Circle cx={ex} cy={ey} r={14} fill={theme.colors.error} stroke="#fff" strokeWidth={4} />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: theme.radius.lg, backgroundColor: theme.colors.primarySoft, overflow: 'hidden' },
  empty: { width: '100%', borderRadius: theme.radius.lg, backgroundColor: theme.colors.softCard },
});
