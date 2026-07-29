import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { api, Earnings as EarningsData } from '../../src/api';
import { useRB } from '../../src/store';
import { theme, fmtDate, money } from '../../src/theme';
import { Header, SectionLabel, Empty, Stars } from '../../src/ui';
import { Ico } from '../../src/icons';

type Period = 'week' | 'month' | 'quarter' | 'year';
const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'year', label: 'Annual' },
];

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function periodStart(kind: Period, now: Date) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (kind === 'week') {
    // Week starts Monday.
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
  } else if (kind === 'month') {
    d.setDate(1);
  } else if (kind === 'quarter') {
    d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
  } else {
    d.setMonth(0, 1);
  }
  return d;
}

function periodLabel(kind: Period, now: Date) {
  if (kind === 'week') return 'This week';
  if (kind === 'month') return now.toLocaleString('en-IN', { month: 'long' });
  if (kind === 'quarter') return `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
  return String(now.getFullYear());
}

/** Bucket earnings into the bars the chart draws for the chosen period. */
function buckets(kind: Period, now: Date, trips: EarningsData['trips']) {
  const start = periodStart(kind, now);
  const out: { label: string; value: number }[] = [];

  if (kind === 'week') {
    DAY_NAMES.forEach((n) => out.push({ label: n, value: 0 }));
  } else if (kind === 'month') {
    const weeks = Math.ceil((new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) / 7);
    for (let i = 0; i < weeks; i++) out.push({ label: 'W' + (i + 1), value: 0 });
  } else if (kind === 'quarter') {
    const qs = Math.floor(now.getMonth() / 3) * 3;
    for (let i = 0; i < 3; i++) out.push({ label: MON[qs + i], value: 0 });
  } else {
    for (let i = 0; i <= now.getMonth(); i++) out.push({ label: MON[i], value: 0 });
  }

  trips.forEach((t) => {
    if (!t.completed_at) return;
    const d = new Date(t.completed_at);
    if (d < start || d > now) return;
    let idx = 0;
    if (kind === 'week') idx = (d.getDay() + 6) % 7;
    else if (kind === 'month') idx = Math.floor((d.getDate() - 1) / 7);
    else if (kind === 'quarter') idx = d.getMonth() - Math.floor(now.getMonth() / 3) * 3;
    else idx = d.getMonth();
    if (out[idx]) out[idx].value += t.earnings;
  });

  return out;
}

export default function Earnings() {
  const { showToast } = useRB();
  const [kind, setKind] = useState<Period>('month');
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    api
      .earnings()
      .then(setData)
      .catch((e) => showToast({ type: 'error', title: e?.message || 'Could not load earnings.' }))
      .finally(() => setLoading(false));
  }, []);

  const inPeriod = useMemo(() => {
    if (!data) return [];
    const start = periodStart(kind, now);
    return data.trips.filter((t) => t.completed_at && new Date(t.completed_at) >= start);
  }, [data, kind, now]);

  const total = inPeriod.reduce((s, t) => s + t.earnings, 0);
  const bars = useMemo(() => (data ? buckets(kind, now, data.trips) : []), [data, kind, now]);
  const peak = Math.max(1, ...bars.map((b) => b.value));

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.brandPrimary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <Header tone="green" subtitle="Your earnings" title={money(total)} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Period toggle */}
        <View style={styles.segment}>
          {PERIODS.map((p) => {
            const on = p.id === kind;
            return (
              <Pressable
                key={p.id}
                onPress={() => setKind(p.id)}
                style={[styles.segBtn, on && styles.segBtnOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.segTxt, on && styles.segTxtOn]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartLabel}>{periodLabel(kind, now)}</Text>
          <View style={styles.chart}>
            {bars.map((b, i) => (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(2, (b.value / peak) * 100)}%`,
                        backgroundColor: b.value > 0 ? theme.colors.green500 : theme.colors.green100,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {b.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{inPeriod.length}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {money(inPeriod.length ? Math.round(total / inPeriod.length) : 0)}
            </Text>
            <Text style={styles.statLabel}>Avg / trip</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{money(data?.lifetime)}</Text>
            <Text style={styles.statLabel}>Lifetime</Text>
          </View>
        </View>

        {/* Payout note */}
        <View style={styles.payout}>
          <Ico.Wallet size={18} color={theme.colors.green700} />
          <Text style={styles.payoutTxt}>
            Earnings settle to your linked account every Monday. You keep{' '}
            {Math.round((1 - (data?.commission_rate ?? 0.2)) * 100)}% of every trip fare — RideBuddy&apos;s
            commission is {Math.round((data?.commission_rate ?? 0.2) * 100)}%.
          </Text>
        </View>

        {/* Trips in period */}
        <View>
          <SectionLabel right={<Text style={styles.count}>{inPeriod.length} trips</Text>}>
            Trips this {kind === 'year' ? 'year' : kind}
          </SectionLabel>
          {inPeriod.length === 0 ? (
            <View style={styles.emptyCard}>
              <Empty
                icon={<Ico.Wallet size={30} color={theme.colors.green300} />}
                title="No trips in this period."
                body="Completed trips and their payouts show up here."
              />
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {inPeriod.map((t) => {
                const from = (t.pickup_address || '').split(',').slice(-1)[0].trim();
                const to = (t.drop_address || '').split(',').slice(-1)[0].trim();
                return (
                  <View key={t.id} style={styles.tripRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tripRoute}>
                        {from} → {to || '—'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={styles.tripMeta}>{fmtDate(t.completed_at)}</Text>
                        {!!t.rating && <Stars value={t.rating} size={11} />}
                      </View>
                    </View>
                    <Text style={styles.tripMoney}>{money(t.earnings)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfacePage },
  scroll: { padding: theme.spacing.lg, paddingBottom: 40, gap: 18 },

  segment: {
    flexDirection: 'row', backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.radius.pill, padding: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderHairline,
  },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.pill, alignItems: 'center' },
  segBtnOn: { backgroundColor: theme.colors.brandPrimary },
  segTxt: { fontFamily: theme.fonts.bodyMed, fontSize: 13, color: theme.colors.textSecondary },
  segTxtOn: { fontFamily: theme.fonts.bodySemi, color: '#fff' },

  chartCard: {
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.xl,
    padding: theme.spacing.lg, borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline, ...theme.shadow.md,
  },
  chartLabel: {
    fontFamily: theme.fonts.body, fontSize: 11, letterSpacing: 0.5,
    color: '#9a9a8e', textTransform: 'uppercase', marginBottom: 14,
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 132 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4, minHeight: 3 },
  barLabel: { fontFamily: theme.fonts.body, fontSize: 10, color: theme.colors.textSecondary },

  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1, backgroundColor: theme.colors.surfaceCard, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderHairline,
    paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', ...theme.shadow.sm,
  },
  statValue: { fontFamily: theme.fonts.displayExtra, fontSize: 16, color: theme.colors.textPrimary },
  statLabel: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textSecondary, marginTop: 3 },

  payout: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    backgroundColor: theme.colors.green50, borderRadius: theme.radius.lg, padding: 14,
  },
  payoutTxt: { flex: 1, fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.green800, lineHeight: 18 },

  count: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  emptyCard: {
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderHairline,
  },
  tripRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.lg,
    padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderHairline,
  },
  tripRoute: { fontFamily: theme.fonts.display, fontSize: 14.5, color: theme.colors.textPrimary },
  tripMeta: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary },
  tripMoney: { fontFamily: theme.fonts.display, fontSize: 14.5, color: theme.colors.textPrimary },
});
