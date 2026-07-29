// Shared UI primitives, transcribed from the design's component set.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput, ActivityIndicator,
  Animated, ViewStyle, TextStyle, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, initials } from './theme';
import { Ico } from './icons';

// ── Header band ──────────────────────────────────────────────
export function Header({
  tone = 'green', title, subtitle, onBack, right,
}: {
  tone?: 'green' | 'white';
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const green = tone === 'green';
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + 14,
          backgroundColor: green ? theme.colors.green500 : theme.colors.surfaceCard,
          borderBottomWidth: green ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.borderHairline,
        },
      ]}
    >
      <View style={styles.headerRow}>
        {onBack && (
          <Pressable
            onPress={onBack}
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={8}
            style={[
              styles.headerBack,
              { backgroundColor: green ? 'rgba(255,255,255,0.16)' : theme.colors.surfaceSoft },
            ]}
          >
            <Ico.ArrowLeft size={20} color={green ? '#fff' : theme.colors.textPrimary} />
          </Pressable>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {!!subtitle && (
            <Text
              style={[
                styles.headerSub,
                { color: green ? 'rgba(255,255,255,0.85)' : theme.colors.textSecondary },
              ]}
            >
              {subtitle}
            </Text>
          )}
          {!!title && (
            <Text
              numberOfLines={1}
              style={[
                styles.headerTitle,
                {
                  color: green ? theme.colors.textOnBrand : theme.colors.textPrimary,
                  fontSize: title.length > 22 ? 20 : 24,
                },
              ]}
            >
              {title}
            </Text>
          )}
        </View>
        {right}
      </View>
    </View>
  );
}

// ── Status badge ─────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const m = theme.badge[status] || theme.badge.pending;
  return (
    <View style={[styles.badge, { backgroundColor: m.bg }]}>
      <Text style={[styles.badgeTxt, { color: m.fg }]}>{m.label}</Text>
    </View>
  );
}

// ── Avatar ───────────────────────────────────────────────────
export function Avatar({ name, size = 44, photo }: { name?: string | null; size?: number; photo?: string | null }) {
  // Initials are the base layer, so a slow or failed photo never leaves a hole.
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
        backgroundColor: theme.colors.green100,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: theme.fonts.display, fontSize: size * 0.38, color: theme.colors.green800 }}>
        {initials(name)}
      </Text>
      {!!photo && !failed && (
        <Image
          source={{ uri: photo }}
          onError={() => setFailed(true)}
          style={{ position: 'absolute', width: size, height: size }}
        />
      )}
    </View>
  );
}

// ── Stars ────────────────────────────────────────────────────
export function Stars({ value = 0, size = 14 }: { value?: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ico.Star
          key={i}
          size={size}
          color={theme.colors.star}
          fill={i <= Math.round(value) ? theme.colors.star : 'none'}
        />
      ))}
    </View>
  );
}

export function RatingInline({ value, trips, size = 14 }: { value: number; trips?: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      <Ico.Star size={size} color={theme.colors.star} fill={theme.colors.star} />
      <Text style={{ fontFamily: theme.fonts.bodySemi, fontSize: 13, color: theme.colors.textPrimary }}>
        {Number(value).toFixed(1)}
      </Text>
      {trips != null && (
        <Text style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary }}>
          · {trips} trips
        </Text>
      )}
    </View>
  );
}

// ── Section label ────────────────────────────────────────────
export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
      {right}
    </View>
  );
}

// ── Primary button ───────────────────────────────────────────
export function Button({
  children, onPress, disabled, loading, variant = 'primary', leadingIcon, style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
  leadingIcon?: React.ReactNode;
  style?: ViewStyle;
}) {
  const isOutline = variant === 'outline';
  const bg = disabled
    ? theme.colors.green100
    : isOutline
    ? theme.colors.surfaceCard
    : variant === 'danger'
    ? theme.colors.error
    : theme.colors.brandPrimary;
  const fg = isOutline ? theme.colors.brandPrimary : '#fff';
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: pressed && !isOutline && !disabled ? theme.colors.brandPrimaryHover : bg,
          borderWidth: isOutline ? 1.5 : 0,
          borderColor: theme.colors.brandPrimary,
          opacity: disabled ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {leadingIcon}
          <Text style={[styles.btnTxt, { color: fg }]}>{children}</Text>
        </>
      )}
    </Pressable>
  );
}

// ── OTP / code input ─────────────────────────────────────────
// A single hidden field drives N visible boxes — one caret, no per-box focus
// juggling, and the OS autofill for SMS codes still works.
export function OtpInput({
  length = 6, value, onChange, autoFocus = true, error,
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  error?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable onPress={() => ref.current?.focus()} style={styles.otpRow}>
      {Array.from({ length }).map((_, i) => {
        const char = value[i] || '';
        const active = focused && i === Math.min(value.length, length - 1);
        return (
          <View
            key={i}
            style={[
              styles.otpBox,
              length > 4 ? { width: 46, height: 54 } : { width: 58, height: 64 },
              !!char && { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.green300 },
              active && { borderColor: theme.colors.brandPrimary },
              error && { borderColor: theme.colors.error },
            ]}
          >
            <Text style={[styles.otpChar, length <= 4 && { fontSize: 26 }]}>{char}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.otpHidden}
        caretHidden
      />
    </Pressable>
  );
}

// ── Empty state ──────────────────────────────────────────────
export function Empty({ icon, title, body }: { icon?: React.ReactNode; title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      {!!icon && <View style={{ marginBottom: 12, opacity: 0.5 }}>{icon}</View>}
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!body && <Text style={styles.emptyBody}>{body}</Text>}
    </View>
  );
}

// ── Demo note (deliberately out-of-product styling) ──────────
export function DemoNote({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.demo}>
      <Text style={styles.demoTag}>DEMO</Text>
      <Text style={styles.demoBody}>{children}</Text>
    </View>
  );
}

// ── Toast ────────────────────────────────────────────────────
export function Toast({
  type = 'success', title, body, onDone,
}: {
  type?: 'success' | 'info' | 'error';
  title: string;
  body?: string;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, []);
  const tone =
    type === 'error' ? theme.colors.error : type === 'info' ? theme.colors.info : theme.colors.success;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.toast,
        {
          bottom: insets.bottom + 90,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      <View style={[styles.toastDot, { backgroundColor: tone }]}>
        {type === 'success' ? (
          <Ico.Check size={14} color="#fff" />
        ) : (
          <Ico.Bell size={13} color="#fff" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.toastTitle}>{title}</Text>
        {!!body && <Text style={styles.toastBody}>{body}</Text>}
      </View>
    </Animated.View>
  );
}

// ── Card ─────────────────────────────────────────────────────
export function Card({
  children, accent, style,
}: {
  children: React.ReactNode;
  accent?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: accent ? theme.colors.green50 : theme.colors.surfaceCard,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
        },
        !accent && {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.borderHairline,
          ...theme.shadow.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: theme.spacing.xl, paddingBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  headerBack: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerSub: { fontFamily: theme.fonts.body, fontSize: 13, marginBottom: 2 },
  headerTitle: { fontFamily: theme.fonts.display, lineHeight: 28, letterSpacing: -0.2 },

  badge: { borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 11.5 },

  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: {
    fontFamily: theme.fonts.display, fontSize: 13, textTransform: 'uppercase',
    letterSpacing: 1, color: theme.colors.green700,
  },

  btn: {
    height: 52, borderRadius: theme.radius.lg, alignItems: 'center',
    justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  btnTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 15 },

  otpRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  otpBox: {
    borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceInput,
    borderWidth: 1.5, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  otpChar: { fontFamily: theme.fonts.displayExtra, fontSize: 22, color: theme.colors.textPrimary },
  otpHidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },

  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: theme.fonts.display, fontSize: 16, color: theme.colors.textPrimary, textAlign: 'center' },
  emptyBody: {
    fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.textSecondary,
    marginTop: 4, textAlign: 'center',
  },

  demo: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.info,
    borderRadius: 10, padding: 10, flexDirection: 'row', gap: 8,
    backgroundColor: 'rgba(21,101,192,0.05)', alignItems: 'flex-start',
  },
  demoTag: { fontFamily: theme.fonts.bodySemi, fontSize: 10, letterSpacing: 0.6, color: theme.colors.info, marginTop: 1 },
  demoBody: { flex: 1, fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textPrimary, lineHeight: 17 },

  toast: {
    position: 'absolute', left: 16, right: 16, zIndex: 500,
    flexDirection: 'row', gap: 11, alignItems: 'center',
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.lg,
    padding: 14, ...theme.shadow.lg,
  },
  toastDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toastTitle: { fontFamily: theme.fonts.display, fontSize: 14.5, color: theme.colors.textPrimary },
  toastBody: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary, marginTop: 1 },
});
