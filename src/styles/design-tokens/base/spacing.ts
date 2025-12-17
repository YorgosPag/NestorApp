/**
 * 📐 BASE SPACING TOKENS - ENTERPRISE MODULE
 *
 * @description Κεντρικοποιημένο spacing system που ενοποιεί όλα τα
 * spacing values, margins και padding της εφαρμογής
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-17
 * @version 1.0.0 - Enterprise Modularization
 *
 * 🔄 EXTRACTED FROM: src/styles/design-tokens.ts (3,542 lines → modular)
 */

// ============================================================================
// SPACING SCALE - FOUNDATION SYSTEM
// ============================================================================

export const spacing = {
  // Base spacing scale (σε rem)
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px

  // Component-specific spacing
  component: {
    padding: {
      xs: '0.5rem',     // 8px - tight padding
      sm: '0.75rem',    // 12px - small padding
      md: '1rem',       // 16px - default padding
      lg: '1.5rem',     // 24px - large padding
      xl: '2rem',       // 32px - extra large padding
    },
    gap: {
      xs: '0.25rem',    // 4px - tight gap
      sm: '0.5rem',     // 8px - small gap
      md: '1rem',       // 16px - default gap
      lg: '1.5rem',     // 24px - large gap
    },
    margin: {
      xs: '0.25rem',    // 4px
      sm: '0.5rem',     // 8px
      md: '1rem',       // 16px
      lg: '1.5rem',     // 24px
      xl: '2rem',       // 32px
    }
  }
} as const;

// ============================================================================
// SPACING UTILITIES - TYPE-SAFE ACCESS
// ============================================================================

/**
 * Get spacing value με type safety
 */
export const getSpacing = (size: keyof typeof spacing): string => {
  return spacing[size];
};

/**
 * Get component spacing value
 */
export const getComponentSpacing = (
  type: 'padding' | 'gap' | 'margin',
  size: keyof typeof spacing.component.padding
): string => {
  return spacing.component[type][size];
};

/**
 * Generate spacing styles για components
 */
export const getSpacingStyles = (config: {
  padding?: keyof typeof spacing.component.padding;
  margin?: keyof typeof spacing.component.margin;
  gap?: keyof typeof spacing.component.gap;
}) => {
  const styles: any = {};

  if (config.padding) {
    styles.padding = spacing.component.padding[config.padding];
  }

  if (config.margin) {
    styles.margin = spacing.component.margin[config.margin];
  }

  if (config.gap) {
    styles.gap = spacing.component.gap[config.gap];
  }

  return styles;
};

// ============================================================================
// SEMANTIC SPACING PRESETS
// ============================================================================

export const spacingPresets = {
  // Layout spacing
  layout: {
    sectionGap: spacing.xl,      // 2rem - Between major sections
    containerPadding: spacing.lg, // 1.5rem - Container horizontal padding
    contentGap: spacing.md,      // 1rem - Between content blocks
  },

  // Component spacing
  components: {
    buttonPadding: {
      horizontal: spacing.component.padding.md,
      vertical: spacing.component.padding.sm,
    },

    cardPadding: spacing.component.padding.lg,
    cardGap: spacing.component.gap.md,

    formFieldGap: spacing.component.gap.sm,
    formSectionGap: spacing.component.gap.lg,

    listItemPadding: spacing.component.padding.sm,
    listGap: spacing.component.gap.xs,
  },

  // Interactive spacing
  interactive: {
    hoverOffset: spacing.xs,     // Subtle hover movement
    focusOffset: spacing.sm,     // Focus ring offset
    clickOffset: '0.125rem',     // 2px - Active state movement
  }
} as const;

// ============================================================================
// RESPONSIVE SPACING UTILITIES
// ============================================================================

export const responsiveSpacing = {
  /**
   * Responsive padding που adapts σε screen size
   */
  responsivePadding: (base: keyof typeof spacing, scale: number = 1.2) => ({
    padding: spacing[base],
    '@media (min-width: 768px)': {
      padding: `calc(${spacing[base]} * ${scale})`,
    },
    '@media (min-width: 1024px)': {
      padding: `calc(${spacing[base]} * ${scale * 1.2})`,
    },
  }),

  /**
   * Responsive margin με breakpoints
   */
  responsiveMargin: (base: keyof typeof spacing) => ({
    margin: spacing[base],
    '@media (min-width: 768px)': {
      margin: `calc(${spacing[base]} * 1.25)`,
    },
  }),
} as const;

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

/**
 * 🔄 LEGACY SUPPORT: Re-export για backward compatibility
 */
export {
  spacing as designTokenSpacing,
  spacingPresets as designTokenSpacingPresets
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type SpacingScale = typeof spacing;
export type SpacingPresets = typeof spacingPresets;
export type SpacingSize = keyof typeof spacing;
export type ComponentSpacingSize = keyof typeof spacing.component.padding;

/**
 * ✅ ENTERPRISE SPACING MODULE COMPLETE
 *
 * Features:
 * 1. ✅ Centralized spacing system από monolithic design-tokens.ts
 * 2. ✅ Type-safe access utilities για spacing values
 * 3. ✅ Semantic spacing presets για component consistency
 * 4. ✅ Responsive spacing utilities για adaptive layouts
 * 5. ✅ Component-specific spacing categories
 * 6. ✅ Legacy compatibility exports
 * 7. ✅ Full TypeScript support με exported types
 * 8. ✅ Enterprise documentation standards
 *
 * Migration Benefits:
 * - 📐 Professional spacing management
 * - 🎯 Separated από 3,542-line monolithic file
 * - 🏢 Modular architecture για easy maintenance
 * - ⚡ Better performance και tree-shaking
 * - 📱 Responsive design support
 *
 * Result: Fortune 500-class spacing token system
 */