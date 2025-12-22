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
 * Return type για useIconSizes hook - Full type safety
 */
export interface UseIconSizesReturn {
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

  // 🔧 Utility method για dynamic access
  readonly getSize: (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl') => string;
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
      // 📐 Icon Sizes - Pre-computed για performance
      xs: iconSizes.xs,          // h-3 w-3
      sm: iconSizes.sm,          // h-4 w-4 - Most common
      md: iconSizes.md,          // h-5 w-5
      lg: iconSizes.lg,          // h-6 w-6
      xl: iconSizes.xl,          // h-8 w-8
      '2xl': iconSizes['2xl'],   // h-10 w-10

      // 🔧 Utility Method - Type-safe dynamic access
      getSize: (size) => {
        return iconSizes[size];
      },

    } as const;
  }, []); // Empty dependency - componentSizes είναι σταθερό
}

// ============================================================================
// 🎯 SPECIALIZED HOOKS - COMMON USE CASES
// ============================================================================

/**
 * Hook για standard icon size (sm = h-4 w-4) - Lightweight
 * Χρήση: Όταν χρειάζεσαι μόνο το πιο συνηθισμένο size
 */
export function useStandardIconSize() {
  const iconSizes = useIconSizes();

  return useMemo(() => iconSizes.sm, [iconSizes.sm]); // h-4 w-4
}

/**
 * Hook για button icons (sm και md) - Lightweight
 * Χρήση: Για action buttons σε Details containers
 */
export function useButtonIconSizes() {
  const iconSizes = useIconSizes();

  return useMemo(() => ({
    small: iconSizes.sm,    // h-4 w-4 - για compact buttons
    medium: iconSizes.md,   // h-5 w-5 - για standard buttons
  }), [iconSizes.sm, iconSizes.md]);
}

// ============================================================================
// 🔗 CONVENIENCE EXPORTS - EASY IMPORTS
// ============================================================================

/**
 * Default export για main hook
 */
export default useIconSizes;

/**
 * Quick access pattern
 */
export {
  useIconSizes as useIcons,
  useStandardIconSize as useStandardIcon,
  useButtonIconSizes as useButtonIcons,
};