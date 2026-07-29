import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { api } from '../src/api';
import { theme } from '../src/theme';
import { Button, DemoNote } from '../src/ui';

/** RideBuddy logomark — the "R" with the running figure, per the design. */
function Logomark({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Rect width="120" height="120" rx="26" fill={theme.colors.green500} />
      <G transform="translate(30,22) scale(0.5)">
        <Path d="M40 26 V86" fill="none" stroke={theme.colors.parchment} strokeWidth="14" strokeLinecap="round" />
        <Path
          d="M40 26 H62 A18 18 0 0 1 62 62 H40"
          fill="none" stroke={theme.colors.parchment} strokeWidth="14"
          strokeLinecap="round" strokeLinejoin="round"
        />
        <Path d="M49 62 Q66 80 78 78 T86 92" fill="none" stroke={theme.colors.parchment} strokeWidth="14" strokeLinecap="round" />
        <Circle cx="86" cy="84" r="13" fill={theme.colors.parchment} />
        <Path d="M86 110 L75 90 H97 Z" fill={theme.colors.parchment} />
      </G>
    </Svg>
  );
}

export default function Login() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const valid = phone.length === 10;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setErr('');
    try {
      const full = '+91' + phone;
      await api.sendOtp(full);
      router.push({ pathname: '/otp', params: { phone: full } });
    } catch (e: any) {
      setErr(e?.message || "Couldn't send the code. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Logomark size={52} />
          <View style={styles.wordmarkRow}>
            <Text style={styles.wordmark}>RideBuddy</Text>
            <Text style={styles.wordmarkTag}>PARTNER</Text>
          </View>
          <Text style={styles.tagline}>Drive with us. We&apos;ve got you.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.h1}>Enter your phone number.</Text>
          <Text style={styles.sub}>We&apos;ll text you a one-time code to sign in.</Text>

          <View style={styles.inputRow}>
            <View style={styles.cc}>
              <Text style={styles.ccTxt}>+91</Text>
            </View>
            <TextInput
              testID="phone-input"
              value={phone}
              onChangeText={(t) => {
                setPhone(t.replace(/[^0-9]/g, '').slice(0, 10));
                setErr('');
              }}
              keyboardType="number-pad"
              placeholder="98765 43210"
              placeholderTextColor={theme.colors.textPlaceholder}
              autoFocus
              style={[styles.input, !!err && { borderColor: theme.colors.error, borderWidth: 1.5 }]}
            />
          </View>

          {!!err && <Text style={styles.err}>{err}</Text>}

          <View style={{ marginTop: theme.spacing.xl }}>
            <Button onPress={submit} disabled={!valid} loading={busy}>
              Get OTP
            </Button>
          </View>

          <View style={{ marginTop: theme.spacing.lg }}>
            <DemoNote>
              Demo partner: <Text style={styles.bold}>98765 43210</Text> (Rajesh Singh, with trips already
              assigned). Any number works — any 6-digit code signs you in.
            </DemoNote>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: theme.spacing.xxl, paddingBottom: 40 },
  brand: { alignItems: 'center', gap: 12, paddingTop: 92 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  wordmark: {
    fontFamily: theme.fonts.displayExtra, fontSize: 29,
    color: theme.colors.textPrimary, letterSpacing: -0.3,
  },
  wordmarkTag: {
    fontFamily: theme.fonts.bodySemi, fontSize: 11,
    letterSpacing: 2, color: theme.colors.green500,
  },
  tagline: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary },

  form: { marginTop: 52 },
  h1: { fontFamily: theme.fonts.display, fontSize: 22, color: theme.colors.textPrimary, marginBottom: 6 },
  sub: {
    fontFamily: theme.fonts.body, fontSize: 14,
    color: theme.colors.textSecondary, marginBottom: 22, lineHeight: 20,
  },
  inputRow: { flexDirection: 'row', gap: 8 },
  cc: {
    height: 54, paddingHorizontal: 16, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceInput, alignItems: 'center', justifyContent: 'center',
  },
  ccTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 16, color: theme.colors.textPrimary },
  input: {
    flex: 1, height: 54, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceInput, paddingHorizontal: 16,
    fontFamily: theme.fonts.body, fontSize: 16,
    color: theme.colors.textPrimary, letterSpacing: 0.6,
    borderColor: 'transparent',
  },
  err: { color: theme.colors.error, fontFamily: theme.fonts.body, fontSize: 13, marginTop: 10 },
  bold: { fontFamily: theme.fonts.displayExtra },
});
