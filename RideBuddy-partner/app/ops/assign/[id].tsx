// Assign a Buddy to a pending trip. Ops assignment overrides the backend's
// auto-matcher, so the list leads with who is actually free.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { api, OpsBooking, OpsBuddy } from '../../../src/api';
import { useRB } from '../../../src/store';
import { theme } from '../../../src/theme';
import { Avatar } from '../../../src/ui';
import { OpsHeader, OpsCard, Section, Urgency, money } from '../../../src/ops-ui';

export default function OpsAssign() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useRB();
  const [booking, setBooking] = useState<OpsBooking | null>(null);
  const [buddies, setBuddies] = useState<OpsBuddy[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [b, list] = await Promise.all([api.opsBooking(id), api.opsBuddies()]);
      setBooking(b);
      setBuddies(list);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || 'Could not load this trip.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Free and on-duty are both shown — assigning someone mid-trip is a judgement
  // call, not something to hide, but it should never be the default.
  const [free, busyNow, inactive] = useMemo(() => {
    const l = buddies || [];
    const match = (b: OpsBuddy) => !booking || !booking.transmission
      || b.active; // transmission capability is not modelled per-Buddy yet
    return [
      l.filter((b) => b.active && !b.on_duty && !b.onboarding && match(b)),
      l.filter((b) => b.active && b.on_duty && !b.onboarding),
      l.filter((b) => !b.active || b.onboarding),
    ];
  }, [buddies, booking]);

  const assign = async (b: OpsBuddy) => {
    setBusy(b.id);
    try {
      await api.opsAssign(String(id), b.id);
      showToast({ type: 'success', title: `Assigned to ${b.name || 'Buddy'}.` });
      router.replace(`/ops/booking/${id}` as any);
    } catch (e: any) {
      showToast({ type: 'error', title: e?.message || 'Could not assign that Buddy.' });
      setBusy(null);
    }
  };

  const tail = (a?: string | null) => (a || '').split(',').slice(-1)[0].trim();

  const Group = ({ title, list, dim, assignable = true }: {
    title: string; list: OpsBuddy[]; dim?: boolean; assignable?: boolean;
  }) => {
    if (!list.length) return null;
    return (
      <>
        <Section title={title} right={<Text style={styles.count}>{list.length}</Text>} />
        <OpsCard style={dim ? { opacity: 0.6 } : undefined}>
          {list.map((b, i) => (
            <Pressable
              key={b.id}
              // A deactivated or still-onboarding Buddy cannot take a trip, so
              // offering the action here would only ever produce an error.
              onPress={assignable ? () => assign(b) : undefined}
              disabled={!assignable || !!busy}
              style={[styles.row, i > 0 && styles.rowSep]}
              accessibilityRole={assignable ? 'button' : undefined}
              accessibilityLabel={assignable ? `Assign ${b.name}` : b.name || b.phone}
            >
              <Avatar name={b.name} photo={b.photo} size={42} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{b.name || b.phone}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {b.region} · {b.rating || '—'}★ · {b.completed} trips
                </Text>
                {b.on_duty && <Text style={styles.dutyTag}>On a trip now</Text>}
                {b.onboarding && <Text style={styles.dutyTag}>In onboarding · {b.stage}</Text>}
                {!b.active && !b.onboarding && <Text style={styles.dutyTag}>Deactivated</Text>}
              </View>
              {busy === b.id ? (
                <ActivityIndicator color={theme.colors.brandPrimary} />
              ) : assignable ? (
                <View style={styles.pick}><Text style={styles.pickTxt}>Assign</Text></View>
              ) : null}
            </Pressable>
          ))}
        </OpsCard>
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <OpsHeader
        title="Assign a Buddy"
        subtitle={booking ? `${tail(booking.pickup_address)} → ${tail(booking.drop_address)}` : ' '}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {!!err && <Text style={styles.err}>{err}</Text>}
        {!booking && !err && <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 30 }} />}

        {!!booking && (
          <OpsCard style={{ padding: 14 }}>
            <View style={styles.tripTop}>
              <Text style={styles.tripCustomer}>{booking.customer.name || 'Customer'}</Text>
              <Urgency at={booking.scheduled_at} />
            </View>
            <Text style={styles.tripMeta}>
              {booking.one_way ? 'One way' : `Round trip · ${booking.days} days`} ·{' '}
              {Math.round(booking.distance_km)} km · {money(booking.fare)}
            </Text>
            <Text style={styles.tripMeta}>
              {booking.scheduled_at
                ? new Date(booking.scheduled_at).toLocaleString([], {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : ''}
            </Text>
          </OpsCard>
        )}

        {booking && booking.label !== 'Received' && (
          <Text style={styles.already}>
            This trip is already {booking.label.toLowerCase()} — reassigning is not available here.
          </Text>
        )}

        {!!buddies && booking?.label === 'Received' && (
          <>
            <Group title="Available" list={free} />
            <Group title="Currently on a trip" list={busyNow} dim />
            <Group title="Not assignable" list={inactive} dim assignable={false} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 34 },
  err: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error },
  count: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary },

  tripTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tripCustomer: { fontFamily: theme.fonts.display, fontSize: 15.5, color: theme.colors.textPrimary },
  tripMeta: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 3 },
  already: {
    fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.textSecondary,
    marginTop: 20, lineHeight: 20,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(100,100,100,0.13)' },
  name: { fontFamily: theme.fonts.display, fontSize: 14.5, color: theme.colors.textPrimary },
  meta: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  dutyTag: { fontFamily: theme.fonts.bodySemi, fontSize: 11, color: theme.colors.warning, marginTop: 2 },
  pick: {
    backgroundColor: theme.colors.green50, borderRadius: theme.radius.pill,
    paddingHorizontal: 13, paddingVertical: 7,
  },
  pickTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: theme.colors.green700 },
});
