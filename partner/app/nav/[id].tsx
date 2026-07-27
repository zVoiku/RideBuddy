import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Trip } from '../../src/api';
import { useRB } from '../../src/store';
import { theme } from '../../src/theme';
import { Header, StatusBadge } from '../../src/ui';
import { Ico } from '../../src/icons';
import TripMap from '../../src/TripMap';

const LATE_TEMPLATES = [
  'Running about 5 minutes late.',
  'Running 10–15 minutes late, apologies.',
  'Slow traffic on the highway, still on my way.',
  "I've reached the pickup point.",
  'Quick fuel stop, we’ll be moving in 5.',
];

/** Great-circle distance in km. */
function km(a: [number, number], b: [number, number]) {
  const R = 6371;
  const t = Math.PI / 180;
  const dLat = (b[0] - a[0]) * t;
  const dLng = (b[1] - a[1]) * t;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function phaseFor(trip: Trip) {
  const dropCity = (trip.drop_area || '').split(',').slice(-1)[0].trim();
  if (trip.status === 'in_progress') {
    return {
      key: 'enroute',
      label: 'En route to drop',
      heading: 'DROP-OFF',
      place: trip.round_trip ? `${dropCity} (drop area)` : trip.drop_address || dropCity,
    };
  }
  if (trip.status === 'arrived') {
    return { key: 'arrived', label: 'At pickup point', heading: 'PICKUP', place: trip.pickup_address };
  }
  return { key: 'topickup', label: 'Heading to pickup', heading: 'PICKUP', place: trip.pickup_address };
}

function Sheet({
  title, visible, onClose, children,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>{title}</Text>
        {children}
      </View>
    </Modal>
  );
}

export default function NavMode() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tripById, refresh, showToast } = useRB();

  const [trip, setTrip] = useState<Trip | undefined>(tripById(id));
  const [sheet, setSheet] = useState<'late' | 'sos' | null>(null);
  const [busy, setBusy] = useState(false);

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

  const from = (trip.pickup_address || '').split(',').slice(-1)[0].trim();
  const to = (trip.drop_area || '').split(',').slice(-1)[0].trim();
  const ph = phaseFor(trip);

  const hasDrop = trip.drop_lat != null && trip.drop_lng != null;
  const legKm = hasDrop ? km([trip.pickup_lat, trip.pickup_lng], [trip.drop_lat!, trip.drop_lng!]) : 0;
  // Highway speed to the drop; local speed on the short hop to the pickup.
  const dist = ph.key === 'enroute' ? legKm : Math.max(0.6, legKm * 0.12);
  const eta = Math.max(1, Math.round((dist / (ph.key === 'enroute' ? 40 : 24)) * 60));

  const markArrived = async () => {
    setBusy(true);
    try {
      const updated = await api.arrived(trip.id);
      setTrip(updated);
      await refresh();
      showToast({ type: 'success', title: 'Customer notified you’ve arrived.' });
    } catch (e: any) {
      showToast({ type: 'error', title: e?.message || 'Could not update the trip.' });
    } finally {
      setBusy(false);
    }
  };

  const ActionBtn = ({
    icon, label, onPress, danger,
  }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.action, danger && { borderColor: 'rgba(198,40,40,0.4)', backgroundColor: '#FDF5F5' }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: danger ? theme.colors.error : theme.colors.green50 }]}>
        {icon}
      </View>
      <Text style={[styles.actionLabel, danger && { color: theme.colors.error }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <Header
        tone="white"
        onBack={() => router.back()}
        title={`${from} → ${to}`}
        subtitle={`Navigation · #${trip.id.slice(0, 8).toUpperCase()}`}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.statusStrip}>
          <View style={styles.liveDot} />
          <Text style={styles.statusTxt}>{ph.label}</Text>
          <StatusBadge status={trip.status} />
        </View>

        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <TripMap
            pickupLat={trip.pickup_lat}
            pickupLng={trip.pickup_lng}
            dropLat={trip.drop_lat}
            dropLng={trip.drop_lng}
            pickupLabel={trip.pickup_address}
            dropLabel={ph.place || undefined}
            height={284}
          />
        </View>

        <View style={styles.etaCard}>
          <View style={styles.etaIcon}>
            <Ico.Navigation size={22} color={theme.colors.brandPrimary} fill={theme.colors.brandPrimary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.etaHeading}>{ph.heading}</Text>
            <Text style={styles.etaPlace} numberOfLines={2}>
              {ph.place}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.etaMin}>
              {eta}
              <Text style={styles.etaMinUnit}> min</Text>
            </Text>
            <Text style={styles.etaKm}>{dist.toFixed(dist < 10 ? 1 : 0)} km</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <ActionBtn
            icon={<Ico.Message size={17} color={theme.colors.brandPrimary} />}
            label="Message"
            onPress={() =>
              showToast({ type: 'info', title: 'In-app chat', body: 'Arriving in the next release.' })
            }
          />
          <ActionBtn
            icon={<Ico.Clock size={17} color={theme.colors.brandPrimary} />}
            label="Running late"
            onPress={() => setSheet('late')}
          />
          <ActionBtn
            icon={<Ico.Shield size={17} color="#fff" />}
            label="Safety / SOS"
            onPress={() => setSheet('sos')}
            danger
          />
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + 14 }]}>
        {trip.status === 'en_route' && (
          <Pressable onPress={markArrived} disabled={busy} style={styles.ctaBtn} accessibilityRole="button">
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ico.MapPin size={18} color="#fff" />
                <Text style={styles.ctaTxt}>Mark Arrived at Pickup</Text>
              </>
            )}
          </Pressable>
        )}
        {trip.status === 'arrived' && (
          <Pressable onPress={() => router.push(`/trip/${trip.id}`)} style={styles.ctaBtn} accessibilityRole="button">
            <Text style={styles.ctaTxt}>Enter start code to begin</Text>
          </Pressable>
        )}
        {trip.status === 'in_progress' && (
          <View style={styles.waitNote}>
            <Ico.Clock size={16} color={theme.colors.textSecondary} />
            <Text style={styles.waitTxt}>The customer ends the trip from their app.</Text>
          </View>
        )}
      </View>

      <Sheet title="Send a quick update" visible={sheet === 'late'} onClose={() => setSheet(null)}>
        <View style={{ gap: 8 }}>
          {LATE_TEMPLATES.map((t, i) => (
            <Pressable
              key={i}
              onPress={() => {
                setSheet(null);
                showToast({ type: 'info', title: 'In-app chat', body: 'Arriving in the next release.' });
              }}
              style={styles.sheetRow}
              accessibilityRole="button"
            >
              <Text style={styles.sheetRowTxt}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet title="Safety" visible={sheet === 'sos'} onClose={() => setSheet(null)}>
        <Text style={styles.sosIntro}>Your live location is shared with RideBuddy Ops during every trip.</Text>
        <View style={{ gap: 8 }}>
          <Pressable
            onPress={() => {
              setSheet(null);
              showToast({ type: 'info', title: 'Connecting to RideBuddy Safety Desk…' });
            }}
            style={styles.sosRow}
            accessibilityRole="button"
          >
            <View style={styles.sosLeft}>
              <Ico.Phone size={18} color={theme.colors.brandPrimary} />
              <Text style={styles.sosTxt}>Call RideBuddy Safety Desk</Text>
            </View>
            <Ico.ChevronRight size={16} color="#bbb" />
          </Pressable>
          <Pressable
            onPress={() => {
              setSheet(null);
              showToast({ type: 'info', title: 'Live location shared with Ops.' });
            }}
            style={styles.sosRow}
            accessibilityRole="button"
          >
            <View style={styles.sosLeft}>
              <Ico.MapPin size={18} color={theme.colors.brandPrimary} />
              <Text style={styles.sosTxt}>Share live location with Ops</Text>
            </View>
            <Ico.ChevronRight size={16} color="#bbb" />
          </Pressable>
          <Pressable
            onPress={() => {
              setSheet(null);
              showToast({ type: 'error', title: 'Calling emergency services · 112' });
            }}
            style={[styles.sosRow, styles.sosDanger]}
            accessibilityRole="button"
          >
            <View style={styles.sosLeft}>
              <Ico.Alert size={18} color={theme.colors.error} />
              <Text style={[styles.sosTxt, { color: theme.colors.error, fontFamily: theme.fonts.bodySemi }]}>
                Emergency · Call 112
              </Text>
            </View>
            <Ico.ChevronRight size={16} color={theme.colors.error} />
          </Pressable>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfacePage },

  statusStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: theme.spacing.lg, paddingBottom: 12 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.success },
  statusTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 13, color: theme.colors.textPrimary },

  etaCard: {
    marginHorizontal: theme.spacing.lg, marginTop: 14,
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderHairline,
    padding: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 14,
    ...theme.shadow.md,
  },
  etaIcon: {
    width: 46, height: 46, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.green50, alignItems: 'center', justifyContent: 'center',
  },
  etaHeading: { fontFamily: theme.fonts.body, fontSize: 11, letterSpacing: 0.5, color: '#9a9a8e' },
  etaPlace: { fontFamily: theme.fonts.display, fontSize: 16, color: theme.colors.textPrimary, lineHeight: 20 },
  etaMin: { fontFamily: theme.fonts.displayExtra, fontSize: 20, color: theme.colors.brandPrimary },
  etaMinUnit: { fontSize: 12, fontFamily: theme.fonts.display },
  etaKm: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: theme.spacing.lg, paddingVertical: 18 },
  action: {
    flex: 1, alignItems: 'center', gap: 5, paddingVertical: 12, paddingHorizontal: 6,
    borderWidth: 1, borderColor: theme.colors.borderHairline,
    borderRadius: 14, backgroundColor: theme.colors.surfaceCard,
  },
  actionIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: theme.fonts.bodySemi, fontSize: 12, color: theme.colors.textPrimary },

  cta: {
    paddingHorizontal: theme.spacing.lg, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceCard,
  },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.lg, paddingVertical: 15,
  },
  ctaTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 15, color: '#fff' },
  waitNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  waitTxt: { fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.textSecondary },

  scrim: { flex: 1, backgroundColor: 'rgba(30,30,26,0.5)' },
  sheet: {
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: theme.radius.xxl, borderTopRightRadius: theme.radius.xxl,
    paddingHorizontal: theme.spacing.lg, paddingTop: 10,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: theme.colors.greyLine2, marginBottom: 14,
  },
  sheetTitle: { fontFamily: theme.fonts.display, fontSize: 16, color: theme.colors.textPrimary, marginBottom: 12 },
  sheetRow: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfacePage, borderRadius: theme.radius.lg, padding: 14,
  },
  sheetRowTxt: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textPrimary },

  sosIntro: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginBottom: 12, lineHeight: 19 },
  sosRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfacePage, borderRadius: theme.radius.lg, padding: 14,
  },
  sosLeft: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  sosTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 14.5, color: theme.colors.textPrimary },
  sosDanger: { borderColor: 'rgba(198,40,40,0.4)', backgroundColor: '#FDF5F5' },
});
