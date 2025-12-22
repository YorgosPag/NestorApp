/**
 * ============================================================================
 * ✍️ ENTERPRISE TYPOGRAPHY HOOK - PROFESSIONAL INTEGRATION
 * ============================================================================
 *
 * ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΛΥΣΗ ΓΙΑ ΔΙΑΣΠΑΡΤΑ TYPOGRAPHY PATTERNS
 *
 * Features:
 * - Type-safe access σε centralized typography classes
 * - Tailwind-compatible για εύκολη migration
 * - Performance optimized με useMemo
 * - Consistent API για όλα τα components
 * - Zero hardcoded typography values
 * - Enterprise-grade patterns
 *
 * Usage Example:
 * ```tsx
 * function ContactDetails() {
 *   const typography = useTypography();
 *
 *   return (
 *     <h2 className={typography.heading.lg}>      // "text-lg font-semibold"
 *     <p className={typography.body.sm}>          // "text-sm"
 *     <span className={typography.label.xs}>     // "text-xs font-medium"
 *   );
 * }
 * ```
 *
 * ΚΛΕΙΔΙ: Αντικαθιστά τα διάσπαρτα typography patterns από το local_todo.txt
 *
 * ============================================================================
 */

import { useMemo } from 'react';

// ============================================================================
// 🎯 HOOK INTERFACE - TYPE-SAFE RETURNS
// ============================================================================

/**
 * Return type για useTypography hook - Full type safety
 */
export interface UseTypographyReturn {
  // 📝 HEADING PATTERNS - Σύστημα τίτλων
  readonly heading: {
    /** "text-xl font-semibold" - Main headings */
    readonly lg: string;
    /** "text-lg font-semibold" - Section headings */
    readonly md: string;
    /** "text-sm font-semibold" - Subsection headings */
    readonly sm: string;
    /** "text-xs font-semibold" - Small headings */
    readonly xs: string;
  };

  // 📖 BODY TEXT PATTERNS - Κύριο κείμενο
  readonly body: {
    /** "text-base" - Default body text */
    readonly base: string;
    /** "text-sm" - Smaller body text (πιο συχνό) */
    readonly sm: string;
    /** "text-xs" - Small body text */
    readonly xs: string;
  };

  // 🏷️ LABEL PATTERNS - Labels και metadata
  readonly label: {
    /** "text-sm font-medium" - Form labels */
    readonly sm: string;
    /** "text-xs font-medium" - Small labels */
    readonly xs: string;
    /** "text-xs" - Simple labels */
    readonly simple: string;
  };

  // 💰 SPECIAL PURPOSE PATTERNS
  readonly special: {
    /** "text-xl font-semibold text-foreground" - Main container titles */
    readonly containerTitle: string;
    /** "text-sm font-medium truncate flex-1" - Mobile titles */
    readonly mobileTitle: string;
    /** "font-mono text-xs" - Code/ID display */
    readonly codeId: string;
    /** "font-medium text-green-600" - Price display */
    readonly price: string;
    /** "text-sm text-muted-foreground" - Secondary info */
    readonly secondary: string;
    /** "text-xs text-muted-foreground" - Tertiary info */
    readonly tertiary: string;
  };

  // 🔧 UTILITY METHODS
  readonly getHeading: (size: 'lg' | 'md' | 'sm' | 'xs') => string;
  readonly getBody: (size: 'base' | 'sm' | 'xs') => string;
  readonly getLabel: (size: 'sm' | 'xs', style?: 'medium' | 'simple') => string;
}

// ============================================================================
// 🪝 MAIN HOOK - ENTERPRISE TYPOGRAPHY CLASSES ACCESS
// ============================================================================

/**
 * Enterprise Typography Hook
 *
 * Παρέχει type-safe access στα centralized typography classes
 * για αντικατάσταση όλων των διάσπαρτων patterns
 *
 * @returns {UseTypographyReturn} All typography classes με utility methods
 */
export function useTypography(): UseTypographyReturn {

  // ============================================================================
  // 🚀 MEMOIZED TYPOGRAPHY CLASSES - PERFORMANCE OPTIMIZED
  // ============================================================================

  return useMemo(() => ({
    // 📝 HEADING PATTERNS - Αντικαθιστά heading διπλότυπα
    heading: {
      lg: "text-xl font-semibold",          // Container titles (h2)
      md: "text-lg font-semibold",          // Section headings (h3)
      sm: "text-sm font-semibold",          // Subsection headings (h4)
      xs: "text-xs font-semibold",          // Small headings (h5)
    },

    // 📖 BODY TEXT PATTERNS - Αντικαθιστά body διπλότυπα
    body: {
      base: "text-base",                    // Default body (16px)
      sm: "text-sm",                        // Small body (14px) - πιο συχνό
      xs: "text-xs",                        // Extra small (12px)
    },

    // 🏷️ LABEL PATTERNS - Αντικαθιστά label διπλότυπα
    label: {
      sm: "text-sm font-medium",            // Form labels
      xs: "text-xs font-medium",            // Small labels
      simple: "text-xs",                    // Simple labels χωρίς font-medium
    },

    // 💰 SPECIAL PURPOSE PATTERNS - Specific use cases
    special: {
      containerTitle: "text-xl font-semibold text-foreground", // DetailsContainer titles
      mobileTitle: "text-sm font-medium truncate flex-1",     // MobileDetailsSlideIn
      codeId: "font-mono text-xs",                           // Version IDs, codes
      price: "font-medium text-green-600",                   // Price displays
      secondary: "text-sm text-muted-foreground",            // Secondary information
      tertiary: "text-xs text-muted-foreground",             // Tertiary information
    },

    // 🔧 UTILITY METHODS - Type-safe dynamic access
    getHeading: (size) => {
      const headingMap = {
        lg: "text-xl font-semibold",
        md: "text-lg font-semibold",
        sm: "text-sm font-semibold",
        xs: "text-xs font-semibold",
      };
      return headingMap[size];
    },

    getBody: (size) => {
      const bodyMap = {
        base: "text-base",
        sm: "text-sm",
        xs: "text-xs",
      };
      return bodyMap[size];
    },

    getLabel: (size, style = 'medium') => {
      if (style === 'simple') return `text-${size}`;
      return `text-${size} font-medium`;
    },

  } as const), []); // Empty dependency - classes είναι σταθερές
}

// ============================================================================
// 🎯 SPECIALIZED HOOKS - COMMON USE CASES
// ============================================================================

/**
 * Hook για heading patterns - Lightweight
 * Χρήση: Όταν χρειάζεσαι μόνο headings
 */
export function useHeadings() {
  const typography = useTypography();

  return useMemo(() => typography.heading, [typography.heading]);
}

/**
 * Hook για body text patterns - Lightweight
 * Χρήση: Όταν χρειάζεσαι μόνο body text
 */
export function useBodyText() {
  const typography = useTypography();

  return useMemo(() => typography.body, [typography.body]);
}

/**
 * Hook για label patterns - Lightweight
 * Χρήση: Για form labels και metadata
 */
export function useLabels() {
  const typography = useTypography();

  return useMemo(() => typography.label, [typography.label]);
}

/**
 * Hook για special purpose typography - Lightweight
 * Χρήση: Για specific use cases (prices, codes, κτλ.)
 */
export function useSpecialTypography() {
  const typography = useTypography();

  return useMemo(() => typography.special, [typography.special]);
}

// ============================================================================
// 🔗 CONVENIENCE EXPORTS - EASY IMPORTS
// ============================================================================

/**
 * Default export για main hook
 */
export default useTypography;

/**
 * Quick access pattern
 */
export {
  useTypography as useText,
  useHeadings as useHeadingStyles,
  useBodyText as useBodyStyles,
  useLabels as useLabelStyles,
  useSpecialTypography as useSpecialText,
};