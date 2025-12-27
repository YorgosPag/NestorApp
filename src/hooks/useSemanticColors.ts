'use client';

/**
 * ============================================================================
 * 🎨 ENTERPRISE SEMANTIC COLORS HOOK - LEGACY PROXY
 * ============================================================================
 *
 * 🚨 LEGACY HOOK - NOW A PROXY TO NEW ENTERPRISE DESIGN SYSTEM
 * 🔄 Strangler Fig Pattern: Gradually replacing old implementation with new architecture
 * 📍 New structure: src/design-system/ + src/ui-adapters/
 *
 * This hook now proxies to the new enterprise design system architecture:
 * - Framework-agnostic design tokens (src/design-system/tokens/)
 * - Business semantics layer (src/design-system/semantics/)
 * - UI patterns layer (src/design-system/patterns/)
 * - Clean React adapter (src/ui-adapters/react/)
 *
 * ⚠️ API remains identical for backward compatibility
 * ⚠️ All existing components continue to work unchanged
 *
 * ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΛΥΣΗ ΓΙΑ ΔΙΑΣΠΑΡΤΑ COLOR PATTERNS
 *
 * Features (now provided by new architecture):
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
 * ΚΛΕΙΔΙ: Now powered by enterprise design system architecture
 *
 * ============================================================================
 */

// 🚀 ENTERPRISE BRIDGE: Import from new design system architecture
import { useSemanticColors as useNewSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// 🔄 ENTERPRISE PROXY IMPLEMENTATION (STRANGLER FIG PATTERN)
// ============================================================================

/**
 * Legacy types re-exported for backward compatibility
 * (These now map to the new design system types)
 */
export type SemanticColorName =
  | 'success' | 'error' | 'warning' | 'info'
  | 'price' | 'primary' | 'secondary' | 'muted'
  | 'accent' | 'foreground' | 'background'
  | 'hover' | 'focus';

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
 * 🚀 ENTERPRISE ENHANCEMENT: Added hover effects integration
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
  /** 🎯 ENTERPRISE: Hover effects για visual interactions */
  readonly hoverEffects: {
    /** Scale effects για cards, buttons */
    readonly scaleUp: string;
    readonly scaleDown: string;
    /** Shadow effects για depth */
    readonly shadowSubtle: string;
    readonly shadowEnhanced: string;
    /** Background effects για states */
    readonly bgLight: string;
    readonly bgBlue: string;
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
// 🪝 MAIN HOOK - ENTERPRISE PROXY IMPLEMENTATION (STRANGLER FIG PATTERN)
// ============================================================================

/**
 * Enterprise Semantic Colors Hook - Legacy Proxy
 *
 * @deprecated Use '@/ui-adapters/react/useSemanticColors' instead.
 * This file exists only for backward compatibility.
 *
 * 🔄 Now proxies to new enterprise design system architecture
 * ⚠️ API remains identical for backward compatibility
 *
 * @returns {UseSemanticColorsReturn} All semantic color patterns με utility methods
 */
export function useSemanticColors(): UseSemanticColorsReturn {
  // 🚀 ENTERPRISE PROXY: Direct passthrough to new design system architecture
  return useNewSemanticColors() as UseSemanticColorsReturn;
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
 * Type exports για other modules - SemanticColorName εξάγεται ήδη στη γραμμή 46
 */

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