/**
 * ============================================================================
 * 🎯 ENTERPRISE ICON SIZES HOOK - PROFESSIONAL INTEGRATION
 * ============================================================================
 *
 * ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΧΡΗΣΗ ΤΟΥ EXISTING DESIGN TOKENS SYSTEM
 *
 * Features:
 * - Type-safe access σε centralized icon sizes
 * - Performance optimized με useMemo
 * - Consistent API για όλα τα components
 * - Zero hardcoded values - 100% centralized
 * - Enterprise-grade patterns
 *
 * Usage Example:
 * ```tsx
 * function ContactDetails() {
 *   const iconSizes = useIconSizes();
 *
 *   return (
 *     <Edit className={iconSizes.sm} />  // h-4 w-4
 *     <Check className={iconSizes.md} /> // h-5 w-5
 *   );
 * }
 * ```
 *
 * ============================================================================
 */

import { useMemo } from 'react';
import { componentSizes } from '@/styles/design-tokens';

// ============================================================================
// 🎯 HOOK INTERFACE - TYPE-SAFE RETURNS
// ============================================================================

/**
 * Return type για useIconSizes hook - ENTERPRISE TYPE SAFETY
 */
export interface UseIconSizesReturn {
  // ============================================================================
  // 🎯 CORE ICON SIZES - EXISTING (BACKWARD COMPATIBLE)
  // ============================================================================
  /** Extra extra small icons: h-2 w-2 (8px) */
  readonly xxs: string;
  /** Extra small icons: h-3 w-3 (12px) */
  readonly xs: string;
  /** Small icons: h-4 w-4 (16px) - Most common */
  readonly sm: string;
  /** Medium icons: h-5 w-5 (20px) */
  readonly md: string;
  /** Large icons: h-6 w-6 (24px) */
  readonly lg: string;
  /** Extra large icons: h-8 w-8 (32px) */
  readonly xl: string;
  /** 2X large icons: h-10 w-10 (40px) */
  readonly '2xl': string;

  // ============================================================================
  // 🚀 ENTERPRISE EXTENDED SIZES - PROFESSIONAL GRADE
  // ============================================================================
  /** XL2 icons: h-12 w-12 (48px) - Card headers, feature icons */
  readonly xl2: string;
  /** XL3 icons: h-14 w-14 (56px) - Section icons, user avatars */
  readonly xl3: string;
  /** XL4 icons: h-16 w-16 (64px) - Hero icons, prominent displays */
  readonly xl4: string;
  /** XL5 icons: h-20 w-20 (80px) - Large feature displays */
  readonly xl5: string;
  /** XL6 icons: h-24 w-24 (96px) - Loading spinners, thumbnails */
  readonly xl6: string;
  /** XL8 icons: h-32 w-32 (128px) - Large avatars, placeholders */
  readonly xl8: string;
  /** XL12 icons: h-48 w-48 (192px) - Empty states, splash screens */
  readonly xl12: string;

  // 🔧 Utility method για dynamic access - ENTERPRISE EXTENDED
  readonly getSize: (size: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'xl2' | 'xl3' | 'xl4' | 'xl5' | 'xl6' | 'xl8' | 'xl12') => string;

  // ============================================================================
  // 🏢 NUMERIC SIZES - FOR LUCIDE-REACT & SVG ICONS (size prop)
  // ============================================================================
  /** Numeric pixel values for lucide-react and other SVG libraries */
  readonly numeric: {
    readonly xxs: number;
    readonly xs: number;
    readonly sm: number;
    readonly md: number;
    readonly lg: number;
    readonly xl: number;
    readonly '2xl': number;
    readonly xl2: number;
    readonly xl3: number;
    readonly xl4: number;
    readonly xl5: number;
    readonly xl6: number;
  };
}

// ============================================================================
// 🪝 MAIN HOOK - ENTERPRISE ICON SIZES ACCESS
// ============================================================================

/**
 * Enterprise Icon Sizes Hook
 *
 * Παρέχει type-safe access στα centralized icon sizes
 * με optimized performance και consistent API
 *
 * @returns {UseIconSizesReturn} All icon sizes με utility methods
 */
export function useIconSizes(): UseIconSizesReturn {

  // ============================================================================
  // 🚀 MEMOIZED ICON SIZES - PERFORMANCE OPTIMIZED
  // ============================================================================

  return useMemo(() => {
    const iconSizes = componentSizes.icon;

    return {
      // ============================================================================
      // 📐 CORE ICON SIZES - EXISTING (BACKWARD COMPATIBLE)
      // ============================================================================
      xxs: iconSizes.xxs,        // h-2 w-2 - Extra extra small
      xs: iconSizes.xs,          // h-3 w-3
      sm: iconSizes.sm,          // h-4 w-4 - Most common
      md: iconSizes.md,          // h-5 w-5
      lg: iconSizes.lg,          // h-6 w-6
      xl: iconSizes.xl,          // h-8 w-8
      '2xl': iconSizes['2xl'],   // h-10 w-10

      // ============================================================================
      // 🚀 ENTERPRISE EXTENDED SIZES - PROFESSIONAL GRADE
      // ============================================================================
      xl2: iconSizes.xl2,        // h-12 w-12 - Card headers, feature icons
      xl3: iconSizes.xl3,        // h-14 w-14 - Section icons, user avatars
      xl4: iconSizes.xl4,        // h-16 w-16 - Hero icons, prominent displays
      xl5: iconSizes.xl5,        // h-20 w-20 - Large feature displays
      xl6: iconSizes.xl6,        // h-24 w-24 - Loading spinners, thumbnails
      xl8: iconSizes.xl8,        // h-32 w-32 - Large avatars, placeholders
      xl12: iconSizes.xl12,      // h-48 w-48 - Empty states, splash screens

      // 🔧 Utility Method - ENTERPRISE EXTENDED TYPE-SAFE ACCESS
      getSize: (size) => {
        return iconSizes[size];
      },

      // ============================================================================
      // 🏢 NUMERIC SIZES - FOR LUCIDE-REACT & SVG ICONS
      // ============================================================================
      numeric: iconSizes.numeric,

    } as const;
  }, []); // Empty dependency - componentSizes είναι σταθερό
}

// ============================================================================
// 🎯 SPECIALIZED HOOKS - COMMON USE CASES
// ============================================================================

