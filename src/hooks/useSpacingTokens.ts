import { useMemo } from 'react';
import { spacing } from '@/styles/design-tokens/core/spacing';

/**
 * 🏢 ENTERPRISE: Spacing Tokens Hook
 *
 * Centralized spacing tokens for consistent layout across the application.
 * Based on design-tokens/core/spacing.ts with semantic naming.
 *
 * @enterprise Part of the centralized design system
 * @pattern Follows useTypography.ts and useBorderTokens.ts patterns
 * @author Enterprise Architecture Team
 * @see src/styles/design-tokens/core/spacing.ts
 * @see src/hooks/useTypography.ts (reference pattern)
 *
 * @example
 * ```tsx
 * const spacing = useSpacingTokens();
 *
 * return (
 *   <div className={spacing.padding.md}>
 *     <section className={spacing.margin.bottom.lg}>
 *       <div className={spacing.gap.sm}>
 *         Content
 *       </div>
 *     </section>
 *   </div>
 * );
 * ```
 */

/**
 * Spacing tokens interface
 */
export interface SpacingTokens {
  /** Base spacing scale (xs, sm, md, lg, xl, 2xl) */
  base: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };

  /** Padding utilities */
  padding: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    none: string;

    /** Directional padding */
    top: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      none: string;
    };
    bottom: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      none: string;
    };
    left: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      none: string;
    };
    right: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      none: string;
    };
    x: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      none: string;
    };
    y: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      none: string;
    };
  };

  /** Margin utilities */
  margin: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    none: string;
    auto: string;

    /** Directional margins */
    top: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      none: string;
    };
    bottom: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      none: string;
    };
    left: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      none: string;
    };
    right: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      none: string;
    };
  };

  /** Gap utilities (for flex/grid) */
  gap: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    none: string;
  };

  /** Space-between utilities */
  spaceBetween: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
}

/**
 * Hook that provides centralized spacing tokens
 *
 * @returns Spacing tokens object with semantic naming
 *
 * @enterprise Zero hardcoded spacing values - all centralized
 */
export function useSpacingTokens(): SpacingTokens {
  return useMemo<SpacingTokens>(() => {
    // Base spacing scale from design tokens
    const baseScale = {
      xs: spacing.xs,      // 4px
      sm: spacing.sm,      // 8px
      md: spacing.md,      // 16px
      lg: spacing.lg,      // 24px
      xl: spacing.xl,      // 32px
      '2xl': spacing['2xl'] || '3rem', // 48px
    };

    return {
      // Base spacing scale
      base: baseScale,

      // Padding utilities
      padding: {
        xs: 'p-1',        // 4px
        sm: 'p-2',        // 8px
        md: 'p-4',        // 16px
        lg: 'p-6',        // 24px
        xl: 'p-8',        // 32px
        '2xl': 'p-12',    // 48px
        none: 'p-0',

        // Directional padding
        top: {
          xs: 'pt-1',
          sm: 'pt-2',
          md: 'pt-4',
          lg: 'pt-6',
          xl: 'pt-8',
          '2xl': 'pt-12',
          none: 'pt-0',
        },
        bottom: {
          xs: 'pb-1',
          sm: 'pb-2',
          md: 'pb-4',
          lg: 'pb-6',
          xl: 'pb-8',
          '2xl': 'pb-12',
          none: 'pb-0',
        },
        left: {
          xs: 'pl-1',
          sm: 'pl-2',
          md: 'pl-4',
          lg: 'pl-6',
          xl: 'pl-8',
          '2xl': 'pl-12',
          none: 'pl-0',
        },
        right: {
          xs: 'pr-1',
          sm: 'pr-2',
          md: 'pr-4',
          lg: 'pr-6',
          xl: 'pr-8',
          '2xl': 'pr-12',
          none: 'pr-0',
        },
        x: {
          xs: 'px-1',
          sm: 'px-2',
          md: 'px-4',
          lg: 'px-6',
          xl: 'px-8',
          '2xl': 'px-12',
          none: 'px-0',
        },
        y: {
          xs: 'py-1',
          sm: 'py-2',
          md: 'py-4',
          lg: 'py-6',
          xl: 'py-8',
          '2xl': 'py-12',
          none: 'py-0',
        },
      },

      // Margin utilities
      margin: {
        xs: 'm-1',
        sm: 'm-2',
        md: 'm-4',
        lg: 'm-6',
        xl: 'm-8',
        '2xl': 'm-12',
        none: 'm-0',
        auto: 'm-auto',

        // Directional margins
        top: {
          xs: 'mt-1',
          sm: 'mt-2',
          md: 'mt-4',
          lg: 'mt-6',
          xl: 'mt-8',
          '2xl': 'mt-12',
          none: 'mt-0',
        },
        bottom: {
          xs: 'mb-1',
          sm: 'mb-2',
          md: 'mb-4',
          lg: 'mb-6',
          xl: 'mb-8',
          '2xl': 'mb-12',
          none: 'mb-0',
        },
        left: {
          xs: 'ml-1',
          sm: 'ml-2',
          md: 'ml-4',
          lg: 'ml-6',
          xl: 'ml-8',
          '2xl': 'ml-12',
          none: 'ml-0',
        },
        right: {
          xs: 'mr-1',
          sm: 'mr-2',
          md: 'mr-4',
          lg: 'mr-6',
          xl: 'mr-8',
          '2xl': 'mr-12',
          none: 'mr-0',
        },
      },

      // Gap utilities (flex/grid)
      gap: {
        xs: 'gap-1',      // 4px
        sm: 'gap-2',      // 8px
        md: 'gap-4',      // 16px
        lg: 'gap-6',      // 24px
        xl: 'gap-8',      // 32px
        '2xl': 'gap-12',  // 48px
        none: 'gap-0',
      },

      // Space-between utilities
      spaceBetween: {
        xs: 'space-y-1',
        sm: 'space-y-2',
        md: 'space-y-4',
        lg: 'space-y-6',
        xl: 'space-y-8',
        '2xl': 'space-y-12',
      },
    };
  }, []); // No dependencies - tokens are static
}

/**
 * 🏢 ENTERPRISE: Default export for convenience
 */
export default useSpacingTokens;
