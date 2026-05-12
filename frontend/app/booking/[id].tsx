import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, TextInput, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { theme } from '../../src/theme';

const STATUS_LABEL: Record<string, string> = {
  searching: 'Finding the perfect driver…',
  assigned: 'Driver is on the way',
  arrived: 'Driver has arrived',
  in_progress: 'Trip in progress',
  completed: 'Trip completed',
  cancelled: 'Trip cancelled',
};

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [code, setCode] = useState('');
  const pollRef = useRef<any>(null);

  const load = async () => {
    try { setBooking(await api.getBooking(id as string)); } catch {}
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 3000);
    return () => clearInterval(pollRef.current);
  }, [id]);

  useEffect(() => {
    if (booking?.status === 'completed' || booking?.status === 'cancelled') {
      clearInterval(pollRef.current);
    }
  }, [booking?.status]);

  const submitCode = async () => {
    if (code.length !== 4) { Alert.alert('Invalid', 'Code must be 4 digits'); return; }
    try {
      if (booking.status === 'in_progress') {
        const b = await api.verifyEnd(booking.id, code);
        setBooking(b); setCode('');
        Alert.alert('Trip completed', 'Thanks for riding with us!');
      } else {
        const b = await api.verifyStart(booking.id, code);
        setBooking(b); setCode('');
      }
    } catch (e: any) { Alert.alert('Wrong code', e.message); }
  };

  const cancel = async () => {
    Alert.alert('Cancel trip?', 'This will cancel your booking.', [
      { text: 'No' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          await api.cancelBooking(booking.id);
          router.replace('/(tabs)/bookings');
        },
      },
    ]);
  };

  const simulateArrived = async () => {
    try { setBooking(await api.simulateArrived(booking.id)); } catch {}
  };

  if (!booking) {
    return (
      <SafeAreaView style={styles.c}><Text style={{ textAlign: 'center', marginTop: 80 }}>Loading…</Text></SafeAreaView>
    );
  }

  const d = booking.driver;
  const showCodeInput = ['assigned', 'arrived', 'in_progress'].includes(booking.status);
  const isEndCode = booking.status === 'in_progress';

  return (
    <View style={styles.c}>
      <Image source={{ uri: 'https://images.unsplash.com/photo-1680187287324-e64977a3e7c9?w=1200' }} style={styles.map} />
      <View style={styles.mapTint} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity testID="trip-back" onPress={() => router.replace('/(tabs)/bookings')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.statusChip}>
            <View style={styles.pulse} />
            <Text style={styles.statusText}>{STATUS_LABEL[booking.status]}</Text>
          </View>
        </View>

        {/* Simulated car marker */}
        {d && booking.status !== 'completed' && booking.status !== 'cancelled' && (
          <View style={styles.carMarker}>
            <View style={styles.carPin}>
              <Ionicons name="car-sport" size={22} color={theme.colors.inverse} />
            </View>
            <Text style={styles.etaText}>{d.eta_minutes} min</Text>
          </View>
        )}

        <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
          <View style={styles.handle} />

          {/* Trip Codes Card */}
          {(booking.start_code) && (
            <View style={styles.codesCard}>
              <Text style={styles.codesTitle}>Safety Handshake</Text>
              <View style={styles.codesRow}>
                <View style={[styles.codeBox, !isEndCode && booking.status !== 'completed' && styles.codeBoxActive]}>
                  <Text style={styles.codeLbl}>START CODE</Text>
                  <Text testID="start-code" style={styles.codeVal}>{booking.start_code}</Text>
                  <Text style={styles.codeHint}>Give to driver to begin</Text>
                </View>
                <View style={[styles.codeBox, isEndCode && styles.codeBoxActive]}>
                  <Text style={styles.codeLbl}>END CODE</Text>
                  <Text testID="end-code" style={styles.codeVal}>{booking.end_code}</Text>
                  <Text style={styles.codeHint}>At destination</Text>
                </View>
              </View>
            </View>
          )}

          {/* Driver card */}
          {d ? (
            <View style={styles.driverCard}>
              <Image source={{ uri: d.photo }} style={styles.dpic} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.dname}>{d.name}</Text>
                  {d.aadhaar_verified && <Ionicons name="shield-checkmark" size={16} color={theme.colors.accentDark} />}
                </View>
                <Text style={styles.dmeta}>★ {d.rating} · {d.trips} trips</Text>
                <View style={styles.badges}>
                  {d.aadhaar_verified && <View style={styles.badge}><Text style={styles.badgeText}>Aadhaar</Text></View>}
                  {d.police_verified && <View style={styles.badge}><Text style={styles.badgeText}>Police</Text></View>}
                </View>
              </View>
              <View style={styles.actionsCol}>
                <TouchableOpacity testID="call-driver" style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${d.phone}`)}>
                  <Ionicons name="call" size={18} color={theme.colors.inverse} />
                </TouchableOpacity>
                <TouchableOpacity testID="chat-driver" style={[styles.actionBtn, { backgroundColor: theme.colors.accent }]} onPress={() => Alert.alert('Chat', 'In-app chat coming soon. Use call for now.')}>
                  <Ionicons name="chatbubble" size={18} color={theme.colors.primaryDark} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.searching}>
              <Ionicons name="search" size={28} color={theme.colors.primary} />
              <Text style={styles.searchingT}>Searching for nearby drivers…</Text>
              <Text style={styles.searchingS}>This usually takes a few seconds</Text>
            </View>
          )}

          {/* Code entry */}
          {showCodeInput && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {isEndCode ? 'Enter End Code to complete' : 'Enter Start Code from driver'}
              </Text>
              <TextInput
                testID="trip-code-input"
                style={styles.codeInput}
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="••••"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="number-pad"
                maxLength={4}
              />
              <TouchableOpacity testID="submit-code-btn" style={styles.cta} onPress={submitCode}>
                <Text style={styles.ctaText}>{isEndCode ? 'Complete trip' : 'Start trip'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Trip summary */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Trip summary</Text>
            <View style={styles.routeLine}><View style={[styles.dot, { backgroundColor: theme.colors.accent }]} /><Text style={styles.addr}>{booking.pickup_address}</Text></View>
            {booking.drop_address && <View style={styles.routeLine}><View style={[styles.dot, { backgroundColor: theme.colors.error }]} /><Text style={styles.addr}>{booking.drop_address}</Text></View>}
            <View style={styles.fareRow}>
              <Text style={styles.fareLbl}>Total fare</Text>
              <Text style={styles.fareVal}>₹{booking.total_fare}</Text>
            </View>
            <Text style={styles.payNote}>
              {booking.payment_method.toUpperCase()} · Paid ₹{booking.paid_amount}
              {booking.paid_amount < booking.total_fare ? ` · Balance ₹${(booking.total_fare - booking.paid_amount).toFixed(2)} on completion` : ''}
            </Text>
          </View>

          {/* Demo helpers */}
          {booking.status === 'assigned' && (
            <TouchableOpacity testID="sim-arrived" style={styles.demoBtn} onPress={simulateArrived}>
              <Ionicons name="flash" size={14} color={theme.colors.primary} />
              <Text style={styles.demoText}>Simulate driver arrived</Text>
            </TouchableOpacity>
          )}

          {(booking.status === 'searching' || booking.status === 'assigned' || booking.status === 'arrived') && (
            <TouchableOpacity testID="cancel-btn" style={styles.cancelBtn} onPress={cancel}>
              <Text style={styles.cancelText}>Cancel trip</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.primaryDark },
  map: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  mapTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,76,129,0.15)' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 4 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', ...theme.shadow.soft },
  statusChip: { marginLeft: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.pill, ...theme.shadow.soft },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent },
  statusText: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  carMarker: { position: 'absolute', top: '32%', alignSelf: 'center', alignItems: 'center', gap: 4 },
  carPin: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: theme.colors.card, ...theme.shadow.soft },
  etaText: { fontSize: 12, fontWeight: '800', color: theme.colors.inverse, backgroundColor: theme.colors.primaryDark, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  sheet: { flex: 1, marginTop: 'auto', backgroundColor: theme.colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, maxHeight: '70%' },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 14 },
  codesCard: { padding: 16, borderRadius: theme.radius.lg, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', marginBottom: 14 },
  codesTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.primary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  codesRow: { flexDirection: 'row', gap: 10 },
  codeBox: { flex: 1, padding: 14, backgroundColor: theme.colors.card, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.borderLight, alignItems: 'center' },
  codeBoxActive: { borderColor: theme.colors.accent, borderWidth: 2, backgroundColor: '#F0FDF4' },
  codeLbl: { fontSize: 10, color: theme.colors.textSecondary, fontWeight: '700', letterSpacing: 1 },
  codeVal: { fontSize: 28, fontWeight: '800', color: theme.colors.primary, letterSpacing: 4, marginVertical: 4 },
  codeHint: { fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center' },
  driverCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: theme.radius.lg, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.borderLight, ...theme.shadow.soft, marginBottom: 12 },
  dpic: { width: 60, height: 60, borderRadius: 30 },
  dname: { fontSize: 17, fontWeight: '800', color: theme.colors.textPrimary },
  dmeta: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, backgroundColor: '#DCFCE7' },
  badgeText: { fontSize: 10, fontWeight: '700', color: theme.colors.accentDark },
  actionsCol: { gap: 8 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  searching: { alignItems: 'center', gap: 6, padding: 24, borderRadius: theme.radius.lg, backgroundColor: '#EFF6FF', marginBottom: 12 },
  searchingT: { fontSize: 16, fontWeight: '700', color: theme.colors.primary },
  searchingS: { color: theme.colors.textSecondary, fontSize: 13 },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.borderLight, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 10 },
  codeInput: { height: 64, borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.borderLight, textAlign: 'center', fontSize: 28, letterSpacing: 14, fontWeight: '800', color: theme.colors.primary, backgroundColor: theme.colors.background },
  cta: { backgroundColor: theme.colors.primary, height: 52, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  ctaText: { color: theme.colors.inverse, fontSize: 16, fontWeight: '700' },
  routeLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  addr: { flex: 1, color: theme.colors.textPrimary, fontSize: 14 },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.borderLight },
  fareLbl: { color: theme.colors.textSecondary, fontWeight: '600' },
  fareVal: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary },
  payNote: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 6 },
  demoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed', marginBottom: 10 },
  demoText: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: theme.colors.error, fontWeight: '700' },
});
