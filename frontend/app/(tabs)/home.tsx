import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { theme } from '../../src/theme';

type TripType = 'point_to_point' | 'hourly';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [tripType, setTripType] = useState<TripType>('point_to_point');
  const [oneWay, setOneWay] = useState(true);
  const [pickup, setPickup] = useState('Bandra West, Mumbai');
  const [drop, setDrop] = useState('Andheri East, Mumbai');
  const [distance, setDistance] = useState('18');
  const [hours, setHours] = useState('4');
  const [scheduleNow, setScheduleNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('Tomorrow 9:00 AM');
  const [intersectOwner, setIntersectOwner] = useState(true);
  const [transmission, setTransmission] = useState<'Automatic' | 'Manual'>('Automatic');

  useEffect(() => {
    api.me().then(setUser).catch(() => {});
  }, []);

  const goEstimate = () => {
    if (tripType === 'point_to_point' && (!pickup || !drop || !distance)) {
      Alert.alert('Missing', 'Fill pickup, drop and distance');
      return;
    }
    router.push({
      pathname: '/booking/estimate',
      params: {
        trip_type: tripType,
        one_way: oneWay ? '1' : '0',
        pickup_address: pickup,
        drop_address: drop,
        distance_km: distance,
        duration_hours: hours,
        schedule_now: scheduleNow ? '1' : '0',
        scheduled_at: scheduledAt,
        intersect_at_owner: intersectOwner ? '1' : '0',
        transmission,
      },
    });
  };

  return (
    <View style={styles.c}>
      <Image source={{ uri: 'https://images.unsplash.com/photo-1680187287324-e64977a3e7c9?w=1200' }} style={styles.mapBg} />
      <View style={styles.mapTint} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Hello{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋</Text>
            <Text style={styles.subtitle}>Book a verified driver</Text>
          </View>
          <View style={styles.locPin}>
            <Ionicons name="location" size={20} color={theme.colors.inverse} />
          </View>
        </View>

        <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={styles.handle} />

          <View style={styles.segment}>
            {(['point_to_point', 'hourly'] as TripType[]).map((t) => (
              <TouchableOpacity
                key={t}
                testID={`tab-${t}`}
                style={[styles.segBtn, tripType === t && styles.segActive]}
                onPress={() => setTripType(t)}
              >
                <Text style={[styles.segText, tripType === t && styles.segTextActive]}>
                  {t === 'point_to_point' ? 'Point-to-Point' : 'Hourly Rental'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tripType === 'point_to_point' && (
            <View style={styles.row}>
              {(['one', 'round'] as const).map((k) => {
                const isOne = k === 'one';
                const active = oneWay === isOne;
                return (
                  <TouchableOpacity
                    key={k}
                    testID={`way-${k}`}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setOneWay(isOne)}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {isOne ? 'One Way' : 'Round Trip'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.inputRow}>
            <View style={styles.bullet}><View style={[styles.dot, { backgroundColor: theme.colors.accent }]} /></View>
            <TextInput
              testID="pickup-input"
              style={styles.input}
              value={pickup}
              onChangeText={setPickup}
              placeholder="Pickup location"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          {tripType === 'point_to_point' && (
            <>
              <View style={styles.inputRow}>
                <View style={styles.bullet}><View style={[styles.dot, { backgroundColor: theme.colors.error }]} /></View>
                <TextInput
                  testID="drop-input"
                  style={styles.input}
                  value={drop}
                  onChangeText={setDrop}
                  placeholder="Drop location"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>
              <View style={styles.inputRow}>
                <View style={styles.bullet}><Ionicons name="speedometer-outline" size={18} color={theme.colors.primary} /></View>
                <TextInput
                  testID="distance-input"
                  style={styles.input}
                  value={distance}
                  onChangeText={(t) => setDistance(t.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder="Distance (km)"
                  placeholderTextColor={theme.colors.textSecondary}
                />
              </View>
            </>
          )}

          {tripType === 'hourly' && (
            <View style={styles.inputRow}>
              <View style={styles.bullet}><Ionicons name="time-outline" size={18} color={theme.colors.primary} /></View>
              <TextInput
                testID="hours-input"
                style={styles.input}
                value={hours}
                onChangeText={(t) => setHours(t.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="Duration (hours)"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>
          )}

          <View style={styles.rowGap}>
            <Text style={styles.label}>When</Text>
            <View style={styles.row}>
              <TouchableOpacity testID="when-now" style={[styles.pill, scheduleNow && styles.pillActive]} onPress={() => setScheduleNow(true)}>
                <Text style={[styles.pillText, scheduleNow && styles.pillTextActive]}>Now</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="when-later" style={[styles.pill, !scheduleNow && styles.pillActive]} onPress={() => setScheduleNow(false)}>
                <Text style={[styles.pillText, !scheduleNow && styles.pillTextActive]}>Schedule</Text>
              </TouchableOpacity>
            </View>
            {!scheduleNow && (
              <TextInput
                testID="schedule-time"
                style={[styles.input, styles.scheduleInput]}
                value={scheduledAt}
                onChangeText={setScheduledAt}
                placeholder="e.g. Tomorrow 9:00 AM"
                placeholderTextColor={theme.colors.textSecondary}
              />
            )}
          </View>

          <View style={styles.rowGap}>
            <Text style={styles.label}>Car Transmission</Text>
            <View style={styles.row}>
              {(['Automatic', 'Manual'] as const).map((tx) => (
                <TouchableOpacity
                  key={tx}
                  testID={`tx-${tx}`}
                  style={[styles.pill, transmission === tx && styles.pillActive]}
                  onPress={() => setTransmission(tx)}
                >
                  <Text style={[styles.pillText, transmission === tx && styles.pillTextActive]}>{tx}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.toggleCard}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleTitle}>Driver pickup at my location</Text>
              <Text style={styles.toggleSub}>
                {intersectOwner ? 'Driver comes to your pickup' : "You'll pick the driver up"}
              </Text>
            </View>
            <Switch
              testID="intersect-switch"
              value={intersectOwner}
              onValueChange={setIntersectOwner}
              trackColor={{ false: '#CBD5E1', true: theme.colors.accent }}
              thumbColor={theme.colors.card}
            />
          </View>

          <TouchableOpacity testID="see-prices-btn" style={styles.cta} onPress={goEstimate}>
            <Text style={styles.ctaText}>See prices</Text>
            <Ionicons name="arrow-forward" size={20} color={theme.colors.inverse} />
          </TouchableOpacity>

          {user?.is_new && (
            <View style={styles.promo}>
              <Ionicons name="gift" size={18} color={theme.colors.accentDark} />
              <Text style={styles.promoText}>First ride? Enjoy 10% off automatically.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.primaryDark },
  mapBg: { ...StyleSheet.absoluteFillObject, opacity: 0.85 },
  mapTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,76,129,0.18)' },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hello: { fontSize: 24, fontWeight: '800', color: theme.colors.inverse, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  locPin: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, backgroundColor: theme.colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: 8, padding: 20 },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 12 },
  segment: { flexDirection: 'row', backgroundColor: theme.colors.background, borderRadius: theme.radius.pill, padding: 4, marginBottom: 16 },
  segBtn: { flex: 1, paddingVertical: 12, borderRadius: theme.radius.pill, alignItems: 'center' },
  segActive: { backgroundColor: theme.colors.primary },
  segText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 14 },
  segTextActive: { color: theme.colors.inverse },
  row: { flexDirection: 'row', gap: 10 },
  rowGap: { gap: 8, marginTop: 4 },
  pill: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.borderLight, backgroundColor: theme.colors.card },
  pillActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pillText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: theme.colors.inverse },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.background, borderRadius: theme.radius.md, paddingHorizontal: 12, marginTop: 12, borderWidth: 1, borderColor: theme.colors.borderLight },
  bullet: { width: 28, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  input: { flex: 1, height: 52, fontSize: 15, color: theme.colors.textPrimary },
  scheduleInput: { paddingHorizontal: 16, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.borderLight, backgroundColor: theme.colors.background, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  toggleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, padding: 16, borderRadius: theme.radius.md, marginTop: 16, borderWidth: 1, borderColor: theme.colors.borderLight },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  toggleSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  cta: { marginTop: 18, backgroundColor: theme.colors.primary, height: 58, borderRadius: theme.radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ctaText: { color: theme.colors.inverse, fontSize: 17, fontWeight: '700' },
  promo: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: theme.radius.md, backgroundColor: '#DCFCE7', marginTop: 14 },
  promoText: { color: theme.colors.accentDark, fontWeight: '700', fontSize: 13 },
});
