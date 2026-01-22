import { useMemo } from 'react';

/**
 * 🏢 ENTERPRISE: Positioning Tokens Hook
 *
 * Centralized positioning tokens for absolute/relative/fixed positioning.
 * Separates POSITIONING (coordinate placement) from SPACING (whitespace).
 *
 * @enterprise Part of the centralized design system
 * @pattern Follows useSpacingTokens.ts pattern
 * @author Enterprise Architecture Team
 * @see src/hooks/useSpacingTokens.ts (spacing tokens)
 * @created 2026-01-22
 *
 * @example
 * ```tsx
 * const positioning = usePositioningTokens();
 *
 * return (
 *   <div className={`absolute ${positioning.top.sm} ${positioning.right.sm}`}>
 *     Positioned element (top: 8px, right: 8px)
 *   </div>
 * );
 * ```
 *
 * ============================================================================
 * 🎯 ARCHITECTURE DECISION
 * ============================================================================
 *
 * Positioning ≠ Spacing:
 * - POSITIONING: Controls coordinate placement (top, right, bottom, left)
 * - SPACING: Controls whitespace (padding, margin, gap)
 *
 * This separation follows enterprise design systems:
 * - SAP Fiori Design Guidelines
 * - Microsoft Fluent UI
 * - Autodesk Design System
 * - Google Material Design
 *
 * ============================================================================
 */

/**
 * Positioning tokens interface
 */
export interface PositioningTokens {
  /** Top positioning utilities */
  top: {
    none: string;   // top-0 (0px)
    xs: string;     // top-1 (4px)
    sm: string;     // top-2 (8px)
    md: string;     // top-4 (16px)
    lg: string;     // top-6 (24px)
    xl: string;     // top-8 (32px)
    '2xl': string;  // top-12 (48px)
    full: string;   // top-full (100%)
    half: string;   // top-1/2 (50%)
  };

  /** Right positioning utilities */
  right: {
    none: string;   // right-0 (0px)
    xs: string;     // right-1 (4px)
    sm: string;     // right-2 (8px)
    md: string;     // right-4 (16px)
    lg: string;     // right-6 (24px)
    xl: string;     // right-8 (32px)
    '2xl': string;  // right-12 (48px)
    full: string;   // right-full (100%)
    half: string;   // right-1/2 (50%)
  };

  /** Bottom positioning utilities */
  bottom: {
    none: string;   // bottom-0 (0px)
    xs: string;     // bottom-1 (4px)
    sm: string;     // bottom-2 (8px)
    md: string;     // bottom-4 (16px)
    lg: string;     // bottom-6 (24px)
    xl: string;     // bottom-8 (32px)
    '2xl': string;  // bottom-12 (48px)
    full: string;   // bottom-full (100%)
    half: string;   // bottom-1/2 (50%)
  };

  /** Left positioning utilities */
  left: {
    none: string;   // left-0 (0px)
    xs: string;     // left-1 (4px)
    sm: string;     // left-2 (8px)
    md: string;     // left-4 (16px)
    lg: string;     // left-6 (24px)
    xl: string;     // left-8 (32px)
    '2xl': string;  // left-12 (48px)
    full: string;   // left-full (100%)
    half: string;   // left-1/2 (50%)
  };

  /** Inset utilities (all sides) */
  inset: {
    none: string;   // inset-0 (0px all sides)
    xs: string;     // inset-1 (4px all sides)
    sm: string;     // inset-2 (8px all sides)
    md: string;     // inset-4 (16px all sides)
    lg: string;     // inset-6 (24px all sides)
    xl: string;     // inset-8 (32px all sides)
    '2xl': string;  // inset-12 (48px all sides)
    full: string;   // inset-full (100% all sides)
    half: string;   // inset-1/2 (50% all sides)
  };

  /** Inset-x utilities (left and right) */
  insetX: {
    none: string;   // inset-x-0 (0px left+right)
    xs: string;     // inset-x-1 (4px left+right)
    sm: string;     // inset-x-2 (8px left+right)
    md: string;     // inset-x-4 (16px left+right)
    lg: string;     // inset-x-6 (24px left+right)
    xl: string;     // inset-x-8 (32px left+right)
    '2xl': string;  // inset-x-12 (48px left+right)
  };

  /** Inset-y utilities (top and bottom) */
  insetY: {
    none: string;   // inset-y-0 (0px top+bottom)
    xs: string;     // inset-y-1 (4px top+bottom)
    sm: string;     // inset-y-2 (8px top+bottom)
    md: string;     // inset-y-4 (16px top+bottom)
    lg: string;     // inset-y-6 (24px top+bottom)
    xl: string;     // inset-y-8 (32px top+bottom)
    '2xl': string;  // inset-y-12 (48px top+bottom)
  };
}

/**
 * Hook that provides centralized positioning tokens
 *
 * @returns Positioning tokens object with semantic naming
 *
 * @enterprise Zero hardcoded positioning values - all centralized
 */
export function usePositioningTokens(): PositioningTokens {
  return useMemo<PositioningTokens>(() => ({
    // Top positioning
    top: {
      none: 'top-0',
      xs: 'top-1',
      sm: 'top-2',
      md: 'top-4',
      lg: 'top-6',
      xl: 'top-8',
      '2xl': 'top-12',
      full: 'top-full',
      half: 'top-1/2',
    },

    // Right positioning
    right: {
      none: 'right-0',
      xs: 'right-1',
      sm: 'right-2',
      md: 'right-4',
      lg: 'right-6',
      xl: 'right-8',
      '2xl': 'right-12',
      full: 'right-full',
      half: 'right-1/2',
    },

    // Bottom positioning
    bottom: {
      none: 'bottom-0',
      xs: 'bottom-1',
      sm: 'bottom-2',
      md: 'bottom-4',
      lg: 'bottom-6',
      xl: 'bottom-8',
      '2xl': 'bottom-12',
      full: 'bottom-full',
      half: 'bottom-1/2',
    },

    // Left positioning
    left: {
      none: 'left-0',
      xs: 'left-1',
      sm: 'left-2',
      md: 'left-4',
      lg: 'left-6',
      xl: 'left-8',
      '2xl': 'left-12',
      full: 'left-full',
      half: 'left-1/2',
    },

    // Inset (all sides)
    inset: {
      none: 'inset-0',
      xs: 'inset-1',
      sm: 'inset-2',
      md: 'inset-4',
      lg: 'inset-6',
      xl: 'inset-8',
      '2xl': 'inset-12',
      full: 'inset-full',
      half: 'inset-1/2',
    },

    // Inset-x (left and right)
    insetX: {
      none: 'inset-x-0',
      xs: 'inset-x-1',
      sm: 'inset-x-2',
      md: 'inset-x-4',
      lg: 'inset-x-6',
      xl: 'inset-x-8',
      '2xl': 'inset-x-12',
    },

    // Inset-y (top and bottom)
    insetY: {
      none: 'inset-y-0',
      xs: 'inset-y-1',
      sm: 'inset-y-2',
      md: 'inset-y-4',
      lg: 'inset-y-6',
      xl: 'inset-y-8',
      '2xl': 'inset-y-12',
    },
  }), []); // No dependencies - tokens are static
}

/**
 * 🏢 ENTERPRISE: Default export for convenience
 */
export default usePositioningTokens;
