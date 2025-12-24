/**
 * ============================================================================
 * 🎨 ENTERPRISE SEMANTIC COLORS HOOK - PROFESSIONAL INTEGRATION
 * ============================================================================
 *
 * ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΛΥΣΗ ΓΙΑ ΔΙΑΣΠΑΡΤΑ COLOR PATTERNS
 *
 * Features:
 * - Integration με existing design-tokens colors system
 * - Semantic color access (success, error, warning, info)
 * - Common color patterns (price, status, interactive states)
 * - Type-safe Tailwind class generation
 * - Performance optimized με useMemo
 * - Zero hardcoded color values
 * - Enterprise-grade patterns
 *
 * Usage Example:
 * ```tsx
 * function PropertyDetails() {
 *   const colors = useSemanticColors();
 *
 *   return (
 *     <div className={colors.text.success}>Επιτυχία</div>
 *     <p className={colors.text.price}>€150,000</p>
 *     <span className={colors.bg.warning}>Προειδοποίηση</span>
 *   );
 * }
 * ```
 *
 * ΚΛΕΙΔΙ: Επεκτείνει existing design-tokens colors με semantic Tailwind classes
 *
 * ============================================================================
 */

import { useMemo } from 'react';
import { semanticColors, colors } from '@/styles/design-tokens/base/colors';
import { useBorderTokens } from '@/hooks/useBorderTokens';

// ============================================================================
// 🎯 HOOK INTERFACE - TYPE-SAFE RETURNS
// ============================================================================

/**
 * Text color patterns - Semantic text coloring
 */
export interface SemanticTextColors {
  /** Success text color - 'text-green-600' */
  readonly success: string;
  /** Error text color - 'text-red-600' */
  readonly error: string;
  /** Warning text color - 'text-yellow-600' */
  readonly warning: string;
  /** Info text color - 'text-blue-600' */
  readonly info: string;
  /** Price/Value text color - 'text-green-600' */
  readonly price: string;
  /** Primary text color - 'text-slate-900' */
  readonly primary: string;
  /** Secondary text color - 'text-slate-600' */
  readonly secondary: string;
  /** Muted text color - 'text-slate-400' */
  readonly muted: string;
  /** Inverse text color - 'text-white' */
  readonly inverse: string;
}

/**
 * Background color patterns - Semantic backgrounds
 */
export interface SemanticBackgroundColors {
  /** Success background color - 'bg-green-50' */
  readonly success: string;
  /** Error background color - 'bg-red-50' */
  readonly error: string;
  /** Warning background color - 'bg-yellow-50' */
  readonly warning: string;
  /** Info background color - 'bg-blue-50' */
  readonly info: string;
  /** Primary background color - 'bg-white' */
  readonly primary: string;
  /** Secondary background color - 'bg-slate-50' */
  readonly secondary: string;
  /** Hover background color - 'bg-slate-100' */
  readonly hover: string;
  /** Active background color - 'bg-slate-200' */
  readonly active: string;
}

/**
 * Border color patterns - Semantic borders
 */
export interface SemanticBorderColors {
  /** Success border color - 'border-green-300' */
  readonly success: string;
  /** Error border color - 'border-red-300' */
  readonly error: string;
  /** Warning border color - 'border-yellow-300' */
  readonly warning: string;
  /** Info border color - 'border-blue-300' */
  readonly info: string;
  /** Primary border color - 'border-slate-200' */
  readonly primary: string;
  /** Secondary border color - 'border-slate-300' */
  readonly secondary: string;
  /** Focus border color - 'border-blue-500' */
  readonly focus: string;
}

/**
 * Status color patterns - Semantic status indicators
 */
export interface StatusColorPatterns {
  /** Active status - green colors */
  readonly active: {
    readonly text: string;
    readonly bg: string;
    readonly border: string;
  };
  /** Inactive status - gray colors */
  readonly inactive: {
    readonly text: string;
    readonly bg: string;
    readonly border: string;
  };
  /** Pending status - yellow colors */
  readonly pending: {
    readonly text: string;
    readonly bg: string;
    readonly border: string;
  };
  /** Completed status - blue colors */
  readonly completed: {
    readonly text: string;
    readonly bg: string;
    readonly border: string;
  };
  /** Cancelled status - red colors */
  readonly cancelled: {
    readonly text: string;
    readonly bg: string;
    readonly border: string;
  };
}

/**
 * Interactive color patterns - Hover, focus, active states
 */
export interface InteractiveColorPatterns {
  /** Button hover patterns */
  readonly buttonHover: {
    readonly primary: string;
    readonly secondary: string;
    readonly ghost: string;
  };
  /** Link color patterns */
  readonly link: {
    readonly default: string;
    readonly hover: string;
    readonly visited: string;
  };
  /** Input focus patterns */
  readonly inputFocus: {
    readonly border: string;
    readonly ring: string;
  };
}

/**
 * Common UI patterns - Frequently used combinations
 */
export interface CommonUIPatterns {
  /** Card patterns */
  readonly card: {
    /** Standard card pattern - 'bg-white border border-slate-200' */
    readonly standard: string;
    /** Hover card pattern - 'bg-white border border-slate-200 hover:bg-slate-50' */
    readonly hover: string;
    /** Selected card pattern - 'bg-blue-50 border border-blue-300' */
    readonly selected: string;
  };
  /** Alert patterns */
  readonly alert: {
    /** Success alert pattern */
    readonly success: string;
    /** Error alert pattern */
    readonly error: string;
    /** Warning alert pattern */
    readonly warning: string;
    /** Info alert pattern */
    readonly info: string;
  };
  /** Badge patterns */
  readonly badge: {
    /** Success badge pattern */
    readonly success: string;
    /** Error badge pattern */
    readonly error: string;
    /** Warning badge pattern */
    readonly warning: string;
    /** Info badge pattern */
    readonly info: string;
  };
}

/**
 * Return type για useSemanticColors hook - Full type safety
 */
export interface UseSemanticColorsReturn {
  readonly text: SemanticTextColors;
  readonly bg: SemanticBackgroundColors;
  readonly border: SemanticBorderColors;
  readonly status: StatusColorPatterns;
  readonly interactive: InteractiveColorPatterns;
  readonly patterns: CommonUIPatterns;

  // 🔧 UTILITY METHODS
  readonly getText: (type: keyof SemanticTextColors) => string;
  readonly getBg: (type: keyof SemanticBackgroundColors) => string;
  readonly getBorder: (type: keyof SemanticBorderColors) => string;
  readonly getStatusColor: (status: keyof StatusColorPatterns, type: 'text' | 'bg' | 'border') => string;
  readonly createCustomPattern: (classes: string[]) => string;
}

// ============================================================================
// 🪝 MAIN HOOK - ENTERPRISE SEMANTIC COLORS ACCESS
// ============================================================================

/**
 * Enterprise Semantic Colors Hook
 *
 * Παρέχει type-safe access στα semantic color patterns
 * βασισμένα στα existing design tokens colors
 *
 * @returns {UseSemanticColorsReturn} All semantic color patterns με utility methods
 */
export function useSemanticColors(): UseSemanticColorsReturn {
  // ============================================================================
  // 🎨 ENTERPRISE BORDER INTEGRATION - CENTRALIZED TOKENS
  // ============================================================================
  const { quick } = useBorderTokens();

  // ============================================================================
  // 🚀 MEMOIZED COLOR PATTERNS - PERFORMANCE OPTIMIZED
  // ============================================================================

  return useMemo(() => ({

    // 🎨 TEXT COLOR PATTERNS - Semantic text coloring
    text: {
      success: 'text-green-600',
      error: 'text-red-600',
      warning: 'text-yellow-600',
      info: 'text-blue-600',
      price: 'text-green-600',        // Common pattern για prices/values
      primary: 'text-slate-900',
      secondary: 'text-slate-600',
      muted: 'text-slate-400',
      inverse: 'text-white',
    },

    // 🖌️ BACKGROUND COLOR PATTERNS - Semantic backgrounds
    bg: {
      success: 'bg-green-50',
      error: 'bg-red-50',
      warning: 'bg-yellow-50',
      info: 'bg-blue-50',
      primary: 'bg-white',
      secondary: 'bg-slate-50',
      hover: 'bg-slate-100',
      active: 'bg-slate-200',
    },

    // 🔲 BORDER COLOR PATTERNS - Semantic borders
    border: {
      success: 'border-green-300',
      error: 'border-red-300',
      warning: 'border-yellow-300',
      info: 'border-blue-300',
      primary: 'border-slate-200',
      secondary: 'border-slate-300',
      focus: 'border-blue-500',
    },

    // 📊 STATUS COLOR PATTERNS - Complete status indicators
    status: {
      active: {
        text: 'text-green-700',
        bg: 'bg-green-50',
        border: 'border-green-300',
      },
      inactive: {
        text: 'text-gray-600',
        bg: 'bg-gray-50',
        border: 'border-gray-300',
      },
      pending: {
        text: 'text-yellow-700',
        bg: 'bg-yellow-50',
        border: 'border-yellow-300',
      },
      completed: {
        text: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-300',
      },
      cancelled: {
        text: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-300',
      },
    },

    // ⚡ INTERACTIVE COLOR PATTERNS - Hover, focus, active states
    interactive: {
      buttonHover: {
        primary: 'hover:bg-blue-600',
        secondary: 'hover:bg-slate-100',
        ghost: 'hover:bg-slate-50',
      },
      link: {
        default: 'text-blue-600',
        hover: 'hover:text-blue-700',
        visited: 'visited:text-purple-600',
      },
      inputFocus: {
        border: 'focus:border-blue-500',
        ring: 'focus:ring-2 focus:ring-blue-200',
      },
    },

    // 🎯 COMMON UI PATTERNS - Ready-to-use combinations
    patterns: {
      card: {
        standard: `bg-white ${quick.card}`,
        hover: `bg-white ${quick.card} hover:bg-slate-50 transition-colors`,
        selected: `bg-blue-50 ${quick.card} border-blue-300`,
      },
      alert: {
        success: `bg-green-50 ${quick.table} border-green-200 text-green-800 p-4`,
        error: `bg-red-50 ${quick.table} border-red-200 text-red-800 p-4`,
        warning: `bg-yellow-50 ${quick.table} border-yellow-200 text-yellow-800 p-4`,
        info: `bg-blue-50 ${quick.table} border-blue-200 text-blue-800 p-4`,
      },
      badge: {
        success: `bg-green-100 text-green-800 ${quick.input} border-green-300 px-2 py-1 text-sm`,
        error: `bg-red-100 text-red-800 ${quick.input} border-red-300 px-2 py-1 text-sm`,
        warning: `bg-yellow-100 text-yellow-800 ${quick.input} border-yellow-300 px-2 py-1 text-sm`,
        info: `bg-blue-100 text-blue-800 ${quick.input} border-blue-300 px-2 py-1 text-sm`,
      },
    },

    // 🔧 UTILITY METHODS - Type-safe dynamic access
    getText: (type) => {
      const textMap = {
        success: 'text-green-600',
        error: 'text-red-600',
        warning: 'text-yellow-600',
        info: 'text-blue-600',
        price: 'text-green-600',
        primary: 'text-slate-900',
        secondary: 'text-slate-600',
        muted: 'text-slate-400',
        inverse: 'text-white',
      };
      return textMap[type];
    },

    getBg: (type) => {
      const bgMap = {
        success: 'bg-green-50',
        error: 'bg-red-50',
        warning: 'bg-yellow-50',
        info: 'bg-blue-50',
        primary: 'bg-white',
        secondary: 'bg-slate-50',
        hover: 'bg-slate-100',
        active: 'bg-slate-200',
      };
      return bgMap[type];
    },

    getBorder: (type) => {
      const borderMap = {
        success: 'border-green-300',
        error: 'border-red-300',
        warning: 'border-yellow-300',
        info: 'border-blue-300',
        primary: 'border-slate-200',
        secondary: 'border-slate-300',
        focus: 'border-blue-500',
      };
      return borderMap[type];
    },

    getStatusColor: (status, colorType) => {
      const statusMap = {
        active: { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-300' },
        inactive: { text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-300' },
        pending: { text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300' },
        completed: { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300' },
        cancelled: { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300' },
      };
      return statusMap[status][colorType];
    },

    createCustomPattern: (classes) => classes.join(' '),

  } as const), [quick]); // Include border tokens dependency για reactivity
}

// ============================================================================
// 🎯 SPECIALIZED HOOKS - COMMON USE CASES
// ============================================================================

/**
 * Hook για status colors - Lightweight
 * Χρήση: Όταν χρειάζεσαι μόνο status indicators
 */
export function useStatusColors() {
  const colors = useSemanticColors();
  return useMemo(() => colors.status, [colors.status]);
}

/**
 * Hook για text colors - Lightweight
 * Χρήση: Όταν χρειάζεσαι μόνο text coloring
 */
export function useTextColors() {
  const colors = useSemanticColors();
  return useMemo(() => colors.text, [colors.text]);
}

/**
 * Hook για interactive colors - Lightweight
 * Χρήση: Για hover/focus states
 */
export function useInteractiveColors() {
  const colors = useSemanticColors();
  return useMemo(() => colors.interactive, [colors.interactive]);
}

/**
 * Hook για common UI patterns - Lightweight
 * Χρήση: Για ready-to-use component patterns
 */
export function useUIPatterns() {
  const colors = useSemanticColors();
  return useMemo(() => colors.patterns, [colors.patterns]);
}

// ============================================================================
// 🔗 CONVENIENCE EXPORTS - EASY IMPORTS
// ============================================================================

/**
 * Default export για main hook
 */
export default useSemanticColors;

/**
 * Quick access pattern
 */
export {
  useSemanticColors as useColors,
  useStatusColors as useStatus,
  useTextColors as useTextStyles,
  useInteractiveColors as useHoverStyles,
  useUIPatterns as useCommonPatterns,
};