/**
 * ============================================================================
 * 🔘 ENTERPRISE BUTTON PATTERNS HOOK - PROFESSIONAL INTEGRATION
 * ============================================================================
 *
 * ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΛΥΣΗ ΓΙΑ ΔΙΑΣΠΑΡΤΑ BUTTON PATTERNS
 *
 * Features:
 * - Type-safe access σε centralized button patterns
 * - Common button combinations (outline-sm, ghost-sm, κτλ.)
 * - Action-specific button configurations (Edit, Delete, View, Save)
 * - Icon + Button patterns για consistent UX
 * - Performance optimized με useMemo
 * - Integration με existing Button component
 * - Zero hardcoded button values
 * - Enterprise-grade patterns
 *
 * Usage Example:
 * ```tsx
 * function ContactDetails() {
 *   const buttonPatterns = useButtonPatterns();
 *
 *   return (
 *     <Button {...buttonPatterns.actions.edit}>Επεξεργασία</Button>
 *     <Button {...buttonPatterns.common.outlineSmall}>Προβολή</Button>
 *     <button className={buttonPatterns.raw.iconButton}>...</button>
 *   );
 * }
 * ```
 *
 * ΚΛΕΙΔΙ: Αντικαθιστά όλα τα διάσπαρτα button patterns από την εφαρμογή
 *
 * ============================================================================
 */

import { useMemo } from 'react';
import type { ButtonProps } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';

// ============================================================================
// 🎯 HOOK INTERFACE - TYPE-SAFE RETURNS
// ============================================================================

/**
 * Common Button variant combinations
 */
export interface CommonButtonPatterns {
  /** variant="outline" size="sm" - Most common pattern */
  readonly outlineSmall: ButtonProps;
  /** variant="ghost" size="sm" - Secondary actions */
  readonly ghostSmall: ButtonProps;
  /** variant="outline" size="default" - Standard actions */
  readonly outlineDefault: ButtonProps;
  /** variant="default" size="sm" - Primary small actions */
  readonly primarySmall: ButtonProps;
  /** variant="destructive" size="sm" - Danger actions */
  readonly dangerSmall: ButtonProps;
  /** variant="secondary" size="sm" - Alternative actions */
  readonly secondarySmall: ButtonProps;
}

/**
 * Action-specific Button configurations
 */
export interface ActionButtonPatterns {
  /** Edit button configuration */
  readonly edit: ButtonProps;
  /** Delete button configuration */
  readonly delete: ButtonProps;
  /** View/Details button configuration */
  readonly view: ButtonProps;
  /** Save button configuration */
  readonly save: ButtonProps;
  /** Cancel button configuration */
  readonly cancel: ButtonProps;
  /** Create/Add button configuration */
  readonly create: ButtonProps;
  /** Close button configuration */
  readonly close: ButtonProps;
  /** Back button configuration */
  readonly back: ButtonProps;
  /** Next button configuration */
  readonly next: ButtonProps;
  /** Finish button configuration */
  readonly finish: ButtonProps;
}

/**
 * Icon Button patterns
 */
export interface IconButtonPatterns {
  /** Small icon button (6x6) for list actions */
  readonly iconSmall: ButtonProps;
  /** Medium icon button for toolbar actions */
  readonly iconMedium: ButtonProps;
  /** Ghost icon button for subtle actions */
  readonly iconGhost: ButtonProps;
  /** Outline icon button for clear actions */
  readonly iconOutline: ButtonProps;
}

/**
 * Raw button className patterns (για <button> elements)
 */
export interface RawButtonPatterns {
  /** Basic icon button με hover effects */
  readonly iconButton: string;
  /** Tab-like button pattern */
  readonly tabButton: string;
  /** Menu item button pattern */
  readonly menuButton: string;
  /** Floating action button pattern */
  readonly floatingButton: string;
}

/**
 * Special purpose Button patterns
 */
export interface SpecialButtonPatterns {
  /** Mobile-optimized buttons */
  readonly mobile: {
    /** Full width primary button for mobile */
    readonly primary: ButtonProps;
    /** Compact action button for mobile */
    readonly compact: ButtonProps;
  };
  /** Loading state buttons */
  readonly loading: {
    /** Button με loading spinner */
    readonly withSpinner: ButtonProps;
    /** Disabled state για loading */
    readonly disabled: ButtonProps;
  };
  /** Form-specific buttons */
  readonly form: {
    /** Submit button για forms */
    readonly submit: ButtonProps;
    /** Reset button για forms */
    readonly reset: ButtonProps;
  };
}

/**
 * Return type για useButtonPatterns hook - Full type safety
 */
export interface UseButtonPatternsReturn {
  readonly common: CommonButtonPatterns;
  readonly actions: ActionButtonPatterns;
  readonly icons: IconButtonPatterns;
  readonly raw: RawButtonPatterns;
  readonly special: SpecialButtonPatterns;

  // 🔧 UTILITY METHODS
  readonly getCommon: (variant: keyof CommonButtonPatterns) => ButtonProps;
  readonly getAction: (action: keyof ActionButtonPatterns) => ButtonProps;
  readonly getIcon: (type: keyof IconButtonPatterns) => ButtonProps;
  readonly combineProps: (base: ButtonProps, override: Partial<ButtonProps>) => ButtonProps;
}

// ============================================================================
// 🪝 MAIN HOOK - ENTERPRISE BUTTON PATTERNS ACCESS
// ============================================================================

/**
 * Enterprise Button Patterns Hook
 *
 * Παρέχει type-safe access στα centralized button patterns
 * για αντικατάσταση όλων των διάσπαρτων button combinations
 *
 * @returns {UseButtonPatternsReturn} All button patterns με utility methods
 */
export function useButtonPatterns(): UseButtonPatternsReturn {
  const iconSizes = useIconSizes();

  // ============================================================================
  // 🚀 MEMOIZED BUTTON PATTERNS - PERFORMANCE OPTIMIZED
  // ============================================================================

  return useMemo(() => ({

    // 🔘 COMMON PATTERNS - Αντικαθιστά διάσπαρτα variant+size combinations
    common: {
      outlineSmall: {
        variant: 'outline' as const,
        size: 'sm' as const,
      },
      ghostSmall: {
        variant: 'ghost' as const,
        size: 'sm' as const,
      },
      outlineDefault: {
        variant: 'outline' as const,
        size: 'default' as const,
      },
      primarySmall: {
        variant: 'default' as const,
        size: 'sm' as const,
      },
      dangerSmall: {
        variant: 'destructive' as const,
        size: 'sm' as const,
      },
      secondarySmall: {
        variant: 'secondary' as const,
        size: 'sm' as const,
      },
    },

    // ⚡ ACTION PATTERNS - Semantic button configurations
    actions: {
      edit: {
        variant: 'outline' as const,
        size: 'sm' as const,
      },
      delete: {
        variant: 'destructive' as const,
        size: 'sm' as const,
      },
      view: {
        variant: 'outline' as const,
        size: 'sm' as const,
      },
      save: {
        variant: 'default' as const,
        size: 'sm' as const,
      },
      cancel: {
        variant: 'ghost' as const,
        size: 'sm' as const,
      },
      create: {
        variant: 'default' as const,
        size: 'sm' as const,
      },
      close: {
        variant: 'ghost' as const,
        size: 'sm' as const,
      },
      back: {
        variant: 'ghost' as const,
        size: 'sm' as const,
      },
      next: {
        variant: 'default' as const,
        size: 'sm' as const,
      },
      finish: {
        variant: 'default' as const,
        size: 'default' as const,
      },
    },

    // 🔘 ICON BUTTON PATTERNS - Specific icon button configurations
    icons: {
      iconSmall: {
        variant: 'ghost' as const,
        size: 'sm' as const,
        className: `${iconSizes.lg} p-0`,
      },
      iconMedium: {
        variant: 'outline' as const,
        size: 'default' as const,
        className: `${iconSizes.xl} p-0`,
      },
      iconGhost: {
        variant: 'ghost' as const,
        size: 'sm' as const,
        className: `${iconSizes.lg} p-1`,
      },
      iconOutline: {
        variant: 'outline' as const,
        size: 'sm' as const,
        className: `${iconSizes.lg} p-1`,
      },
    },

    // 🎨 RAW BUTTON PATTERNS - For <button> elements
    raw: {
      iconButton: `p-2 rounded-md border ${COLOR_BRIDGE.bg.primary} border-border hover:bg-accent hover:text-accent-foreground transition-colors duration-200`,
      tabButton: 'px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 hover:bg-accent hover:text-accent-foreground',
      menuButton: 'w-full px-2 py-1.5 text-sm text-left rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors duration-200',
      floatingButton: `fixed bottom-4 right-4 ${iconSizes.xl3} rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow duration-300`,
    },

    // 💎 SPECIAL PURPOSE PATTERNS
    special: {
      mobile: {
        primary: {
          variant: 'default' as const,
          size: 'lg' as const,
          className: 'w-full',
        },
        compact: {
          variant: 'outline' as const,
          size: 'sm' as const,
          className: 'h-8 px-2 text-xs',
        },
      },
      loading: {
        withSpinner: {
          variant: 'default' as const,
          size: 'sm' as const,
          disabled: true,
        },
        disabled: {
          variant: 'secondary' as const,
          size: 'sm' as const,
          disabled: true,
        },
      },
      form: {
        submit: {
          variant: 'default' as const,
          size: 'default' as const,
          type: 'submit' as const,
        },
        reset: {
          variant: 'outline' as const,
          size: 'default' as const,
          type: 'reset' as const,
        },
      },
    },

    // 🔧 UTILITY METHODS - Type-safe dynamic access
    getCommon: (variant) => {
      const commonMap = {
        outlineSmall: { variant: 'outline' as const, size: 'sm' as const },
        ghostSmall: { variant: 'ghost' as const, size: 'sm' as const },
        outlineDefault: { variant: 'outline' as const, size: 'default' as const },
        primarySmall: { variant: 'default' as const, size: 'sm' as const },
        dangerSmall: { variant: 'destructive' as const, size: 'sm' as const },
        secondarySmall: { variant: 'secondary' as const, size: 'sm' as const },
      };
      return commonMap[variant];
    },

    getAction: (action) => {
      const actionMap = {
        edit: { variant: 'outline' as const, size: 'sm' as const },
        delete: { variant: 'destructive' as const, size: 'sm' as const },
        view: { variant: 'outline' as const, size: 'sm' as const },
        save: { variant: 'default' as const, size: 'sm' as const },
        cancel: { variant: 'ghost' as const, size: 'sm' as const },
        create: { variant: 'default' as const, size: 'sm' as const },
        close: { variant: 'ghost' as const, size: 'sm' as const },
        back: { variant: 'ghost' as const, size: 'sm' as const },
        next: { variant: 'default' as const, size: 'sm' as const },
        finish: { variant: 'default' as const, size: 'default' as const },
      };
      return actionMap[action];
    },

    getIcon: (type) => {
      const iconMap = {
        iconSmall: { variant: 'ghost' as const, size: 'sm' as const, className: `${iconSizes.lg} p-0` },
        iconMedium: { variant: 'outline' as const, size: 'default' as const, className: `${iconSizes.xl} p-0` },
        iconGhost: { variant: 'ghost' as const, size: 'sm' as const, className: `${iconSizes.lg} p-1` },
        iconOutline: { variant: 'outline' as const, size: 'sm' as const, className: `${iconSizes.lg} p-1` },
      };
      return iconMap[type];
    },

    combineProps: (base, override) => ({
      ...base,
      ...override,
      className: base.className && override.className
        ? `${base.className} ${override.className}`
        : base.className || override.className,
    }),

  } as const), []); // Empty dependency - patterns είναι σταθερές
}

// ============================================================================
// 🎯 SPECIALIZED HOOKS - COMMON USE CASES
// ============================================================================

/**
 * Hook για common button patterns - Lightweight
 * Χρήση: Όταν χρειάζεσαι μόνο basic combinations
 */
export function useCommonButtons() {
  const buttonPatterns = useButtonPatterns();
  return useMemo(() => buttonPatterns.common, [buttonPatterns.common]);
}

/**
 * Hook για action button patterns - Lightweight
 * Χρήση: Για semantic action buttons
 */
export function useActionButtons() {
  const buttonPatterns = useButtonPatterns();
  return useMemo(() => buttonPatterns.actions, [buttonPatterns.actions]);
}

/**
 * Hook για icon button patterns - Lightweight
 * Χρήση: Για icon-based buttons
 */
export function useIconButtons() {
  const buttonPatterns = useButtonPatterns();
  return useMemo(() => buttonPatterns.icons, [buttonPatterns.icons]);
}

/**
 * Hook για raw button patterns - Lightweight
 * Χρήση: Για <button> elements
 */
export function useRawButtons() {
  const buttonPatterns = useButtonPatterns();
  return useMemo(() => buttonPatterns.raw, [buttonPatterns.raw]);
}

// ============================================================================
// 🔗 CONVENIENCE EXPORTS - EASY IMPORTS
// ============================================================================

/**
 * Default export για main hook
 */
export default useButtonPatterns;

/**
 * Quick access pattern
 */
export {
  useButtonPatterns as useButtons,
  useCommonButtons as useCommonButtonStyles,
  useActionButtons as useActionButtonStyles,
  useIconButtons as useIconButtonStyles,
  useRawButtons as useRawButtonStyles,
};