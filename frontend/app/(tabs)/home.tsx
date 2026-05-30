import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Modal, Alert, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { theme } from '../../src/theme';
import CityPicker from '../../src/CityPicker';

type DateField = 'pickup' | 'return';
type TripMode = 'point_to_point' | 'hourly';

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtDate(d: Date) {
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}, ${d.getFullYear()}`;
}
function fmtTime(d: Date) {
  let h = d.getHours(); const m = d.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(h)}:${pad(m)} ${ap}`;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  // Drawer state kept but unused (now via tabs)
  const drawer = false;
  const setDrawer = (_: boolean) => {};
  const [recent, setRecent] = useState<any[]>([]);
  const [tripMode, setTripMode] = useState<TripMode>('point_to_point');
  const [oneWay, setOneWay] = useState(true);
  const [pickupAddr, setPickupAddr] = useState('Mumbai, Maharashtra');
  const [dropAddr, setDropAddr] = useState('Delhi, Delhi');
  const [hours, setHours] = useState('4');
  const today = new Date(); today.setHours(today.getHours() + 1, 30, 0, 0);
  const ret = new Date(today); ret.setDate(ret.getDate() + 5);
  const [pickupDate, setPickupDate] = useState<Date>(today);
  const [returnDate, setReturnDate] = useState<Date | null>(ret);
  const [picker, setPicker] = useState<DateField | null>(null);
  const [cityPicker, setCityPicker] = useState<null | 'pickup' | 'drop'>(null);
  const [intersect, setIntersect] = useState(true);

  const load = async () => {
    try {
      const u = await api.me(); setUser(u);
      const b = await api.listBookings(); setRecent(b.slice(0, 2));
    } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const days = oneWay || tripMode === 'hourly' || !returnDate ? 0 :
    Math.max(1, Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24)));

  const valid = tripMode === 'hourly' ? !!pickupAddr && parseFloat(hours) > 0 : !!pickupAddr && !!dropAddr;

  const goEstimate = () => {
    if (!valid) { Alert.alert('Missing', 'Please complete trip details'); return; }
    router.push({
      pathname: '/booking/summary',
      params: {
        trip_mode: tripMode,
        one_way: oneWay ? '1' : '0',
        pickup_address: pickupAddr, drop_address: tripMode === 'hourly' ? '' : dropAddr,
        scheduled_at: pickupDate.toISOString(),
        return_at: tripMode === 'point_to_point' && !oneWay && returnDate ? returnDate.toISOString() : '',
        days: String(days),
        duration_hours: tripMode === 'hourly' ? hours : '0',
        intersect_at_owner: intersect ? '1' : '0',
      },
    });
  };

  const logout = async () => {};

  return (
    <View style={styles.c}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.top}>
          <Text style={styles.title}>Reserve a ride</Text>
        </View>

        <View style={styles.sheet}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

              {/* Trip Mode Segmented */}
              <View style={styles.segment}>
                {(['point_to_point', 'hourly'] as TripMode[]).map((t) => (
                  <TouchableOpacity key={t} testID={`mode-${t}`} style={[styles.seg, tripMode === t && styles.segActive]} onPress={() => setTripMode(t)}>
                    <Text style={[styles.segText, tripMode === t && styles.segTextActive]}>{t === 'point_to_point' ? 'Point-to-Point' : 'Hourly Rental'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tripMode === 'point_to_point' && (
                <View style={styles.row}>
                  {(['one', 'round'] as const).map((k) => {
                    const isOne = k === 'one'; const active = oneWay === isOne;
                    return (
                      <TouchableOpacity key={k} testID={`way-${k}`} style={[styles.pill, active && styles.pillActive]} onPress={() => setOneWay(isOne)}>
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{isOne ? 'One Way' : 'Round Trip'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Pickup City */}
              <TouchableOpacity testID="pickup-btn" style={[styles.locCard, { marginTop: 16 }]} onPress={() => setCityPicker('pickup')}>
                <Text style={styles.locLbl}>Pickup</Text>
                <View style={styles.locRow}>
                  <Ionicons name="location" size={20} color={theme.colors.primary} />
                  <Text style={styles.locValue}>{pickupAddr}</Text>
                  <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>

              {tripMode === 'point_to_point' && (
                <>
                  <View style={styles.swapWrap}><View style={styles.swapBtn}><Ionicons name="arrow-down" size={20} color={theme.colors.inverse} /></View></View>
                  <TouchableOpacity testID="drop-btn" style={styles.locCard} onPress={() => setCityPicker('drop')}>
                    <Text style={styles.locLbl}>Destination</Text>
                    <View style={styles.locRow}>
                      <Ionicons name="location" size={20} color={theme.colors.primary} />
                      <Text style={styles.locValue}>{dropAddr}</Text>
                      <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {tripMode === 'hourly' && (
                <View style={[styles.locCard, { marginTop: 12 }]}>
                  <Text style={styles.locLbl}>Duration</Text>
                  <View style={styles.locRow}>
                    <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
                    <TextInput testID="hours-input" style={styles.hoursInput} value={hours} onChangeText={(t) => setHours(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="4" placeholderTextColor={theme.colors.textSecondary} />
                    <Text style={styles.hoursLbl}>hours</Text>
                  </View>
                </View>
              )}

              <View style={styles.divider}><Text style={styles.dividerText}>Trip Schedule</Text></View>

              <TouchableOpacity testID="pickup-date" style={styles.dateCard} onPress={() => setPicker('pickup')}>
                <Text style={styles.locLbl}>Pickup Date & Time</Text>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar" size={20} color={theme.colors.primary} />
                  <Text style={styles.dateText}>{fmtDate(pickupDate)}</Text>
                  <Ionicons name="time-outline" size={20} color={theme.colors.primary} style={{ marginLeft: 12 }} />
                  <Text style={styles.dateText}>{fmtTime(pickupDate)}</Text>
                </View>
              </TouchableOpacity>

              {tripMode === 'point_to_point' && !oneWay && (
                <TouchableOpacity testID="return-date" style={styles.dateCard} onPress={() => setPicker('return')}>
                  <Text style={styles.locLbl}>Return Date & Time</Text>
                  <View style={styles.dateRow}>
                    <Ionicons name="calendar" size={20} color={theme.colors.primary} />
                    <Text style={[styles.dateText, !returnDate && { color: theme.colors.textSecondary }]}>
                      {returnDate ? `${fmtDate(returnDate)}  ·  ${fmtTime(returnDate)}` : 'Select date'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Owner-Driver Intersect Toggle */}
              <View style={styles.intersectCard}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.intersectTitle}>Driver pickup at my location</Text>
                  <Text style={styles.intersectSub}>{intersect ? 'Driver comes to your pickup' : "You'll pick up the driver"}</Text>
                </View>
                <Switch testID="intersect-switch" value={intersect} onValueChange={setIntersect} trackColor={{ false: '#CBD5E1', true: theme.colors.primary }} thumbColor={theme.colors.card} />
              </View>

              <View style={styles.recentHead}>
                <Text style={styles.recentTitle}>Recent Bookings</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/trips')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
              </View>
              {recent.length === 0 ? (
                <Text style={styles.empty}>No bookings yet — your first trip awaits!</Text>
              ) : recent.map((b) => (
                <TouchableOpacity key={b.id} testID={`recent-${b.id}`} style={styles.recentCard} onPress={() => router.push(`/booking/${b.id}`)}>
                  <View style={styles.pinDot}><Ionicons name="location" size={18} color={theme.colors.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentRoute} numberOfLines={1}>
                      <Text style={{ fontWeight: '900' }}>{b.pickup_address.split(',')[0]}</Text>  <Text>→</Text>  <Text style={{ fontWeight: '900' }}>{(b.drop_address || 'Hourly').split(',')[0]}</Text>
                    </Text>
                    <Text style={styles.recentMeta}>{new Date(b.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}  ·  {b.one_way ? 'One Way' : 'Round Trip'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.bottomBar}>
              <TouchableOpacity testID="fare-estimate-btn" style={[styles.cta, !valid && styles.ctaDisabled]} onPress={goEstimate} disabled={!valid}>
                <Text style={styles.ctaText}>Fare Estimate</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>

      {/* City Pickers */}
      <CityPicker
        visible={cityPicker === 'pickup'}
        title="Pickup City"
        selected={pickupAddr}
        onClose={() => setCityPicker(null)}
        onSelect={setPickupAddr}
      />
      <CityPicker
        visible={cityPicker === 'drop'}
        title="Destination City"
        selected={dropAddr}
        onClose={() => setCityPicker(null)}
        onSelect={setDropAddr}
      />

      {/* Date Picker Modal */}
      <DateTimePicker
        visible={!!picker}
        initial={picker === 'pickup' ? pickupDate : (returnDate || new Date())}
        title={picker === 'pickup' ? 'Pickup Date & Time' : 'Return Date & Time'}
        onClose={() => setPicker(null)}
        onConfirm={(d: Date) => {
          if (picker === 'pickup') setPickupDate(d); else setReturnDate(d);
          setPicker(null);
        }}
      />

      {/* Drawer */}
      <Modal visible={drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}>
        <View style={styles.drawerOverlay}>
          <View style={styles.drawer}>
            <View style={styles.drawerHead}>
              <Text style={styles.drawerTitle}>Menu</Text>
              <TouchableOpacity testID="drawer-close" onPress={() => setDrawer(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={theme.colors.inverse} />
              </TouchableOpacity>
            </View>
            <View style={styles.drawerProfile}>
              <View style={styles.avatar}><Ionicons name="person" size={36} color={theme.colors.textSecondary} /></View>
              <View>
                <Text style={styles.dName}>{user?.name || 'Rider'}</Text>
                <Text style={styles.dPhone}>{user?.phone}</Text>
                {user?.email && <Text style={styles.dPhone}>{user.email}</Text>}
              </View>
            </View>
            <TouchableOpacity testID="menu-bookings" style={styles.drawerItem} onPress={() => { setDrawer(false); router.push('/bookings'); }}>
              <Ionicons name="list" size={22} color={theme.colors.primary} />
              <Text style={styles.drawerItemText}>My Bookings</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity testID="menu-logout" style={styles.logoutBtn} onPress={logout}>
              <Ionicons name="log-out-outline" size={22} color={theme.colors.error} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DateTimePicker({ visible, initial, title, onClose, onConfirm }: any) {
  const [date, setDate] = useState<Date>(initial);
  useEffect(() => { if (visible) setDate(new Date(initial)); }, [visible, initial]);
  if (!visible) return null;

  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthName = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const times = ['06:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '06:00 PM', '08:00 PM', '10:00 PM'];

  const goMonth = (delta: number) => {
    const nd = new Date(date); nd.setMonth(nd.getMonth() + delta); setDate(nd);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={pickerStyles.head}>
            <TouchableOpacity testID="picker-back" onPress={onClose} style={pickerStyles.back}><Ionicons name="arrow-back" size={22} color={theme.colors.inverse} /></TouchableOpacity>
            <Text style={pickerStyles.title}>{title}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
            <View style={pickerStyles.monthRow}>
              <TouchableOpacity testID="prev-month" onPress={() => goMonth(-1)} style={pickerStyles.monthNav}><Ionicons name="chevron-back" size={20} color={theme.colors.primary} /></TouchableOpacity>
              <Text style={pickerStyles.monthLbl}>{monthName}</Text>
              <TouchableOpacity testID="next-month" onPress={() => goMonth(1)} style={pickerStyles.monthNav}><Ionicons name="chevron-forward" size={20} color={theme.colors.primary} /></TouchableOpacity>
            </View>
            <View style={pickerStyles.weekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <Text key={i} style={pickerStyles.weekText}>{w}</Text>)}
            </View>
            <View style={pickerStyles.grid}>
              {cells.map((d, i) => {
                const sel = !!d && d === date.getDate();
                return (
                  <View key={i} style={pickerStyles.dayWrap}>
                    {d ? (
                      <TouchableOpacity
                        testID={`day-${d}`}
                        style={[pickerStyles.dayCell, sel && pickerStyles.daySel]}
                        onPress={() => { const nd = new Date(date); nd.setDate(d); setDate(nd); }}
                      >
                        <Text style={[pickerStyles.dayText, sel && pickerStyles.dayTextSel]}>{d}</Text>
                      </TouchableOpacity>
                    ) : <View style={pickerStyles.dayCell} />}
                  </View>
                );
              })}
            </View>
            <View style={pickerStyles.timeHead}><Ionicons name="time-outline" size={20} color={theme.colors.primary} /><Text style={pickerStyles.timeTitle}>Select Time</Text></View>
            <View style={pickerStyles.timeGrid}>
              {times.map((t) => {
                const cur = fmtTime(date);
                const sel = cur === t;
                return (
                  <TouchableOpacity
                    key={t}
                    testID={`time-${t}`}
                    style={[pickerStyles.timePill, sel && pickerStyles.timePillSel]}
                    onPress={() => {
                      const [hm, ap] = t.split(' ');
                      const [hStr, mStr] = hm.split(':');
                      let h = parseInt(hStr); const m = parseInt(mStr);
                      if (ap === 'PM' && h !== 12) h += 12;
                      if (ap === 'AM' && h === 12) h = 0;
                      const nd = new Date(date); nd.setHours(h, m, 0, 0); setDate(nd);
                    }}
                  >
                    <Text style={[pickerStyles.timeText, sel && pickerStyles.timeTextSel]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <View style={pickerStyles.bottom}>
            <TouchableOpacity testID="picker-confirm" style={pickerStyles.cta} onPress={() => onConfirm(date)}>
              <Text style={pickerStyles.ctaText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.primary },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'space-between' },
  menuBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.inverse },
  sheet: { flex: 1, backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  segment: { flexDirection: 'row', backgroundColor: theme.colors.softCard, borderRadius: theme.radius.pill, padding: 4 },
  seg: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: theme.radius.pill },
  segActive: { backgroundColor: theme.colors.primary },
  segText: { color: theme.colors.textSecondary, fontWeight: '800', fontSize: 14 },
  segTextActive: { color: theme.colors.inverse },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  pill: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: theme.radius.pill, borderWidth: 1.5, borderColor: theme.colors.softCard, backgroundColor: theme.colors.card },
  pillActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pillText: { color: theme.colors.textSecondary, fontWeight: '700', fontSize: 13 },
  pillTextActive: { color: theme.colors.inverse },
  locCard: { backgroundColor: theme.colors.card, borderRadius: theme.radius.md, padding: 14, borderWidth: 1, borderColor: theme.colors.softCard },
  locLbl: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locValue: { flex: 1, fontSize: 17, fontWeight: '800', color: theme.colors.textPrimary },
  hoursInput: { flex: 1, fontSize: 17, fontWeight: '800', color: theme.colors.textPrimary, height: 28, padding: 0 },
  hoursLbl: { color: theme.colors.textSecondary, fontWeight: '700' },
  swapWrap: { alignItems: 'center', marginVertical: -16, zIndex: 2 },
  swapBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: theme.colors.card },
  divider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 18, gap: 10 },
  dividerText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '700' },
  dateCard: { backgroundColor: theme.colors.card, borderRadius: theme.radius.md, padding: 14, borderWidth: 1, borderColor: theme.colors.softCard, marginBottom: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dateText: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  intersectCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.softCard, marginTop: 6, marginBottom: 8 },
  intersectTitle: { fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary },
  intersectSub: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 },
  recentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 12 },
  recentTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary },
  seeAll: { color: theme.colors.primary, fontWeight: '700' },
  empty: { color: theme.colors.textSecondary, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  recentCard: { flexDirection: 'row', gap: 12, padding: 14, backgroundColor: theme.colors.softCard, borderRadius: theme.radius.md, marginBottom: 10, alignItems: 'center' },
  pinDot: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  recentRoute: { fontSize: 14, color: theme.colors.textPrimary },
  recentMeta: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 3 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: theme.colors.card },
  cta: { backgroundColor: theme.colors.primary, height: 56, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaDisabled: { backgroundColor: theme.colors.softCard },
  ctaText: { color: theme.colors.inverse, fontSize: 17, fontWeight: '800' },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.35)' },
  drawer: { width: '78%', backgroundColor: theme.colors.card, paddingBottom: 40, marginLeft: 'auto' },
  drawerHead: { backgroundColor: theme.colors.primary, padding: 18, paddingTop: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drawerTitle: { color: theme.colors.inverse, fontSize: 24, fontWeight: '900' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  drawerProfile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, backgroundColor: theme.colors.primary },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center' },
  dName: { color: theme.colors.inverse, fontSize: 18, fontWeight: '900' },
  dPhone: { color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20 },
  drawerItemText: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, margin: 16, padding: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.softCard },
  logoutText: { color: theme.colors.error, fontWeight: '900', fontSize: 16 },
});

const pickerStyles = StyleSheet.create({
  head: { backgroundColor: theme.colors.primary, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.colors.inverse, fontSize: 22, fontWeight: '900' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 6 },
  monthNav: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.softCard, alignItems: 'center', justifyContent: 'center' },
  monthLbl: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  weekText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayWrap: { width: `${100 / 7}%`, padding: 3 },
  dayCell: { height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card },
  daySel: { backgroundColor: theme.colors.primary },
  dayText: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  dayTextSel: { color: theme.colors.inverse },
  timeHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 },
  timeTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timePill: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: theme.radius.pill, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.softCard },
  timePillSel: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  timeText: { fontWeight: '800', color: theme.colors.textPrimary, fontSize: 14 },
  timeTextSel: { color: theme.colors.inverse },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: theme.colors.card },
  cta: { backgroundColor: theme.colors.primary, height: 58, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: theme.colors.inverse, fontSize: 18, fontWeight: '900' },
});
