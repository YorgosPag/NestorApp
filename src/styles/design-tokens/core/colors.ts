// Color system - Base colors για το design system
export const colors = {
  // Basic color palette
  background: {
    primary: '#ffffff',
    secondary: '#f8fafc',
    tertiary: '#f1f5f9',
    hover: '#f1f5f9',
    accent: '#e0f2fe',  // ✅ ENTERPRISE FIX: Missing accent background color
    overlay: 'rgba(0, 0, 0, 0.5)'
  },

  text: {
    primary: '#1e293b',
    secondary: '#64748b',
    tertiary: '#94a3b8',
    muted: '#94a3b8',        // ✅ ENTERPRISE: Muted text color (same as tertiary for consistency)
    inverse: '#ffffff',
    inverted: '#ffffff'      // ✅ ENTERPRISE: Inverted text color (alias for inverse, used in components)
  },

  border: {
    primary: '#e2e8f0',
    secondary: '#cbd5e1',
    tertiary: '#f1f5f9'
  },

  surface: {
    primary: '#ffffff',
    secondary: '#f8fafc'
  },

  // Semantic colors
  primary: {
    500: '#3b82f6'
  },

  // Accent colors
  accent: {
    primary: '#3b82f6'
  },

  // Status colors
  blue: { 300: '#93c5fd', 500: '#3b82f6', 600: '#2563eb' },
  green: { 300: '#86efac', 500: '#22c55e', 600: '#16a34a' },
  purple: { 300: '#c4b5fd', 500: '#8b5cf6', 600: '#7c3aed' },
  orange: { 300: '#fdba74', 500: '#f97316', 600: '#ea580c' },
  red: { 300: '#fca5a5', 500: '#ef4444', 600: '#dc2626' },
  teal: { 300: '#5eead4', 500: '#14b8a6', 600: '#0d9488' },
  gray: { 50: '#f9fafb', 100: '#f3f4f6', 500: '#6b7280' }
} as const;