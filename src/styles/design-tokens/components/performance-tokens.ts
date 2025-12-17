/**
 * ⚡ PERFORMANCE TOKENS - ENTERPRISE MODULE
 *
 * @description High-performance UI components tokens για enterprise-grade
 * applications. Optimized για smooth 60fps rendering και minimal repaints.
 *
 * @author Γιώργος Παγωνής + Claude Code (Anthropic AI)
 * @since 2025-12-17
 * @version 1.0.0 - Enterprise Modularization
 *
 * 🔄 EXTRACTED FROM: src/styles/design-tokens.ts (συμπιέζοντας διπλότυπα)
 * 🚨 CRITICAL: Removed duplicate chartComponents - using dedicated chart-tokens.ts
 */

import React from 'react';

// Import base tokens for consistent styling
import { colors } from '../base/colors';
import { spacing } from '../base/spacing';
import { typography } from '../base/typography';

// Import centralized constants για αποφυγή circular dependencies
import { SHADOWS, ANIMATION, TRANSITIONS } from '../constants/shared-constants';

// ============================================================================
// PERFORMANCE COMPONENTS - VIRTUALIZED & OPTIMIZED UI
// ============================================================================

/**
 * Performance Components για High-Performance UI Elements
 * Enterprise-class virtualized tables, metrics dashboards, and analytics
 *
 * Optimized για smooth 60fps rendering με minimal repaints
 *
 * @example
 * ```tsx
 * <div style={performanceComponents.virtualizedTable.container} />
 * <span style={performanceComponents.metrics.label.primary} />
 * ```
 */
export const performanceComponents = {
  // Virtualized Table System
  virtualizedTable: {
    // Main container
    container: {
      position: 'relative' as const,
      overflow: 'hidden' as const,
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: '0.375rem',
      willChange: 'scroll-position' as const // Performance optimization
    },

    // Header section
    header: {
      position: 'sticky' as const,
      top: 0,
      backgroundColor: colors.background.secondary,
      borderBottom: `1px solid ${colors.border.primary}`,
      zIndex: 1,
      padding: spacing.md,
      fontWeight: typography.fontWeight.semibold,
      fontSize: typography.fontSize.sm,
      color: colors.text.primary
    },

    // Scrollable content area
    scrollableContent: {
      position: 'relative' as const,
      overflow: 'auto' as const,
      willChange: 'scroll-position, contents' as const // Performance hint
    },

    // Row styling
    row: {
      base: {
        display: 'flex',
        alignItems: 'center',
        padding: `${spacing.sm} ${spacing.md}`,
        borderBottom: `1px solid ${colors.border.secondary}`,
        transition: `background-color ${ANIMATION.duration.fast}`,
        cursor: 'default' as const
      },

      interactive: {
        cursor: 'pointer' as const,
        '&:hover': {
          backgroundColor: colors.background.hover
        }
      }
    },

    // Cell styling
    cell: {
      base: {
        display: 'flex',
        alignItems: 'center',
        minWidth: 0, // Allow text truncation
        padding: `0 ${spacing.sm}`,
        color: colors.text.primary,
        fontSize: typography.fontSize.sm
      },

      flexible: {
        flex: 1,
        minWidth: 0
      }
    }
  },

  // Performance Metrics Components
  metrics: {
    // Individual metric card
    card: {
      padding: spacing.lg,
      backgroundColor: colors.background.secondary,
      borderRadius: '0.375rem',
      border: `1px solid ${colors.border.secondary}`
    },

    // Metric labels and values
    label: {
      primary: {
        fontWeight: typography.fontWeight.medium,
        fontSize: typography.fontSize.sm,
        color: colors.text.primary
      },

      secondary: {
        fontWeight: typography.fontWeight.medium,
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary
      },

      tertiary: {
        fontWeight: typography.fontWeight.medium,
        fontSize: typography.fontSize.sm,
        color: colors.text.tertiary
      }
    },

    // Metric values με severity colors
    value: {
      primary: {
        fontWeight: typography.fontWeight.semibold,
        fontSize: typography.fontSize.lg,
        color: colors.text.primary
      },

      success: { color: colors.green[600] },
      warning: { color: colors.orange[600] },
      error: { color: colors.red[600] },
      info: { color: colors.blue[600] }
    }
  },

  // Loading and States
  states: {
    loading: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing['2xl'],
      color: colors.text.secondary
    },

    error: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing['2xl'],
      color: colors.red[600],
      backgroundColor: colors.red[50] || '#fef2f2',
      borderRadius: '0.375rem',
      border: `1px solid ${colors.red[200] || '#fecaca'}`
    },

    empty: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing['2xl'],
      color: colors.text.tertiary,
      textAlign: 'center' as const
    }
  },

  // Performance Optimizations - GPU Acceleration & Will-Change
  optimizations: {
    willChangeTransform: { willChange: 'transform' as const },
    willChangeScroll: { willChange: 'scroll-position' as const },
    willChangeContents: { willChange: 'contents' as const },
    gpuAccelerated: { transform: 'translateZ(0)' },
    compositeLayer: { transform: 'translate3d(0,0,0)' }
  },

  // Animation Presets για Performance Components
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
// VIRTUALIZATION UTILITIES - HELPER FUNCTIONS
// ============================================================================

export const virtualizationUtilities = {
  /**
   * Calculate visible items για virtualized tables
   */
  calculateVisibleItems: (
    scrollTop: number,
    itemHeight: number,
    containerHeight: number,
    buffer: number = 5
  ): { startIndex: number; endIndex: number; visibleCount: number } => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + (2 * buffer);
    const endIndex = startIndex + visibleCount;

    return { startIndex, endIndex, visibleCount };
  },

  /**
   * Calculate transform για virtual scrolling
   */
  getVirtualTransform: (startIndex: number, itemHeight: number): React.CSSProperties => ({
    transform: `translateY(${startIndex * itemHeight}px)`
  }),

  /**
   * Generate style για virtualized container
   */
  getVirtualContainerStyle: (totalHeight: number): React.CSSProperties => ({
    height: `${totalHeight}px`,
    position: 'relative'
  })
} as const;

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

/**
 * 🔄 LEGACY SUPPORT: Re-export για backward compatibility
 */
export {
  performanceComponents as designTokenPerformanceComponents,
  virtualizationUtilities as designTokenVirtualizationUtilities
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PerformanceComponents = typeof performanceComponents;
export type VirtualizationUtilities = typeof virtualizationUtilities;
export type VirtualizedTableComponents = typeof performanceComponents.virtualizedTable;
export type MetricsComponents = typeof performanceComponents.metrics;
export type PerformanceStates = typeof performanceComponents.states;

/**
 * ✅ ENTERPRISE PERFORMANCE TOKENS MODULE COMPLETE
 *
 * Features:
 * 1. ✅ High-performance virtualized table system
 * 2. ✅ Metrics dashboard components με severity colors
 * 3. ✅ Performance optimization tokens (will-change, GPU acceleration)
 * 4. ✅ Loading/Error/Empty states με consistent styling
 * 5. ✅ Animation presets για smooth 60fps rendering
 * 6. ✅ Virtualization utilities για efficient rendering
 * 7. ✅ Legacy compatibility exports
 * 8. ✅ Full TypeScript support με exported types
 * 9. ✅ Enterprise documentation standards
 * 10. 🚨 CRITICAL: Eliminated chart components duplicates
 *
 * Migration Benefits:
 * - ⚡ Separated performance-critical components από monolithic file
 * - 🏢 Professional modular architecture
 * - 🔧 Eliminated duplicates (chart components moved to dedicated module)
 * - ⚡ Better performance και tree-shaking
 * - 📈 Enhanced virtualization support for large datasets
 * - 👥 Better team collaboration on performance-critical code
 *
 * Result: Fortune 500-class performance component management system
 */