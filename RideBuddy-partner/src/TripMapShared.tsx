// Shared between TripMap.tsx (native) and TripMap.web.tsx.
//
// This lives in its own module deliberately: if the web variant imported the
// placeholder from "./TripMap", Metro would resolve that back to TripMap.web
// itself — a circular import that leaves the component undefined at runtime.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from './theme';
import { Ico } from './icons';

export type TripMapProps = {
  pickupLat: number;
  pickupLng: number;
  dropLat?: number | null;
  dropLng?: number | null;
  pickupLabel?: string;
  dropLabel?: string;
  height?: number;
};

/** Schematic route card, used wherever a native map is unavailable. */
export function Placeholder({
  pickupLabel, dropLabel, height = 230,
}: Pick<TripMapProps, 'pickupLabel' | 'dropLabel' | 'height'>) {
  return (
    <View style={[styles.fallback, { height }]}>
      <View style={styles.row}>
        <View style={styles.rail}>
          <View style={styles.dotFilled} />
          <View style={styles.line} />
          <View style={styles.dotHollow} />
        </View>
        <View style={{ flex: 1, gap: 18 }}>
          <Text style={styles.title} numberOfLines={2}>
            {pickupLabel || 'Pickup'}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {dropLabel || 'Drop'}
          </Text>
        </View>
      </View>
      <View style={styles.noteRow}>
        <Ico.Navigation size={13} color={theme.colors.green300} fill={theme.colors.green300} />
        <Text style={styles.note}>Live map appears in the device build</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.green50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: 16,
  },
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', paddingTop: 5 },
  dotFilled: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.brandPrimary },
  dotHollow: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: theme.colors.brandPrimary },
  line: { width: 2, flex: 1, minHeight: 26, backgroundColor: theme.colors.green100, marginVertical: 3 },
  title: { fontFamily: theme.fonts.display, fontSize: 14.5, color: theme.colors.textPrimary, lineHeight: 19 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  note: { fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.textSecondary },
});
