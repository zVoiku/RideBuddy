import { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, saveToken } from '../src/api';
import { theme } from '../src/theme';

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const refs = useRef<Array<TextInput | null>>([]);

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
    if (otp.length !== 6) {
      Alert.alert('Invalid', 'Enter all 6 digits');
      return;
    }
    try {
      setLoading(true);
      const res = await api.verifyOtp(phone as string, otp);
      await saveToken(res.token);
      router.replace(res.user.name ? '/(tabs)/home' : '/(tabs)/profile');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.c}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity testID="otp-back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.body}>
          <Text style={styles.h1}>Verification</Text>
          <Text style={styles.sub}>We sent a 6-digit code to {phone}</Text>
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
          <TouchableOpacity testID="verify-otp-btn" style={styles.btn} onPress={verify} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Verifying…' : 'Verify & Continue'}</Text>
          </TouchableOpacity>
          <Text style={styles.note}>Hint: use 123456 in mock mode</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.background },
  back: { padding: 12, marginLeft: 8 },
  body: { padding: 24, gap: 18, flex: 1 },
  h1: { fontSize: 32, fontWeight: '800', color: theme.colors.textPrimary, letterSpacing: -0.8 },
  sub: { fontSize: 16, color: theme.colors.textSecondary },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  box: { flex: 1, height: 62, borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.borderLight, textAlign: 'center', fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary, backgroundColor: theme.colors.card },
  boxFilled: { borderColor: theme.colors.primary, backgroundColor: '#EFF6FF' },
  btn: { backgroundColor: theme.colors.primary, height: 56, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  btnText: { color: theme.colors.inverse, fontSize: 17, fontWeight: '700' },
  note: { textAlign: 'center', color: theme.colors.textSecondary, fontSize: 13 },
});
