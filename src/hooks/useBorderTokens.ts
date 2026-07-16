// ============================================================================
// 🎨 ENTERPRISE BORDER TOKENS HOOK
// ============================================================================
//
// ✨ React Hook για εύκολη πρόσβαση στο Border Design System
// Single Source of Truth για όλα τα border patterns
// Enterprise-level API design για maximum developer productivity
//
// ============================================================================

import {
  borderWidth,
  borderColors,
  coreBorderRadius,
  borderStyle,
  borderVariants,
  borderUtils,
  responsiveBorders
} from '../styles/design-tokens';

// ============================================================================
// 🏢 SHARED MAPS — declared once, consumed by the hook AND the static export
// ============================================================================

/** Semantic states that resolve to a border colour. */
type BorderStatus =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'muted'
  | 'subtle';

/** Sides a border can be drawn on. */
type BorderDirection = 'top' | 'bottom' | 'left' | 'right';

/**
 * Colour suffix per status. `border` (rather than a palette shade) yields
 * `border-border` — the centralized CSS variable.
 */
const STATUS_BORDER_COLOR = {
  default: 'border',
  success: 'green-500',
  warning: 'yellow-500',
  error: 'red-500',
  info: 'blue-500',
  muted: 'border',
  subtle: 'border'
} as const satisfies Record<BorderStatus, string>;

/** Tailwind side prefix per direction. */
const BORDER_DIRECTION = {
  top: 'border-t',
  bottom: 'border-b',
  left: 'border-l',
  right: 'border-r'
} as const satisfies Record<BorderDirection, string>;

/** Full base border per status, for elements bordered on all four sides. */
const STATUS_BASE_BORDER = {
  default: 'border border-border',
  success: 'border border-green-500',
  warning: 'border border-yellow-500',
  error: 'border border-red-500',
  info: 'border border-blue-500',
  muted: 'border border-border',
  subtle: 'border border-border'
} as const satisfies Record<BorderStatus, string>;

/**
 * Border on the given sides only, in the caller's order, in the status colour.
 * The single implementation behind `getDirectionalBorder`,
 * `getMultiDirectionalBorder` and the directional half of `getCombinedBorder`.
 */
function directionalBorder(
  status: BorderStatus,
  directions: readonly BorderDirection[]
): string {
  const directionClasses = directions
    .map(dir => BORDER_DIRECTION[dir])
    .join(' ');
  return `${directionClasses} border-${STATUS_BORDER_COLOR[status]}`;
}

/**
 * 🎯 QUICK BORDER SHORTCUTS
 * The canonical class strings for common patterns. Exposed both as
 * `useBorderTokens().quick` (React) and `borderTokens.quick` (non-React) —
 * one definition, so the two can never drift apart.
 */
const QUICK_BORDERS = {
  /** No border */
  none: 'border-0',

  /** Default border (same as card) */
  default: 'border border-border rounded-lg',

  /** Default card border */
  card: 'border border-border rounded-lg',

  /** Default button border */
  button: 'border border-border',

  /** Default input border — uses --input variable (darker than --border) for visibility (ADR-190) */
  input: 'border border-input rounded-md',

  /** Checkbox border */
  checkbox: 'border border-border rounded-md',

  /** Modal border (typically none + shadow) */
  modal: 'border-0 rounded-lg shadow-lg',

  /** Container border (typically none) */
  container: 'border-0',

  /** Horizontal separator */
  separatorH: 'border-t border-border',

  /** Vertical separator */
  separatorV: 'border-l border-border',

  /** Success border */
  success: 'border border-green-500',

  /** Error border */
  error: 'border border-red-500',

  /** Warning border */
  warning: 'border border-yellow-500',

  /** Info border */
  info: 'border border-blue-500',

  /** Muted border για DynamicInput components */
  muted: 'border border-border',

  /** Focus state border */
  focus: 'focus:border-blue-500 focus:ring-2 focus:ring-blue-200',

  /** Selected state border */
  selected: 'border-blue-500 bg-blue-50',

  /** Table border (for dropdown/table items) */
  table: 'border border-border rounded-lg',

  /** Rounded border shortcut */
  rounded: 'border border-border rounded-lg',

  /** Dashed border */
  dashed: 'border-2 border-border border-dashed rounded-lg',

  /** Generic separator */
  separator: 'border-t border-border',

  /** Bottom border for card sections, headers */
  borderB: 'border-b border-border',

  /** Top border for footers, separators */
  borderT: 'border-t border-border',

  /** Left border for sidebars, panels */
  borderL: 'border-l border-border',

  /** Right border for sidebars, panels */
  borderR: 'border-r border-border',

  /** Avatar border for UserCard */
  avatar: 'border-2 border-border rounded-full',
} as const;

/**
 * 🎯 ENTERPRISE BORDER TOKENS HOOK
 *
 * Provides centralized access to all border design tokens
 * with enterprise-level type safety and developer experience
 *
 * @example
 * ```tsx
 * function MyCard() {
 *   const { getVariantClass, createBorder, variants } = useBorderTokens();
 *
 *   return (
 *     <div className={variants.card.className}>
 *       Card with enterprise border
 *     </div>
 *   );
 * }
 * ```
 */
export function useBorderTokens() {
  return {
    // ========================================================================
    // 🎨 CORE TOKENS - Raw design values
    // ========================================================================

    /** Border width tokens (none, hairline, default, medium, thick, heavy) */
    width: borderWidth,

    /** Border color tokens with light/dark/css variants */
    colors: borderColors,

    /** Border radius tokens (none, xs, sm, default, md, lg, xl, 2xl, 3xl, full) */
    radius: coreBorderRadius,

    /** Border radius Tailwind classes - ENTERPRISE: Single source of truth for rounded-* */
    radiusClass: {
      none: 'rounded-none',
      sm: 'rounded-sm',
      default: 'rounded',
      md: 'rounded-md',
      lg: 'rounded-lg',
      xl: 'rounded-xl',
      '2xl': 'rounded-2xl',
      '3xl': 'rounded-3xl',
      full: 'rounded-full',
    } as const,

    /** Border style tokens (solid, dashed, dotted, double, hidden, none) */
    style: borderStyle,

    // ========================================================================
    // 🏢 SEMANTIC VARIANTS - Enterprise UI patterns
    // ========================================================================

    /** Pre-configured border variants for common UI elements */
    variants: borderVariants,

    /** Responsive border utilities for different screen sizes */
    responsive: responsiveBorders,

    // ========================================================================
    // 🛠️ UTILITY FUNCTIONS - Dynamic border generation
    // ========================================================================

    /** Create border CSS string from tokens */
    createBorder: borderUtils.createBorder,

    /** Get CSS class for a border variant */
    getVariantClass: borderUtils.getVariantClass,

    /** Safely combine multiple border classes */
    combineBorders: borderUtils.combineBorders,

    /** Apply dark mode border automatically */
    withDarkMode: borderUtils.withDarkMode,

    // ========================================================================
    // 🎯 CONVENIENCE METHODS - Enterprise developer experience
    // ========================================================================

    /**
     * Get complete border class for a UI element type
     * @param element - The UI element type (card, button, input, modal, etc.)
     * @param state - Optional state (default, focus, error, hover, etc.)
     */
    getElementBorder: (
      element: 'card' | 'button' | 'input' | 'modal' | 'container',
      state: 'default' | 'focus' | 'error' | 'hover' | 'selected' = 'default'
    ): string => {
      // ✅ ENTERPRISE: Input states
      if (element === 'input') {
        const inputStates = {
          default: borderVariants.input.default.className,
          focus: 'border-2 border-blue-500 rounded-md',
          error: 'border-2 border-red-500 rounded-md'
        };
        return inputStates[state as keyof typeof inputStates] || inputStates.default;
      }

      // ✅ ENTERPRISE: Button states
      if (element === 'button') {
        const buttonStates = {
          default: borderVariants.button.default.className,
          focus: 'border border-blue-500',
          hover: 'border border-border' // 🏢 ENTERPRISE: Centralized
        };
        return buttonStates[state as keyof typeof buttonStates] || buttonStates.default;
      }

      // ✅ ENTERPRISE: Interactive states with fallbacks
      const interactiveStates = {
        hover: 'hover:border-border', // 🏢 ENTERPRISE: Centralized
        focus: 'focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
        selected: 'border-blue-500 bg-blue-50'
      };

      if (state in interactiveStates) {
        return interactiveStates[state as keyof typeof interactiveStates];
      }

      // ✅ ENTERPRISE: Element defaults with fallbacks
      const elementDefaults = {
        card: borderVariants.card.className,
        modal: borderVariants.modal.className,
        container: borderVariants.container.className
      };

      return elementDefaults[element as keyof typeof elementDefaults] || elementDefaults.card;
    },

    /**
     * Get border class for status/semantic states
     * @param status - The semantic status (success, warning, error, info, muted, subtle, critical, high, medium, low)
     */
    getStatusBorder: (status: 'default' | 'success' | 'warning' | 'error' | 'info' | 'muted' | 'subtle' | 'critical' | 'high' | 'medium' | 'low'): string => {
      // Handle special cases
      if (status === 'default') {
        return `border-[${borderWidth.default}] border-[${borderColors.default.light}]`; // CENTRALIZED από design tokens!
      }
      if (status === 'muted') {
        return `border-[${borderWidth.default}] border-[${borderColors.muted.light}]`; // CENTRALIZED από design tokens!
      }
      if (status === 'subtle') {
        return `border-[${borderWidth.hairline}] border-[${borderColors.muted.light}]`; // CENTRALIZED από design tokens!
      }

      // Handle severity levels (for Geo Canvas compatibility)
      if (status === 'critical') {
        return `border-[${borderWidth.thick}] border-[${borderColors.error.light}]`; // CENTRALIZED από design tokens!
      }
      if (status === 'high') {
        return `border-[${borderWidth.medium}] border-[${borderColors.warning.light}]`; // CENTRALIZED από design tokens!
      }
      if (status === 'medium') {
        return `border-[${borderWidth.default}] border-[${borderColors.info.light}]`; // CENTRALIZED από design tokens!
      }
      if (status === 'low') {
        return `border-[${borderWidth.default}] border-[${borderColors.success.light}]`; // CENTRALIZED από design tokens!
      }

      // ✅ ENTERPRISE: Status fallbacks with centralized values
      const statusFallbacks = {
        success: 'border border-green-500',
        warning: 'border border-yellow-500',
        error: 'border border-red-500',
        info: 'border border-blue-500',
        muted: 'border border-border' // 🏢 ENTERPRISE: Centralized
      };

      return statusFallbacks[status as keyof typeof statusFallbacks] || `border-[${borderWidth.default}] border-[${borderColors.default.light}]`;
    },

    /**
     * Get separator border class
     * @param direction - Horizontal or vertical separator
     */
    getSeparatorBorder: (direction: 'horizontal' | 'vertical'): string => {
      // ✅ ENTERPRISE: Separator fallbacks - Centralized
      const separatorDirections = {
        horizontal: 'border-t border-border', // 🏢 ENTERPRISE: Centralized
        vertical: 'border-l border-border'    // 🏢 ENTERPRISE: Centralized
      };
      return separatorDirections[direction];
    },

    /**
     * Create responsive border classes for mobile/tablet/desktop
     * @param element - The UI element type
     */
    getResponsiveBorder: (element: 'card' | 'button' | 'input'): string => {
      // ✅ ENTERPRISE: Responsive fallbacks
      const responsiveElements = {
        card: 'border sm:border lg:border',
        button: 'border sm:border lg:border',
        input: 'border sm:border lg:border'
      };

      return responsiveElements[element] || 'border';
    },

    /**
     * Quick border shortcuts για common patterns
     */
    quick: QUICK_BORDERS,

    // ========================================================================
    // 🎯 DIRECTIONAL BORDERS - 100% Centralization Support
    // ========================================================================

    /**
     * Get directional border class with status
     * @param status - The semantic status
     * @param direction - Border direction (top, bottom, left, right)
     */
    getDirectionalBorder: (
      status: BorderStatus,
      direction: BorderDirection
    ): string => directionalBorder(status, [direction]),

    /**
     * Get multiple directional borders with status
     * @param status - The semantic status
     * @param directions - Array of directions to apply border
     */
    getMultiDirectionalBorder: (
      status: BorderStatus,
      directions: BorderDirection[]
    ): string => directionalBorder(status, directions),

    /**
     * Combine centralized border with directional borders (replaces mixed patterns)
     * @param status - The semantic status
     * @param additionalDirections - Additional directional borders
     */
    getCombinedBorder: (
      status: BorderStatus,
      additionalDirections?: BorderDirection[]
    ): string => {
      const baseBorder = STATUS_BASE_BORDER[status];

      if (!additionalDirections || additionalDirections.length === 0) {
        return baseBorder;
      }

      return `${baseBorder} ${directionalBorder(status, additionalDirections)}`;
    },

    /**
     * Get focus border classes for interactive elements
     * @param element - The element type ('input', 'button', 'card', 'select')
     * @returns Focus border classes
     */
    getFocusBorder: (element: 'input' | 'button' | 'card' | 'select'): string => {
      switch (element) {
        case 'input':
          return 'focus:border-2 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20';
        case 'button':
          return 'focus:ring-2 focus:ring-primary focus:ring-opacity-30';
        case 'select':
          return 'focus:border-2 focus:border-primary focus:ring-1 focus:ring-primary';
        case 'card':
          return 'focus:border-primary focus:ring-1 focus:ring-primary focus:ring-opacity-20';
        default:
          return 'focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20';
      }
    }
  };
}

/**
 * 🎨 TYPE EXPORTS
 * Re-export types for external usage
 */
export type BorderWidth = keyof typeof borderWidth;
export type BorderColor = keyof typeof borderColors;
export type BorderRadius = keyof typeof coreBorderRadius;
export type BorderStyle = keyof typeof borderStyle;
export type BorderVariant = keyof typeof borderVariants;

/**
 * 🏢 ENTERPRISE INTEGRATION
 * Default export for easy consumption
 */
export default useBorderTokens;

/**
 * 🎯 STATIC BORDER TOKENS
 * For use in utility functions and non-React contexts
 *
 * ⚠️ Note: Prefer useBorderTokens() hook in React components
 * This static export is for utility functions that need border tokens
 * but cannot use React hooks
 */
export const borderTokens = {
  quick: QUICK_BORDERS
} as const;