import React, { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useRB } from '../../src/store';
import { Trip } from '../../src/api';
import { theme, fmtDate, fmtTime, money, greeting, firstName, DONE_STATES } from '../../src/theme';
import { Header, StatusBadge, Avatar, SectionLabel, Empty, Stars, Card } from '../../src/ui';
import { Ico } from '../../src/icons';

/** Transmission pill — "Auto" reads as the premium option, per the design. */
function TxPill({ value }: { value: string }) {
  const auto = value === 'Automatic';
  return (
    <View style={[styles.tx, { backgroundColor: auto ? theme.colors.green50 : theme.colors.surfaceSoft }]}>
      <Text style={[styles.txTxt, { color: auto ? theme.colors.green800 : theme.colors.textSecondary }]}>
        {auto ? 'Auto' : 'Manual'}
      </Text>
    </View>
  );
}

/** Pickup is always exact; a round trip's drop is a city until the day. */
export function RouteBlock({ trip }: { trip: Trip }) {
  const round = trip.round_trip;
  const pickupCity = (trip.pickup_address || '').split(',').slice(-1)[0].trim();
  const dropCity = (trip.drop_area || '').split(',').slice(-1)[0].trim();
  return (
    <View>
      <View style={styles.routeRow}>
        <View style={styles.routeRail}>
          <View style={styles.dotFilled} />
          <View style={styles.rail} />
        </View>
        <View style={{ flex: 1, paddingBottom: 4 }}>
          <Text style={styles.routeLabel}>PICKUP · EXACT</Text>
          <Text style={styles.routeValue}>{trip.pickup_address}</Text>
          <Text style={styles.routeSub}>{pickupCity}</Text>
        </View>
      </View>
      <View style={styles.routeRow}>
        <View style={styles.routeRail}>
          <View style={styles.dotHollow} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.routeLabel}>{round ? 'DROP AREA' : 'DROP'}</Text>
          <Text style={styles.routeValue}>{round ? dropCity : trip.drop_address || dropCity}</Text>
          <Text style={styles.routeSub}>
            {round ? `${dropCity} · exact drop shared on the day` : dropCity}
          </Text>
        </View>
      </View>
    </View>
  );
}

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={styles.card}>
        <View style={styles.cardTop}>
          <StatusBadge status={trip.status} />
          <Text style={styles.cardId}>#{trip.id.slice(0, 8).toUpperCase()}</Text>
        </View>

        <RouteBlock trip={trip} />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ico.User size={14} color={theme.colors.green500} />
            <Text style={styles.metaStrong}>{trip.customer}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ico.Car size={14} color={theme.colors.green500} />
            <Text style={styles.metaTxt}>{trip.car || '—'}</Text>
          </View>
          <TxPill value={trip.transmission} />
        </View>

        <View style={styles.cardFoot}>
          <View>
            <Text style={styles.footLabel}>YOUR EARNINGS</Text>
            <Text style={styles.footMoney}>{money(trip.earnings)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.footDate}>{fmtDate(trip.scheduled_at)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Text style={styles.footTime}>{fmtTime(trip.scheduled_at)} pickup</Text>
              <Ico.ChevronRight size={14} color={theme.colors.green700} />
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export default function Home() {
  const router = useRouter();
  const { partner, trips, refresh, error, setAvailability } = useRB();
  const [showPast, setShowPast] = useState(false);
  const [busy, setBusy] = useState(false);

  const upcoming = trips
    .filter((t) => !DONE_STATES.includes(t.status))
    .sort((a, b) => +new Date(a.scheduled_at || a.created_at) - +new Date(b.scheduled_at || b.created_at));
  const past = trips
    .filter((t) => t.status === 'completed')
    .sort((a, b) => +new Date(b.completed_at || b.created_at) - +new Date(a.completed_at || a.created_at));

  const onRefresh = async () => {
    setBusy(true);
    await refresh();
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <Header
        tone="green"
        subtitle={`${greeting()},`}
        title={`${firstName(partner?.name)}.`}
        right={
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityLabel="Profile"
            accessibilityRole="button"
          >
            <View style={styles.avatarRing}>
              <Avatar name={partner?.name} photo={partner?.photo} size={38} />
            </View>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
      >
        {/* Online / offline */}
        <View style={styles.onlineCard}>
          <View
            style={[
              styles.onlineDot,
              { backgroundColor: partner?.available ? theme.colors.success : theme.colors.grey400 },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.onlineTitle}>{partner?.available ? "You're online" : "You're offline"}</Text>
            <Text style={styles.onlineSub}>
              {partner?.available
                ? 'Ops can assign you new trips.'
                : 'You keep assigned trips, but get no new ones.'}
            </Text>
          </View>
          <Switch
            value={!!partner?.available}
            onValueChange={setAvailability}
            trackColor={{ true: theme.colors.green300, false: theme.colors.greyLine2 }}
            thumbColor={partner?.available ? theme.colors.brandPrimary : '#fff'}
          />
        </View>

        {!!error && (
          <View style={styles.errBox}>
            <Ico.Alert size={16} color={theme.colors.warning} />
            <Text style={styles.errTxt}>{error}</Text>
          </View>
        )}

        <View>
          <SectionLabel
            right={upcoming.length ? <Text style={styles.count}>{upcoming.length} assigned</Text> : null}
          >
            Upcoming Trips
          </SectionLabel>
          {upcoming.length === 0 ? (
            <View style={styles.emptyCard}>
              <Empty
                icon={<Ico.Navigation size={30} color={theme.colors.green300} />}
                title="No trips assigned yet."
                body="New assignments from Ops will appear here."
              />
            </View>
          ) : (
            <View style={{ gap: 18 }}>
              {upcoming.map((t) => (
                <TripCard key={t.id} trip={t} onPress={() => router.push(`/trip/${t.id}`)} />
              ))}
            </View>
          )}
        </View>

        {past.length > 0 && (
          <View>
            <Pressable onPress={() => setShowPast((s) => !s)} style={styles.pastToggle} accessibilityRole="button">
              <Text style={styles.pastLabel}>Past Trips · {past.length}</Text>
              <Ico.ChevronDown size={18} color={theme.colors.green700} />
            </Pressable>
            {showPast && (
              <View style={{ gap: 10, marginTop: 12 }}>
                {past.map((t) => {
                  const from = (t.pickup_address || '').split(',').slice(-1)[0].trim();
                  const to = (t.drop_area || '').split(',').slice(-1)[0].trim();
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => router.push(`/trip/${t.id}`)}
                      style={styles.pastRow}
                      accessibilityRole="button"
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pastRoute}>
                          {from} → {to}
                        </Text>
                        <Text style={styles.pastMeta}>
                          {fmtDate(t.completed_at)} · {t.customer}
                        </Text>
                      </View>
                      {!!t.rating && <Stars value={t.rating} size={13} />}
                      <Ico.ChevronRight size={16} color="#bbb" />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.lg, paddingBottom: 40, gap: 26 },
  avatarRing: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 22, padding: 1 },

  onlineCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline, ...theme.shadow.sm,
  },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  onlineTitle: { fontFamily: theme.fonts.display, fontSize: 15, color: theme.colors.textPrimary },
  onlineSub: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 1 },

  errBox: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: '#FFF3E0', borderRadius: theme.radius.md, padding: 12,
  },
  errTxt: { flex: 1, fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.warning },

  count: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  emptyCard: {
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderHairline,
  },

  card: { gap: 13, borderRadius: theme.radius.xl, padding: 18 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardId: { fontFamily: theme.fonts.body, fontSize: 12, color: '#888', letterSpacing: 0.3 },

  routeRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  routeRail: { alignItems: 'center', paddingTop: 3, width: 9 },
  dotFilled: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.brandPrimary },
  dotHollow: {
    width: 9, height: 9, borderRadius: 5,
    borderWidth: 2, borderColor: theme.colors.brandPrimary,
  },
  rail: { width: 2, flex: 1, minHeight: 28, backgroundColor: theme.colors.green100, marginTop: 2 },
  routeLabel: { fontFamily: theme.fonts.body, fontSize: 10.5, letterSpacing: 0.6, color: '#9a9a8e' },
  routeValue: { fontFamily: theme.fonts.display, fontSize: 15, color: theme.colors.textPrimary, lineHeight: 19 },
  routeSub: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaStrong: { fontFamily: theme.fonts.bodySemi, fontSize: 13, color: theme.colors.textPrimary },
  metaTxt: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary },
  tx: { borderRadius: theme.radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  txTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 11 },

  cardFoot: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderHairline, paddingTop: 11,
  },
  footLabel: { fontFamily: theme.fonts.body, fontSize: 11, letterSpacing: 0.5, color: '#9a9a8e' },
  footMoney: { fontFamily: theme.fonts.displayExtra, fontSize: 20, color: theme.colors.textPrimary },
  footDate: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary },
  footTime: { fontFamily: theme.fonts.bodySemi, fontSize: 13, color: theme.colors.green700 },

  pastToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pastLabel: {
    fontFamily: theme.fonts.display, fontSize: 13, textTransform: 'uppercase',
    letterSpacing: 1, color: theme.colors.green700,
  },
  pastRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.lg, padding: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderHairline,
  },
  pastRoute: { fontFamily: theme.fonts.display, fontSize: 15, color: theme.colors.textPrimary },
  pastMeta: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 2 },
});
