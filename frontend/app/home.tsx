import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, clearToken } from '../src/api';
import { theme } from '../src/theme';

type DateField = 'pickup' | 'return';

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
  const [drawer, setDrawer] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);
  const [pickupAddr, setPickupAddr] = useState('Mumbai, Maharashtra');
  const [dropAddr, setDropAddr] = useState('Delhi, Delhi');
  const today = new Date(); today.setHours(today.getHours() + 1, 30, 0, 0);
  const ret = new Date(today); ret.setDate(ret.getDate() + 5);
  const [pickupDate, setPickupDate] = useState<Date>(today);
  const [returnDate, setReturnDate] = useState<Date | null>(ret);
  const [picker, setPicker] = useState<DateField | null>(null);

  const load = async () => {
    try {
      const u = await api.me(); setUser(u);
      const b = await api.listBookings(); setRecent(b.slice(0, 2));
    } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const days = returnDate ? Math.max(1, Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;

  const goEstimate = () => {
    if (!pickupAddr || !dropAddr) { Alert.alert('Missing', 'Enter pickup & destination'); return; }
    router.push({
      pathname: '/booking/summary',
      params: {
        pickup_address: pickupAddr, drop_address: dropAddr,
        scheduled_at: pickupDate.toISOString(), return_at: returnDate?.toISOString() || '',
        days: String(days),
      },
    });
  };

  const logout = async () => { await clearToken(); router.replace('/login'); };

  return (
    <View style={styles.c}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.top}>
          <TouchableOpacity testID="menu-btn" onPress={() => setDrawer(true)} style={styles.menuBtn}>
            <Ionicons name="menu" size={22} color={theme.colors.inverse} />
          </TouchableOpacity>
          <Text style={styles.title}>Reserve a ride</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.sheet}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>

              <View style={styles.locCard}>
                <Text style={styles.locLbl}>Pickup</Text>
                <View style={styles.locRow}>
                  <Ionicons name="location" size={20} color={theme.colors.primary} />
                  <TextInput testID="pickup-input" style={styles.locInput} value={pickupAddr} onChangeText={setPickupAddr} placeholder="Pickup" placeholderTextColor={theme.colors.textSecondary} />
                </View>
              </View>

              <View style={styles.swapWrap}>
                <View style={styles.swapBtn}>
                  <Ionicons name="arrow-down" size={20} color={theme.colors.inverse} />
                </View>
              </View>

              <View style={styles.locCard}>
                <Text style={styles.locLbl}>Destination</Text>
                <View style={styles.locRow}>
                  <Ionicons name="location" size={20} color={theme.colors.primary} />
                  <TextInput testID="drop-input" style={styles.locInput} value={dropAddr} onChangeText={setDropAddr} placeholder="Destination" placeholderTextColor={theme.colors.textSecondary} />
                </View>
              </View>

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

              <TouchableOpacity testID="return-date" style={styles.dateCard} onPress={() => setPicker('return')}>
                <Text style={styles.locLbl}>Return Date & Time</Text>
                <View style={styles.dateRow}>
                  <Ionicons name="calendar" size={20} color={theme.colors.primary} />
                  <Text style={[styles.dateText, !returnDate && { color: theme.colors.textSecondary }]}>
                    {returnDate ? `${fmtDate(returnDate)}  ·  ${fmtTime(returnDate)}` : 'Select date'}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.recentHead}>
                <Text style={styles.recentTitle}>Recent Bookings</Text>
                <TouchableOpacity onPress={() => router.push('/bookings')}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
              </View>
              {recent.length === 0 ? (
                <Text style={styles.empty}>No bookings yet — your first trip awaits!</Text>
              ) : recent.map((b) => (
                <TouchableOpacity key={b.id} testID={`recent-${b.id}`} style={styles.recentCard} onPress={() => router.push(`/booking/${b.id}`)}>
                  <View style={styles.pinDot}><Ionicons name="location" size={18} color={theme.colors.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentRoute} numberOfLines={1}>
                      <Text style={{ fontWeight: '900' }}>{b.pickup_address.split(',')[0]}</Text>  <Text>→</Text>  <Text style={{ fontWeight: '900' }}>{(b.drop_address || '').split(',')[0]}</Text>
                    </Text>
                    <Text style={styles.recentMeta}>{new Date(b.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}  ·  {b.one_way ? 'One Way' : 'Round Trip'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.bottomBar}>
              <TouchableOpacity testID="fare-estimate-btn" style={[styles.cta, (!pickupAddr || !dropAddr) && styles.ctaDisabled]} onPress={goEstimate} disabled={!pickupAddr || !dropAddr}>
                <Text style={styles.ctaText}>Fare Estimate</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>

      {/* Date Picker Modal */}
      <DateTimePicker
        visible={!!picker}
        initial={picker === 'pickup' ? pickupDate : (returnDate || new Date())}
        title={picker === 'pickup' ? 'Pickup Date & Time' : 'Return Date & Time'}
        onClose={() => setPicker(null)}
        onConfirm={(d) => {
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
                <Text style={styles.dName}>{user?.name || 'Arjun Patel'}</Text>
                <Text style={styles.dPhone}>{user?.phone || '+91 98765 43210'}</Text>
                <View style={styles.starRow}><Ionicons name="star" size={14} color="#FFC107" /><Text style={styles.starText}>4.9</Text></View>
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
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setDrawer(false)} />
        </View>
      </Modal>
    </View>
  );
}

function DateTimePicker({ visible, initial, title, onClose, onConfirm }: any) {
  const [date, setDate] = useState(initial);
  useEffect(() => { if (visible) setDate(initial); }, [visible]);
  if (!visible) return null;
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const grid: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  const times = ['12:00 AM', '12:30 AM', '1:00 AM', '1:30 AM', '2:00 AM', '2:30 AM', '8:00 AM', '9:00 AM', '10:00 AM', '12:00 PM', '3:00 PM', '6:00 PM', '9:00 PM', '11:00 PM'];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={pickerStyles.head}>
            <TouchableOpacity testID="picker-back" onPress={onClose} style={pickerStyles.back}><Ionicons name="arrow-back" size={22} color={theme.colors.inverse} /></TouchableOpacity>
            <Text style={pickerStyles.title}>{title}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
            <View style={pickerStyles.grid}>
              {grid.map((d, i) => {
                const sel = d === date.getDate();
                return (
                  <TouchableOpacity
                    key={i}
                    testID={d ? `day-${d}` : undefined}
                    disabled={!d}
                    style={[pickerStyles.day, sel && pickerStyles.daySel, !d && { backgroundColor: 'transparent' }]}
                    onPress={() => { if (d) { const nd = new Date(date); nd.setDate(d); setDate(nd); } }}
                  >
                    <Text style={[pickerStyles.dayText, sel && { color: theme.colors.inverse }, !d && { opacity: 0 }]}>{d || ''}</Text>
                  </TouchableOpacity>
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
                    <Text style={[pickerStyles.timeText, sel && { color: theme.colors.inverse }]}>{t}</Text>
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
  locCard: { backgroundColor: theme.colors.card, borderRadius: theme.radius.md, padding: 14, borderWidth: 1, borderColor: theme.colors.softCard },
  locLbl: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locInput: { flex: 1, fontSize: 17, fontWeight: '800', color: theme.colors.textPrimary, height: 28, padding: 0 },
  swapWrap: { alignItems: 'center', marginVertical: -16, zIndex: 2 },
  swapBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: theme.colors.card },
  divider: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 18, gap: 10 },
  dividerText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '700' },
  dateCard: { backgroundColor: theme.colors.card, borderRadius: theme.radius.md, padding: 14, borderWidth: 1, borderColor: theme.colors.softCard, marginBottom: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dateText: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  recentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 12 },
  recentTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary },
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
  drawer: { width: '78%', backgroundColor: theme.colors.card, paddingBottom: 40 },
  drawerHead: { backgroundColor: theme.colors.primary, padding: 18, paddingTop: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drawerTitle: { color: theme.colors.inverse, fontSize: 24, fontWeight: '900' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  drawerProfile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, backgroundColor: theme.colors.primary },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center' },
  dName: { color: theme.colors.inverse, fontSize: 18, fontWeight: '900' },
  dPhone: { color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  starText: { color: theme.colors.inverse, fontWeight: '800' },
  drawerItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20 },
  drawerItemText: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, margin: 16, padding: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.softCard },
  logoutText: { color: theme.colors.error, fontWeight: '900', fontSize: 16 },
});

const pickerStyles = StyleSheet.create({
  head: { backgroundColor: theme.colors.primary, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.colors.inverse, fontSize: 22, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  day: { width: `${100 / 7}%`, aspectRatio: 1, padding: 4 },
  dayText: { textAlign: 'center', textAlignVertical: 'center', lineHeight: 50, fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, backgroundColor: theme.colors.card, borderRadius: theme.radius.md, height: 50 },
  daySel: {},
  timeHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 12 },
  timeTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timePill: { width: '30%', paddingVertical: 14, alignItems: 'center', borderRadius: theme.radius.pill, backgroundColor: theme.colors.softCard },
  timePillSel: { backgroundColor: theme.colors.primary },
  timeText: { fontWeight: '800', color: theme.colors.textPrimary, fontSize: 14 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: theme.colors.card },
  cta: { backgroundColor: theme.colors.primary, height: 58, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: theme.colors.inverse, fontSize: 18, fontWeight: '900' },
});

// Override the daySel style to actually highlight
Object.assign(pickerStyles.daySel, {});
