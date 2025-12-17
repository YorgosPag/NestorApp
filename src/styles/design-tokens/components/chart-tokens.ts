/**
 * 📊 CHART TOKENS - ENTERPRISE MODULE
 *
 * @description Comprehensive chart components design tokens για enterprise-grade
 * data visualization. Fortune 500 grade chart styling patterns.
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-17
 * @version 1.0.0 - Enterprise Modularization
 *
 * 🔄 EXTRACTED FROM: src/styles/design-tokens.ts (consolidating duplicates)
 * ✅ ENTERPRISE REFACTORED: Inline styles → Centralized tokens
 * 📊 COMPLETE VERSION: Full-featured chart system με axis, animations, layouts
 */

import React from 'react';

// Import base tokens for consistent styling
import { colors } from '../base/colors';
import { spacing } from '../base/spacing';
import { typography } from '../base/typography';

// Import centralized constants για αποφυγή circular dependencies
import { BORDER_RADIUS, SHADOWS, TRANSITIONS } from '../constants/shared-constants';

// ============================================================================
// CHART COMPONENTS - COMPLETE DATA VISUALIZATION SYSTEM
// ============================================================================

/**
 * Chart components design tokens για data visualization
 *
 * ✅ ENTERPRISE REFACTORED: Inline styles → Centralized tokens
 * ✅ Type-safe chart styling patterns
 * ✅ Dynamic color management για chart elements
 * ✅ Fortune 500 grade data visualization standards
 *
 * Usage:
 * - ChartLegend.tsx: Legend colors, indicators, tooltips
 * - ChartTooltip.tsx: Tooltip indicators, backgrounds
 * - Chart containers: Sizing, spacing, responsive patterns
 */
export const chartComponents = {
  // Legend Components
  legend: {
    container: {
      display: 'flex' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: spacing.lg
    },

    item: {
      base: {
        display: 'flex' as const,
        alignItems: 'center' as const,
        gap: spacing.sm // Updated to use new spacing tokens
      },

      icon: {
        height: spacing.md,
        width: spacing.md,
        color: colors.text.tertiary
      }
    },

    indicator: {
      base: {
        height: spacing.sm,
        width: spacing.sm,
        flexShrink: 0,
        borderRadius: BORDER_RADIUS.sm
      },

      /**
       * Dynamic color utility για chart legend indicators
       * Replaces: style={{ backgroundColor: item.color }}
       */
      withColor: (color: string): React.CSSProperties => ({
        backgroundColor: color
      })
    },

    // Top/Bottom positioned legends
    positioning: {
      top: { paddingBottom: spacing.md },
      bottom: { paddingTop: spacing.md },
      left: { paddingRight: spacing.md },
      right: { paddingLeft: spacing.md }
    }
  },

  // Tooltip Components
  tooltip: {
    indicator: {
      dot: {
        height: '10px',
        width: '10px',
        flexShrink: 0,
        borderRadius: BORDER_RADIUS.sm
      },

      line: {
        width: '4px',
        flexShrink: 0,
        borderRadius: BORDER_RADIUS.sm
      },

      dashed: {
        width: 0,
        border: '1.5px dashed',
        backgroundColor: 'transparent',
        flexShrink: 0
      },

      /**
       * CSS Variables approach για dynamic colors
       * Replaces: { "--color-bg": color, "--color-border": color }
       */
      withColor: (color: string | undefined): React.CSSProperties => ({
        '--color-bg': color,
        '--color-border': color
      } as React.CSSProperties),

      // Base styling με CSS variables
      cssVariables: {
        border: `1px solid var(--color-border)`,
        backgroundColor: `var(--color-bg)`
      }
    },

    container: {
      base: {
        backgroundColor: colors.surface.primary,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: BORDER_RADIUS.md,
        padding: spacing.md,
        boxShadow: SHADOWS.md
      },

      content: {
        fontSize: typography.fontSize.sm,
        color: colors.text.primary
      }
    }
  },

  // Chart Container Components
  container: {
    base: {
      position: 'relative' as const,
      width: '100%',
      height: '100%'
    },

    responsive: {
      width: '100%',
      height: 'auto',
      aspectRatio: '16/9'
    },

    // Size variants
    sizes: {
      sm: { height: '200px' },
      md: { height: '300px' },
      lg: { height: '400px' },
      xl: { height: '500px' }
    }
  },

  // Chart Title & Layout Components (ENTERPRISE ADDITION - 2025-12-16)
  title: {
    container: {
      textAlign: 'center' as const,
      marginBottom: spacing.sm
    },

    main: {
      margin: 0,
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },

    subtitle: {
      margin: '4px 0 0 0',
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary
    }
  },

  // Chart Layout & Positioning
  layout: {
    // Main chart containers με dynamic dimensions
    container: (width?: number, height?: number): React.CSSProperties => ({
      position: 'relative',
      width: width || '100%',
      height: height || '100%'
    }),

    // Interactive cursor patterns
    interactive: (enabled: boolean): React.CSSProperties => ({
      cursor: enabled ? 'pointer' : 'default'
    }),

    // Chart content styling for tooltips
    tooltip: {
      fontWeight: 'bold' as const
    }
  },

  // Chart Axis Components
  axis: {
    line: {
      stroke: colors.border.secondary,
      strokeWidth: 1
    },

    tick: {
      fontSize: typography.fontSize.xs,
      fill: colors.text.secondary
    },

    label: {
      fontSize: typography.fontSize.sm,
      fill: colors.text.primary,
      fontWeight: typography.fontWeight.medium
    }
  },

  // Chart Colors Palette (για consistent data visualization)
  colors: {
    // Primary data series
    primary: [
      colors.blue[500],
      colors.green[500],
      colors.purple[500],
      colors.orange[500],
      colors.red[500],
      colors.teal[500]
    ],

    // Secondary data series
    secondary: [
      colors.blue[300],
      colors.green[300],
      colors.purple[300],
      colors.orange[300],
      colors.red[300],
      colors.teal[300]
    ],

    // Status-based colors
    status: {
      success: colors.green[500],
      warning: colors.orange[500],
      error: colors.red[500],
      info: colors.blue[500],
      neutral: colors.gray[500]
    },

    // Grid lines
    grid: {
      major: colors.border.secondary,
      minor: colors.border.tertiary
    }
  },

  // Animation & Transitions
  animations: {
    fadeIn: {
      opacity: 1,
      transition: `opacity ${TRANSITIONS.duration.base} ${TRANSITIONS.easing.easeOut}`
    },

    slideUp: {
      transform: 'translateY(0)',
      transition: `transform ${TRANSITIONS.duration.base} ${TRANSITIONS.easing.easeOut}`
    },

    scale: {
      transform: 'scale(1)',
      transition: `transform ${TRANSITIONS.duration.fast} ${TRANSITIONS.easing.easeOut}`
    }
  }
} as const;

// ============================================================================
// CHART UTILITIES - HELPER FUNCTIONS
// ============================================================================

export const chartUtilities = {
  /**
   * Get color από primary palette με automatic cycling
   */
  getDataSeriesColor: (index: number): string => {
    return chartComponents.colors.primary[index % chartComponents.colors.primary.length];
  },

  /**
   * Get secondary color με automatic cycling
   */
  getSecondaryColor: (index: number): string => {
    return chartComponents.colors.secondary[index % chartComponents.colors.secondary.length];
  },

  /**
   * Get status color με fallback
   */
  getStatusColor: (status: keyof typeof chartComponents.colors.status): string => {
    return chartComponents.colors.status[status];
  },

  /**
   * Generate chart container με responsive sizing
   */
  getResponsiveContainer: (aspectRatio: string = '16/9'): React.CSSProperties => ({
    ...chartComponents.container.responsive,
    aspectRatio
  }),

  /**
   * Generate tooltip style με dynamic color
   */
  getTooltipWithColor: (color: string): React.CSSProperties => ({
    ...chartComponents.tooltip.container.base,
    ...chartComponents.tooltip.indicator.withColor(color)
  })
} as const;

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

/**
 * 🔄 LEGACY SUPPORT: Re-export για backward compatibility
 */
export {
  chartComponents as designTokenChartComponents,
  chartUtilities as designTokenChartUtilities
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ChartComponents = typeof chartComponents;
export type ChartUtilities = typeof chartUtilities;
export type ChartLegendComponents = typeof chartComponents.legend;
export type ChartTooltipComponents = typeof chartComponents.tooltip;
export type ChartContainerComponents = typeof chartComponents.container;
export type ChartColors = typeof chartComponents.colors;
export type ChartStatusColor = keyof typeof chartComponents.colors.status;

/**
 * ✅ ENTERPRISE CHART TOKENS MODULE COMPLETE
 *
 * Features:
 * 1. ✅ Complete chart visualization system από monolithic design-tokens.ts
 * 2. ✅ Dynamic color utilities με automatic series cycling
 * 3. ✅ Legend components με indicators και positioning
 * 4. ✅ Tooltip system με CSS variables support
 * 5. ✅ Chart containers με responsive sizing
 * 6. ✅ Axis components για professional charts
 * 7. ✅ Animation presets για smooth transitions
 * 8. ✅ Helper utilities για common chart operations
 * 9. ✅ Legacy compatibility exports
 * 10. ✅ Full TypeScript support με exported types
 * 11. 🚨 CRITICAL: Consolidated duplicates από performanceComponents
 * 12. ✅ Enterprise documentation standards
 *
 * Migration Benefits:
 * - 📊 Professional chart token management
 * - 🎯 Eliminated duplicate chart definitions
 * - 🏢 Modular architecture για easy maintenance
 * - ⚡ Better performance και tree-shaking
 * - 🎨 Consistent data visualization patterns
 * - 👥 Better team collaboration on chart components
 *
 * Result: Fortune 500-class chart component management system
 */