import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { theme } from '../src/theme';

export default function Login() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (phone.length < 10) {
      Alert.alert('Invalid', 'Enter a valid 10-digit number');
      return;
    }
    try {
      setLoading(true);
      await api.sendOtp('+91' + phone);
      router.push({ pathname: '/otp', params: { phone: '+91' + phone } });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.c}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.heroIcon}>
            <Ionicons name="car-sport" size={56} color={theme.colors.inverse} />
          </View>
          <Text style={styles.brand}>RideBuddy</Text>
          <Text style={styles.tag}>Verified drivers for your car. On demand.</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Enter your mobile number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.cc}><Text style={styles.ccText}>+91</Text></View>
              <TextInput
                testID="phone-input"
                style={styles.phone}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                keyboardType="number-pad"
                placeholder="98765 43210"
                placeholderTextColor={theme.colors.textSecondary}
                maxLength={10}
              />
            </View>
            <TouchableOpacity testID="send-otp-btn" style={styles.btn} onPress={submit} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Sending…' : 'Send OTP'}</Text>
            </TouchableOpacity>
            <Text style={styles.note}>Mock OTP: use any 6 digits like <Text style={{ fontWeight: '700' }}>123456</Text></Text>
          </View>

          <Text style={styles.terms}>By continuing you agree to our Terms & Privacy Policy</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 24, paddingTop: 40, gap: 20 },
  heroIcon: { alignSelf: 'center', width: 96, height: 96, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', ...theme.shadow.soft },
  brand: { fontSize: 36, fontWeight: '800', color: theme.colors.textPrimary, textAlign: 'center', letterSpacing: -1, marginTop: 8 },
  tag: { fontSize: 16, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 12 },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 24, gap: 14, ...theme.shadow.soft },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  phoneRow: { flexDirection: 'row', gap: 10 },
  cc: { paddingHorizontal: 16, justifyContent: 'center', backgroundColor: theme.colors.background, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.borderLight },
  ccText: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  phone: { flex: 1, fontSize: 18, paddingHorizontal: 16, height: 56, backgroundColor: theme.colors.background, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.borderLight, color: theme.colors.textPrimary },
  btn: { backgroundColor: theme.colors.primary, height: 56, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  btnText: { color: theme.colors.inverse, fontSize: 17, fontWeight: '700' },
  note: { textAlign: 'center', color: theme.colors.textSecondary, fontSize: 13 },
  terms: { textAlign: 'center', color: theme.colors.textSecondary, fontSize: 12, marginTop: 12 },
});
