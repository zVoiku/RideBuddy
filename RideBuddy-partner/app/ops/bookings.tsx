// All Bookings — the working list. Defaults to open trips (Received →
// Confirmed → In Progress); completed and cancelled are behind the scope chips
// so the list stays about what still needs attention.
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, OpsBooking } from '../../src/api';
import { theme } from '../../src/theme';
import { Ico } from '../../src/icons';
import { OpsNav, OpsHeader, OpsBadge, OpsCard, Urgency, money } from '../../src/ops-ui';

const SCOPES = [
  { id: 'open', label: 'Open' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

const SORTS = [
  { id: 'status', label: 'Status' },
  { id: 'soonest', label: 'Soonest' },
  { id: 'fare', label: 'Fare' },
] as const;

function route(b: OpsBooking) {
  const tail = (a: string | null) => (a || '').split(',').slice(-1)[0].trim();
  return [tail(b.pickup_address), tail(b.drop_address)].filter(Boolean).join(' → ');
}

function when(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
    + ' · ' + new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function OpsBookings() {
  const router = useRouter();
  const [scope, setScope] = useState<string>('open');
  const [sort, setSort] = useState<string>('status');
  const [rows, setRows] = useState<OpsBooking[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.opsBookings(scope, sort));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || 'Could not load bookings.');
    }
  }, [scope, sort]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <OpsHeader title="Bookings" subtitle={rows ? `${rows.length} trips` : ' '} />

      <View style={styles.chips}>
        {SCOPES.map((s) => (
          <Pressable key={s.id} onPress={() => { setScope(s.id); setRows(null); }}
            style={[styles.chip, scope === s.id && styles.chipOn]} accessibilityRole="button">
            <Text style={[styles.chipTxt, scope === s.id && styles.chipTxtOn]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLbl}>Sort</Text>
        {SORTS.map((s) => (
          <Pressable key={s.id} onPress={() => { setSort(s.id); setRows(null); }}
            accessibilityRole="button">
            <Text style={[styles.sortTxt, sort === s.id && styles.sortTxtOn]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={theme.colors.brandPrimary}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {!!err && <Text style={styles.err}>{err}</Text>}
        {!rows && !err && <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 24 }} />}
        {rows && !rows.length && <Text style={styles.empty}>No {scope} bookings.</Text>}

        {!!rows?.length && (
          <OpsCard>
            {rows.map((b, i) => (
              <Pressable
                key={b.id}
                onPress={() => router.push(`/ops/booking/${b.id}` as any)}
                style={[styles.row, i > 0 && styles.rowSep]}
                accessibilityRole="button"
                accessibilityLabel={`Booking ${route(b)}`}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTop}>
                    <OpsBadge label={b.label} />
                    {b.label === 'Received' ? <Urgency at={b.scheduled_at} /> : null}
                    {b.payment_failed && <Text style={styles.failTag}>Payment failed</Text>}
                  </View>
                  <Text style={styles.title} numberOfLines={1}>{route(b)}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {b.customer.name || 'Customer'}
                    {b.buddy ? ` · ${b.buddy.name}` : ' · unassigned'}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {when(b.scheduled_at)} · {money(b.fare)}
                  </Text>
                </View>
                <Ico.ChevronRight size={17} color={theme.colors.grey400} />
              </Pressable>
            ))}
          </OpsCard>
        )}
      </ScrollView>

      <OpsNav />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceCard,
  },
  chipOn: { backgroundColor: theme.colors.brandPrimary },
  chipTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: theme.colors.textSecondary },
  chipTxtOn: { color: '#fff' },

  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingTop: 12 },
  sortLbl: { fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.grey400 },
  sortTxt: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary },
  sortTxtOn: { fontFamily: theme.fonts.bodySemi, color: theme.colors.green700 },

  scroll: { padding: 16, paddingBottom: 28 },
  err: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error, marginBottom: 8 },
  empty: { fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 30 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(100,100,100,0.13)' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  title: { fontFamily: theme.fonts.display, fontSize: 14.5, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  meta: { fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.grey400, marginTop: 2 },
  failTag: { fontFamily: theme.fonts.bodySemi, fontSize: 11, color: theme.colors.error },
});
