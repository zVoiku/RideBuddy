import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, clearToken } from '../src/api';
import { theme } from '../src/theme';

export default function Account() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [cars, setCars] = useState<any[]>([]);

  const load = async () => {
    try {
      const u = await api.me(); setUser(u);
      const c = await api.listCars(); setCars(c);
    } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const logout = () => {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await clearToken(); router.replace('/login'); } },
    ]);
  };

  const initial = (user?.name || user?.phone || 'U').slice(0, 1).toUpperCase();

  return (
    <View style={styles.c}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.head}>
          <TouchableOpacity testID="account-back" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.inverse} />
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 16 }}>
          <View style={styles.profile}>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{initial}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{user?.name || 'Add your name'}</Text>
              <Text style={styles.phone}>{user?.phone}</Text>
              {user?.email && <Text style={styles.phone}>{user.email}</Text>}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>My Garage</Text>
            {cars.length === 0 ? (
              <Text style={styles.empty}>No cars yet</Text>
            ) : cars.map((c) => (
              <View key={c.id} style={styles.carRow}>
                <View style={styles.carIcon}><Ionicons name="car-sport" size={18} color={theme.colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.carName}>{c.make} {c.model}</Text>
                  <Text style={styles.carMeta}>{c.transmission}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity testID="add-car-btn" style={styles.addCar} onPress={() => router.push('/onboarding/car-make')}>
              <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.addCarText}>Add another car</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {[
              { i: 'help-circle-outline', t: 'Help & Support', s: 'FAQs and contact us' },
              { i: 'document-text-outline', t: 'Terms & Privacy', s: 'Read our policies' },
              { i: 'information-circle-outline', t: 'About RideBuddy', s: 'v1.0' },
            ].map((row) => (
              <View key={row.t} style={styles.menuRow}>
                <View style={styles.menuIcon}><Ionicons name={row.i as any} size={18} color={theme.colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuT}>{row.t}</Text>
                  <Text style={styles.menuS}>{row.s}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
              </View>
            ))}
          </View>

          <TouchableOpacity testID="logout-btn" style={styles.logout} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.primary },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.colors.inverse, fontSize: 22, fontWeight: '900' },
  sheet: { flex: 1, backgroundColor: theme.colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: theme.colors.card, borderRadius: theme.radius.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primaryPale, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 22, fontWeight: '900', color: theme.colors.primaryDark },
  name: { fontSize: 17, fontWeight: '900', color: theme.colors.textPrimary },
  phone: { color: theme.colors.textSecondary, marginTop: 2, fontSize: 13 },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: theme.colors.textPrimary },
  empty: { color: theme.colors.textSecondary, fontSize: 13 },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  carIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  carName: { fontWeight: '700', fontSize: 15, color: theme.colors.textPrimary },
  carMeta: { color: theme.colors.textSecondary, fontSize: 12 },
  addCar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, marginTop: 4 },
  addCarText: { color: theme.colors.primary, fontWeight: '700', fontSize: 14 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.colors.borderHair },
  menuIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  menuT: { fontWeight: '700', fontSize: 15, color: theme.colors.textPrimary },
  menuS: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 1 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: theme.radius.lg, borderWidth: 1.5, borderColor: theme.colors.error, marginTop: 8 },
  logoutText: { color: theme.colors.error, fontWeight: '900', fontSize: 15 },
});
