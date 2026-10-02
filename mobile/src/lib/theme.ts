// Design tokens from docs/redesign.md. Black and white with one loud accent.
export const colors = {
  ink: '#0B0B0F',
  paper: '#FFFFFF',
  mist: '#F4F4F6',
  line: '#E4E4E8',
  muted: '#6B6B76',
  heroStart: '#E8338B',
  heroEnd: '#F2602E',
  herO: '#B0247A',
  alert: '#E5252A',
  alertSoft: '#FDECEC',
  safe: '#12A150',
  safeSoft: '#E7F6ED',
} as const;

export const heroGradient = [colors.heroStart, colors.heroEnd] as const;

export const fonts = {
  display: 'Lexend_700Bold',
  displayMedium: 'Lexend_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { card: 12, pill: 999 } as const;

/** Minimum touch target; emergency controls use `emergencyTarget`. */
export const touchTarget = 48;
export const emergencyTarget = 64;
