// Add a Buddy. They enter as an applicant, not an active driver — Ops still has
// to verify them on the profile screen before they can sign in or take trips.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useRB } from '../../src/store';
import { theme } from '../../src/theme';
import { OpsHeader, OpsCard, Section } from '../../src/ops-ui';

function Field({ label, value, onChange, placeholder, keyboardType, autoCapitalize, hint }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.grey400}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || 'none'}
        style={styles.input}
      />
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export default function OpsAddBuddy() {
  const router = useRouter();
  const { showToast } = useRB();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [licence, setLicence] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const digits = phone.replace(/\D/g, '');
  const valid = digits.length === 10 && name.trim().length > 1;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const made = await api.opsAddBuddy({
        phone: `+91${digits}`,
        name: name.trim(),
        licence: licence.trim() || undefined,
        email: email.trim() || undefined,
      });
      showToast({ type: 'success', title: `${name.trim()} added as an applicant.` });
      router.replace(`/ops/buddy/${made.id}` as any);
    } catch (e: any) {
      setErr(e?.message || 'Could not add that Buddy.');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <OpsHeader title="Add a Buddy" subtitle="New applicant" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Section title="Details" />
        <OpsCard style={{ padding: 16 }}>
          <Field
            label="Phone number"
            value={phone}
            onChange={(t: string) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
            placeholder="98765 43210"
            keyboardType="number-pad"
            hint="This becomes their login. +91 is added automatically."
          />
          <Field label="Full name" value={name} onChange={setName}
            placeholder="Rajesh Singh" autoCapitalize="words" />
          <Field label="Licence number" value={licence} onChange={setLicence}
            placeholder="PB-0220190034521" autoCapitalize="characters"
            hint="The PB / HP prefix sets their region on the dashboard." />
          <Field label="Email" value={email} onChange={setEmail}
            placeholder="optional" keyboardType="email-address" />
        </OpsCard>

        {!!err && <Text style={styles.err}>{err}</Text>}

        <Text style={styles.note}>
          They start at the applied stage and cannot sign in yet. Move them to verified on
          their profile once documents check out.
        </Text>

        <Pressable
          onPress={submit}
          disabled={!valid || busy}
          style={[styles.cta, (!valid || busy) && { opacity: 0.45 }]}
          accessibilityRole="button"
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.ctaTxt}>Add applicant</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  label: { fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: theme.colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.surfaceInput, borderRadius: theme.radius.md,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.colors.textPrimary,
  },
  hint: { fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.grey400, marginTop: 5 },
  err: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error, marginTop: 12 },
  note: {
    fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary,
    marginTop: 16, lineHeight: 19,
  },
  cta: {
    marginTop: 20, backgroundColor: theme.colors.brandPrimary,
    borderRadius: theme.radius.pill, paddingVertical: 15, alignItems: 'center',
  },
  ctaTxt: { fontFamily: theme.fonts.display, fontSize: 15, color: '#fff' },
});
