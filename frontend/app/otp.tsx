import { useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, saveToken } from '../src/api';
import { theme } from '../src/theme';

export default function OtpScreen() {
  const { phone, channel } = useLocalSearchParams<{ phone: string; channel?: string }>();
  const router = useRouter();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resend, setResend] = useState(53);
  const refs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    const t = setInterval(() => setResend((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number, key: string) => {
    if (key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const verify = async () => {
    const otp = digits.join('');
    if (otp.length !== 6) { Alert.alert('Invalid', 'Enter all 6 digits'); return; }
    try {
      setLoading(true);
      const res = await api.verifyOtp(phone as string, otp);
      await saveToken(res.token);
      const u = res.user;
    if (!u.name) { router.replace('/onboarding/profile'); return; }
      const cars = await api.listCars();
      router.replace(cars.length === 0 ? '/onboarding/car-make' : '/(tabs)/home');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  const masked = phone ? `${phone.slice(0, 4)} (${phone.slice(4, 7)}) ***-**${phone.slice(-2)}` : '';

  return (
    <SafeAreaView style={styles.c}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity testID="otp-back" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={26} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.icon}>
            <Ionicons name="shield-checkmark" size={42} color={theme.colors.inverse} />
          </View>
          <Text style={styles.h1}>Verify Code</Text>
          <Text style={styles.sub}>We sent a code to <Text style={{ fontWeight: '800', color: theme.colors.textPrimary }}>{masked}</Text></Text>

          <View style={styles.fieldHead}><Text style={styles.lbl}>Enter 6-digit code</Text></View>
          <View style={styles.row}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { refs.current[i] = r; }}
                testID={`otp-${i}`}
                style={[styles.box, d ? styles.boxFilled : null]}
                value={d}
                onChangeText={(v) => setDigit(i, v)}
                onKeyPress={({ nativeEvent }) => handleKey(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
              />
            ))}
          </View>

          <Text style={styles.resend}>{resend > 0 ? `Resend in ${resend}s` : 'Resend now'}</Text>

          <TouchableOpacity testID="verify-otp-btn" style={styles.btn} onPress={verify} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Verifying…' : 'Verify & Continue'}</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>{channel === 'twilio' ? 'Real SMS sent via Twilio — check your phone' : 'Tip: any 6 digits work in mock mode (e.g. 123456)'}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 28, paddingTop: 20, gap: 14 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.softCard, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 76, height: 76, borderRadius: 18, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  h1: { fontSize: 30, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: -0.6, marginTop: 6 },
  sub: { fontSize: 15, color: theme.colors.textSecondary, marginBottom: 12 },
  fieldHead: { marginTop: 8 },
  lbl: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  box: { flex: 1, height: 60, borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.colors.primary, backgroundColor: theme.colors.card, textAlign: 'center', fontSize: 22, fontWeight: '800', color: theme.colors.textPrimary },
  boxFilled: { backgroundColor: theme.colors.card },
  resend: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 14 },
  btn: { backgroundColor: theme.colors.primary, height: 56, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  btnText: { color: theme.colors.inverse, fontSize: 17, fontWeight: '800' },
  hint: { textAlign: 'center', color: theme.colors.textSecondary, fontSize: 12, marginTop: 10 },
});
