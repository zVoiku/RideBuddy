import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { theme, CAR_MODELS } from '../../src/theme';

export default function CarModel() {
  const router = useRouter();
  const { makeId, makeName } = useLocalSearchParams<{ makeId: string; makeName: string }>();
  const [selected, setSelected] = useState<string | null>(null);
  const [transmission, setTransmission] = useState<'Automatic' | 'Manual'>('Automatic');
  const [saving, setSaving] = useState(false);
  const models = CAR_MODELS[makeId as string] || [];

  const submit = async () => {
    if (!selected) { Alert.alert('Pick one', 'Select your car model'); return; }
    const m = models.find((x) => x.id === selected)!;
    try {
      setSaving(true);
      await api.addCar({ make: makeName, model: m.name, transmission });
      router.replace('/(tabs)/home');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.c}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 14, paddingBottom: 140 }}>
        <TouchableOpacity testID="model-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={26} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.icon}>
          <Ionicons name="car-sport" size={42} color={theme.colors.inverse} />
        </View>
        <Text style={styles.h1}>Select Your Model</Text>
        <Text style={styles.sub}>Choose the model of your car</Text>

        <View style={styles.grid}>
          {models.map((m) => {
            const active = selected === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                testID={`model-${m.id}`}
                style={[styles.card, active && styles.cardActive]}
                onPress={() => setSelected(m.id)}
              >
                <Image source={{ uri: m.image }} style={styles.img} />
                <Text style={styles.cname}>{m.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLbl, { marginTop: 20 }]}>Transmission</Text>
        <View style={styles.txRow}>
          {(['Automatic', 'Manual'] as const).map((tx) => {
            const active = transmission === tx;
            return (
              <TouchableOpacity key={tx} testID={`tx-${tx}`} style={[styles.txCard, active && styles.txCardActive]} onPress={() => setTransmission(tx)}>
                <Ionicons name={tx === 'Automatic' ? 'flash' : 'settings'} size={22} color={active ? theme.colors.inverse : theme.colors.primary} />
                <Text style={[styles.txText, active && { color: theme.colors.inverse }]}>{tx}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.cta}>
        <TouchableOpacity testID="model-continue" style={styles.btn} onPress={submit} disabled={saving}>
          <Text style={styles.btnText}>{saving ? 'Saving…' : 'Continue'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.background },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.softCard, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 64, height: 64, borderRadius: 16, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  h1: { fontSize: 30, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: -0.6, marginTop: 8 },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  card: { width: '47%', backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 12, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  cardActive: { borderColor: theme.colors.primary },
  img: { width: '100%', height: 80, borderRadius: theme.radius.md, marginBottom: 10, backgroundColor: theme.colors.softCard },
  cname: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  sectionLbl: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary, marginBottom: 6 },
  txRow: { flexDirection: 'row', gap: 12 },
  txCard: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.colors.softCard, gap: 6, backgroundColor: theme.colors.card },
  txCardActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary },
  txText: { fontWeight: '800', color: theme.colors.textPrimary, fontSize: 14 },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, backgroundColor: theme.colors.card },
  btn: { backgroundColor: theme.colors.primary, height: 58, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: theme.colors.inverse, fontSize: 17, fontWeight: '800' },
});
