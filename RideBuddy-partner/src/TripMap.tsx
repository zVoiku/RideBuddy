// Trip map — a real Google map on device (react-native-maps, matching the
// client app), with pickup/drop pins in the brand palette.
//
// react-native-maps is a native module, so it is absent in Expo Go and on web:
// TripMap.web.tsx serves the schematic fallback on web, and the require guard
// below covers Expo Go on device.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from './theme';
import { Placeholder, TripMapProps } from './TripMapShared';

export type { TripMapProps };

let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = undefined;
try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
} catch {
  // Expo Go — no native map module available.
}

function regionFor(p: [number, number], d?: [number, number] | null) {
  if (!d) {
    return { latitude: p[0], longitude: p[1], latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }
  // 60% padding so both pins sit comfortably inside the frame.
  return {
    latitude: (p[0] + d[0]) / 2,
    longitude: (p[1] + d[1]) / 2,
    latitudeDelta: Math.max(Math.abs(p[0] - d[0]) * 1.6, 0.05),
    longitudeDelta: Math.max(Math.abs(p[1] - d[1]) * 1.6, 0.05),
  };
}

export default function TripMap({
  pickupLat, pickupLng, dropLat, dropLng, pickupLabel, dropLabel, height = 230,
}: TripMapProps) {
  const hasDrop = dropLat != null && dropLng != null;

  if (!MapView) {
    return <Placeholder pickupLabel={pickupLabel} dropLabel={dropLabel} height={height} />;
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={regionFor([pickupLat, pickupLng], hasDrop ? [dropLat!, dropLng!] : null)}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <Marker
          coordinate={{ latitude: pickupLat, longitude: pickupLng }}
          title={pickupLabel}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.pinFilled} />
        </Marker>
        {hasDrop && (
          <>
            <Marker
              coordinate={{ latitude: dropLat!, longitude: dropLng! }}
              title={dropLabel}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.pinHollow} />
            </Marker>
            <Polyline
              coordinates={[
                { latitude: pickupLat, longitude: pickupLng },
                { latitude: dropLat!, longitude: dropLng! },
              ]}
              strokeColor={theme.colors.brandPrimary}
              strokeWidth={3}
              lineDashPattern={[6, 6]}
            />
          </>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  pinFilled: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: theme.colors.brandPrimary,
    borderWidth: 3, borderColor: '#fff',
  },
  pinHollow: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 4, borderColor: theme.colors.brandPrimary,
  },
});
