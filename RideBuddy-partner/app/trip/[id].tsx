import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, Trip } from '../../src/api';
import { useRB } from '../../src/store';
import { theme, fmtDate, fmtTime, money, ACTIVE_STATES } from '../../src/theme';
import { Header, StatusBadge, Button, OtpInput, Card, DemoNote, Stars } from '../../src/ui';
import { Ico } from '../../src/icons';
import TripMap from '../../src/TripMap';

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tripById, refresh, showToast } = useRB();

  const [trip, setTrip] = useState<Trip | undefined>(tripById(id));
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState(false);
  const [busy, setBusy] = useState(false);

  // Fall back to a direct fetch when opened cold (e.g. from a deep link).
  useEffect(() => {
    const fromStore = tripById(id);
    if (fromStore) setTrip(fromStore);
    else if (id) api.trip(String(id)).then(setTrip).catch(() => {});
  }, [id, tripById]);

  if (!trip) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.brandPrimary} />
      </View>
    );
  }

  const round = trip.round_trip;
  const from = (trip.pickup_address || '').split(',').slice(-1)[0].trim();
  const to = (trip.drop_area || '').split(',').slice(-1)[0].trim();

  const act = async (fn: () => Promise<Trip>, toast?: { title: string; body?: string }) => {
    setBusy(true);
    try {
      const updated = await fn();
      setTrip(updated);
      await refresh();
      if (toast) showToast({ type: 'success', ...toast });
    } catch (e: any) {
      showToast({ type: 'error', title: e?.message || 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };

  const startTrip = async () => {
    setBusy(true);
    try {
      const updated = await api.verifyStart(trip.id, code);
      setTrip(updated);
      setCodeErr(false);
      setCode('');
      await refresh();
      showToast({ type: 'success', title: 'Trip started.' });
    } catch {
      setCodeErr(true);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const rows = [
    { icon: <Ico.User size={18} color={theme.colors.green500} />, label: 'Customer', value: trip.customer },
    {
      icon: <Ico.Car size={18} color={theme.colors.green500} />,
      label: 'Car',
      value: trip.car || '—',
      pill: trip.transmission,
    },
    { icon: <Ico.MapPin size={18} color={theme.colors.green500} />, label: 'Pickup', value: trip.pickup_address },
    {
      icon: <Ico.Navigation size={18} color={theme.colors.green500} />,
      label: round ? 'Drop area' : 'Drop',
      value: round ? to : trip.drop_address || to,
    },
    {
      icon: <Ico.Calendar size={18} color={theme.colors.green500} />,
      label: round ? 'Dates' : 'Date',
      value: round
        ? `${fmtDate(trip.scheduled_at)} → ${fmtDate(trip.return_at)}`
        : fmtDate(trip.scheduled_at),
    },
    { icon: <Ico.Clock size={18} color={theme.colors.green500} />, label: 'Pickup time', value: fmtTime(trip.scheduled_at) },
    {
      icon: <Ico.Repeat size={18} color={theme.colors.green500} />,
      label: 'Trip type',
      value: round ? 'Round Trip' : 'One-Way',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <Header
        tone="white"
        onBack={() => router.back()}
        title={`${from} → ${to}`}
        subtitle={`#${trip.id.slice(0, 8).toUpperCase()}`}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topRow}>
          <StatusBadge status={trip.status} />
          <Pressable
            onPress={() =>
              showToast({
                type: 'info',
                title: `Messaging ${trip.customer}…`,
                body: 'In-app chat arrives in the next release.',
              })
            }
            style={styles.msgBtn}
            accessibilityRole="button"
          >
            <Ico.Message size={15} color={theme.colors.brandPrimary} />
            <Text style={styles.msgTxt}>Message customer</Text>
          </Pressable>
        </View>

        <TripMap
          pickupLat={trip.pickup_lat}
          pickupLng={trip.pickup_lng}
          dropLat={trip.drop_lat}
          dropLng={trip.drop_lng}
          pickupLabel={trip.pickup_address}
          dropLabel={round ? `${to} (drop area)` : trip.drop_address || to}
          height={230}
        />

        {ACTIVE_STATES.includes(trip.status) && (
          <Pressable onPress={() => router.push(`/nav/${trip.id}`)} style={styles.navBtn} accessibilityRole="button">
            <Ico.Navigation size={17} color="#fff" fill="#fff" />
            <Text style={styles.navTxt}>Open navigation</Text>
          </Pressable>
        )}

        <Card style={{ padding: theme.spacing.lg }}>
          {rows.map((r, i) => (
            <View
              key={i}
              style={[
                styles.detailRow,
                i < rows.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.colors.borderHairline,
                },
              ]}
            >
              <View style={styles.detailIcon}>{r.icon}</View>
              <Text style={styles.detailLabel}>{r.label}</Text>
              <View style={styles.detailValueWrap}>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {r.value}
                </Text>
                {!!r.pill && (
                  <View style={styles.pill}>
                    <Text style={styles.pillTxt}>{r.pill === 'Automatic' ? 'Auto' : 'Manual'}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </Card>

        <View style={styles.earnRow}>
          <Text style={styles.earnLabel}>
            Your earnings <Text style={{ fontSize: 11 }}>(from this trip)</Text>
          </Text>
          <Text style={styles.earnValue}>{money(trip.earnings)}</Text>
        </View>

        {/* ── Arrived: enter the code the owner reads out ── */}
        {trip.status === 'arrived' && (
          <View style={{ gap: 12 }}>
            <Card accent>
              <Text style={styles.cardTitle}>Start the trip</Text>
              <Text style={styles.cardBody}>Ask the customer for their 4-digit code to start the trip.</Text>
              <OtpInput
                length={4}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setCodeErr(false);
                }}
                error={codeErr}
                autoFocus={false}
              />
              {codeErr && <Text style={styles.codeErr}>Incorrect code. Ask the customer to check their app.</Text>}
            </Card>
            <DemoNote>The customer&apos;s app shows this code on their booking screen.</DemoNote>
          </View>
        )}

        {trip.status === 'in_progress' && (
          <View style={{ gap: 12 }}>
            <Card accent>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={styles.roundIcon}>
                  <Ico.Navigation size={18} color={theme.colors.green700} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Trip is underway</Text>
                  <Text style={[styles.cardBody, { marginBottom: 0 }]}>
                    The customer will end the trip on their end.
                  </Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        {trip.status === 'completed' && (
          <View style={{ gap: 12 }}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={styles.successDot}>
                  <Ico.Check size={16} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>Trip completed</Text>
              </View>
              <Text style={styles.completedMeta}>
                {trip.completed_at
                  ? `Completed on ${fmtDate(trip.completed_at)} at ${fmtTime(trip.completed_at)}.`
                  : 'Completed.'}
              </Text>
            </Card>
            {trip.rating ? (
              <Card>
                <Text style={styles.ratingLabel}>CUSTOMER RATING</Text>
                <Stars value={trip.rating} size={18} />
                {!!trip.comment && <Text style={styles.comment}>“{trip.comment}”</Text>}
              </Card>
            ) : (
              <Text style={styles.pendingRating}>Rating pending from customer.</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Sticky CTA ── */}
      {['assigned', 'en_route', 'arrived'].includes(trip.status) && (
        <View style={styles.sticky}>
          {trip.status === 'assigned' && (
            <Button
              loading={busy}
              onPress={() =>
                act(() => api.leftForPickup(trip.id), {
                  title: 'Customer notified.',
                  body: "You're marked en route to pickup.",
                })
              }
              leadingIcon={<Ico.Navigation size={18} color="#fff" fill="#fff" />}
            >
              Mark Left for Pickup
            </Button>
          )}
          {trip.status === 'en_route' && (
            <Button
              loading={busy}
              onPress={() =>
                act(() => api.arrived(trip.id), {
                  title: 'Customer notified.',
                  body: 'Ask them for the 4-digit code to start.',
                })
              }
              leadingIcon={<Ico.MapPin size={18} color="#fff" />}
            >
              Mark Arrived at Pickup
            </Button>
          )}
          {trip.status === 'arrived' && (
            <Button loading={busy} disabled={code.length !== 4} onPress={startTrip}>
              Start Trip
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfacePage },
  scroll: { padding: theme.spacing.lg, paddingBottom: 32, gap: 16 },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  msgBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: theme.colors.brandPrimary,
    borderRadius: theme.radius.pill, paddingHorizontal: 14, paddingVertical: 7,
  },
  msgTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 13, color: theme.colors.brandPrimary },

  navBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.lg, paddingVertical: 13,
  },
  navTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 14.5, color: '#fff' },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  detailIcon: { width: 30, alignItems: 'center' },
  detailLabel: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, width: 92 },
  detailValueWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  detailValue: { flexShrink: 1, fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.colors.textPrimary, textAlign: 'right' },
  pill: { backgroundColor: theme.colors.green50, borderRadius: theme.radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  pillTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 11, color: theme.colors.green800 },

  earnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  earnLabel: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary },
  earnValue: { fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.textPrimary },

  cardTitle: { fontFamily: theme.fonts.display, fontSize: 16, color: theme.colors.textPrimary, marginBottom: 4 },
  cardBody: { fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.textSecondary, marginBottom: 14, lineHeight: 19 },
  codeErr: { color: theme.colors.error, fontFamily: theme.fonts.body, fontSize: 13, marginTop: 10, textAlign: 'center' },

  roundIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  successDot: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.success,
    alignItems: 'center', justifyContent: 'center',
  },
  completedMeta: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary },
  ratingLabel: { fontFamily: theme.fonts.body, fontSize: 12, letterSpacing: 0.7, color: '#888', marginBottom: 6 },
  comment: { fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.textPrimary, marginTop: 8, lineHeight: 20, fontStyle: 'italic' },
  pendingRating: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' },

  sticky: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    backgroundColor: theme.colors.surfacePage,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderHairline,
  },
});
