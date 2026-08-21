// Booking detail — the read-only Ops view, plus the two actions that belong to
// a single trip: assign a Buddy, and settle a refund on a cancelled one.
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { api, OpsBooking } from '../../../src/api';
import { useRB } from '../../../src/store';
import { theme } from '../../../src/theme';
import { Ico } from '../../../src/icons';
import { OpsHeader, OpsBadge, OpsCard, Section, ConfirmSheet, money } from '../../../src/ops-ui';

function fmt(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function Row({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{label}</Text>
      <Text style={[styles.v, mono && { fontFamily: theme.fonts.display }]} numberOfLines={2}>
        {value === null || value === undefined || value === '' ? '—' : String(value)}
      </Text>
    </View>
  );
}

export default function OpsBookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useRB();
  const [b, setB] = useState<OpsBooking | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setB(await api.opsBooking(id));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || 'Could not load this booking.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refund = async () => {
    setBusy(true);
    try {
      await api.opsRefund(String(id));
      showToast({ type: 'success', title: 'Refund settled.' });
      setConfirm(false);
      await load();
    } catch (e: any) {
      showToast({ type: 'error', title: e?.message || 'Could not settle the refund.' });
    } finally {
      setBusy(false);
    }
  };

  const tail = (a?: string | null) => (a || '').split(',').slice(-1)[0].trim();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <OpsHeader
        title={b ? `${tail(b.pickup_address)} → ${tail(b.drop_address)}` : 'Booking'}
        subtitle={b ? `#${b.id.slice(0, 8).toUpperCase()}` : ' '}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {!!err && <Text style={styles.err}>{err}</Text>}
        {!b && !err && <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 30 }} />}

        {!!b && (
          <>
            <View style={styles.statusRow}>
              <OpsBadge label={b.label} />
              {b.payment_failed && <Text style={styles.fail}>Payment failed</Text>}
            </View>

            <Section title="Customer" />
            <OpsCard style={{ padding: 14 }}>
              <Row label="Name" value={b.customer.name} mono />
              <Row label="Phone" value={b.customer.phone} />
              <Row label="Email" value={b.customer.email} />
              {!!b.customer.phone && (
                <View style={styles.actions}>
                  <Pressable style={styles.act} accessibilityRole="button"
                    onPress={() => Linking.openURL(`tel:${b.customer.phone}`)}>
                    <Ico.Phone size={15} color="#fff" />
                    <Text style={styles.actTxt}>Call customer</Text>
                  </Pressable>
                </View>
              )}
            </OpsCard>

            <Section title="Buddy" right={b.label === 'Received' ? (
              <Pressable onPress={() => router.push(`/ops/assign/${b.id}` as any)} accessibilityRole="button">
                <Text style={styles.link}>Assign</Text>
              </Pressable>
            ) : undefined} />
            <OpsCard style={{ padding: 14 }}>
              {b.buddy ? (
                <>
                  <Row label="Name" value={b.buddy.name} mono />
                  <Row label="Phone" value={b.buddy.phone} />
                  <Row label="Rating" value={b.buddy.rating} />
                  <Row label="Payout" value={money(b.payout || 0)} />
                  <View style={styles.actions}>
                    <Pressable style={styles.act} accessibilityRole="button"
                      onPress={() => Linking.openURL(`tel:${b.buddy!.phone}`)}>
                      <Ico.Phone size={15} color="#fff" />
                      <Text style={styles.actTxt}>Call Buddy</Text>
                    </Pressable>
                    <Pressable style={[styles.act, styles.actAlt]} accessibilityRole="button"
                      onPress={() => router.push(`/ops/buddy/${b.buddy!.id}` as any)}>
                      <Text style={[styles.actTxt, { color: theme.colors.green700 }]}>Profile</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={styles.none}>No Buddy assigned yet.</Text>
              )}
            </OpsCard>

            <Section title="Trip" />
            <OpsCard style={{ padding: 14 }}>
              <Row label="Pickup" value={b.pickup_address} />
              <Row label="Drop" value={b.drop_address} />
              <Row label="Type" value={`${b.one_way ? 'One way' : 'Round trip'}${b.days ? ` · ${b.days} days` : ''}`} />
              <Row label="Distance" value={`${Math.round(b.distance_km)} km`} />
              <Row label="Transmission" value={b.transmission} />
              <Row label="Car" value={b.car ? `${b.car}${b.plate ? ` · ${b.plate}` : ''}` : null} />
              <Row label="Scheduled" value={fmt(b.scheduled_at)} />
              {!b.one_way && <Row label="Return" value={fmt(b.return_at)} />}
              {b.customer_stay !== undefined && !b.one_way && (
                <Row label="Stay" value={b.customer_stay ? 'Customer arranging' : 'Allowance included'} />
              )}
            </OpsCard>

            <Section title="Money" />
            <OpsCard style={{ padding: 14 }}>
              <Row label="Fare" value={money(b.fare)} mono />
              <Row label="Deposit (20%)" value={money(b.deposit)} />
              <Row label="Paid" value={money(b.paid_amount)} />
              <Row label="Balance" value={money(b.balance)} />
              {!!b.commission && (
                <>
                  <Row label={`Commission (${b.commission.commission_pct}%)`} value={money(b.commission.commission)} />
                  <Row label="GST within" value={money(b.commission.gst)} />
                  <Row label="Net revenue" value={money(b.commission.net_revenue)} />
                </>
              )}
            </OpsCard>

            {b.status === 'cancelled' && (
              <>
                <Section title="Cancellation" />
                <OpsCard style={{ padding: 14 }}>
                  <Row label="Reason" value={b.cancel_reason} />
                  <Row label="Refund" value={b.refund_done ? 'Settled' : `${money(b.deposit)} due`} />
                  {!b.refund_done && (
                    <Pressable
                      onPress={() => setConfirm(true)}
                      disabled={busy}
                      accessibilityLabel="Settle refund"
                      style={[styles.refundBtn, busy && { opacity: 0.5 }]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.refundTxt}>Settle refund</Text>
                    </Pressable>
                  )}
                </OpsCard>
              </>
            )}

            {!!b.timeline && (
              <>
                <Section title="Timeline" />
                <OpsCard style={{ padding: 14 }}>
                  <Row label="Booked" value={fmt(b.timeline.created_at)} />
                  <Row label="Left for pickup" value={fmt(b.timeline.left_at)} />
                  <Row label="Arrived" value={fmt(b.timeline.arrived_at)} />
                  <Row label="Started" value={fmt(b.timeline.started_at)} />
                  <Row label="Completed" value={fmt(b.timeline.completed_at)} />
                </OpsCard>
              </>
            )}

            {!!b.rating && (
              <>
                <Section title="Rating" />
                <OpsCard style={{ padding: 14 }}>
                  <Row label="Stars" value={`${b.rating} / 5`} mono />
                  <Row label="Comment" value={b.comment} />
                </OpsCard>
              </>
            )}
          </>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={confirm}
        title="Settle refund"
        body={`Mark ${money(b?.deposit || 0)} as refunded to ${b?.customer.name || 'the customer'}? `
          + 'Payments are mocked, so this records the decision without moving money.'}
        confirmLabel="Settle refund"
        destructive
        busy={busy}
        onConfirm={refund}
        onCancel={() => setConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 34 },
  err: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  fail: { fontFamily: theme.fonts.bodySemi, fontSize: 11.5, color: theme.colors.error },
  link: { fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: theme.colors.green700 },
  none: { fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.textSecondary },

  kv: { flexDirection: 'row', paddingVertical: 6, gap: 12 },
  k: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, width: 128 },
  v: { flex: 1, fontFamily: theme.fonts.bodyMed, fontSize: 13.5, color: theme.colors.textPrimary },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  act: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.pill,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  actAlt: { backgroundColor: theme.colors.green50 },
  actTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: '#fff' },

  refundBtn: {
    marginTop: 12, backgroundColor: theme.colors.error,
    borderRadius: theme.radius.pill, paddingVertical: 11, alignItems: 'center',
  },
  refundTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 13.5, color: '#fff' },
});
