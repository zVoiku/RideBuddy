import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, saveToken } from '../src/api';
import { useRB } from '../src/store';
import { theme } from '../src/theme';
import { Header, OtpInput, DemoNote } from '../src/ui';

export default function Otp() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { signIn, signInOps, showToast } = useRB();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [secs, setSecs] = useState(60);
  const submitted = useRef(false);

  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  const verify = async (value: string) => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setErr('');
    try {
      const res = await api.verifyOtp(String(phone), value);
      await saveToken(res.token);
      // The number decides the app. An Ops number lands in the console; every
      // other number is a Buddy. This is also the only way back to Ops from
      // partner mode — signing in again re-runs the same check.
      if (res.role === 'ops' && res.ops) {
        signInOps(res.ops);
        router.replace('/ops/dashboard');
      } else {
        signIn(res.partner);
        router.replace('/(tabs)/home');
      }
    } catch (e: any) {
      setErr(e?.message || 'That code did not work.');
      setCode('');
      submitted.current = false;
    } finally {
      setBusy(false);
    }
  };

  // Auto-submit on the sixth digit, matching the design.
  useEffect(() => {
    if (code.length === 6) {
      const t = setTimeout(() => verify(code), 250);
      return () => clearTimeout(t);
    }
  }, [code]);

  const resend = async () => {
    try {
      await api.sendOtp(String(phone));
      setSecs(60);
      showToast({ type: 'info', title: 'Code sent again.' });
    } catch {
      showToast({ type: 'error', title: 'Could not resend the code.' });
    }
  };

  const local = String(phone || '').replace('+91', '');
  const masked = `+91 ${local.slice(0, 5)} ${'X'.repeat(Math.max(0, local.length - 6))}${local.slice(-1)}`;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header tone="white" onBack={() => router.back()} title="Verify your number" />
      <View style={styles.body}>
        <Text style={styles.sub}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.phone}>{masked}</Text>
        </Text>

        <OtpInput length={6} value={code} onChange={setCode} error={!!err} />

        {!!err && <Text style={styles.err}>{err}</Text>}

        <View style={styles.resendRow}>
          {secs > 0 ? (
            <Text style={styles.resendTxt}>
              Resend code in <Text style={styles.resendStrong}>0:{String(secs).padStart(2, '0')}</Text>
            </Text>
          ) : (
            <Pressable onPress={resend} hitSlop={10} accessibilityRole="button">
              <Text style={styles.resendLink}>Resend OTP</Text>
            </Pressable>
          )}
        </View>

        <View style={{ marginTop: theme.spacing.xxl }}>
          <DemoNote>OTP is mocked — any 6 digits will sign you in.</DemoNote>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 28, paddingTop: 28, flex: 1 },
  sub: {
    fontFamily: theme.fonts.body, fontSize: 14.5,
    color: theme.colors.textSecondary, marginBottom: 26, lineHeight: 22,
  },
  phone: { fontFamily: theme.fonts.display, color: theme.colors.textPrimary },
  err: {
    color: theme.colors.error, fontFamily: theme.fonts.body,
    fontSize: 13, marginTop: 14, textAlign: 'center',
  },
  resendRow: { marginTop: 24, alignItems: 'center' },
  resendTxt: { fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.textSecondary },
  resendStrong: { fontFamily: theme.fonts.bodySemi, color: theme.colors.textPrimary },
  resendLink: { fontFamily: theme.fonts.bodySemi, fontSize: 13.5, color: theme.colors.green700 },
});
