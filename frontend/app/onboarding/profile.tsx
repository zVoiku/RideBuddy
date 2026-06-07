import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { theme } from '../../src/theme';

export default function OnboardingProfile() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    api.me().then((u) => {
      setMe(u); setName(u.name || ''); setEmail(u.email || '');
    }).catch(() => {});
  }, []);

  const submit = async () => {
    if (!name.trim()) { Alert.alert('Missing', 'Please enter your name'); return; }
    if (email.trim() && !email.includes('@')) { Alert.alert('Invalid', 'Please enter a valid email or leave it blank'); return; }
    try {
      setSaving(true);
      await api.updateMe({ name: name.trim(), email: email.trim() || undefined });
      const cars = await api.listCars();
      router.replace(cars.length === 0 ? '/onboarding/car-make' : '/home');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.c}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.icon}>
            <Ionicons name="person" size={42} color={theme.colors.inverse} />
          </View>
          <Text style={styles.h1}>Tell us about yourself</Text>
          <Text style={styles.sub}>We&apos;ll personalise your rides and invoices</Text>

          <View style={styles.field}>
            <Text style={styles.lbl}>Full Name</Text>
            <TextInput
              testID="profile-name"
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Arjun Patel"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.lbl}>Email</Text>
            <TextInput
              testID="profile-email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="arjun@example.com"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.phoneBlock}>
            <Ionicons name="phone-portrait" size={18} color={theme.colors.primary} />
            <Text style={styles.phoneText}>{me?.phone}</Text>
            <View style={styles.verifBadge}><Ionicons name="checkmark" size={11} color={theme.colors.inverse} /><Text style={styles.verifText}>Verified</Text></View>
          </View>

          <TouchableOpacity testID="profile-continue" style={styles.btn} onPress={submit} disabled={saving}>
            <Text style={styles.btnText}>{saving ? 'Saving…' : 'Continue'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 28, paddingTop: 40, gap: 14 },
  icon: { width: 76, height: 76, borderRadius: 18, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  h1: { fontSize: 28, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: -0.6 },
  sub: { fontSize: 15, color: theme.colors.textSecondary, marginBottom: 18 },
  field: { gap: 8 },
  lbl: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  input: { backgroundColor: theme.colors.card, height: 56, borderRadius: theme.radius.pill, paddingHorizontal: 22, fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary, borderWidth: 2, borderColor: theme.colors.primary },
  phoneBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.softCard, marginTop: 6 },
  phoneText: { flex: 1, fontWeight: '800', color: theme.colors.textPrimary, fontSize: 15 },
  verifBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primary },
  verifText: { color: theme.colors.inverse, fontWeight: '900', fontSize: 11 },
  btn: { backgroundColor: theme.colors.primary, height: 56, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  btnText: { color: theme.colors.inverse, fontSize: 18, fontWeight: '900' },
});
