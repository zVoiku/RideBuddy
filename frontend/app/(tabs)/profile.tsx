import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, clearToken } from '../../src/api';
import { theme } from '../../src/theme';

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(false);

  // Add-car form
  const [showAdd, setShowAdd] = useState(false);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [transmission, setTransmission] = useState<'Automatic' | 'Manual'>('Automatic');

  const load = async () => {
    try {
      const u = await api.me();
      setUser(u);
      setName(u.name || '');
      setEmail(u.email || '');
      setCars(await api.listCars());
    } catch {}
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const save = async () => {
    try {
      const u = await api.updateMe({ name, email });
      setUser(u);
      setEditing(false);
      Alert.alert('Saved', 'Profile updated');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const addCar = async () => {
    if (!make || !model) { Alert.alert('Missing', 'Make and model required'); return; }
    try {
      await api.addCar({ make, model, transmission });
      setMake(''); setModel('');
      setShowAdd(false);
      setCars(await api.listCars());
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const removeCar = async (id: string) => {
    await api.deleteCar(id);
    setCars(await api.listCars());
  };

  const logout = async () => {
    await clearToken();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 18 }}>
        <View style={styles.header}>
          <Text style={styles.h1}>Profile</Text>
          <TouchableOpacity testID="logout-btn" onPress={logout} style={styles.logout}>
            <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.profCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTxt}>{(user?.name || user?.phone || 'U').slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pname}>{user?.name || 'New Rider'}</Text>
            <Text style={styles.pphone}>{user?.phone}</Text>
            {user?.is_new && <Text style={styles.newBadge}>★ 10% off your first ride</Text>}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Personal info</Text>
            <TouchableOpacity testID="edit-profile-btn" onPress={() => setEditing(!editing)}>
              <Text style={styles.edit}>{editing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.lbl}>Full name</Text>
          <TextInput
            testID="name-input"
            style={[styles.input, !editing && styles.inputDisabled]}
            value={name}
            onChangeText={setName}
            editable={editing}
            placeholder="Your name"
            placeholderTextColor={theme.colors.textSecondary}
          />
          <Text style={styles.lbl}>Email</Text>
          <TextInput
            testID="email-input"
            style={[styles.input, !editing && styles.inputDisabled]}
            value={email}
            onChangeText={setEmail}
            editable={editing}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {editing && (
            <TouchableOpacity testID="save-profile-btn" style={styles.saveBtn} onPress={save}>
              <Text style={styles.saveBtnText}>Save changes</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>My Garage</Text>
            <TouchableOpacity testID="add-car-btn" onPress={() => setShowAdd(!showAdd)}>
              <Ionicons name={showAdd ? 'close' : 'add-circle'} size={26} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
          {cars.length === 0 && !showAdd && (
            <Text style={styles.empty}>No cars added. Tap + to add your first car.</Text>
          )}
          {cars.map((c) => (
            <View key={c.id} style={styles.carRow}>
              <View style={styles.carIcon}><Ionicons name="car-sport" size={22} color={theme.colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.carName}>{c.make} {c.model}</Text>
                <Text style={styles.carMeta}>{c.transmission}</Text>
              </View>
              <TouchableOpacity testID={`del-car-${c.id}`} onPress={() => removeCar(c.id)}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          {showAdd && (
            <View style={{ gap: 10, marginTop: 8 }}>
              <TextInput testID="car-make" style={styles.input} value={make} onChangeText={setMake} placeholder="Make (e.g. Hyundai)" placeholderTextColor={theme.colors.textSecondary} />
              <TextInput testID="car-model" style={styles.input} value={model} onChangeText={setModel} placeholder="Model (e.g. Creta)" placeholderTextColor={theme.colors.textSecondary} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['Automatic', 'Manual'] as const).map((tx) => (
                  <TouchableOpacity key={tx} testID={`car-tx-${tx}`} style={[styles.pill, transmission === tx && styles.pillActive]} onPress={() => setTransmission(tx)}>
                    <Text style={[styles.pillText, transmission === tx && styles.pillTextActive]}>{tx}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity testID="save-car-btn" style={styles.saveBtn} onPress={addCar}>
                <Text style={styles.saveBtnText}>Add car</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h1: { fontSize: 28, fontWeight: '800', color: theme.colors.textPrimary, letterSpacing: -0.6 },
  logout: { padding: 8 },
  profCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 28, fontWeight: '800', color: theme.colors.primaryDark },
  pname: { fontSize: 20, fontWeight: '800', color: theme.colors.inverse },
  pphone: { color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  newBadge: { color: theme.colors.accent, fontWeight: '700', marginTop: 6, fontSize: 12 },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 18, borderWidth: 1, borderColor: theme.colors.borderLight, ...theme.shadow.soft, gap: 8 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary },
  edit: { color: theme.colors.primary, fontWeight: '700' },
  lbl: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 },
  input: { backgroundColor: theme.colors.background, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.borderLight, paddingHorizontal: 14, height: 50, fontSize: 15, color: theme.colors.textPrimary },
  inputDisabled: { opacity: 0.7 },
  saveBtn: { backgroundColor: theme.colors.primary, height: 50, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  saveBtnText: { color: theme.colors.inverse, fontWeight: '700', fontSize: 15 },
  empty: { color: theme.colors.textSecondary, fontSize: 14, paddingVertical: 8 },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  carIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  carName: { fontWeight: '700', fontSize: 15, color: theme.colors.textPrimary },
  carMeta: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 },
  pill: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.borderLight },
  pillActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pillText: { color: theme.colors.textSecondary, fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: theme.colors.inverse },
});
