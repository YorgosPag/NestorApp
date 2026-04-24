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
  /** Inverted text color - alias for inverse */
  readonly inverted: string;
  /** Foreground text color - direct mapping */
  readonly foreground: string;

  // ✅ ENTERPRISE FIX: Missing properties for TestResultsModal and debug components
  /** Danger text color - 'text-red-600' (alias for error) */
  readonly danger: string;
  /** Disabled text color - 'text-gray-400' */
  readonly disabled: string;
  /** Tertiary text color - 'text-slate-500' */
  readonly tertiary: string;
  /** Accent text color - 'text-blue-600' (alias for info) */
  readonly accent: string;

  // ✅ ENTERPRISE: Uppercase color constants (for legacy compatibility)
  /** White text - 'text-white' */
  readonly WHITE: string;
  /** Black text - 'text-black' */
  readonly BLACK: string;
  /** Darker text - 'text-gray-800' */
  readonly DARKER: string;
  /** Light red text - 'text-red-400' */
  readonly RED_LIGHT: string;

  // ✅ ENTERPRISE: Strong text variants
  readonly successStrong: string;
  readonly errorStrong: string;

  // ✅ ENTERPRISE: Constraint text colors
  readonly yellow: string;
  readonly orange: string;
  readonly purple: string;
  readonly magenta: string;

  // ✅ ENTERPRISE: Muted inverted for dark backgrounds
  readonly mutedInverted: string;

  // ✅ ENTERPRISE: Light variants for dark backgrounds (calibration overlays, debug panels)
  readonly infoLight: string;
  readonly infoLighter: string;
  readonly infoAccent: string;
  readonly successLight: string;
  readonly successLighter: string;
  readonly warningLight: string;
  readonly warningLighter: string;
  readonly errorLight: string;
  readonly cyanLight: string;
  readonly cyanAccent: string;
  readonly orangeLight: string;
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
  /** Primary background color - 'bg-background' (beautiful blue) */
  readonly primary: string;
  /** Secondary background color - 'bg-slate-50' */
  readonly secondary: string;
  /** Hover background color - 'bg-slate-100' */
  readonly hover: string;
  /** Active background color - 'bg-slate-200' */
  readonly active: string;

  // ✅ ENTERPRISE: Core backgrounds
  readonly card: string;
  readonly surface: string;
  readonly muted: string;
  readonly skeleton: string;
  readonly tertiary: string;
  readonly elevated: string;
  readonly selection: string;
  readonly backgroundSecondary: string;
  readonly overlay: string;
  readonly accent: string;
  readonly light: string;
  readonly transparent: string;

  // ✅ ENTERPRISE: Modal backdrops
  readonly modalBackdrop: string;
  readonly modalBackdropLight: string;
  readonly modalBackdropDark: string;

  // ✅ ENTERPRISE: Status variants
  readonly danger: string;
  readonly successHover: string;
  readonly dangerHover: string;
  readonly successSubtle: string;
  readonly errorSubtle: string;
  readonly infoSubtle: string;
  readonly neutralSubtle: string;
  readonly warningSubtle: string;
  readonly errorLight: string;
  readonly warningLight: string;

  // ✅ ENTERPRISE: Constraint colors
  readonly yellow: string;
  readonly orange: string;
  readonly purple: string;
  readonly magenta: string;

  // ✅ ENTERPRISE: Dark theme backgrounds
  readonly infoDark: string;
  readonly successDark: string;
  readonly warningDark: string;
  readonly errorDark: string;
  readonly slateDark: string;
  readonly slateLight: string;

  // ✅ ENTERPRISE: Panel backgrounds on dark UIs
  readonly warningPanel: string;
  readonly infoPanel: string;
  readonly successPanel: string;
}

/**
 * Border color patterns - Semantic borders
 */
export interface SemanticBorderColors {
  /** Default border color - 'border-border' */
  readonly default: string;
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
    /** Standard card pattern - 'bg-card border border-border' (beautiful blue) */
    readonly standard: string;
    /** Hover card pattern - 'bg-card border border-border hover:bg-accent' (beautiful blue) */
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
  return useNewSemanticColors() as unknown as UseSemanticColorsReturn; // ✅ ENTERPRISE: Fixed type conversion
}

// ============================================================================
// 🎯 SPECIALIZED HOOKS - COMMON USE CASES
// ============================================================================

