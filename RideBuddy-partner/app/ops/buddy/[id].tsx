// Buddy profile — the record plus the two levers Ops has over an account:
// advancing them through onboarding, and deactivating them.
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { api, OpsBooking, OpsBuddy } from '../../../src/api';
import { useRB } from '../../../src/store';
import { theme } from '../../../src/theme';
import { Ico } from '../../../src/icons';
import { Avatar } from '../../../src/ui';
import { OpsHeader, OpsCard, Section, OpsBadge, StatTile, ConfirmSheet, money } from '../../../src/ops-ui';

const STAGES = ['applied', 'verification', 'verified'] as const;

export default function OpsBuddyProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useRB();
  const [b, setB] = useState<(OpsBuddy & { recent: OpsBooking[] }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setB(await api.opsBuddy(id));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || 'Could not load this Buddy.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const patch = async (data: { active?: boolean; stage?: string }, msg: string) => {
    setBusy(true);
    try {
      await api.opsPatchBuddy(String(id), data);
      showToast({ type: 'success', title: msg });
      await load();
    } catch (e: any) {
      showToast({ type: 'error', title: e?.message || 'Could not update this Buddy.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <OpsHeader title={b?.name || 'Buddy'} subtitle={b?.phone} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {!!err && <Text style={styles.err}>{err}</Text>}
        {!b && !err && <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 30 }} />}

        {!!b && (
          <>
            <OpsCard style={{ padding: 16 }}>
              <View style={styles.top}>
                <Avatar name={b.name} photo={b.photo} size={58} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{b.name || b.phone}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {b.region} · joined {b.joined || '—'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    {b.onboarding
                      ? <OpsBadge label="Received" />
                      : <OpsBadge label={b.active ? 'Complete' : 'Closed'} />}
                    {b.on_duty && <Text style={styles.duty}>On a trip</Text>}
                  </View>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable style={styles.act} accessibilityRole="button"
                  onPress={() => Linking.openURL(`tel:${b.phone}`)}>
                  <Ico.Phone size={15} color="#fff" />
                  <Text style={styles.actTxt}>Call</Text>
                </Pressable>
                <Pressable style={[styles.act, styles.actAlt]} onPress={() => setConfirm(true)} disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={b.active ? 'Deactivate' : 'Reactivate'}>
                  <Text style={[styles.actTxt, { color: b.active ? theme.colors.error : theme.colors.green700 }]}>
                    {b.active ? 'Deactivate' : 'Reactivate'}
                  </Text>
                </Pressable>
              </View>
            </OpsCard>

            <Section title="Performance" />
            <View style={styles.grid}>
              <StatTile label="Rating" value={b.rating || '—'} hint="Average" />
              <StatTile label="Completed" value={b.completed} hint="Trips" />
              <StatTile label="Earned" value={money(b.earnings)} hint="Lifetime payout" />
            </View>

            {b.onboarding && (
              <>
                <Section title="Onboarding" />
                <OpsCard style={{ padding: 14 }}>
                  <Text style={styles.stageHint}>
                    {b.applied_at ? `Applied ${daysAgo(b.applied_at)}.` : ''} Marking them verified
                    puts them on the active roster and lets them sign in.
                  </Text>
                  <View style={styles.stageRow}>
                    {STAGES.map((s) => (
                      <Pressable
                        key={s}
                        disabled={busy || b.stage === s}
                        onPress={() => patch({ stage: s },
                          s === 'verified' ? 'Buddy verified and added to the roster.' : `Moved to ${s}.`)}
                        style={[styles.stagePill, b.stage === s && styles.stagePillOn]}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.stagePillTxt, b.stage === s && styles.stagePillTxtOn]}>{s}</Text>
                      </Pressable>
                    ))}
                  </View>
                </OpsCard>
              </>
            )}

            <Section title="Record" />
            <OpsCard style={{ padding: 14 }}>
              <Row label="Phone" value={b.phone} />
              <Row label="Licence" value={b.licence} />
              <Row label="Region" value={b.region} />
              <Row label="Trips in system" value={b.trips_in_system} />
              <Row label="Available" value={b.available ? 'Online' : 'Offline'} />
            </OpsCard>

            {!!b.recent?.length && (
              <>
                <Section title="Recent trips" right={<Text style={styles.count}>{b.recent.length}</Text>} />
                <OpsCard>
                  {b.recent.map((t, i) => (
                    <Pressable
                      key={t.id}
                      onPress={() => router.push(`/ops/booking/${t.id}` as any)}
                      style={[styles.trip, i > 0 && styles.tripSep]}
                      accessibilityRole="button"
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <OpsBadge label={t.label} />
                        <Text style={styles.tripTitle} numberOfLines={1}>
                          {tail(t.pickup_address)} → {tail(t.drop_address)}
                        </Text>
                        <Text style={styles.tripMeta}>
                          {t.scheduled_at ? new Date(t.scheduled_at).toLocaleDateString([], { day: 'numeric', month: 'short' }) : ''}
                          {' · '}{money(t.fare)}
                        </Text>
                      </View>
                      <Ico.ChevronRight size={16} color={theme.colors.grey400} />
                    </Pressable>
                  ))}
                </OpsCard>
              </>
            )}
          </>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={confirm}
        title={b?.active ? 'Deactivate Buddy' : 'Reactivate Buddy'}
        body={b?.active
          ? `${b?.name || 'This Buddy'} will no longer be able to sign in or be assigned trips.`
          : `${b?.name || 'This Buddy'} will be able to sign in and take trips again.`}
        confirmLabel={b?.active ? 'Deactivate' : 'Reactivate'}
        destructive={!!b?.active}
        busy={busy}
        onConfirm={async () => {
          const off = !!b?.active;
          setConfirm(false);
          await patch({ active: !off }, off ? 'Buddy deactivated.' : 'Buddy reactivated.');
        }}
        onCancel={() => setConfirm(false)}
      />
    </View>
  );
}

const tail = (a?: string | null) => (a || '').split(',').slice(-1)[0].trim();
function daysAgo(iso: string) {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'today' : `${d} days ago`;
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{label}</Text>
      <Text style={styles.v}>{value === null || value === undefined || value === '' ? '—' : String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 34 },
  err: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error },
  count: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary },

  top: { flexDirection: 'row', gap: 13, alignItems: 'center' },
  name: { fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
  duty: { fontFamily: theme.fonts.bodySemi, fontSize: 11.5, color: theme.colors.success, alignSelf: 'center' },

  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  act: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.pill,
    paddingHorizontal: 15, paddingVertical: 9,
  },
  actAlt: { backgroundColor: theme.colors.fillSoft },
  actTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: '#fff' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },

  stageHint: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary, lineHeight: 19 },
  stageRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stagePill: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.fillSoft,
  },
  stagePillOn: { backgroundColor: theme.colors.brandPrimary },
  stagePillTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 12, color: theme.colors.textSecondary, textTransform: 'capitalize' },
  stagePillTxtOn: { color: '#fff' },

  kv: { flexDirection: 'row', paddingVertical: 6, gap: 12 },
  k: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, width: 128 },
  v: { flex: 1, fontFamily: theme.fonts.bodyMed, fontSize: 13.5, color: theme.colors.textPrimary },

  trip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  tripSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(100,100,100,0.13)' },
  tripTitle: { fontFamily: theme.fonts.display, fontSize: 14, color: theme.colors.textPrimary, marginTop: 5 },
  tripMeta: { fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.textSecondary, marginTop: 2 },
});
