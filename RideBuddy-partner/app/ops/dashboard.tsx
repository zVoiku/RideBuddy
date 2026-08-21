// Ops dashboard. Ordered by what needs a decision: the pending queue and the
// refund queue first, the health metrics below them.
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, OpsBooking, OpsMetrics } from '../../src/api';
import { useRB } from '../../src/store';
import { theme } from '../../src/theme';
import { Ico } from '../../src/icons';
import { OpsNav, OpsBadge, StatTile, Section, OpsCard, SplitBar, Urgency, money } from '../../src/ops-ui';

const POLL_MS = 8000;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function route(b: OpsBooking) {
  const tail = (a: string | null) => (a || '').split(',').slice(-1)[0].trim();
  return [tail(b.pickup_address), tail(b.drop_address)].filter(Boolean).join(' → ');
}

export default function OpsDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ops } = useRB();
  const [m, setM] = useState<OpsMetrics | null>(null);
  const [pending, setPending] = useState<OpsBooking[]>([]);
  const [refunds, setRefunds] = useState<OpsBooking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [metrics, open, cancelled] = await Promise.all([
        api.opsMetrics(), api.opsBookings('open'), api.opsBookings('cancelled'),
      ]);
      setM(metrics);
      setPending(open.filter((b) => b.label === 'Received'));
      setRefunds(cancelled.filter((b) => !b.refund_done));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || 'Could not load the dashboard.');
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <View style={[styles.head, { paddingTop: insets.top + 14 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greet}>{greeting()},</Text>
          <Text style={styles.name}>{ops?.name || 'Ops'}.</Text>
        </View>
        <Pressable
          onPress={() => router.push('/ops/account')}
          style={styles.avatar}
          accessibilityRole="button"
          accessibilityLabel="Account"
        >
          <Text style={styles.avatarTxt}>{(ops?.name || 'O').slice(0, 1).toUpperCase()}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={theme.colors.brandPrimary}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {!!err && <Text style={styles.err}>{err}</Text>}
        {!m && !err && <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 30 }} />}

        {!!m && (
          <>
            {/* Needs a decision — the whole reason to open this screen. */}
            <Section title="Needs you" right={
              <Text style={styles.count}>{pending.length + refunds.length}</Text>
            } />
            {!pending.length && !refunds.length ? (
              <OpsCard style={{ padding: 18 }}>
                <Text style={styles.clear}>Nothing waiting. Every trip has a Buddy and every refund is settled.</Text>
              </OpsCard>
            ) : (
              <OpsCard>
                {pending.map((b, i) => (
                  <Pressable
                    key={b.id}
                    onPress={() => router.push(`/ops/assign/${b.id}` as any)}
                    style={[styles.row, i > 0 && styles.rowSep]}
                    accessibilityRole="button"
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.rowTop}>
                        <OpsBadge label={b.label} />
                        <Urgency at={b.scheduled_at} />
                      </View>
                      <Text style={styles.rowTitle} numberOfLines={1}>{route(b)}</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {b.customer.name || 'Customer'} · {money(b.fare)}
                      </Text>
                    </View>
                    <View style={styles.assignBtn}>
                      <Text style={styles.assignTxt}>Assign</Text>
                    </View>
                  </Pressable>
                ))}
                {refunds.map((b, i) => (
                  <Pressable
                    key={b.id}
                    onPress={() => router.push(`/ops/booking/${b.id}` as any)}
                    style={[styles.row, (i > 0 || pending.length > 0) && styles.rowSep]}
                    accessibilityRole="button"
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.rowTop}>
                        <OpsBadge label="Cancelled" />
                        <Text style={styles.refundTag}>Refund due</Text>
                      </View>
                      <Text style={styles.rowTitle} numberOfLines={1}>{route(b)}</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {b.customer.name || 'Customer'} · deposit {money(b.deposit)}
                      </Text>
                    </View>
                    <Ico.ChevronRight size={17} color={theme.colors.grey400} />
                  </Pressable>
                ))}
              </OpsCard>
            )}

            <Section title="Trips" />
            <View style={styles.grid}>
              <StatTile label="Pending" value={m.pending} hint="Awaiting a Buddy" tone={m.pending ? 'warn' : undefined} />
              <StatTile label="In progress" value={m.in_progress} hint="On the road now" />
              <StatTile label="Confirmed" value={m.confirmed} hint="Buddy assigned" />
              <StatTile label="Completion" value={`${m.completion_rate}%`} hint="vs cancelled" />
              <StatTile label="Cancelled" value={m.cancelled} hint={m.top_cancel_reason} />
              <StatTile label="Avg fare" value={money(m.avg_fare)} hint="Completed trips" />
            </View>
            <OpsCard style={{ padding: 14, marginTop: 10 }}>
              <Text style={styles.barLabel}>
                {m.completed} completed · {m.cancelled} cancelled
              </Text>
              <SplitBar a={m.completed} b={m.cancelled} bColor={theme.colors.error} />
            </OpsCard>

            <Section title="Buddies" />
            <View style={styles.grid}>
              <StatTile label="Active" value={m.active_buddies} hint="On the roster" />
              <StatTile label="Available" value={m.available} hint="Not on a trip" />
              <StatTile label="On duty" value={m.on_duty} hint="Driving now" />
              <StatTile label="Utilisation" value={`${m.utilisation_pct}%`} hint="Engaged" />
              <StatTile label="Avg rating" value={m.avg_rating} hint="Rated trips" />
              <StatTile label="Per Buddy" value={money(m.earnings_per_buddy)} hint="Lifetime payout" />
            </View>
            <OpsCard style={{ padding: 14, marginTop: 10 }}>
              <Text style={styles.barLabel}>Punjab {m.punjab} · Himachal {m.himachal}</Text>
              <SplitBar a={m.punjab} b={m.himachal} bColor={theme.colors.green300} />
            </OpsCard>

            <Section title="Acquisition" right={
              <Pressable onPress={() => router.push('/ops/buddies')} accessibilityRole="button">
                <Text style={styles.link}>Roster</Text>
              </Pressable>
            } />
            <View style={styles.grid}>
              <StatTile label="In pipeline" value={m.in_pipeline} hint={`${m.avg_days_in_pipeline}d average`} />
              <StatTile label="Applied" value={m.applied} hint="Not yet screened" />
              <StatTile label="Verifying" value={m.in_verification} hint="Documents" />
              <StatTile label="Ready" value={m.verified_ready} hint="Verified" tone={m.verified_ready ? 'good' : undefined} />
            </View>

            <Section title="Money" />
            <View style={styles.grid}>
              <StatTile label="Revenue" value={money(m.revenue)} hint="Collected" />
              <StatTile label="Deposits" value={money(m.deposits_collected)} hint="20% upfront" />
              <StatTile label="Balances" value={money(m.balance_collected)} hint="At trip end" />
              <StatTile label="Payment rate" value={`${m.payment_rate}%`} hint={`${m.payments_failed} failed`}
                tone={m.payments_failed ? 'warn' : undefined} />
              <StatTile label="Refunds due" value={m.refunds_pending} hint={money(m.refunds_pending_value)}
                tone={m.refunds_pending ? 'bad' : undefined} />
              <StatTile label="Commission" value={`${m.commission_pct}%`} hint="Launch rate" />
            </View>
          </>
        )}
      </ScrollView>

      <OpsNav />
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 18, backgroundColor: theme.colors.brandPrimary,
  },
  greet: { fontFamily: theme.fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.78)' },
  name: { fontFamily: theme.fonts.displayExtra, fontSize: 27, color: '#fff' },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontFamily: theme.fonts.display, fontSize: 17, color: theme.colors.green700 },

  scroll: { padding: 16, paddingBottom: 28 },
  err: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error, marginBottom: 8 },
  count: { fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: theme.colors.textSecondary },
  link: { fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: theme.colors.green700 },
  clear: { fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.textSecondary, lineHeight: 20 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(100,100,100,0.13)' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  rowTitle: { fontFamily: theme.fonts.display, fontSize: 14.5, color: theme.colors.textPrimary },
  rowSub: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  refundTag: { fontFamily: theme.fonts.bodySemi, fontSize: 11.5, color: theme.colors.error },
  assignBtn: {
    backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.pill,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  assignTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: '#fff' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  barLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginBottom: 8 },
});
