// RideBuddy v2 — Trail Green + Parchment design tokens
// Per /app/memory design files (May 2026)

export const theme = {
  colors: {
    // Brand
    primary: '#4A5C2F',          // Trail Green 500
    primaryDark: '#384522',      // Green 700
    primaryDeep: '#262F17',      // Green 800
    primaryLight: '#8FA96A',     // Green 300 — mid tone / secondary accent
    primaryPale: '#C5D4A8',      // Green 100 — light fills, hover
    primarySoft: '#EDF0E8',      // Green 50 — selection bg

    // Surfaces
    background: '#F5F0E8',       // Parchment
    card: '#FFFFFF',
    softCard: '#F7F7F5',         // Pill / detail tile background

    // Text
    textPrimary: '#1E1E1A',      // Charcoal
    textSecondary: '#888888',    // Muted
    textTertiary: '#AAAA9F',     // Greyer
    inverse: '#FFFFFF',
    textOnPrimary: '#F5F0E8',    // Parchment on Trail Green button

    // Lines
    borderLight: 'rgba(100,100,100,0.15)',
    borderHair: 'rgba(100,100,100,0.10)',

    // Semantic
    success: '#2E7D32',
    successBg: '#E8F5E9',
    warning: '#E65100',
    warningBg: '#FFF3E0',
    error: '#C62828',
    errorBg: '#FFEBEE',
    info: '#1565C0',
    infoBg: '#E3F2FD',

    // Status badge variants (UI library §08)
    badgeAssignedBg: '#EDF0E8',
    badgeAssignedFg: '#384522',
    badgeInProgressBg: '#E3F2FD',
    badgeInProgressFg: '#0D47A1',
    badgeCompletedBg: '#F3E5F5',
    badgeCompletedFg: '#4A148C',
    badgeCancelledBg: '#FFEBEE',
    badgeCancelledFg: '#B71C1C',
    badgePendingBg: '#FFF3E0',
    badgePendingFg: '#E65100',

    // legacy aliases for screens still referencing the old palette
    accent: '#8FA96A',
    accentDark: '#384522',
    onTripGreen: '#0D47A1',
    completedGrey: '#4A148C',
  },

  radius: { sm: 4, md: 8, lg: 12, xl: 16, pill: 9999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, hero: 40 },

  shadow: {
    soft: {
      shadowColor: '#646464',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 12,
      elevation: 3,
    },
  },

  fonts: {
    heading: 'Urbanist_700Bold',
    body: 'DMSans_400Regular',
    bodyMed: 'DMSans_500Medium',
  },
};

export const CAR_MAKES = [
  { id: 'maruti', name: 'Maruti Suzuki', image: 'https://images.unsplash.com/photo-1568844293986-8d0400bd4745?w=400' },
  { id: 'hyundai', name: 'Hyundai', image: 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?w=400' },
  { id: 'tata', name: 'Tata Motors', image: 'https://images.unsplash.com/photo-1626668893632-6f3a4466d109?w=400' },
  { id: 'mahindra', name: 'Mahindra', image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400' },
  { id: 'honda', name: 'Honda', image: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=400' },
  { id: 'toyota', name: 'Toyota', image: 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=400' },
];

export const CAR_MODELS: Record<string, { id: string; name: string; image: string }[]> = {
  maruti: [
    { id: 'swift', name: 'Swift', image: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=400' },
    { id: 'baleno', name: 'Baleno', image: 'https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=400' },
    { id: 'brezza', name: 'Brezza', image: 'https://images.unsplash.com/photo-1568844293986-8d0400bd4745?w=400' },
  ],
  hyundai: [
    { id: 'creta', name: 'Creta', image: 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?w=400' },
    { id: 'i20', name: 'i20', image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400' },
    { id: 'verna', name: 'Verna', image: 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982?w=400' },
  ],
  tata: [
    { id: 'nexon', name: 'Nexon', image: 'https://images.unsplash.com/photo-1626668893632-6f3a4466d109?w=400' },
    { id: 'punch', name: 'Punch', image: 'https://images.unsplash.com/photo-1626668893632-6f3a4466d109?w=400' },
    { id: 'harrier', name: 'Harrier', image: 'https://images.unsplash.com/photo-1626668893632-6f3a4466d109?w=400' },
  ],
  mahindra: [
    { id: 'xuv700', name: 'XUV700', image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400' },
    { id: 'scorpio', name: 'Scorpio', image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400' },
    { id: 'thar', name: 'Thar', image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400' },
  ],
  honda: [
    { id: 'city', name: 'City', image: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=400' },
    { id: 'amaze', name: 'Amaze', image: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=400' },
  ],
  toyota: [
    { id: 'innova', name: 'Innova', image: 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=400' },
    { id: 'fortuner', name: 'Fortuner', image: 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=400' },
    { id: 'glanza', name: 'Glanza', image: 'https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=400' },
  ],
};
