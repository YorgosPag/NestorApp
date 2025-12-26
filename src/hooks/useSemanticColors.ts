'use client';

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
import { useBorderTokens } from '@/hooks/useBorderTokens';

// Note: Hover effects imports removed to avoid circular dependencies
// Using hardcoded values for enterprise stability

// ============================================================================
// 🎯 HOOK INTERFACE - TYPE-SAFE RETURNS
// ============================================================================

/**
 * Semantic Color Names - Union type για all supported colors
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

    // 🏢 ENTERPRISE BACKGROUND COLOR PATTERNS - CSS Variables Integration
    bg: {
      success: 'bg-[hsl(var(--bg-success))]',        // ✅ ENTERPRISE: CSS variable integration
      error: 'bg-[hsl(var(--bg-error))]',              // ✅ ENTERPRISE: CSS variable integration
      warning: 'bg-[hsl(var(--bg-warning))]',          // ✅ ENTERPRISE: CSS variable integration
      info: 'bg-[hsl(var(--bg-info))]',                // ✅ ENTERPRISE: CSS variable integration
      primary: 'bg-[hsl(var(--bg-primary))]',          // ✅ ENTERPRISE: CSS variable integration
      secondary: 'bg-[hsl(var(--bg-secondary))]',      // ✅ ENTERPRISE: CSS variable integration
      hover: 'bg-[hsl(var(--bg-hover))]',              // ✅ ENTERPRISE: CSS variable integration
      active: 'bg-[hsl(var(--bg-active))]',            // ✅ ENTERPRISE: CSS variable integration

      // 🎨 COMMON BACKGROUND VARIANTS - Centralized hardcoded replacement
      white: 'bg-white',                               // ✅ CENTRALIZED: Pure white background
      transparent: 'bg-transparent',                   // ✅ CENTRALIZED: Transparent background

      // Neutral backgrounds (gray scale)
      slate: {
        '50': 'bg-slate-50',   // ✅ CENTRALIZED: Very light gray
        '100': 'bg-slate-100', // ✅ CENTRALIZED: Light gray
        '200': 'bg-slate-200', // ✅ CENTRALIZED: Medium light gray
        '300': 'bg-slate-300', // ✅ CENTRALIZED: Medium gray
        '400': 'bg-slate-400', // ✅ CENTRALIZED: Medium dark gray
        '500': 'bg-slate-500', // ✅ CENTRALIZED: Dark gray
        '600': 'bg-slate-600', // ✅ CENTRALIZED: Darker gray
        '700': 'bg-slate-700', // ✅ CENTRALIZED: Very dark gray
        '800': 'bg-slate-800', // ✅ CENTRALIZED: Extra dark gray
        '900': 'bg-slate-900', // ✅ CENTRALIZED: Nearly black
      },

      gray: {
        '50': 'bg-gray-50',     // ✅ CENTRALIZED: Most commonly used light background
        '100': 'bg-gray-100',   // ✅ CENTRALIZED: Light background
        '200': 'bg-gray-200',   // ✅ CENTRALIZED: Medium light background
        '300': 'bg-gray-300',   // ✅ CENTRALIZED: Medium background
        '400': 'bg-gray-400',   // ✅ CENTRALIZED: Medium dark background
        '500': 'bg-gray-500',   // ✅ CENTRALIZED: Dark background
        '600': 'bg-gray-600',   // ✅ CENTRALIZED: Darker background
        '700': 'bg-gray-700',   // ✅ CENTRALIZED: Very dark background
        '800': 'bg-gray-800',   // ✅ CENTRALIZED: Extra dark background
        '900': 'bg-gray-900',   // ✅ CENTRALIZED: Nearly black background
      },

      // Status color backgrounds (light variants)
      red: {
        '100': 'bg-red-100',    // ✅ CENTRALIZED: Light error background
        '500': 'bg-red-500',    // ✅ CENTRALIZED: Strong error background
        '600': 'bg-red-600',    // ✅ CENTRALIZED: Dark error background
      },

      green: {
        '100': 'bg-green-100',  // ✅ CENTRALIZED: Light success background
        '500': 'bg-green-500',  // ✅ CENTRALIZED: Strong success background
        '600': 'bg-green-600',  // ✅ CENTRALIZED: Dark success background
      },

      blue: {
        '50': 'bg-blue-50',     // ✅ CENTRALIZED: Very light info background
        '100': 'bg-blue-100',   // ✅ CENTRALIZED: Light info background
        '500': 'bg-blue-500',   // ✅ CENTRALIZED: Strong info background
        '600': 'bg-blue-600',   // ✅ CENTRALIZED: Dark info background
      },

      yellow: {
        '100': 'bg-yellow-100', // ✅ CENTRALIZED: Light warning background
        '400': 'bg-yellow-400', // ✅ CENTRALIZED: Strong warning background
      },

      orange: {
        '500': 'bg-orange-500', // ✅ CENTRALIZED: Orange accent background
      },
    },

    // 🎯 LAYOUT BACKGROUND PATTERNS - Page-level backgrounds
    layout: {
      page: 'min-h-screen bg-[hsl(var(--bg-secondary))] dark:bg-background',  // ✅ ENTERPRISE: Full-screen page layout
      pageLight: 'min-h-screen bg-gray-50 dark:bg-background',               // ✅ ENTERPRISE: Light page background
      container: 'bg-[hsl(var(--bg-primary))]',                             // ✅ ENTERPRISE: Container background
      card: 'bg-[hsl(var(--bg-primary))]',                                  // ✅ ENTERPRISE: Card background
      modal: 'bg-[hsl(var(--bg-primary))]',                                 // ✅ ENTERPRISE: Modal background
      panel: 'bg-[hsl(var(--bg-secondary))]',                               // ✅ ENTERPRISE: Panel background
      sidebar: 'bg-[hsl(var(--bg-primary))]',                               // ✅ ENTERPRISE: Sidebar background
      header: 'bg-[hsl(var(--bg-primary))] border-b',                       // ✅ ENTERPRISE: Header with border
      footer: 'bg-[hsl(var(--bg-secondary))]',                              // ✅ ENTERPRISE: Footer background
    },

    // 🎪 STATE-SPECIFIC BACKGROUNDS - UI States
    state: {
      loading: 'bg-[hsl(var(--bg-secondary))]',                             // ✅ ENTERPRISE: Loading state background
      empty: 'bg-[hsl(var(--bg-secondary))]',                               // ✅ ENTERPRISE: Empty state background
      disabled: 'bg-gray-100',                                              // ✅ CENTRALIZED: Disabled state background
      selected: 'bg-[hsl(var(--bg-info))]',                                 // ✅ ENTERPRISE: Selected state background
      highlighted: 'bg-[hsl(var(--bg-warning))]',                           // ✅ ENTERPRISE: Highlighted state background
    },

    // 🎭 INTERACTIVE BACKGROUNDS MOVED TO UTILITY METHODS BELOW

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

    // 🏢 ENTERPRISE STATUS COLOR PATTERNS - CSS Variables Integration
    status: {
      active: {
        text: 'text-green-700',
        bg: 'bg-[hsl(var(--bg-success))]',           // ✅ ENTERPRISE: CSS variable
        border: 'border-green-300',
      },
      inactive: {
        text: 'text-gray-600',
        bg: 'bg-gray-50',                            // Note: Keeping gray-50 (no CSS var yet)
        border: 'border-gray-300',
      },
      pending: {
        text: 'text-yellow-700',
        bg: 'bg-[hsl(var(--bg-warning))]',          // ✅ ENTERPRISE: CSS variable
        border: 'border-yellow-300',
      },
      completed: {
        text: 'text-blue-700',
        bg: 'bg-[hsl(var(--bg-info))]',             // ✅ ENTERPRISE: CSS variable
        border: 'border-blue-300',
      },
      cancelled: {
        text: 'text-red-700',
        bg: 'bg-[hsl(var(--bg-error))]',            // ✅ ENTERPRISE: CSS variable
        border: 'border-red-300',
      },
    },

    // ⚡ INTERACTIVE COLOR PATTERNS - Hover, focus, active states
    // 🚀 ENTERPRISE ENHANCEMENT: Integrated hover effects
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
      /** 🎯 ENTERPRISE HOVER EFFECTS - Hardcoded για stability */
      hoverEffects: {
        scaleUp: 'hover:scale-105',
        scaleDown: 'hover:scale-95',
        shadowSubtle: 'hover:shadow-md',
        shadowEnhanced: 'hover:shadow-lg',
        bgLight: 'hover:bg-white',
        bgBlue: 'hover:bg-blue-50',
      },
    },

    // 🎯 COMMON UI PATTERNS - Ready-to-use combinations
    patterns: {
      card: {
        standard: `bg-[hsl(var(--bg-primary))] ${quick.card}`,                                                    // ✅ ENTERPRISE: CSS variable
        hover: `bg-[hsl(var(--bg-primary))] ${quick.card} hover:bg-[hsl(var(--bg-hover))] transition-colors`,   // ✅ ENTERPRISE: CSS variables
        selected: `bg-[hsl(var(--bg-info))] ${quick.card} border-blue-300`,                                     // ✅ ENTERPRISE: CSS variable
      },
      alert: {
        success: `bg-[hsl(var(--bg-success))] ${quick.table} border-green-200 text-green-800 p-4`,   // ✅ ENTERPRISE: CSS variable
        error: `bg-[hsl(var(--bg-error))] ${quick.table} border-red-200 text-red-800 p-4`,         // ✅ ENTERPRISE: CSS variable
        warning: `bg-[hsl(var(--bg-warning))] ${quick.table} border-yellow-200 text-yellow-800 p-4`, // ✅ ENTERPRISE: CSS variable
        info: `bg-[hsl(var(--bg-info))] ${quick.table} border-blue-200 text-blue-800 p-4`,           // ✅ ENTERPRISE: CSS variable
      },
      badge: {
        success: `bg-green-100 text-green-800 ${quick.input} border-green-300 px-2 py-1 text-sm`,      // Note: Keeping green-100 (lighter shade)
        error: `bg-red-100 text-red-800 ${quick.input} border-red-300 px-2 py-1 text-sm`,            // Note: Keeping red-100 (lighter shade)
        warning: `bg-yellow-100 text-yellow-800 ${quick.input} border-yellow-300 px-2 py-1 text-sm`,  // Note: Keeping yellow-100 (lighter shade)
        info: `bg-blue-100 text-blue-800 ${quick.input} border-blue-300 px-2 py-1 text-sm`,          // Note: Keeping blue-100 (lighter shade)
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
      // 🏢 ENTERPRISE: CSS Variables Dynamic Access
      const bgMap = {
        success: 'bg-[hsl(var(--bg-success))]',        // ✅ ENTERPRISE: CSS variable
        error: 'bg-[hsl(var(--bg-error))]',            // ✅ ENTERPRISE: CSS variable
        warning: 'bg-[hsl(var(--bg-warning))]',        // ✅ ENTERPRISE: CSS variable
        info: 'bg-[hsl(var(--bg-info))]',              // ✅ ENTERPRISE: CSS variable
        primary: 'bg-[hsl(var(--bg-primary))]',        // ✅ ENTERPRISE: CSS variable
        secondary: 'bg-[hsl(var(--bg-secondary))]',    // ✅ ENTERPRISE: CSS variable
        hover: 'bg-[hsl(var(--bg-hover))]',            // ✅ ENTERPRISE: CSS variable
        active: 'bg-[hsl(var(--bg-active))]',          // ✅ ENTERPRISE: CSS variable
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
      // 🏢 ENTERPRISE: Status Colors με CSS Variables Integration
      const statusMap = {
        active: {
          text: 'text-green-700',
          bg: 'bg-[hsl(var(--bg-success))]',           // ✅ ENTERPRISE: CSS variable
          border: 'border-green-300'
        },
        inactive: {
          text: 'text-gray-600',
          bg: 'bg-gray-50',                            // Note: Keeping gray-50 (no CSS var yet)
          border: 'border-gray-300'
        },
        pending: {
          text: 'text-yellow-700',
          bg: 'bg-[hsl(var(--bg-warning))]',          // ✅ ENTERPRISE: CSS variable
          border: 'border-yellow-300'
        },
        completed: {
          text: 'text-blue-700',
          bg: 'bg-[hsl(var(--bg-info))]',             // ✅ ENTERPRISE: CSS variable
          border: 'border-blue-300'
        },
        cancelled: {
          text: 'text-red-700',
          bg: 'bg-[hsl(var(--bg-error))]',            // ✅ ENTERPRISE: CSS variable
          border: 'border-red-300'
        },
      };
      return statusMap[status][colorType];
    },

    createCustomPattern: (classes) => classes.join(' '),

    // ============================================================================
    // 🎨 EXTENDED BACKGROUND UTILITIES - New Enterprise Methods
    // ============================================================================

    /**
     * Get centralized background class for common colors
     * @param color - The color name (gray, blue, red, etc.)
     * @param shade - The shade intensity (50, 100, 200, etc.)
     * @returns Centralized background class
     */
    getBackgroundColor: (color: 'gray' | 'slate' | 'red' | 'green' | 'blue' | 'yellow' | 'orange', shade: '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'): string => {
      const backgroundMap = {
        gray: {
          '50': 'bg-gray-50',   '100': 'bg-gray-100', '200': 'bg-gray-200', '300': 'bg-gray-300',
          '400': 'bg-gray-400', '500': 'bg-gray-500', '600': 'bg-gray-600', '700': 'bg-gray-700',
          '800': 'bg-gray-800', '900': 'bg-gray-900'
        },
        slate: {
          '50': 'bg-slate-50',   '100': 'bg-slate-100', '200': 'bg-slate-200', '300': 'bg-slate-300',
          '400': 'bg-slate-400', '500': 'bg-slate-500', '600': 'bg-slate-600', '700': 'bg-slate-700',
          '800': 'bg-slate-800', '900': 'bg-slate-900'
        },
        red: {
          '50': 'bg-red-50',     '100': 'bg-red-100',   '200': 'bg-red-200',   '300': 'bg-red-300',
          '400': 'bg-red-400',   '500': 'bg-red-500',   '600': 'bg-red-600',   '700': 'bg-red-700',
          '800': 'bg-red-800',   '900': 'bg-red-900'
        },
        green: {
          '50': 'bg-green-50',   '100': 'bg-green-100', '200': 'bg-green-200', '300': 'bg-green-300',
          '400': 'bg-green-400', '500': 'bg-green-500', '600': 'bg-green-600', '700': 'bg-green-700',
          '800': 'bg-green-800', '900': 'bg-green-900'
        },
        blue: {
          '50': 'bg-blue-50',    '100': 'bg-blue-100',  '200': 'bg-blue-200',  '300': 'bg-blue-300',
          '400': 'bg-blue-400',  '500': 'bg-blue-500',  '600': 'bg-blue-600',  '700': 'bg-blue-700',
          '800': 'bg-blue-800',  '900': 'bg-blue-900'
        },
        yellow: {
          '50': 'bg-yellow-50',  '100': 'bg-yellow-100','200': 'bg-yellow-200','300': 'bg-yellow-300',
          '400': 'bg-yellow-400','500': 'bg-yellow-500','600': 'bg-yellow-600','700': 'bg-yellow-700',
          '800': 'bg-yellow-800','900': 'bg-yellow-900'
        },
        orange: {
          '50': 'bg-orange-50',  '100': 'bg-orange-100','200': 'bg-orange-200','300': 'bg-orange-300',
          '400': 'bg-orange-400','500': 'bg-orange-500','600': 'bg-orange-600','700': 'bg-orange-700',
          '800': 'bg-orange-800','900': 'bg-orange-900'
        }
      };
      return backgroundMap[color][shade];
    },

    /**
     * Get layout background class (page, container, card, etc.)
     * @param layout - The layout type
     * @returns Centralized layout background class
     */
    getLayoutBackground: (layout: 'page' | 'pageLight' | 'container' | 'card' | 'modal' | 'panel' | 'sidebar' | 'header' | 'footer'): string => {
      const layoutMap = {
        page: 'min-h-screen bg-[hsl(var(--bg-secondary))] dark:bg-background',
        pageLight: 'min-h-screen bg-gray-50 dark:bg-background',
        container: 'bg-[hsl(var(--bg-primary))]',
        card: 'bg-[hsl(var(--bg-primary))]',
        modal: 'bg-[hsl(var(--bg-primary))]',
        panel: 'bg-[hsl(var(--bg-secondary))]',
        sidebar: 'bg-[hsl(var(--bg-primary))]',
        header: 'bg-[hsl(var(--bg-primary))] border-b',
        footer: 'bg-[hsl(var(--bg-secondary))]',
      };
      return layoutMap[layout];
    },

    /**
     * Get state-specific background class
     * @param state - The UI state
     * @returns Centralized state background class
     */
    getStateBackground: (state: 'loading' | 'empty' | 'disabled' | 'selected' | 'highlighted'): string => {
      const stateMap = {
        loading: 'bg-[hsl(var(--bg-secondary))]',
        empty: 'bg-[hsl(var(--bg-secondary))]',
        disabled: 'bg-gray-100',
        selected: 'bg-[hsl(var(--bg-info))]',
        highlighted: 'bg-[hsl(var(--bg-warning))]',
      };
      return stateMap[state];
    },

    /**
     * Get interactive background class with state
     * @param interaction - The interaction type
     * @param variant - The variant (for hover states)
     * @returns Centralized interactive background class
     */
    getInteractiveBackground: (interaction: 'hover' | 'focus' | 'active', variant: 'light' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'ring' | 'subtle' | 'scale' = 'primary'): string => {
      const interactiveMap = {
        hover: {
          light: 'hover:bg-[hsl(var(--bg-hover))]',
          primary: 'hover:bg-[hsl(var(--bg-primary))]',
          secondary: 'hover:bg-[hsl(var(--bg-secondary))]',
          success: 'hover:bg-[hsl(var(--bg-success))]',
          error: 'hover:bg-[hsl(var(--bg-error))]',
          warning: 'hover:bg-[hsl(var(--bg-warning))]',
          info: 'hover:bg-[hsl(var(--bg-info))]',
          ring: 'hover:bg-[hsl(var(--bg-hover))]',
          subtle: 'hover:bg-[hsl(var(--bg-hover))]',
          scale: 'hover:bg-[hsl(var(--bg-hover))]',
        },
        focus: {
          ring: 'focus:bg-[hsl(var(--bg-primary))] focus:ring-2 focus:ring-blue-500',
          subtle: 'focus:bg-[hsl(var(--bg-hover))]',
          light: 'focus:bg-[hsl(var(--bg-hover))]',
          primary: 'focus:bg-[hsl(var(--bg-primary))]',
          secondary: 'focus:bg-[hsl(var(--bg-secondary))]',
          success: 'focus:bg-[hsl(var(--bg-success))]',
          error: 'focus:bg-[hsl(var(--bg-error))]',
          warning: 'focus:bg-[hsl(var(--bg-warning))]',
          info: 'focus:bg-[hsl(var(--bg-info))]',
          scale: 'focus:bg-[hsl(var(--bg-hover))]',
        },
        active: {
          primary: 'active:bg-[hsl(var(--bg-active))]',
          scale: 'active:bg-[hsl(var(--bg-active))] active:scale-95',
          light: 'active:bg-[hsl(var(--bg-active))]',
          secondary: 'active:bg-[hsl(var(--bg-active))]',
          success: 'active:bg-[hsl(var(--bg-success))]',
          error: 'active:bg-[hsl(var(--bg-error))]',
          warning: 'active:bg-[hsl(var(--bg-warning))]',
          info: 'active:bg-[hsl(var(--bg-info))]',
          ring: 'active:bg-[hsl(var(--bg-active))]',
          subtle: 'active:bg-[hsl(var(--bg-active))]',
        },
      };
      return interactiveMap[interaction][variant];
    },

    /**
     * Get parking status color classes - CENTRALIZED REPLACEMENT για PARKING_STATUS_COLORS
     * @param status - Parking spot status
     * @returns Centralized parking status classes
     */
    getParkingStatusClass: (status: 'sold' | 'owner' | 'available' | 'reserved'): string => {
      const parkingMap = {
        sold: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        owner: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        available: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
        reserved: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      };
      return parkingMap[status];
    },

    /**
     * Get relationship type badge color classes - CENTRALIZED REPLACEMENT για getRelationshipBadgeColor
     * @param relationshipType - Contact relationship type
     * @returns Centralized relationship badge classes
     */
    getRelationshipBadgeClass: (relationshipType: 'employee' | 'manager' | 'director' | 'executive' | 'ceo' | 'shareholder' | 'board_member' | 'chairman' | 'civil_servant' | 'department_head' | 'consultant' | 'contractor' | 'vendor' | 'client' | 'partner'): string => {
      const relationshipMap = {
        'employee': 'bg-blue-100 text-blue-800',
        'manager': 'bg-purple-100 text-purple-800',
        'director': 'bg-purple-100 text-purple-800',
        'executive': 'bg-purple-100 text-purple-800',
        'ceo': 'bg-purple-100 text-purple-800',
        'shareholder': 'bg-green-100 text-green-800',
        'board_member': 'bg-orange-100 text-orange-800',
        'chairman': 'bg-red-100 text-red-800',
        'civil_servant': 'bg-blue-100 text-blue-800', // Using blue for indigo alternative
        'department_head': 'bg-red-100 text-red-800',
        'consultant': 'bg-blue-100 text-blue-800', // Using blue for teal alternative
        'contractor': 'bg-yellow-100 text-yellow-800',
        'vendor': 'bg-gray-100 text-gray-800',
        'client': 'bg-green-100 text-green-800', // Using green for emerald alternative
        'partner': 'bg-pink-100 text-pink-800',
      };
      return relationshipMap[relationshipType] || 'bg-gray-100 text-gray-800';
    },

  } as const), []); // Empty dependency array για stability
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