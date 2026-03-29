// Wakeel Design System — Dark Luxury Theme
// Based on Material Design 3 color scheme

export type ThemeMode = 'dark' | 'night';

const darkColors = {
  // Core backgrounds
  background: '#050505',
  surface: '#131313',
  surfaceContainer: '#201f1f',
  surfaceContainerHigh: '#2a2a2a',
  surfaceContainerHighest: '#353534',
  surfaceContainerLow: '#1c1b1b',
  surfaceContainerLowest: '#0e0e0e',

  // Gold (primary)
  primaryGold: '#f2ca50',
  primaryTextGold: '#ffe9b0',
  primaryGoldDim: '#eac249',

  // Text
  onSurface: '#e5e2e1',
  onSurfaceVariant: '#d0c5af',
  outline: '#99907c',
  outlineVariant: '#4d4635',

  // Status
  error: '#ffb4ab',
  errorContainer: '#93000a',
  success: '#4caf50',
  warning: '#f39c12',

  // Secondary (purple accent)
  secondary: '#cfbcff',
  secondaryContainer: '#6200ea',

  // Legacy aliases
  gold: '#f2ca50',
  goldLight: '#ffe9b0',
  goldDark: '#eac249',
  black: '#050505',
  darkGray: '#201f1f',
  mediumGray: '#2a2a2a',
  cream: '#e5e2e1',
  creamDark: '#d0c5af',
  white: '#e5e2e1',
  textLight: '#99907c',
  textMuted: '#99907c',
};

// Night mode — warm amber tones, reduced blue light
const nightColors = {
  ...darkColors,
  background: '#0c0800',
  surface: '#160f05',
  surfaceContainer: '#231807',
  surfaceContainerHigh: '#2f2210',
  surfaceContainerHighest: '#3b2d18',
  surfaceContainerLow: '#1b1304',
  surfaceContainerLowest: '#110b02',
  primaryGold: '#f5b942',
  primaryTextGold: '#ffd98f',
  primaryGoldDim: '#e8ad38',
  onSurface: '#f2e2d0',
  onSurfaceVariant: '#c9b99a',
  outline: '#8c7a60',
  outlineVariant: '#3d3020',
  // legacy aliases
  gold: '#f5b942',
  goldLight: '#ffd98f',
  goldDark: '#e8ad38',
  black: '#0c0800',
  darkGray: '#231807',
  mediumGray: '#2f2210',
  cream: '#f2e2d0',
  creamDark: '#c9b99a',
  white: '#f2e2d0',
};

export function getThemeColors(mode: ThemeMode) {
  return mode === 'night' ? nightColors : darkColors;
}

// Default export — dark theme (backward compat for screens that import colors directly)
export const colors = darkColors;

export const fonts = {
  regular: 'System',
  bold: 'System',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
