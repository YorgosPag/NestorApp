// ============================================================================
// ⚡ TAILWIND COLOR ADAPTER - Implementation Mapping Layer
// ============================================================================
//
// ✨ Tailwind-specific implementation mapping
// Maps design tokens and patterns to Tailwind CSS classes
//
// Disposable: Can be replaced if framework changes (Tailwind → CSS Modules)
// No design decisions: Pure implementation mapping
//
// ============================================================================

import { hardcodedColorValues } from '../../design-system/tokens/colors';

/**
 * CSS Variable to Tailwind Mapping
 * Maps CSS custom properties to Tailwind arbitrary value syntax
 */
export function mapCssVarToTailwind(varName: string, prefix: 'text' | 'bg' | 'border' = 'bg'): string {
  return `${prefix}-[hsl(var(${varName}))]`;
}

/**
 * Tailwind Text Color Mappings
 * Direct mapping from semantic meanings to Tailwind text classes
 */
export const tailwindTextColors = {
  success: hardcodedColorValues.text.success,     // 'text-green-600'
  error: hardcodedColorValues.text.error,         // 'text-red-600'
  warning: hardcodedColorValues.text.warning,     // 'text-yellow-600'
  info: hardcodedColorValues.text.info,           // 'text-blue-600'
  price: hardcodedColorValues.text.success,       // 'text-green-600' (reuse success)
  primary: hardcodedColorValues.text.primary,     // 'text-slate-900'
  secondary: hardcodedColorValues.text.secondary, // 'text-slate-600'
  muted: hardcodedColorValues.text.muted,         // 'text-slate-400'
  inverse: hardcodedColorValues.text.inverse,     // 'text-white'

  // Strong text variants for emphasis
  successStrong: hardcodedColorValues.text.successStrong, // 'text-green-800'
  errorStrong: hardcodedColorValues.text.errorStrong,     // 'text-red-800'
} as const;

/**
 * Tailwind Background Color Mappings - CSS Variables
 * Enterprise approach: Use CSS variables for theming
 */
export const tailwindBackgroundColors = {
  // CSS variable mappings
  success: mapCssVarToTailwind('--bg-success', 'bg'),
  error: mapCssVarToTailwind('--bg-error', 'bg'),
  warning: mapCssVarToTailwind('--bg-warning', 'bg'),
  info: mapCssVarToTailwind('--bg-info', 'bg'),
  primary: mapCssVarToTailwind('--bg-primary', 'bg'),
  secondary: mapCssVarToTailwind('--bg-secondary', 'bg'),
  hover: mapCssVarToTailwind('--bg-hover', 'bg'),
  active: mapCssVarToTailwind('--bg-active', 'bg'),

  // Subtle semantic backgrounds for soft visual treatment
  errorSubtle: hardcodedColorValues.background.errorSubtle,
  successSubtle: hardcodedColorValues.background.successSubtle,
  infoSubtle: hardcodedColorValues.background.infoSubtle,
  neutralSubtle: hardcodedColorValues.background.neutralSubtle,

  // Hardcoded fallbacks
  hardcoded: hardcodedColorValues.background,
} as const;

/**
 * Tailwind Border Color Mappings
 * Direct mapping to Tailwind border classes
 */
export const tailwindBorderColors = {
  success: hardcodedColorValues.border.success,   // 'border-green-300'
  error: hardcodedColorValues.border.error,       // 'border-red-300'
  warning: hardcodedColorValues.border.warning,   // 'border-yellow-300'
  info: hardcodedColorValues.border.info,         // 'border-blue-300'
  primary: hardcodedColorValues.border.primary,   // 'border-slate-200'
  secondary: hardcodedColorValues.border.secondary, // 'border-slate-300'
  focus: hardcodedColorValues.border.focus,       // 'border-blue-500'
} as const;

/**
 * Tailwind Interactive State Mappings
 * Hover, focus, active state class generation
 */
export const tailwindInteractiveStates = {
  hover: {
    background: {
      light: 'hover:bg-[hsl(var(--bg-hover))]',
      primary: 'hover:bg-[hsl(var(--bg-primary))]',
      secondary: 'hover:bg-[hsl(var(--bg-secondary))]',
      success: 'hover:bg-[hsl(var(--bg-success))]',
      error: 'hover:bg-[hsl(var(--bg-error))]',
      warning: 'hover:bg-[hsl(var(--bg-warning))]',
      info: 'hover:bg-[hsl(var(--bg-info))]',
    },
    scale: {
      up: 'hover:scale-105',
      down: 'hover:scale-95',
    },
    shadow: {
      subtle: 'hover:shadow-md',
      enhanced: 'hover:shadow-lg',
    },
  },

  focus: {
    border: 'focus:border-blue-500',
    ring: 'focus:ring-2 focus:ring-blue-200',
    background: 'focus:bg-[hsl(var(--bg-hover))]',
  },

  active: {
    background: 'active:bg-[hsl(var(--bg-active))]',
    scale: 'active:scale-95',
  },
} as const;

/**
 * Tailwind Layout Mappings
 * Common layout patterns as Tailwind classes
 */
export const tailwindLayoutPatterns = {
  page: {
    fullScreen: 'min-h-screen bg-[hsl(var(--bg-secondary))] dark:bg-background',
    light: 'min-h-screen bg-slate-50 dark:bg-background',
  },
  container: {
    default: 'bg-[hsl(var(--bg-primary))]',
    secondary: 'bg-[hsl(var(--bg-secondary))]',
  },
  modal: {
    default: 'bg-[hsl(var(--bg-primary))]',
  },
  header: {
    default: 'bg-[hsl(var(--bg-primary))] border-b',
  },
} as const;

/**
 * Tailwind Status Pattern Mappings
 * Status-specific color combinations
 */
export const tailwindStatusPatterns = {
  active: {
    text: 'text-green-700',
    bg: mapCssVarToTailwind('--bg-success', 'bg'),
    border: 'border-green-300',
    combined: 'text-green-700 bg-[hsl(var(--bg-success))] border-green-300',
  },
  inactive: {
    text: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-300',
    combined: 'text-slate-600 bg-slate-50 border-slate-300',
  },
  pending: {
    text: 'text-yellow-700',
    bg: mapCssVarToTailwind('--bg-warning', 'bg'),
    border: 'border-yellow-300',
    combined: 'text-yellow-700 bg-[hsl(var(--bg-warning))] border-yellow-300',
  },
  completed: {
    text: 'text-blue-700',
    bg: mapCssVarToTailwind('--bg-info', 'bg'),
    border: 'border-blue-300',
    combined: 'text-blue-700 bg-[hsl(var(--bg-info))] border-blue-300',
  },
  cancelled: {
    text: 'text-red-700',
    bg: mapCssVarToTailwind('--bg-error', 'bg'),
    border: 'border-red-300',
    combined: 'text-red-700 bg-[hsl(var(--bg-error))] border-red-300',
  },
} as const;

/**
 * Combined Tailwind mappings export
 */
export const tailwindColorMappings = {
  text: tailwindTextColors,
  background: tailwindBackgroundColors,
  border: tailwindBorderColors,
  interactive: tailwindInteractiveStates,
  layout: tailwindLayoutPatterns,
  status: tailwindStatusPatterns,
} as const;

/**
 * Utility function to combine Tailwind classes safely
 */
export function combineTailwindClasses(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Default export for convenience
 */
export default tailwindColorMappings;