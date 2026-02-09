// ============================================================================
// 🎨 DESIGN TOKENS - COLOR TOKENS (Framework-agnostic)
// ============================================================================
//
// ✨ Basic color tokens - No framework dependencies
// Based on CSS Custom Properties and semantic color scales
//
// Enterprise-grade: Can be exported to Figma, JSON, Native platforms
// Zero dependencies on React or Tailwind
//
// ============================================================================

/**
 * Base Color Tokens - CSS Custom Properties
 * Framework-agnostic color definitions
 */
export const colorTokens = {
  /** Text color tokens */
  text: {
    primary: '--color-text-primary',      // Main text color
    secondary: '--color-text-secondary',  // Secondary text
    muted: '--color-text-muted',          // Subtle text
    inverse: '--color-text-inverse',      // Text on dark backgrounds
    success: '--color-text-success',     // Success state text
    error: '--color-text-error',         // Error state text
    warning: '--color-text-warning',     // Warning state text
    info: '--color-text-info',           // Info state text

    // Strong text variants for emphasis
    successStrong: '--color-text-success-strong',  // Strong success text
    errorStrong: '--color-text-error-strong',      // Strong error text
  },

  /** Background color tokens */
  background: {
    primary: '--color-bg-primary',        // Main background
    secondary: '--color-bg-secondary',    // Secondary background
    surface: '--color-bg-surface',       // Surface/card background
    hover: '--color-bg-hover',           // Hover state background
    active: '--color-bg-active',         // Active state background
    success: '--color-bg-success',       // Success state background
    error: '--color-bg-error',           // Error state background
    warning: '--color-bg-warning',       // Warning state background
    info: '--color-bg-info',             // Info state background

    // Subtle background variants for softer visual treatment
    successSubtle: '--color-bg-success-subtle',  // Soft success background
    errorSubtle: '--color-bg-error-subtle',      // Soft error background
    infoSubtle: '--color-bg-info-subtle',        // Soft info background
    neutralSubtle: '--color-bg-neutral-subtle',  // Soft neutral background
  },

  /** Border color tokens */
  border: {
    default: '--color-border-default',   // Default border
    muted: '--color-border-muted',       // Subtle border
    focus: '--color-border-focus',       // Focus state border
    success: '--color-border-success',   // Success state border
    error: '--color-border-error',       // Error state border
    warning: '--color-border-warning',   // Warning state border
    info: '--color-border-info',         // Info state border
  },
} as const;

/**
 * Hardcoded Color Values - For cases where CSS variables aren't available
 * These should match the CSS custom properties but provide fallbacks
 */
export const hardcodedColorValues = {
  /** Text colors - Hardcoded Tailwind equivalents */
  text: {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
    primary: 'text-slate-900',
    secondary: 'text-slate-600',
    muted: 'text-slate-400',
    inverse: 'text-white',

    // Strong text variants
    successStrong: 'text-green-800',
    errorStrong: 'text-red-800',
  },

  /** Background colors - Granular color scale */
  background: {
    // Gray/Slate scale
    slate: {
      '50': 'bg-slate-50',   '100': 'bg-slate-100', '200': 'bg-slate-200',
      '300': 'bg-slate-300', '400': 'bg-slate-400', '500': 'bg-slate-500',
      '600': 'bg-slate-600', '700': 'bg-slate-700', '800': 'bg-slate-800',
      '900': 'bg-slate-900',
    },

    gray: {
      '50': 'bg-gray-50',    '100': 'bg-gray-100',  '200': 'bg-gray-200',
      '300': 'bg-gray-300',  '400': 'bg-gray-400',  '500': 'bg-gray-500',
      '600': 'bg-gray-600',  '700': 'bg-gray-700',  '800': 'bg-gray-800',
      '900': 'bg-gray-900',
    },
    toolbar: {
      default: 'bg-[#262626]',
      primary: 'bg-[#364157]',
      success: 'bg-[#255233]',
      danger: 'bg-[#352626]',
    },

    // Status colors
    red: {
      '100': 'bg-red-100',   '500': 'bg-red-500',   '600': 'bg-red-600',
    },

    green: {
      '100': 'bg-green-100', '500': 'bg-green-500', '600': 'bg-green-600',
    },

    blue: {
      '50': 'bg-blue-50',    '100': 'bg-blue-100',  '500': 'bg-blue-500',
      '600': 'bg-blue-600',
    },

    yellow: {
      '100': 'bg-yellow-100', '400': 'bg-yellow-400',
    },

    orange: {
      '500': 'bg-orange-500',
    },

    // Common backgrounds
    light: 'bg-card',              // ✅ ENTERPRISE: Light surface (was bg-white, now beautiful blue)
    transparent: 'bg-transparent',

    // 🔥 ΑΛΗΘΙΝΗ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: ΌΛΑ CSS VARIABLES!
    successSubtle: 'bg-[hsl(var(--bg-success))]',
    errorSubtle: 'bg-[hsl(var(--bg-error))]',
    infoSubtle: 'bg-[hsl(var(--bg-info))]',
    neutralSubtle: 'bg-[hsl(var(--bg-secondary))]',

    // ⚡ ΠΡΑΓΜΑΤΙΚΗ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ - HARDCODED ΑΝΤΙΚΑΤΑΣΤΑΣΗ
    primary: 'bg-[hsl(var(--bg-primary))]',      // 🧪 Will show blue!
    secondary: 'bg-[hsl(var(--bg-secondary))]',  // 🧪 Will show blue!
    hover: 'bg-[hsl(var(--bg-hover))]',          // 🧪 Will show blue!
    active: 'bg-[hsl(var(--bg-active))]',        // 🧪 Will show blue!
  },

  /** Border colors - Hardcoded values */
  border: {
    success: 'border-green-300',
    error: 'border-red-300',
    warning: 'border-yellow-300',
    info: 'border-blue-300',
    primary: 'border-slate-200',
    secondary: 'border-slate-300',
    focus: 'border-blue-500',
  },
} as const;

/**
 * Type definitions for token access
 */
export type ColorTokenCategory = keyof typeof colorTokens;
export type TextColorToken = keyof typeof colorTokens.text;
export type BackgroundColorToken = keyof typeof colorTokens.background;
export type BorderColorToken = keyof typeof colorTokens.border;

/**
 * Default export for convenience
 */
export default colorTokens;
