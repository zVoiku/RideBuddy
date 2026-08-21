import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { theme } from '../../src/theme';
import { getDirections } from '../../src/maps';
import LiveMap from '../../src/LiveMap';

function fmt(d: Date) {
  return `${d.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function Summary() {
  const p = useLocalSearchParams<Record<string, string>>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [est, setEst] = useState<any>(null);
  const pickup = p.scheduled_at ? new Date(p.scheduled_at) : new Date();
  const ret = p.return_at ? new Date(p.return_at) : null;
  const days = parseInt(p.days || '1');
  const isHourly = p.trip_mode === 'hourly';
  const hours = parseFloat(p.duration_hours || '0');
  const [route, setRoute] = useState<any>(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    (async () => {
      let distance_km = 0;
      if (!isHourly && p.pickup_lat && p.drop_lat) {
        const r = await getDirections(`${p.pickup_lat},${p.pickup_lng}`, `${p.drop_lat},${p.drop_lng}`);
        if (r) { setRoute(r); distance_km = r.distance_km; }
      }
      try {
        const r = await api.estimate({
          trip_type: isHourly ? 'hourly' : 'point_to_point',
          one_way: p.one_way === '1' || isHourly,
          distance_km, duration_hours: hours, days,
          // The night/odd-hour charge depends on the pickup time, and the stay
          // allowance on the customer's answer, so both must reach the engine.
          scheduled_at: p.scheduled_at || undefined,
          customer_stay: p.customer_stay === '1',
        });
        setEst({ ...r, distance_km });
      } catch (e: any) { Alert.alert('Error', e.message); }
    })();
  }, []);

  const pickupPt = p.pickup_lat && p.pickup_lng ? { lat: parseFloat(p.pickup_lat), lng: parseFloat(p.pickup_lng), label: p.pickup_address?.split(',')[0] } : undefined;
  const dropPt = p.drop_lat && p.drop_lng ? { lat: parseFloat(p.drop_lat), lng: parseFloat(p.drop_lng), label: p.drop_address?.split(',')[0] } : undefined;

  return (
    <View style={styles.c}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.head}>
          <TouchableOpacity testID="summary-back" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.inverse} />
          </TouchableOpacity>
          <Text style={styles.title}>Booking Summary</Text>
        </View>

        <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
          {!isHourly && route?.polyline && (
            <View style={{ marginBottom: 16 }}>
              <TouchableOpacity activeOpacity={0.9} onPress={() => setShowMap(true)} style={styles.mapPreview}>
                <View pointerEvents="none">
                  <LiveMap polyline={route.polyline} pickup={pickupPt} drop={dropPt} simulate={false} interactive={false} height={200} />
                </View>
                <View style={styles.expandBadge}>
                  <Ionicons name="expand" size={15} color="#fff" />
                  <Text style={styles.expandText}>Tap to expand</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.routeStats}>
                <View style={styles.routeStat}>
                  <Ionicons name="speedometer-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.routeStatText}>{route.distance_km.toFixed(1)} km</Text>
                </View>
                <View style={styles.routeStat}>
                  <Ionicons name="time-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.routeStatText}>{Math.floor(route.duration_min / 60)}h {route.duration_min % 60}m drive</Text>
                </View>
              </View>
            </View>
          )}
          <Text style={styles.sectionT}>Trip Summary</Text>
          <View style={styles.routeCard}>
            <View style={styles.routeRow}>
              <View style={styles.pinDot}><Ionicons name="location" size={22} color={theme.colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <View style={styles.routeLine}>
                  <Text style={styles.cityName}>{p.pickup_address?.split(',')[0]}</Text>
                  <Ionicons name="arrow-forward" size={16} color={theme.colors.textPrimary} />
                  <Text style={styles.cityName}>{p.drop_address?.split(',')[0]}</Text>
                </View>
                <Text style={styles.tripMeta}>{ret ? 'Round Trip' : 'One Way'} {days > 0 ? `· ${days} Days` : ''}</Text>
              </View>
            </View>
            <View style={styles.dateBlock}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
              <View>
                <Text style={styles.dateLbl}>Pickup</Text>
                <Text style={styles.dateVal}>{fmt(pickup)}</Text>
              </View>
            </View>
            {ret && (
              <View style={styles.dateBlock}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                <View>
                  <Text style={styles.dateLbl}>Return</Text>
                  <Text style={styles.dateVal}>{fmt(ret)}</Text>
                </View>
              </View>
            )}
          </View>

          <Text style={[styles.sectionT, { marginTop: 26 }]}>Fare Estimate</Text>
          {/* Rate Table v1.7 §2.4: one number, no component breakdown. The
              itemisation exists server-side but is deliberately not rendered —
              the conditions below are what the customer is told instead. */}
          {!est ? <ActivityIndicator color={theme.colors.primary} /> : (
            <View style={styles.fareCard}>
              <Text style={styles.estLbl}>Estimated fare</Text>
              <Text testID="fare-estimate" style={styles.estVal}>
                ₹{est.total_fare.toLocaleString('en-IN')}
              </Text>

              <View style={styles.conds}>
                <Cond text={`Includes ${est.included_km?.toLocaleString('en-IN')} km and ${est.included_hours} hours${est.trip_days > 1 ? ` across ${est.trip_days} days` : ''}.`} />
                <Cond text="Extra distance or time beyond that is added to the final fare." />
                {est.stay_included && (
                  <Cond text={`Includes the Buddy's stay for ${est.overnights} ${est.overnights === 1 ? 'night' : 'nights'}. Tell us if you're arranging it and we'll take it off.`} />
                )}
                {est.night_charge_applied && (
                  <Cond text="Includes a night charge — pickup is before 6 AM or arrival is after 10 PM." />
                )}
                <Cond text="Tolls are not part of this fare. You pay them directly during the trip." />
              </View>

              <View style={styles.varianceBox}>
                <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.varianceTxt}>Final fare is calculated when your trip ends.</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.bottom}>
          <TouchableOpacity
            testID="confirm-pay-btn"
            style={[styles.cta, !est && { opacity: 0.6 }]}
            disabled={!est}
            onPress={() => router.push({
              pathname: '/booking/payment',
              params: { ...p, total: String(est.total_fare), deposit: String(est.deposit), depositPct: String(est.deposit_pct), distance_km: String(est.distance_km || 0), polyline: route?.polyline || '' },
            })}
          >
            <Text style={styles.ctaText}>Confirm & Pay</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <LiveMap polyline={route?.polyline} pickup={pickupPt} drop={dropPt} simulate={false} interactive height="100%" />
          <View style={[styles.mapBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <TouchableOpacity testID="summary-map-close" onPress={() => setShowMap(false)} style={styles.mapClose}>
              <Ionicons name="close" size={26} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            {(pickupPt?.label || dropPt?.label) && (
              <View style={styles.mapTitle} pointerEvents="none">
                <Text style={styles.mapTitleText} numberOfLines={1}>{pickupPt?.label} → {dropPt?.label}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** One inclusion/exclusion line under the estimate (§2.4). */
const Cond = ({ text }: { text: string }) => (
  <View style={styles.condRow}>
    <View style={styles.condDot} />
    <Text style={styles.condTxt}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.primary },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.colors.inverse, fontSize: 22, fontWeight: '900' },
  sheet: { flex: 1, backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  sectionT: { fontSize: 22, fontWeight: '900', color: theme.colors.textPrimary, marginBottom: 14 },
  routeCard: { backgroundColor: theme.colors.softCard, borderRadius: theme.radius.lg, padding: 18, gap: 16 },
  routeRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  pinDot: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  routeLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cityName: { fontSize: 16, fontWeight: '900', color: theme.colors.textPrimary },
  tripMeta: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 },
  dateBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dateLbl: { color: theme.colors.textSecondary, fontSize: 13, marginBottom: 2 },
  dateVal: { color: theme.colors.textPrimary, fontWeight: '900', fontSize: 15 },
  fareCard: { backgroundColor: theme.colors.softCard, borderRadius: theme.radius.lg, padding: 18 },
  estLbl: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' },
  estVal: { color: theme.colors.primary, fontSize: 38, fontWeight: '900', marginTop: 2, letterSpacing: -0.5 },
  conds: { marginTop: 16, gap: 9 },
  condRow: { flexDirection: 'row', gap: 9 },
  condDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.colors.primaryLight, marginTop: 7 },
  condTxt: { flex: 1, color: theme.colors.textSecondary, fontSize: 13.5, lineHeight: 19 },
  varianceBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md, padding: 12,
  },
  varianceTxt: { flex: 1, color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600' },
  bottom: { padding: 16, backgroundColor: theme.colors.card },
  cta: { backgroundColor: theme.colors.primary, height: 58, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: theme.colors.inverse, fontSize: 18, fontWeight: '900' },
  routeStats: { flexDirection: 'row', gap: 16, marginTop: 10, paddingHorizontal: 4 },
  routeStat: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primarySoft },
  routeStatText: { color: theme.colors.primary, fontWeight: '800', fontSize: 13 },
  mapPreview: { borderRadius: theme.radius.lg, overflow: 'hidden', position: 'relative' },
  expandBadge: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill },
  expandText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  mapBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  mapClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  mapTitle: { flex: 1, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: theme.radius.pill, paddingHorizontal: 16, paddingVertical: 10, marginRight: 4 },
  mapTitleText: { fontWeight: '800', color: theme.colors.textPrimary, fontSize: 14 },
});
