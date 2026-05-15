import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, CAR_MAKES } from '../../src/theme';

export default function CarMake() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.c}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 14, paddingBottom: 80 }}>
        <TouchableOpacity testID="make-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={26} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.icon}>
          <Ionicons name="car-sport" size={42} color={theme.colors.inverse} />
        </View>
        <Text style={styles.h1}>Select Your Car Make</Text>
        <Text style={styles.sub}>Help us know what car you drive</Text>

        <View style={styles.grid}>
          {CAR_MAKES.map((m) => (
            <TouchableOpacity
              key={m.id}
              testID={`make-${m.id}`}
              style={styles.card}
              onPress={() => router.push({ pathname: '/onboarding/car-model', params: { makeId: m.id, makeName: m.name } })}
            >
              <Image source={{ uri: m.image }} style={styles.img} />
              <Text style={styles.cname}>{m.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
  card: { width: '47%', backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 12, alignItems: 'center', ...theme.shadow.soft },
  img: { width: '100%', height: 80, borderRadius: theme.radius.md, marginBottom: 10, backgroundColor: theme.colors.softCard },
  cname: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 6 },
});
