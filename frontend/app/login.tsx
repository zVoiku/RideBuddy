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
    const digits = phone.replace(/\s/g, '');
    if (digits.length < 10) { Alert.alert('Invalid', 'Enter a valid 10-digit number'); return; }
    try {
      setLoading(true);
      await api.sendOtp('+91' + digits);
      router.push({ pathname: '/otp', params: { phone: '+91' + digits } });
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.c}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.icon}>
            <Ionicons name="car-sport" size={48} color={theme.colors.inverse} />
          </View>
          <Text style={styles.h1}>Welcome to Ride Buddy</Text>
          <Text style={styles.sub}>Enter your phone number to get started</Text>

          <View style={styles.field}>
            <Text style={styles.lbl}>Phone Number</Text>
            <TextInput
              testID="phone-input"
              style={styles.input}
              value={phone}
              onChangeText={(t) => {
                const d = t.replace(/[^0-9]/g, '').slice(0, 10);
                setPhone(d.length > 5 ? d.slice(0, 5) + ' ' + d.slice(5) : d);
              }}
              keyboardType="number-pad"
              placeholder="98111 11111"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <TouchableOpacity testID="send-otp-btn" style={styles.btn} onPress={submit} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Sending…' : 'Continue'}</Text>
          </TouchableOpacity>

          <Text style={styles.terms}>By continuing, you agree to our <Text style={styles.link}>Terms</Text> and <Text style={styles.link}>Privacy Policy</Text></Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 28, paddingTop: 60, gap: 16 },
  icon: { width: 76, height: 76, borderRadius: 18, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  h1: { fontSize: 30, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: -0.6 },
  sub: { fontSize: 15, color: theme.colors.textSecondary, marginBottom: 24 },
  field: { gap: 8 },
  lbl: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  input: { backgroundColor: theme.colors.card, height: 56, borderRadius: theme.radius.pill, paddingHorizontal: 24, fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary, borderWidth: 2, borderColor: theme.colors.primary },
  btn: { backgroundColor: theme.colors.primary, height: 56, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  btnText: { color: theme.colors.inverse, fontSize: 18, fontWeight: '800' },
  terms: { textAlign: 'center', color: theme.colors.textSecondary, fontSize: 13, marginTop: 16 },
  link: { color: theme.colors.primary, fontWeight: '700' },
});
