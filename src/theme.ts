// Wakeel Design System — Multi-Theme
// Based on Material Design 3 color scheme

export type ThemeMode = 'dark' | 'night' | 'light';

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

// Light mode — premium iOS feel
const lightColors = {
  // Core backgrounds
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceContainer: '#F0F0F2',
  surfaceContainerHigh: '#E8E8EA',
  surfaceContainerHighest: '#DDDDE0',
  surfaceContainerLow: '#F8F8FA',
  surfaceContainerLowest: '#FFFFFF',

  // Gold (darker for white bg contrast)
  primaryGold: '#B8860B',
  primaryTextGold: '#8B6914',
  primaryGoldDim: '#A0750A',

  // Text
  onSurface: '#1A1A1A',
  onSurfaceVariant: '#555555',
  outline: '#999999',
  outlineVariant: '#E0E0E0',

  // Status
  error: '#D32F2F',
  errorContainer: '#FFCDD2',
  success: '#2E7D32',
  warning: '#F57F17',

  // Secondary (purple accent)
  secondary: '#7C4DFF',
  secondaryContainer: '#EDE7F6',

  // Legacy aliases
  gold: '#B8860B',
  goldLight: '#8B6914',
  goldDark: '#A0750A',
  black: '#1A1A1A',
  darkGray: '#F0F0F2',
  mediumGray: '#E8E8EA',
  cream: '#1A1A1A',
  creamDark: '#555555',
  white: '#1A1A1A',
  textLight: '#999999',
  textMuted: '#999999',
};

export function getThemeColors(mode: ThemeMode) {
  if (mode === 'night') return nightColors;
  if (mode === 'light') return lightColors;
  return darkColors;
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
