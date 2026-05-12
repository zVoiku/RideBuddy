import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { theme } from '../../src/theme';

type PM = 'upi' | 'card' | 'cash';

export default function Estimate() {
  const p = useLocalSearchParams<Record<string, string>>();
  const router = useRouter();
  const [est, setEst] = useState<any>(null);
  const [pm, setPm] = useState<PM>('upi');
  const [partial, setPartial] = useState(false);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.estimate({
          trip_type: p.trip_type,
          one_way: p.one_way === '1',
          distance_km: parseFloat(p.distance_km || '0'),
          duration_hours: parseFloat(p.duration_hours || '0'),
        });
        setEst(r);
      } catch (e: any) { Alert.alert('Error', e.message); }
    })();
  }, []);

  const confirm = async () => {
    if (booking) return;
    try {
      setBooking(true);
      const b = await api.createBooking({
        trip_type: p.trip_type,
        one_way: p.one_way === '1',
        pickup_address: p.pickup_address,
        drop_address: p.drop_address,
        distance_km: parseFloat(p.distance_km || '0'),
        duration_hours: parseFloat(p.duration_hours || '0'),
        schedule_now: p.schedule_now === '1',
        scheduled_at: p.scheduled_at,
        intersect_at_owner: p.intersect_at_owner === '1',
        transmission: p.transmission,
        payment_method: pm,
        pay_partial: partial,
      });
      router.replace(`/booking/${b.id}`);
    } catch (e: any) {
      setBooking(false);
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.c}>
      <View style={styles.top}>
        <TouchableOpacity testID="estimate-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.h1}>Confirm your ride</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 120 }}>
        <View style={styles.routeCard}>
          <View style={styles.routeLine}>
            <View style={[styles.routeDot, { backgroundColor: theme.colors.accent }]} />
            <Text style={styles.routeText} numberOfLines={1}>{p.pickup_address}</Text>
          </View>
          {p.drop_address ? (
            <>
              <View style={styles.routeBar} />
              <View style={styles.routeLine}>
                <View style={[styles.routeDot, { backgroundColor: theme.colors.error }]} />
                <Text style={styles.routeText} numberOfLines={1}>{p.drop_address}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.metaPill}><Ionicons name="car-sport" size={14} color={theme.colors.primary} /><Text style={styles.metaText}>{p.transmission}</Text></View>
            <View style={styles.metaPill}>
              <Ionicons name="time-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.metaText}>{p.schedule_now === '1' ? 'Now' : p.scheduled_at}</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="swap-horizontal" size={14} color={theme.colors.primary} />
              <Text style={styles.metaText}>{p.intersect_at_owner === '1' ? 'Driver to you' : 'Pickup driver'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fare Breakdown</Text>
          {!est ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <>
              <Row label="Base fare" value={`₹${est.base_fare}`} />
              {est.discount > 0 && <Row label="New-user discount (10%)" value={`-₹${est.discount}`} color={theme.colors.accentDark} />}
              <View style={styles.divider} />
              <Row label="Total" value={`₹${est.total_fare}`} bold />
              {est.discount > 0 && (
                <View style={styles.promo}>
                  <Ionicons name="gift" size={16} color={theme.colors.accentDark} />
                  <Text style={styles.promoText}>You saved ₹{est.discount}</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment</Text>
          <View style={styles.pmRow}>
            {([['upi', 'phone-portrait', 'UPI'], ['card', 'card', 'Card'], ['cash', 'cash', 'Cash']] as const).map(([k, ic, lbl]) => (
              <TouchableOpacity
                key={k}
                testID={`pm-${k}`}
                style={[styles.pmCard, pm === k && styles.pmActive]}
                onPress={() => setPm(k as PM)}
              >
                <Ionicons name={ic as any} size={22} color={pm === k ? theme.colors.inverse : theme.colors.primary} />
                <Text style={[styles.pmText, pm === k && { color: theme.colors.inverse }]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {pm !== 'cash' && est && (
            <View style={styles.advRow}>
              <TouchableOpacity testID="pay-full" style={[styles.advBtn, !partial && styles.advActive]} onPress={() => setPartial(false)}>
                <Text style={[styles.advText, !partial && styles.advTextActive]}>Pay full ₹{est.total_fare}</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="pay-partial" style={[styles.advBtn, partial && styles.advActive]} onPress={() => setPartial(true)}>
                <Text style={[styles.advText, partial && styles.advTextActive]}>30% now ₹{est.advance_30}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity testID="confirm-ride-btn" style={[styles.cta, booking && { opacity: 0.7 }]} onPress={confirm} disabled={booking || !est}>
          <Text style={styles.ctaText}>{booking ? 'Booking…' : `Confirm & Pay ${pm === 'cash' ? '(Cash)' : ''}`}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const Row = ({ label, value, bold, color }: any) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
    <Text style={{ color: theme.colors.textSecondary, fontSize: 15, fontWeight: bold ? '700' : '500' }}>{label}</Text>
    <Text style={{ color: color || theme.colors.textPrimary, fontSize: bold ? 18 : 15, fontWeight: bold ? '800' : '600' }}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.background },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  back: { padding: 8 },
  h1: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary, letterSpacing: -0.4 },
  routeCard: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 18, borderWidth: 1, borderColor: theme.colors.borderLight, ...theme.shadow.soft },
  routeLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeDot: { width: 12, height: 12, borderRadius: 6 },
  routeBar: { width: 2, height: 16, backgroundColor: theme.colors.borderLight, marginLeft: 5, marginVertical: 4 },
  routeText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill, backgroundColor: '#EFF6FF' },
  metaText: { fontSize: 12, color: theme.colors.primary, fontWeight: '700' },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 18, borderWidth: 1, borderColor: theme.colors.borderLight, ...theme.shadow.soft },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 10 },
  divider: { height: 1, backgroundColor: theme.colors.borderLight, marginVertical: 8 },
  promo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 10, borderRadius: theme.radius.md, backgroundColor: '#DCFCE7' },
  promoText: { color: theme.colors.accentDark, fontWeight: '700' },
  pmRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  pmCard: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.borderLight, gap: 6, backgroundColor: theme.colors.background },
  pmActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pmText: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  advRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  advBtn: { flex: 1, paddingVertical: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.borderLight, alignItems: 'center' },
  advActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  advText: { color: theme.colors.textPrimary, fontWeight: '700', fontSize: 13 },
  advTextActive: { color: theme.colors.primaryDark },
  cta: { backgroundColor: theme.colors.primary, height: 58, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  ctaText: { color: theme.colors.inverse, fontSize: 17, fontWeight: '800' },
});
