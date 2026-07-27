// RideBuddy Partner — design tokens.
//
// Transcribed from the RideBuddy design system (Trail Green · Charcoal ·
// Parchment). Values match the client app's theme so the two apps read as one
// family; the partner app leans on the darker green surfaces and the utility
// tones the design uses for trip execution.
//
// "We've got you." — warm, grounded, never cold.

export const theme = {
  colors: {
    // ── Trail Green — primary brand (7-stop tint scale) ──
    green50: '#EDF0E8',   // lightest fill, app background
    green100: '#C5D4A8',  // light fills, hover, placeholders
    green300: '#8FA96A',  // mid tone, secondary accents
    green500: '#4A5C2F',  // PRIMARY BRAND COLOR
    green700: '#384522',  // dark fills, pressed
    green800: '#262F17',  // very dark
    green900: '#131A0C',  // near-black with green undertone

    // ── Neutrals ──
    charcoal: '#1E1E1A',
    parchment: '#F5F0E8',
    white: '#FFFFFF',

    greyLine: 'rgba(100,100,100,0.10)',   // hairline borders, dividers
    greyLine2: 'rgba(100,100,100,0.20)',  // chip / input borders
    grey500: '#888888',                    // secondary text
    grey400: '#A8A39A',                    // placeholder (warm grey)
    greyNav: '#AAAA9F',                    // inactive nav icon/label
    fillSoft: '#F7F7F5',                   // detail pill background

    // ── Semantic ──
    success: '#2E7D32',
    warning: '#E65100',
    error: '#C62828',
    info: '#1565C0',
    star: '#F59E0B',

    // ── Aliases (use these in screens) ──
    brandPrimary: '#4A5C2F',
    brandPrimaryHover: '#384522',
    brandPrimaryPress: '#262F17',

    surfacePage: '#EDF0E8',
    surfaceCard: '#FFFFFF',
    surfaceInput: '#F5F0E8',
    surfaceSoft: '#F7F7F5',
    surfaceAccent: '#EDF0E8',
    surfaceDark: '#1E1E1A',

    textPrimary: '#1E1E1A',
    textSecondary: '#888888',
    textPlaceholder: '#A8A39A',
    textOnBrand: '#F5F0E8',
    textAccent: '#4A5C2F',

    borderHairline: 'rgba(100,100,100,0.10)',
    borderControl: 'rgba(100,100,100,0.20)',
  },

  // Status badge fills + text, keyed by the backend's booking status.
  badge: {
    searching: { bg: '#FFF3E0', fg: '#E65100', label: 'Received' },
    assigned: { bg: '#EDF0E8', fg: '#384522', label: 'Confirmed' },
    en_route: { bg: '#EDF0E8', fg: '#384522', label: 'Left for Pickup' },
    arrived: { bg: '#EDF0E8', fg: '#384522', label: 'Arrived at Pickup' },
    in_progress: { bg: '#E3F2FD', fg: '#0D47A1', label: 'In Progress' },
    completed: { bg: '#F3E5F5', fg: '#4A148C', label: 'Complete' },
    cancelled: { bg: '#FFEBEE', fg: '#B71C1C', label: 'Cancelled' },
    pending: { bg: '#FFF3E0', fg: '#E65100', label: 'Pending' },
  } as Record<string, { bg: string; fg: string; label: string }>,

  // 4px base unit — generous scale, calm and spacious.
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, screen: 40, hero: 64 },

  radius: { sm: 4, md: 8, lg: 12, xl: 16, xxl: 20, pill: 9999 },

  // Type scale — Urbanist for display/headings, DM Sans for body/UI.
  type: {
    display: 40,
    h1: 28,
    h2: 22,
    h3: 18,
    title: 16,
    lead: 17,
    body: 15,
    ui: 14,
    label: 13,
    caption: 12,
    micro: 11,
    overline: 10,
  },

  fonts: {
    display: 'Urbanist_700Bold',
    displayExtra: 'Urbanist_800ExtraBold',
    body: 'DMSans_400Regular',
    bodyMed: 'DMSans_500Medium',
    bodySemi: 'DMSans_600SemiBold',
  },

  // Shadows: cool grey, soft, diffused. Never dramatic.
  shadow: {
    sm: {
      shadowColor: '#646464',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#646464',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 3,
    },
    lg: {
      shadowColor: '#646464',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 6,
    },
  },
};

// ── Formatting helpers (mirroring the design's fmt module) ──
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDate(d?: string | Date | null, withYear = false) {
  if (!d) return '—';
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return '—';
  const base = `${DAYS[x.getDay()]} ${x.getDate()} ${MONS[x.getMonth()]}`;
  return withYear ? `${base} ${x.getFullYear()}` : base;
}

export function fmtTime(d?: string | Date | null) {
  if (!d) return '—';
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return '—';
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export function money(n?: number | null) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function firstName(n?: string | null) {
  return (n || '').split(' ')[0] || 'there';
}

export function initials(name?: string | null) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/** Trips the partner is actively running — drives the persistent banner. */
export const ACTIVE_STATES = ['en_route', 'arrived', 'in_progress'];

/** Statuses that are finished and belong under "Past Trips". */
export const DONE_STATES = ['completed', 'cancelled'];
