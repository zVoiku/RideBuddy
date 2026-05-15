export const theme = {
  colors: {
    primary: '#0E9B9B',
    primaryDark: '#067575',
    primaryLight: '#22B0B0',
    primarySoft: '#D5EFEC',
    accent: '#34C759',
    background: '#D8EFEB',
    backgroundDeep: '#0E9B9B',
    card: '#FFFFFF',
    softCard: '#E6F5F2',
    textPrimary: '#1A1A1A',
    textSecondary: '#9CA3AF',
    textOnPrimary: '#FFFFFF',
    inverse: '#FFFFFF',
    borderLight: '#E2E8F0',
    success: '#34C759',
    warning: '#F59E0B',
    error: '#EF4444',
    onTripGreen: '#34C759',
    completedGrey: '#6B7280',
  },
  radius: { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 20, xl: 24, xxl: 32 },
  shadow: {
    soft: {
      shadowColor: '#0E9B9B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 3,
    },
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
