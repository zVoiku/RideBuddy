import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, TextInput, Modal, Linking, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { theme } from '../../src/theme';
import LiveMap from '../../src/LiveMap';

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function BookingDetail() {
  const { id, polyline } = useLocalSearchParams<{ id: string; polyline?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [b, setB] = useState<any>(null);
  const [showMap, setShowMap] = useState(false);
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [code, setCode] = useState('');
  const pollRef = useRef<any>(null);

  const load = async () => { try { setB(await api.getBooking(id as string)); } catch {} };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 3000);
    return () => clearInterval(pollRef.current);
  }, [id]);

  useEffect(() => {
    if (b?.status === 'completed' || b?.status === 'cancelled') clearInterval(pollRef.current);
  }, [b?.status]);

  if (!b) return <View style={styles.c} />;
  const d = b.driver;
  const onTrip = b.status === 'in_progress';
  const finalised = b.status === 'completed' || b.status === 'cancelled';

  const startTrip = async () => {
    if (code.length !== 4) { Alert.alert('Invalid', 'Enter the 4-digit code'); return; }
    Keyboard.dismiss();
    try {
      const r = await api.verifyStart(b.id, code);
      setB(r); setCode(''); setShowCodeEntry(false);
    } catch (e: any) { Alert.alert('Wrong code', e.message); }
  };

  const endTrip = async () => {
    if (code.length !== 4) { Alert.alert('Invalid', 'Enter the 4-digit end code'); return; }
    Keyboard.dismiss();
    try {
      const r = await api.verifyEnd(b.id, code);
      setB(r); setCode(''); setShowCodeEntry(false);
      Alert.alert('Trip completed', 'Thanks for riding with us!');
    } catch (e: any) { Alert.alert('Wrong code', e.message); }
  };

  const simulateArrived = async () => { try { setB(await api.simulateArrived(b.id)); } catch {} };

  return (
    <View style={styles.c}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.head}>
          <TouchableOpacity testID="detail-back" onPress={() => router.replace('/bookings')} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.inverse} />
          </TouchableOpacity>
          <Text style={styles.title}>{onTrip ? 'On Trip' : 'Booking Details'}</Text>
        </View>

        <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
          {/* Trip Code Card */}
          {b.start_code && !finalised && (
            <View style={styles.codeCard}>
              <Text style={styles.codeLbl}>{onTrip ? 'TRIP END CODE' : 'TRIP CODE'}</Text>
              <Text testID="trip-code" style={styles.codeBig}>{onTrip ? b.end_code : b.start_code}</Text>
              <Text style={styles.codeHint}>{onTrip ? 'Share with partner when trip ends at destination' : 'Share this with your ride partner to start the trip'}</Text>
            </View>
          )}

          {/* Driver Card */}
          {d ? (
            <View style={styles.driverCard}>
              <View style={styles.driverHead}>
                <Image source={{ uri: d.photo }} style={styles.dpic} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dname}>{d.name}</Text>
                  <View style={styles.starRow}>
                    <Ionicons name="star" size={14} color="#FFC107" />
                    <Text style={styles.starText}>{d.rating}</Text>
                    <Text style={styles.tripCount}>· {d.trips} trips</Text>
                  </View>
                  <View style={styles.badges}>
                    {d.aadhaar_verified && <View style={styles.badge}><Ionicons name="checkmark-circle" size={11} color={theme.colors.primary} /><Text style={styles.badgeText}>Aadhaar</Text></View>}
                    {d.police_verified && <View style={styles.badge}><Ionicons name="shield-checkmark" size={11} color={theme.colors.primary} /><Text style={styles.badgeText}>Police</Text></View>}
                  </View>
                </View>
              </View>
              <View style={styles.driverActions}>
                <TouchableOpacity testID="call-driver" style={styles.actBtn} onPress={() => Linking.openURL(`tel:${d.phone}`)}>
                  <Ionicons name="call" size={18} color={theme.colors.inverse} />
                  <Text style={styles.actText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="msg-driver" style={[styles.actBtn, styles.actBtnAlt]} onPress={() => router.push(`/chat/${b.id}`)}>
                  <Ionicons name="chatbubble" size={18} color={theme.colors.primary} />
                  <Text style={[styles.actText, { color: theme.colors.primary }]}>Message</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : !finalised ? (
            <View style={styles.searching}>
              <Text style={{ fontSize: 48 }}>🚗</Text>
              <Text style={styles.searchT}>Searching nearby partners…</Text>
            </View>
          ) : null}

          {/* Static trip route preview before trip starts */}
          {(b.status === 'assigned' || b.status === 'arrived') && (
            <View style={styles.routePreviewCard}>
              <Image source={{ uri: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200' }} style={styles.routePreviewImg} />
              <View style={styles.routePreviewOverlay} />
              <View style={styles.routePreviewPins}>
                <View style={styles.routePinTop}>
                  <View style={[styles.routePin, { backgroundColor: theme.colors.accent }]}><Ionicons name="location" size={14} color={theme.colors.inverse} /></View>
                  <Text style={styles.routePinText} numberOfLines={1}>{b.pickup_address?.split(',')[0]}</Text>
                </View>
                <View style={styles.routePinDots}>
                  {[1, 2, 3, 4].map((i) => <View key={i} style={styles.routePinDot} />)}
                </View>
                <View style={styles.routePinBottom}>
                  <View style={[styles.routePin, { backgroundColor: theme.colors.error }]}><Ionicons name="flag" size={14} color={theme.colors.inverse} /></View>
                  <Text style={styles.routePinText} numberOfLines={1}>{(b.drop_address || 'Destination').split(',')[0]}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Live Trip Map button — only after trip started */}
          {onTrip && (
            <TouchableOpacity testID="live-map-btn" style={styles.mapBtn} onPress={() => setShowMap(true)}>
              <Ionicons name="map" size={20} color={theme.colors.inverse} />
              <Text style={styles.mapBtnText}>Live Trip Map</Text>
            </TouchableOpacity>
          )}

          {/* Trip Summary */}
          <View style={styles.tripCard}>
            <Text style={styles.sectionT}>Trip Summary</Text>
            <View style={styles.routeRow}>
              <View style={styles.pinDot}><Ionicons name="location" size={18} color={theme.colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeText}>
                  <Text style={{ fontWeight: '900' }}>{b.pickup_address?.split(',')[0]}</Text>
                  {'  →  '}
                  <Text style={{ fontWeight: '900' }}>{(b.drop_address || '').split(',')[0]}</Text>
                </Text>
                <Text style={styles.routeMeta}>{b.one_way ? 'One Way' : 'Round Trip'} {b.days > 0 ? `· ${b.days} Days` : ''}</Text>
              </View>
            </View>
            <View style={styles.dateLine}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.dateText}>{fmtDate(b.scheduled_at || b.created_at)}</Text>
            </View>
            {b.return_at && (
              <View style={styles.dateLine}>
                <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.dateText}>Return: {fmtDate(b.return_at)}</Text>
              </View>
            )}
            <View style={styles.fareRow}>
              <Text style={styles.fareLbl}>Total Fare</Text>
              <Text style={styles.fareVal}>₹{b.total_fare.toLocaleString('en-IN')}</Text>
            </View>
            <Text style={styles.paid}>Paid ₹{b.paid_amount.toLocaleString('en-IN')} {b.paid_amount < b.total_fare ? `· Balance ₹${(b.total_fare - b.paid_amount).toLocaleString('en-IN')}` : '· Fully Paid'}</Text>
          </View>

          {/* Helpers */}
          {b.status === 'assigned' && (
            <TouchableOpacity testID="sim-arrived" style={styles.sim} onPress={simulateArrived}>
              <Ionicons name="flash" size={14} color={theme.colors.primary} />
              <Text style={styles.simText}>Simulate Partner Arrived</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Bottom action area */}
        {!finalised && b.status !== 'searching' && (
          <View style={styles.bottom}>
            {onTrip ? (
              <View style={{ gap: 10 }}>
                <TouchableOpacity testID="sos-btn" style={styles.sos} onPress={() => Alert.alert('SOS', 'Emergency contacts notified (mock).')}>
                  <Ionicons name="warning" size={20} color={theme.colors.inverse} />
                  <Text style={styles.sosText}>SOS - Emergency Help</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="end-trip-btn" style={styles.endTrip} onPress={() => setShowCodeEntry(true)}>
                  <Text style={styles.endTripText}>Enter End Code</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity testID="start-trip-btn" style={styles.endTrip} onPress={() => setShowCodeEntry(true)}>
                <Text style={styles.endTripText}>Enter Start Code</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>

      {/* Code entry modal */}
      <Modal visible={showCodeEntry} transparent animationType="slide" onRequestClose={() => setShowCodeEntry(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{onTrip ? 'Enter Trip End Code' : 'Enter Trip Start Code'}</Text>
            <Text style={styles.modalSub}>{onTrip ? 'Get the 4-digit end code from your partner' : 'Get the 4-digit code from your partner'}</Text>
            <TextInput
              testID="code-input"
              style={styles.codeInput}
              value={code}
              onChangeText={(t) => {
                const d = t.replace(/[^0-9]/g, '').slice(0, 4);
                setCode(d);
                if (d.length === 4) Keyboard.dismiss();
              }}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="• • • •"
              placeholderTextColor={theme.colors.textSecondary}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity testID="modal-cancel" style={styles.modalSecondary} onPress={() => { setShowCodeEntry(false); setCode(''); }}>
                <Text style={styles.modalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="modal-confirm" style={styles.modalPrimary} onPress={onTrip ? endTrip : startTrip}>
                <Text style={styles.modalPrimaryText}>{onTrip ? 'Complete Trip' : 'Start Trip'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Live Trip Map modal */}
      <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
            <View style={styles.mapHead}>
              <View style={styles.mapChip}>
                <View style={styles.pulse} />
                <Text style={styles.mapChipText}>Live · {d?.eta_minutes ?? 5} min to destination</Text>
              </View>
            </View>
            <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
              <LiveMap
                polyline={polyline as string}
                pickup={b.pickup_lat && b.pickup_lng ? { lat: b.pickup_lat, lng: b.pickup_lng, label: b.pickup_address?.split(',')[0] } : undefined}
                drop={b.drop_lat && b.drop_lng ? { lat: b.drop_lat, lng: b.drop_lng, label: b.drop_address?.split(',')[0] } : undefined}
                simulate={onTrip}
                height={460}
              />
            </View>
            <View style={styles.mapFooter}>
              <Text style={{ fontWeight: '900', fontSize: 18, color: theme.colors.textPrimary }}>{d?.name}</Text>
              <Text style={{ color: theme.colors.textSecondary, marginTop: 4, marginBottom: 14 }}>{b.pickup_address?.split(',')[0]} → {(b.drop_address || 'Hourly').split(',')[0]}</Text>
              <TouchableOpacity testID="map-close" onPress={() => setShowMap(false)} style={styles.mapBottomBack}>
                <Ionicons name="arrow-back" size={20} color={theme.colors.inverse} />
                <Text style={styles.mapBottomBackText}>Back to Booking Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.primary },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.colors.inverse, fontSize: 22, fontWeight: '900' },
  sheet: { flex: 1, backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  codeCard: { padding: 22, borderRadius: theme.radius.lg, backgroundColor: theme.colors.softCard, borderWidth: 2, borderColor: theme.colors.primary, borderStyle: 'dashed', alignItems: 'center', marginBottom: 18 },
  codeLbl: { color: theme.colors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  codeBig: { fontSize: 56, fontWeight: '900', color: theme.colors.primary, letterSpacing: 18, marginVertical: 8 },
  codeHint: { color: theme.colors.textSecondary, fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  driverCard: { padding: 16, borderRadius: theme.radius.lg, backgroundColor: theme.colors.softCard, marginBottom: 14 },
  driverHead: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  dpic: { width: 64, height: 64, borderRadius: 32 },
  dname: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  starText: { fontWeight: '800', color: theme.colors.textPrimary },
  tripCount: { color: theme.colors.textSecondary, marginLeft: 4 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primarySoft },
  badgeText: { fontSize: 10, fontWeight: '800', color: theme.colors.primary },
  driverActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill },
  actBtnAlt: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.primary },
  actText: { color: theme.colors.inverse, fontWeight: '800', fontSize: 14 },
  searching: { padding: 30, borderRadius: theme.radius.lg, backgroundColor: theme.colors.softCard, alignItems: 'center', marginBottom: 14, gap: 8 },
  searchT: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  mapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary, marginBottom: 14 },
  mapBtnText: { color: theme.colors.inverse, fontWeight: '800', fontSize: 15 },
  routePreviewCard: { height: 180, borderRadius: theme.radius.lg, overflow: 'hidden', marginBottom: 14, justifyContent: 'space-between', padding: 14 },
  routePreviewImg: { ...StyleSheet.absoluteFillObject as any, width: '100%', height: '100%' },
  routePreviewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(14,155,155,0.25)' },
  routePreviewPins: { flex: 1, justifyContent: 'space-between' },
  routePinTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routePinBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routePin: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.card },
  routePinText: { flex: 1, color: theme.colors.inverse, fontWeight: '900', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, overflow: 'hidden' },
  routePinDots: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, marginLeft: 13 },
  routePinDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.inverse, opacity: 0.85 },
  tripCard: { padding: 16, borderRadius: theme.radius.lg, backgroundColor: theme.colors.softCard, gap: 10 },
  sectionT: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary, marginBottom: 6 },
  routeRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  pinDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  routeText: { color: theme.colors.textPrimary, fontSize: 15 },
  routeMeta: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 },
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '700' },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  fareLbl: { fontWeight: '800', color: theme.colors.textPrimary },
  fareVal: { fontWeight: '900', fontSize: 20, color: theme.colors.primary },
  paid: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  sim: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, padding: 12, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.primary, borderStyle: 'dashed' },
  simText: { color: theme.colors.primary, fontWeight: '800', fontSize: 13 },
  bottom: { padding: 16, backgroundColor: theme.colors.card, borderTopWidth: 1, borderTopColor: theme.colors.softCard },
  sos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: theme.radius.md, backgroundColor: theme.colors.error },
  sosText: { color: theme.colors.inverse, fontWeight: '900', fontSize: 16 },
  endTrip: { height: 56, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  endTripText: { color: theme.colors.inverse, fontWeight: '900', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: theme.colors.card, padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: theme.colors.textPrimary },
  modalSub: { color: theme.colors.textSecondary, marginTop: 6, marginBottom: 18 },
  codeInput: { height: 80, borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.colors.primary, textAlign: 'center', fontSize: 36, fontWeight: '900', color: theme.colors.primary, letterSpacing: 24, backgroundColor: theme.colors.softCard },
  modalSecondary: { flex: 1, height: 54, borderRadius: theme.radius.pill, backgroundColor: theme.colors.softCard, alignItems: 'center', justifyContent: 'center' },
  modalSecondaryText: { color: theme.colors.textPrimary, fontWeight: '800' },
  modalPrimary: { flex: 1, height: 54, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalPrimaryText: { color: theme.colors.inverse, fontWeight: '900' },
  mapHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16 },
  mapBack: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  mapChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.pill, backgroundColor: 'rgba(255,255,255,0.95)' },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent },
  mapChipText: { fontWeight: '800', color: theme.colors.textPrimary },
  carMarker: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: theme.colors.card },
  mapFooter: { backgroundColor: theme.colors.card, padding: 18, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  mapBottomBack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary },
  mapBottomBackText: { color: theme.colors.inverse, fontWeight: '900', fontSize: 16 },
});
