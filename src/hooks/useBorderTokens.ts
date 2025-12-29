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
  borders,
  borderWidth,
  borderColors,
  coreBorderRadius,
  borderStyle,
  borderVariants,
  borderUtils,
  responsiveBorders
} from '@/styles/design-tokens';

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
      if (element === 'input' && typeof borderVariants.input === 'object' && state in borderVariants.input) {
        return borderVariants.input[state as keyof typeof borderVariants.input].className;
      }

      if (element === 'button' && typeof borderVariants.button === 'object' && state in borderVariants.button) {
        return borderVariants.button[state as keyof typeof borderVariants.button].className;
      }

      // Handle interactive states
      if (state === 'hover' && borderVariants.interactive.hover) {
        return borderVariants.interactive.hover.className;
      }

      if (state === 'focus' && borderVariants.interactive.focus) {
        return borderVariants.interactive.focus.className;
      }

      if (state === 'selected' && borderVariants.interactive.selected) {
        return borderVariants.interactive.selected.className;
      }

      // Fallback to element default
      const variant = borderVariants[element];
      if (variant && 'className' in variant) {
        return variant.className;
      }

      return borderVariants.card.className; // Safe fallback
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

      return borderVariants.status[status]?.className || `border-[${borderWidth.default}] border-[${borderColors.default.light}]`;
    },

    /**
     * Get separator border class
     * @param direction - Horizontal or vertical separator
     */
    getSeparatorBorder: (direction: 'horizontal' | 'vertical'): string => {
      return borderVariants.separator[direction].className;
    },

    /**
     * Create responsive border classes for mobile/tablet/desktop
     * @param element - The UI element type
     */
    getResponsiveBorder: (element: 'card' | 'button' | 'input'): string => {
      const mobile = responsiveBorders.mobile[element];
      const tablet = responsiveBorders.tablet[element];
      const desktop = responsiveBorders.desktop[element];

      return `${mobile} ${tablet} ${desktop}`;
    },

    /**
     * Quick border shortcuts για common patterns
     */
    quick: {
      /** No border */
      none: 'border-0',

      /** Default card border */
      card: borderVariants.card.className,

      /** Default button border */
      button: borderVariants.button.default.className,

      /** Default input border */
      input: borderVariants.input.default.className,

      /** Modal border (typically none + shadow) */
      modal: borderVariants.modal.className,

      /** Container border (typically none) */
      container: borderVariants.container.className,

      /** Horizontal separator */
      separatorH: borderVariants.separator.horizontal.className,

      /** Vertical separator */
      separatorV: borderVariants.separator.vertical.className,

      /** Success border */
      success: borderVariants.status.success.className,

      /** Error border */
      error: borderVariants.status.error.className,

      /** Warning border */
      warning: borderVariants.status.warning.className,

      /** Info border */
      info: borderVariants.status.info.className,

      /** Muted border για DynamicInput components */
      muted: borderVariants.status.muted.className,

      /** Focus state border */
      focus: borderVariants.interactive.focus.className,

      /** Selected state border */
      selected: borderVariants.interactive.selected.className,

      /** Table border (for dropdown/table items) */
      table: borderVariants.card.className,

      /** Rounded border shortcut */
      rounded: borderVariants.card.className
    },

    // ========================================================================
    // 🎯 DIRECTIONAL BORDERS - 100% Centralization Support
    // ========================================================================

    /**
     * Get directional border class with status
     * @param status - The semantic status
     * @param direction - Border direction (top, bottom, left, right)
     */
    getDirectionalBorder: (
      status: 'default' | 'success' | 'warning' | 'error' | 'info' | 'muted' | 'subtle',
      direction: 'top' | 'bottom' | 'left' | 'right'
    ): string => {
      const colorMap = {
        default: 'gray-600',
        success: 'green-500',
        warning: 'yellow-500',
        error: 'red-500',
        info: 'blue-500',
        muted: 'gray-500',
        subtle: 'gray-400'
      };

      const directionMap = {
        top: 'border-t',
        bottom: 'border-b',
        left: 'border-l',
        right: 'border-r'
      };

      return `${directionMap[direction]} border-${colorMap[status]}`;
    },

    /**
     * Get multiple directional borders with status
     * @param status - The semantic status
     * @param directions - Array of directions to apply border
     */
    getMultiDirectionalBorder: (
      status: 'default' | 'success' | 'warning' | 'error' | 'info' | 'muted' | 'subtle',
      directions: ('top' | 'bottom' | 'left' | 'right')[]
    ): string => {
      const colorMap = {
        default: 'gray-600',
        success: 'green-500',
        warning: 'yellow-500',
        error: 'red-500',
        info: 'blue-500',
        muted: 'gray-500',
        subtle: 'gray-400'
      };

      const directionMap = {
        top: 'border-t',
        bottom: 'border-b',
        left: 'border-l',
        right: 'border-r'
      };

      const directionClasses = directions.map(dir => directionMap[dir]).join(' ');
      return `${directionClasses} border-${colorMap[status]}`;
    },

    /**
     * Combine centralized border with directional borders (replaces mixed patterns)
     * @param status - The semantic status
     * @param additionalDirections - Additional directional borders
     */
    getCombinedBorder: (
      status: 'default' | 'success' | 'warning' | 'error' | 'info' | 'muted' | 'subtle',
      additionalDirections?: ('top' | 'bottom' | 'left' | 'right')[]
    ): string => {
      // Get base border
      const statusBorderMap = {
        default: 'border border-gray-600',
        success: 'border border-green-500',
        warning: 'border border-yellow-500',
        error: 'border border-red-500',
        info: 'border border-blue-500',
        muted: 'border border-gray-500',
        subtle: 'border border-gray-400'
      };

      const baseBorder = statusBorderMap[status];

      if (!additionalDirections || additionalDirections.length === 0) {
        return baseBorder;
      }

      // Get directional borders
      const colorMap = {
        default: 'gray-600',
        success: 'green-500',
        warning: 'yellow-500',
        error: 'red-500',
        info: 'blue-500',
        muted: 'gray-500',
        subtle: 'gray-400'
      };

      const directionMap = {
        top: 'border-t',
        bottom: 'border-b',
        left: 'border-l',
        right: 'border-r'
      };

      const directionClasses = additionalDirections.map(dir => directionMap[dir]).join(' ');
      const additionalBorder = `${directionClasses} border-${colorMap[status]}`;

      return `${baseBorder} ${additionalBorder}`;
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