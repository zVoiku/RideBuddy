import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { theme } from '../../src/theme';
import { getDirections } from '../../src/maps';
import RouteMap from '../../src/RouteMap';

function fmt(d: Date) {
  return `${d.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function Summary() {
  const p = useLocalSearchParams<Record<string, string>>();
  const router = useRouter();
  const [est, setEst] = useState<any>(null);
  const pickup = p.scheduled_at ? new Date(p.scheduled_at) : new Date();
  const ret = p.return_at ? new Date(p.return_at) : null;
  const days = parseInt(p.days || '1');
  const isHourly = p.trip_mode === 'hourly';
  const hours = parseFloat(p.duration_hours || '0');
  const [route, setRoute] = useState<any>(null);

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
        });
        setEst({ ...r, distance_km });
      } catch (e: any) { Alert.alert('Error', e.message); }
    })();
  }, []);

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
              <RouteMap polyline={route.polyline} height={200} />
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
          {!est ? <ActivityIndicator color={theme.colors.primary} /> : (
            <View style={styles.fareCard}>
              {days > 0 && (
                <Row label="Trip Duration" value={`${days} Days`} bold />
              )}
              <Row label={est.per_day_rate ? `Base Fare (${days} × ₹${est.per_day_rate})` : 'Base Fare'} value={`₹${est.base_fare.toLocaleString('en-IN')}`} />
              {est.discount > 0 && (
                <View style={styles.discountBox}>
                  <Text style={{ fontSize: 22 }}>🎉</Text>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.discountTitle}>New User Discount</Text>
                    <Text style={styles.discountSub}>{est.per_day_discount > 0 ? `₹${est.per_day_discount} off per day for new users` : '10% off for new users'}</Text>
                  </View>
                  <Text style={styles.discountAmt}>-₹{est.discount.toLocaleString('en-IN')}</Text>
                </View>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalLbl}>Total Amount</Text>
                <Text style={styles.totalVal}>₹{est.total_fare.toLocaleString('en-IN')}</Text>
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
              params: { ...p, total: String(est.total_fare), advance30: String(est.advance_30), distance_km: String(est.distance_km || 0), polyline: route?.polyline || '' },
            })}
          >
            <Text style={styles.ctaText}>Confirm & Pay</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const Row = ({ label, value, bold }: any) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
    <Text style={{ color: theme.colors.textPrimary, fontWeight: bold ? '900' : '600', fontSize: 15 }}>{label}</Text>
    <Text style={{ color: theme.colors.textPrimary, fontWeight: '900', fontSize: 15 }}>{value}</Text>
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
  discountBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: theme.radius.md, padding: 14, marginVertical: 10 },
  discountTitle: { color: theme.colors.primary, fontWeight: '900', fontSize: 15 },
  discountSub: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  discountAmt: { color: theme.colors.primary, fontWeight: '900', fontSize: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 },
  totalLbl: { fontWeight: '900', fontSize: 18, color: theme.colors.textPrimary },
  totalVal: { fontWeight: '900', fontSize: 22, color: theme.colors.primary },
  bottom: { padding: 16, backgroundColor: theme.colors.card },
  cta: { backgroundColor: theme.colors.primary, height: 58, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: theme.colors.inverse, fontSize: 18, fontWeight: '900' },
  routeStats: { flexDirection: 'row', gap: 16, marginTop: 10, paddingHorizontal: 4 },
  routeStat: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primarySoft },
  routeStatText: { color: theme.colors.primary, fontWeight: '800', fontSize: 13 },
});
