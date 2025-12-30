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
import { COLOR_BRIDGE } from '../../design-system/color-bridge';

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
 * 🔥 ΑΛΗΘΙΝΗ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ - Background Color Mappings
 * ΜΟΝΟΣ ΤΡΟΠΟΣ: Χρήση hardcoded system που συνδέεται με CSS variables
 */
export const tailwindBackgroundColors = {
  // ⚡ ΠΡΑΓΜΑΤΙΚΗ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Direct connection to CSS variables
  success: hardcodedColorValues.background.successSubtle,    // bg-[hsl(var(--bg-success))]
  error: hardcodedColorValues.background.errorSubtle,        // bg-[hsl(var(--bg-error))]
  warning: hardcodedColorValues.background.infoSubtle,       // bg-[hsl(var(--bg-info))] (using info for warning)
  info: hardcodedColorValues.background.infoSubtle,          // bg-[hsl(var(--bg-info))]
  primary: hardcodedColorValues.background.primary,          // bg-[hsl(var(--bg-primary))] 🧪 WILL SHOW BLUE!
  secondary: hardcodedColorValues.background.secondary,      // bg-[hsl(var(--bg-secondary))] 🧪 WILL SHOW BLUE!
  hover: hardcodedColorValues.background.hover,              // bg-[hsl(var(--bg-hover))]
  active: hardcodedColorValues.background.active,            // bg-[hsl(var(--bg-active))]

  // Additional backgrounds
  neutral: hardcodedColorValues.background.neutralSubtle,
  light: hardcodedColorValues.background.light, // ✅ ENTERPRISE: Use light instead of white - respects dark mode!
  transparent: hardcodedColorValues.background.transparent,
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
    border: `focus:${COLOR_BRIDGE.border.focus}`,      // ✅ SEMANTIC: focus:border-blue-500 -> focus border
    ring: 'focus:ring-2 focus:ring-blue-200',         // Keep ring for now (specific shade needed)
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
    fullScreen: `min-h-screen bg-[hsl(var(--bg-secondary))] dark:${COLOR_BRIDGE.bg.primary}`,
    light: `min-h-screen ${COLOR_BRIDGE.bg.light} dark:${COLOR_BRIDGE.bg.primary}`,
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
// ✅ ENTERPRISE: Status patterns with semantic color mapping
export const tailwindStatusPatterns = {
  active: {
    text: COLOR_BRIDGE.text.success,                    // ✅ SEMANTIC: text-green-700 -> success text
    bg: mapCssVarToTailwind('--bg-success', 'bg'),
    border: COLOR_BRIDGE.border.success,               // ✅ SEMANTIC: border-green-300 -> success border
    combined: `${COLOR_BRIDGE.text.success} bg-[hsl(var(--bg-success))] ${COLOR_BRIDGE.border.success}`,
  },
  inactive: {
    text: COLOR_BRIDGE.text.secondary,                 // ✅ SEMANTIC: text-slate-600 -> secondary text
    bg: `${COLOR_BRIDGE.bg.light}`,
    border: COLOR_BRIDGE.border.muted,                 // ✅ SEMANTIC: border-slate-300 -> muted border
    combined: `${COLOR_BRIDGE.text.secondary} ${COLOR_BRIDGE.bg.light} ${COLOR_BRIDGE.border.muted}`,
  },
  pending: {
    text: COLOR_BRIDGE.text.warning,                   // ✅ SEMANTIC: text-yellow-700 -> warning text
    bg: mapCssVarToTailwind('--bg-warning', 'bg'),
    border: COLOR_BRIDGE.border.warning,              // ✅ SEMANTIC: border-yellow-300 -> warning border
    combined: `${COLOR_BRIDGE.text.warning} bg-[hsl(var(--bg-warning))] ${COLOR_BRIDGE.border.warning}`,
  },
  completed: {
    text: COLOR_BRIDGE.text.info,                      // ✅ SEMANTIC: text-blue-700 -> info text
    bg: mapCssVarToTailwind('--bg-info', 'bg'),
    border: COLOR_BRIDGE.border.info,                 // ✅ SEMANTIC: border-blue-300 -> info border
    combined: `${COLOR_BRIDGE.text.info} bg-[hsl(var(--bg-info))] ${COLOR_BRIDGE.border.info}`,
  },
  cancelled: {
    text: COLOR_BRIDGE.text.error,                     // ✅ SEMANTIC: text-red-700 -> error text
    bg: mapCssVarToTailwind('--bg-error', 'bg'),
    border: COLOR_BRIDGE.border.error,                // ✅ SEMANTIC: border-red-300 -> error border
    combined: `${COLOR_BRIDGE.text.error} bg-[hsl(var(--bg-error))] ${COLOR_BRIDGE.border.error}`,
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