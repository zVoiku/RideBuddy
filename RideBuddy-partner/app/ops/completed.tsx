// Completed trips — the archive, opened from Account. Kept off the Bookings
// list so that list stays about work still outstanding.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, OpsBooking } from '../../src/api';
import { theme } from '../../src/theme';
import { Ico } from '../../src/icons';
import { OpsHeader, OpsCard, Section, StatTile, money } from '../../src/ops-ui';

const tail = (a?: string | null) => (a || '').split(',').slice(-1)[0].trim();

export default function OpsCompleted() {
  const router = useRouter();
  const [rows, setRows] = useState<OpsBooking[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.opsBookings('completed', 'soonest');
      // Newest first: an archive reads backwards.
      setRows([...list].reverse());
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || 'Could not load completed trips.');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totals = useMemo(() => {
    const l = rows || [];
    const rated = l.filter((b) => b.rating);
    return {
      count: l.length,
      fares: l.reduce((s, b) => s + b.fare, 0),
      rating: rated.length ? (rated.reduce((s, b) => s + (b.rating || 0), 0) / rated.length).toFixed(1) : '—',
    };
  }, [rows]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <OpsHeader title="Completed trips" subtitle={rows ? `${rows.length} trips` : ' '}
        onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {!!err && <Text style={styles.err}>{err}</Text>}
        {!rows && !err && <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 30 }} />}

        {!!rows && (
          <>
            <View style={styles.grid}>
              <StatTile label="Trips" value={totals.count} hint="All time" />
              <StatTile label="Fares" value={money(totals.fares)} hint="Gross" />
              <StatTile label="Avg rating" value={totals.rating} hint="Rated trips" />
            </View>

            <Section title="History" />
            {!rows.length ? (
              <Text style={styles.empty}>No completed trips yet.</Text>
            ) : (
              <OpsCard>
                {rows.map((b, i) => (
                  <Pressable
                    key={b.id}
                    onPress={() => router.push(`/ops/booking/${b.id}` as any)}
                    style={[styles.row, i > 0 && styles.rowSep]}
                    accessibilityRole="button"
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.title} numberOfLines={1}>
                        {tail(b.pickup_address)} → {tail(b.drop_address)}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {b.customer.name || 'Customer'}{b.buddy ? ` · ${b.buddy.name}` : ''}
                      </Text>
                      <Text style={styles.meta}>
                        {b.timeline?.completed_at || b.scheduled_at
                          ? new Date((b.timeline?.completed_at || b.scheduled_at) as string)
                              .toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
                          : ''}
                        {' · '}{money(b.fare)}
                        {b.rating ? ` · ${b.rating}★` : ''}
                      </Text>
                    </View>
                    <Ico.ChevronRight size={17} color={theme.colors.grey400} />
                  </Pressable>
                ))}
              </OpsCard>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 34 },
  err: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error },
  empty: { fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(100,100,100,0.13)' },
  title: { fontFamily: theme.fonts.display, fontSize: 14.5, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  meta: { fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.grey400, marginTop: 2 },
});
