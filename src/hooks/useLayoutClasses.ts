/**
 * ============================================================================
 * 🏗️ ENTERPRISE LAYOUT CLASSES HOOK - PROFESSIONAL INTEGRATION
 * ============================================================================
 *
 * ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΛΥΣΗ ΓΙΑ ΔΙΑΣΠΑΡΤΑ LAYOUT PATTERNS
 *
 * Features:
 * - Type-safe access σε centralized layout classes
 * - Tailwind-compatible για εύκολη migration
 * - Performance optimized με useMemo
 * - Consistent API για όλα τα components
 * - Zero hardcoded className values
 * - Enterprise-grade patterns
 *
 * Usage Example:
 * ```tsx
 * function ContactDetails() {
 *   const layout = useLayoutClasses();
 *
 *   return (
 *     <div className={layout.flexCenterGap2}>     // "flex items-center gap-2"
 *     <div className={layout.flexGap2}>          // "flex gap-2"
 *     <div className={layout.gridCols2Gap4}>     // "grid grid-cols-2 gap-4"
 *   );
 * }
 * ```
 *
 * ΚΛΕΙΔΙ: Αντικαθιστά τα διάσπαρτα patterns από το local_todo.txt
 *
 * ============================================================================
 */

import { useMemo } from 'react';

// ============================================================================
// 🎯 HOOK INTERFACE - TYPE-SAFE RETURNS
// ============================================================================

/**
 * Return type για useLayoutClasses hook - Full type safety
 */
export interface UseLayoutClassesReturn {
  // 🔄 FLEX PATTERNS - Συχνά χρησιμοποιούμενα
  /** "flex items-center gap-2" - Πιο συχνό pattern */
  readonly flexCenterGap2: string;
  /** "flex items-center gap-1" */
  readonly flexCenterGap1: string;
  /** "flex items-center gap-4" */
  readonly flexCenterGap4: string;
  /** "flex items-center justify-between" */
  readonly flexCenterBetween: string;
  /** "flex gap-2" */
  readonly flexGap2: string;
  /** "flex gap-1" */
  readonly flexGap1: string;
  /** "flex gap-4" */
  readonly flexGap4: string;
  /** "flex gap-2 mt-2" */
  readonly flexGap2Mt2: string;

  // 📐 GRID PATTERNS
  /** "grid grid-cols-2 gap-4" */
  readonly gridCols2Gap4: string;
  /** "grid grid-cols-3 gap-4" */
  readonly gridCols3Gap4: string;
  /** "grid grid-cols-1 gap-2" */
  readonly gridCols1Gap2: string;

  // 🎯 CARD PATTERNS
  /** "flex-1 flex flex-col min-w-0" */
  readonly cardFlexCol: string;

  // 📱 RESPONSIVE PATTERNS
  /** "flex flex-col md:flex-row gap-2" */
  readonly responsiveFlexRow: string;
  /** "flex flex-col gap-2" */
  readonly flexColGap2: string;
  /** "flex flex-col gap-4" */
  readonly flexColGap4: string;

  // ==========================================================================
  // 📝 FORM PATTERNS - Input icons, widths, alignment
  // ==========================================================================

  /** Container for input with icon - "relative" */
  readonly inputContainer: string;
  /** Left icon positioning - "absolute left-3 top-1/2 -translate-y-1/2" */
  readonly inputIconLeft: string;
  /** Right icon positioning - "absolute right-3 top-1/2 -translate-y-1/2" */
  readonly inputIconRight: string;
  /** Input padding for left icon - "pl-12" (48px) */
  readonly inputPaddingLeft: string;
  /** Input padding for right icon - "pr-12" (48px) */
  readonly inputPaddingRight: string;
  /** Input padding for both icons - "pl-12 pr-12" */
  readonly inputPaddingBoth: string;
  /** Spacing for button icon - "mr-2" */
  readonly buttonIconSpacing: string;

  // ==========================================================================
  // 📐 WIDTH PATTERNS - Centralized width tokens
  // ==========================================================================

  /** Auth card width - "w-full max-w-md mx-auto" */
  readonly cardAuthWidth: string;
  /** Small card width - "w-full max-w-sm mx-auto" */
  readonly cardSmWidth: string;
  /** Large card width - "w-full max-w-lg mx-auto" */
  readonly cardLgWidth: string;
  /** Extra large card width - "w-full max-w-xl mx-auto" */
  readonly cardXlWidth: string;
  /** Full width - "w-full" */
  readonly widthFull: string;

  // ==========================================================================
  // 🎯 TEXT ALIGNMENT PATTERNS
  // ==========================================================================

  /** Center text - "text-center" */
  readonly textCenter: string;
  /** Left text - "text-left" */
  readonly textLeft: string;
  /** Right text - "text-right" */
  readonly textRight: string;

  // ==========================================================================
  // 🏢 SHELL PATTERNS - App layout containers
  // ==========================================================================

  /** Auth standalone layout - "min-h-screen w-full flex items-center justify-center" */
  readonly shellAuthStandalone: string;
  /** Auth page wrapper with relative positioning - "relative min-h-screen w-full" */
  readonly authPageWrapper: string;
  /** Auth toolbar at top-right - "fixed top-4 right-4 flex items-center gap-2 z-50" */
  readonly authToolbar: string;
  /** App shell container - "flex h-screen w-full max-w-full overflow-hidden" */
  readonly shellAppContainer: string;
  /** App content area - "flex flex-1 flex-col w-full max-w-full overflow-hidden" */
  readonly shellAppContent: string;

  // ==========================================================================
  // 🎯 CENTERING PATTERNS
  // ==========================================================================

  /** Center element horizontally - "mx-auto" */
  readonly centerHorizontal: string;
  /** Center element vertically - "my-auto" */
  readonly centerVertical: string;
  /** Center element both ways - "m-auto" */
  readonly centerBoth: string;

  // 🔧 UTILITY METHODS
  readonly getFlexGap: (gap: '1' | '2' | '4' | '8') => string;
  readonly getFlexCenter: (gap?: '1' | '2' | '4') => string;
  readonly getGridCols: (cols: 1 | 2 | 3 | 4, gap?: '2' | '4' | '6') => string;
}

// ============================================================================
// 🪝 MAIN HOOK - ENTERPRISE LAYOUT CLASSES ACCESS
// ============================================================================

/**
 * Enterprise Layout Classes Hook
 *
 * Παρέχει type-safe access στα centralized layout classes
 * για αντικατάσταση όλων των διάσπαρτων patterns
 *
 * @returns {UseLayoutClassesReturn} All layout classes με utility methods
 */
export function useLayoutClasses(): UseLayoutClassesReturn {

  // ============================================================================
  // 🚀 MEMOIZED LAYOUT CLASSES - PERFORMANCE OPTIMIZED
  // ============================================================================

  return useMemo(() => ({
    // 🔄 FLEX PATTERNS - Αντικαθιστά το 80% των διάσπαρτων patterns
    flexCenterGap2: "flex items-center gap-2",         // Πιο συχνό (8+ φορές)
    flexCenterGap1: "flex items-center gap-1",         // Μικρό gap
    flexCenterGap4: "flex items-center gap-4",         // Μεγάλο gap
    flexCenterBetween: "flex items-center justify-between", // Space between
    flexGap2: "flex gap-2",                            // Απλό flex
    flexGap1: "flex gap-1",                            // Μικρό gap
    flexGap4: "flex gap-4",                            // Μεγάλο gap
    flexGap2Mt2: "flex gap-2 mt-2",                    // Με margin-top

    // 📐 GRID PATTERNS - Αντικαθιστά grid διπλότυπα
    gridCols2Gap4: "grid grid-cols-2 gap-4",           // Property files pattern
    gridCols3Gap4: "grid grid-cols-3 gap-4",           // Extended pattern
    gridCols1Gap2: "grid grid-cols-1 gap-2",           // Mobile pattern

    // 🎯 CARD PATTERNS - Αντικαθιστά Card layout διπλότυπα
    cardFlexCol: "flex-1 flex flex-col min-w-0",       // Card pattern (3+ φορές)

    // 📱 RESPONSIVE PATTERNS - Mobile/Desktop layouts
    responsiveFlexRow: "flex flex-col md:flex-row gap-2", // Responsive
    flexColGap2: "flex flex-col gap-2",                // Column με gap
    flexColGap4: "flex flex-col gap-4",                // Column με μεγάλο gap

    // ========================================================================
    // 📝 FORM PATTERNS - Input icons, widths, alignment
    // ========================================================================

    inputContainer: "relative",                        // Container for input with icon
    inputIconLeft: "absolute left-3 top-1/2 -translate-y-1/2", // Left icon positioning
    inputIconRight: "absolute right-3 top-1/2 -translate-y-1/2", // Right icon positioning
    inputPaddingLeft: "pl-10",                         // Input padding for left icon (40px) - DEPRECATED: Use Input hasLeftIcon prop
    inputPaddingRight: "pr-10",                        // Input padding for right icon (40px) - DEPRECATED: Use Input hasRightIcon prop
    inputPaddingBoth: "pl-10 pr-10",                   // Input padding for both icons - DEPRECATED: Use Input hasLeftIcon + hasRightIcon props
    buttonIconSpacing: "mr-2",                         // Spacing for button icon

    // ========================================================================
    // 📐 WIDTH PATTERNS - Centralized width tokens
    // ========================================================================

    cardAuthWidth: "w-full max-w-md mx-auto",          // Auth card width (standard forms)
    cardSmWidth: "w-full max-w-sm mx-auto",            // Small card width
    cardLgWidth: "w-full max-w-lg mx-auto",            // Large card width
    cardXlWidth: "w-full max-w-xl mx-auto",            // Extra large card width
    widthFull: "w-full",                               // Full width

    // ========================================================================
    // 🎯 TEXT ALIGNMENT PATTERNS
    // ========================================================================

    textCenter: "text-center",                         // Center text
    textLeft: "text-left",                             // Left text
    textRight: "text-right",                           // Right text

    // ========================================================================
    // 🏢 SHELL PATTERNS - App layout containers
    // ========================================================================

    shellAuthStandalone: "min-h-screen w-full flex items-center justify-center", // Auth pages
    authPageWrapper: "relative min-h-screen w-full",         // Auth wrapper with relative pos
    authToolbar: "fixed top-4 right-4 flex items-center gap-2 z-50", // Auth toolbar top-right
    shellAppContainer: "flex h-screen w-full max-w-full overflow-hidden", // App container
    shellAppContent: "flex flex-1 flex-col w-full max-w-full overflow-hidden", // Content area

    // ========================================================================
    // 🎯 CENTERING PATTERNS
    // ========================================================================

    centerHorizontal: "mx-auto",                       // Center horizontally
    centerVertical: "my-auto",                         // Center vertically
    centerBoth: "m-auto",                              // Center both ways

    // 🔧 UTILITY METHODS - Type-safe dynamic access
    getFlexGap: (gap) => `flex gap-${gap}`,
    getFlexCenter: (gap) => gap ? `flex items-center gap-${gap}` : "flex items-center",
    getGridCols: (cols, gap = '4') => `grid grid-cols-${cols} gap-${gap}`,

  } as const), []); // Empty dependency - classes είναι σταθερές
}

// ============================================================================
// 🎯 SPECIALIZED HOOKS - COMMON USE CASES
// ============================================================================

/**
 * Hook για flex center pattern (flexCenterGap2) - Lightweight
 * Χρήση: Όταν χρειάζεσαι μόνο το πιο συνηθισμένο flex pattern
 */
export function useFlexCenter() {
  const layout = useLayoutClasses();

  return useMemo(() => layout.flexCenterGap2, [layout.flexCenterGap2]);
}

/**
 * Hook για card layout patterns - Lightweight
 * Χρήση: Για Card components σε Details containers
 */
export function useCardLayouts() {
  const layout = useLayoutClasses();

  return useMemo(() => ({
    card: layout.cardFlexCol,           // Main card structure
    content: layout.flexColGap2,        // Card content spacing
    actions: layout.flexCenterGap2,     // Card actions row
  }), [layout.cardFlexCol, layout.flexColGap2, layout.flexCenterGap2]);
}

/**
 * Hook για responsive patterns - Lightweight
 * Χρήση: Mobile/Desktop responsive layouts
 */
export function useResponsiveLayouts() {
  const layout = useLayoutClasses();

  return useMemo(() => ({
    responsiveRow: layout.responsiveFlexRow,    // Mobile column, Desktop row
    mobileStack: layout.flexColGap2,            // Mobile stacked content
    centerRow: layout.flexCenterGap2,           // Centered horizontal row
    spaceBetween: layout.flexCenterBetween,     // Space between items
  }), [
    layout.responsiveFlexRow,
    layout.flexColGap2,
    layout.flexCenterGap2,
    layout.flexCenterBetween
  ]);
}

// ============================================================================
// 🔗 CONVENIENCE EXPORTS - EASY IMPORTS
// ============================================================================

/**
 * Default export για main hook
 */
export default useLayoutClasses;

/**
 * Quick access pattern
 */
export {
  useLayoutClasses as useLayouts,
  useFlexCenter as useFlexCenterPattern,
  useCardLayouts as useCardPatterns,
  useResponsiveLayouts as useResponsivePatterns,
};