import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { theme } from '../../src/theme';

export default function Payment() {
  const p = useLocalSearchParams<Record<string, string>>();
  const router = useRouter();
  const total = parseFloat(p.total || '0');
  const adv = parseFloat(p.advance30 || '0');
  const [partial, setPartial] = useState(false);
  const [busy, setBusy] = useState(false);

  const payable = partial ? adv : total;
  const remaining = total - payable;

  const submit = async () => {
    try {
      setBusy(true);
      const b = await api.createBooking({
        trip_type: p.trip_mode === 'hourly' ? 'hourly' : 'point_to_point',
        one_way: p.one_way === '1' || p.trip_mode === 'hourly',
        pickup_address: p.pickup_address,
        drop_address: p.drop_address || undefined,
        distance_km: 0,
        duration_hours: parseFloat(p.duration_hours || '0'),
        days: parseInt(p.days || '0'),
        schedule_now: false,
        scheduled_at: p.scheduled_at,
        return_at: p.return_at || undefined,
        intersect_at_owner: p.intersect_at_owner === '1',
        transmission: 'Automatic',
        payment_method: 'upi',
        pay_partial: partial,
      });
      router.replace({ pathname: '/booking/finding', params: { id: b.id } });
    } catch (e: any) { setBusy(false); Alert.alert('Error', e.message); }
  };

  return (
    <View style={styles.c}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.head}>
          <TouchableOpacity testID="payment-back" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.inverse} />
          </TouchableOpacity>
          <Text style={styles.title}>Payment</Text>
        </View>

        <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 20, paddingBottom: 130 }}>
          <Text style={styles.h}>Choose Payment Option</Text>

          <TouchableOpacity testID="pay-full" style={[styles.option, !partial && styles.optionActive]} onPress={() => setPartial(false)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optTitle}>Full Payment</Text>
              <Text style={styles.optSub}>Pay the full amount now</Text>
              <Text style={styles.optAmt}>₹{total.toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.radio, !partial && styles.radioActive]}>{!partial && <View style={styles.radioDot} />}</View>
          </TouchableOpacity>

          <TouchableOpacity testID="pay-partial" style={[styles.option, partial && styles.optionActive]} onPress={() => setPartial(true)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.optTitle}>Partial Payment (30%)</Text>
              <Text style={styles.optSub}>Pay 30% now, rest before trip starts</Text>
              <Text style={styles.optAmt}>₹{adv.toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.radio, partial && styles.radioActive]}>{partial && <View style={styles.radioDot} />}</View>
          </TouchableOpacity>

          <Text style={[styles.h, { marginTop: 24 }]}>Payment Method</Text>
          <View style={styles.methodCard}>
            <View style={styles.methodIcon}><Ionicons name="card" size={28} color={theme.colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>UPI / Cards / Netbanking</Text>
              <Text style={styles.methodSub}>Secure payment gateway</Text>
            </View>
          </View>

          <View style={styles.summary}>
            <RowS label="Total Trip Cost" value={`₹${total.toLocaleString('en-IN')}`} />
            <RowS label={`Paying Now ${partial ? '(30%)' : '(100%)'}`} value={`₹${payable.toLocaleString('en-IN')}`} highlight />
            <RowS label="Remaining Amount" value={`₹${remaining.toLocaleString('en-IN')}`} muted />
          </View>
        </ScrollView>

        <View style={styles.bottom}>
          <TouchableOpacity testID="pay-now-btn" style={styles.cta} onPress={submit} disabled={busy}>
            <Text style={styles.ctaText}>{busy ? 'Processing…' : `Pay ₹${payable.toLocaleString('en-IN')}`}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const RowS = ({ label, value, highlight, muted }: any) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
    <Text style={{ color: muted ? theme.colors.textSecondary : theme.colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    <Text style={{ color: highlight ? theme.colors.primary : (muted ? theme.colors.textSecondary : theme.colors.textPrimary), fontWeight: '900', fontSize: 15 }}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.primary },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.colors.inverse, fontSize: 22, fontWeight: '900' },
  sheet: { flex: 1, backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  h: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, marginBottom: 14 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: theme.radius.lg, borderWidth: 2, borderColor: theme.colors.softCard, marginBottom: 14, backgroundColor: theme.colors.card },
  optionActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.softCard },
  optTitle: { fontSize: 16, fontWeight: '900', color: theme.colors.textPrimary },
  optSub: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 },
  optAmt: { color: theme.colors.primary, fontSize: 18, fontWeight: '900', marginTop: 10 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: theme.colors.textSecondary, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: theme.colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.primary },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: theme.radius.lg, backgroundColor: theme.colors.softCard },
  methodIcon: { width: 56, height: 56, borderRadius: 14, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center' },
  methodTitle: { fontSize: 16, fontWeight: '900', color: theme.colors.textPrimary },
  methodSub: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 },
  summary: { backgroundColor: theme.colors.softCard, borderRadius: theme.radius.lg, padding: 18, marginTop: 18 },
  bottom: { padding: 16, backgroundColor: theme.colors.card },
  cta: { backgroundColor: theme.colors.primary, height: 58, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: theme.colors.inverse, fontSize: 18, fontWeight: '900' },
});
