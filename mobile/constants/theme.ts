/**
 * VantageFlow Mobile Theme Tokens
 * Matches web Tailwind palette and aesthetics
 */

export const colors = {
  // Backgrounds
  background: '#0f172a',    // slate-900
  card: '#1e293b',          // slate-800
  cardSecondary: '#334155', // slate-700
  surface: '#1e293b',
  inputBg: '#0b1120',

  // Borders
  border: '#334155',        // slate-700
  borderLight: '#475569',   // slate-600

  // Typography
  text: '#f8fafc',          // slate-50
  textSecondary: '#94a3b8', // slate-400
  textMuted: '#64748b',     // slate-500

  // Brand Accent (Cyan / Indigo / Sky)
  primary: '#38bdf8',       // sky-400
  primaryDark: '#0284c7',   // sky-600
  secondary: '#6366f1',     // indigo-500
  accent: '#06b6d4',        // cyan-500

  // Statuses
  success: '#10b981',       // emerald-500
  warning: '#f59e0b',       // amber-500
  danger: '#ef4444',        // red-500
  info: '#3b82f6',          // blue-500

  // Task Status Colors
  statusZero: '#64748b',     // slate-500
  status25: '#38bdf8',       // sky-400
  status50: '#3b82f6',       // blue-500
  status75: '#6366f1',       // indigo-500
  status100: '#10b981',      // emerald-500
  statusAtRisk: '#ef4444',   // red-500

  // VantageFlow Priority Rubric
  priorityCritical: '#ef4444',   // 🔴 Red
  priorityImportant: '#f59e0b',  // 🟠 Amber
  priorityEnhancement: '#38bdf8',// 🔵 Sky/Blue
};

export const typography = {
  sizes: {
    xs: 12,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    title: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};
