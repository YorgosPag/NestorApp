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
  },

  // Performance Monitor Dashboard - Centralized Styling System
  performanceMonitor: {
    // Container dimensions
    dimensions: {
      maxWidth: '25rem',
      minWidth: '20rem',
      estimatedHeight: 500,
      chartHeight: '2rem', // 32px for FPS history chart
    },

    // Color system based on metric values
    colors: {
      // FPS Status Colors
      fps: {
        excellent: colors.green[600] || '#059669',  // 55+ FPS
        good: colors.orange[600] || '#d97706',      // 30-54 FPS
        poor: colors.red[600] || '#dc2626'          // <30 FPS
      },

      // Memory Status Colors
      memory: {
        normal: colors.blue[600] || '#2563eb',      // <300MB
        warning: colors.orange[600] || '#d97706',   // 300-500MB
        critical: colors.red[600] || '#dc2626'      // >500MB
      },

      // Render Time Status Colors
      renderTime: {
        optimal: colors.green[600] || '#059669',    // <10ms
        acceptable: colors.orange[600] || '#d97706', // 10-16.67ms
        slow: colors.red[600] || '#dc2626'          // >16.67ms
      },

      // Alert Colors
      alerts: {
        background: colors.red[50] || '#fef2f2',
        border: colors.red[200] || '#fecaca',
        text: colors.red[800] || '#991b1b',
        icon: colors.red[600] || '#dc2626'
      },

      // Action Button Variants
      buttons: {
        blue: {
          background: colors.blue[50] || '#eff6ff',
          text: colors.blue[600] || '#2563eb',
          border: colors.blue[200] || '#bfdbfe',
          hover: colors.blue[100] || '#dbeafe'
        },
        green: {
          background: colors.green[50] || '#f0fdf4',
          text: colors.green[600] || '#059669',
          border: colors.green[200] || '#bbf7d0',
          hover: colors.green[100] || '#dcfce7'
        },
        purple: {
          background: colors.purple?.[50] || '#faf5ff',
          text: colors.purple?.[600] || '#9333ea',
          border: colors.purple?.[200] || '#e9d5ff',
          hover: colors.purple?.[100] || '#f3e8ff'
        }
      }
    },

    // Typography system
    typography: {
      title: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.text.primary
      },
      metricLabel: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.normal,
        color: colors.text.secondary
      },
      metricValue: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold
      },
      alertText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.normal
      },
      buttonText: {
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.medium
      }
    },

    // Layout spacing
    spacing: {
      container: spacing.lg,      // 16px
      section: spacing.md,        // 12px
      metric: spacing.sm,         // 8px
      button: spacing.xs,         // 4px
      grid: spacing.md            // 12px for metric grid gap
    },

    // Component states
    states: {
      grade: {
        good: {
          background: colors.green[100] || '#dcfce7',
          text: colors.green[800] || '#166534',
          border: colors.green[300] || '#86efac'
        },
        warning: {
          background: colors.orange[100] || '#fef3c7',
          text: colors.orange[800] || '#92400e',
          border: colors.orange[300] || '#fcd34d'
        },
        poor: {
          background: colors.red[100] || '#fee2e2',
          text: colors.red[800] || '#991b1b',
          border: colors.red[300] || '#fca5a5'
        }
      }
    },

    // Chart configuration
    chart: {
      bar: {
        borderRadius: '0.125rem', // rounded-sm
        minHeight: '0.25rem',     // 4px minimum height
        gap: '0.125rem'           // 2px gap between bars
      }
    },

    // Thresholds για color determination
    thresholds: {
      fps: {
        excellent: 55,
        minimum: 30
      },
      memory: {
        warning: 300,   // MB
        critical: 500   // MB
      },
      renderTime: {
        optimal: 10,    // ms
        acceptable: 16.67 // ms (60fps target)
      }
    }
  },

  // ============================================================================
  // OVERLAY PANELS SYSTEM - PROPERTIES & TOOLS
  // ============================================================================
  overlayPanels: {
    // Shared dimensions για consistency
    dimensions: {
      maxWidth: '25rem',        // Same as Performance Monitor
      minWidth: '20rem',        // Same as Performance Monitor
      zIndex: 9999,            // Floating panel layer
      borderRadius: '0.5rem'    // rounded-lg
    },

    // Panel color system
    colors: {
      // Container colors (dark theme για DXF viewer)
      container: {
        background: colors.gray[800] || '#1f2937',
        border: colors.gray[600] || '#4b5563',
        shadow: 'rgba(0, 0, 0, 0.1)'
      },

      // Header colors
      header: {
        background: colors.gray[700] || '#374151',
        border: colors.gray[600] || '#4b5563',
        text: colors.white || '#ffffff'
      },

      // Icon colors
      icons: {
        primary: colors.blue[600] || '#2563eb',    // Activity icon
        secondary: colors.gray[400] || '#9ca3af',  // Drag handle
        hover: colors.gray[200] || '#e5e7eb'       // Hover states
      },

      // Button colors για close/actions
      buttons: {
        default: {
          background: 'transparent',
          text: colors.gray[400] || '#9ca3af',
          hover: {
            background: colors.gray[700] || '#374151',
            text: colors.gray[200] || '#e5e7eb'
          }
        }
      }
    },

    // Typography system
    typography: {
      title: {
        fontSize: typography.fontSize.sm,     // text-sm
        fontWeight: typography.fontWeight.semibold,
        color: colors.white || '#ffffff',
        margin: 0
      },
      dragHandle: {
        fontSize: typography.fontSize.xs,     // text-xs
        color: colors.gray[400] || '#9ca3af'
      }
    },

    // Layout spacing
    spacing: {
      container: spacing.lg,        // p-4
      header: `${spacing.lg} ${spacing.lg} ${spacing.md} ${spacing.lg}`, // p-4 pb-2
      content: spacing.lg,          // p-4
      gap: spacing.md,              // gap-3
      grid: spacing.lg              // space-y-4
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
// PERFORMANCE MONITOR UTILITIES - CENTRALIZED FUNCTIONS
// ============================================================================

export const performanceMonitorUtilities = {
  /**
   * Get appropriate color for FPS value
   */
  getFpsColor: (fps: number): string => {
    const tokens = performanceComponents.performanceMonitor;
    if (fps >= tokens.thresholds.fps.excellent) return tokens.colors.fps.excellent;
    if (fps >= tokens.thresholds.fps.minimum) return tokens.colors.fps.good;
    return tokens.colors.fps.poor;
  },

  /**
   * Get appropriate color for Memory value
   */
  getMemoryColor: (memoryMB: number): string => {
    const tokens = performanceComponents.performanceMonitor;
    if (memoryMB >= tokens.thresholds.memory.critical) return tokens.colors.memory.critical;
    if (memoryMB >= tokens.thresholds.memory.warning) return tokens.colors.memory.warning;
    return tokens.colors.memory.normal;
  },

  /**
   * Get appropriate color for Render Time value
   */
  getRenderTimeColor: (renderTimeMs: number): string => {
    const tokens = performanceComponents.performanceMonitor;
    if (renderTimeMs <= tokens.thresholds.renderTime.optimal) return tokens.colors.renderTime.optimal;
    if (renderTimeMs <= tokens.thresholds.renderTime.acceptable) return tokens.colors.renderTime.acceptable;
    return tokens.colors.renderTime.slow;
  },

  /**
   * Get CSS classes for metric value based on type and value
   */
  getMetricValueClasses: (type: 'fps' | 'memory' | 'render' | 'elements', value: number): string => {
    let colorClass = '';

    switch (type) {
      case 'fps':
        if (value >= 55) colorClass = 'text-green-600';
        else if (value >= 30) colorClass = 'text-orange-600';
        else colorClass = 'text-red-600';
        break;
      case 'memory':
        if (value > 500) colorClass = 'text-red-600';
        else if (value > 300) colorClass = 'text-orange-600';
        else colorClass = 'text-blue-600';
        break;
      case 'render':
        if (value > 16.67) colorClass = 'text-red-600';
        else if (value > 10) colorClass = 'text-orange-600';
        else colorClass = 'text-green-600';
        break;
      default:
        colorClass = 'text-blue-600';
    }

    return `text-lg font-semibold ${colorClass}`;
  },

  /**
   * Get CSS classes for action button variants
   */
  getActionButtonClasses: (variant: 'blue' | 'green' | 'purple', fullWidth: boolean = false): string => {
    const variantClasses = {
      blue: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100',
      green: 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100',
      purple: 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100'
    };

    const baseClasses = "flex items-center justify-center rounded border transition-colors gap-2 text-xs";
    const sizeClasses = fullWidth ? "px-4 py-2 w-full" : "px-3 py-1";
    const variantClass = variantClasses[variant];

    return `${baseClasses} ${sizeClasses} ${variantClass}`;
  },

  /**
   * Get CSS classes for FPS chart bars based on value
   */
  getChartBarClasses: (fpsValue: number): string => {
    if (fpsValue >= 55) return 'bg-green-500';
    if (fpsValue >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  },

  // ============================================================================
  // OVERLAY PANELS UTILITIES
  // ============================================================================

  /**
   * Get CSS classes για overlay panel container
   */
  getOverlayContainerClasses: (): string => {
    const tokens = performanceComponents.overlayPanels;
    return `fixed z-[${tokens.dimensions.zIndex}] max-w-[${tokens.dimensions.maxWidth}] min-w-[${tokens.dimensions.minWidth}] rounded-lg shadow-lg cursor-auto select-none`;
  },

  /**
   * Get inline styles για overlay panel container
   */
  getOverlayContainerStyles: (): React.CSSProperties => {
    const tokens = performanceComponents.overlayPanels;
    return {
      backgroundColor: tokens.colors.container.background,
      borderColor: tokens.colors.container.border,
      border: '1px solid'
    };
  },

  /**
   * Get CSS classes για overlay panel header
   */
  getOverlayHeaderClasses: (): string => {
    return 'p-4 pb-2 cursor-grab active:cursor-grabbing border-b';
  },

  /**
   * Get inline styles για overlay panel header
   */
  getOverlayHeaderStyles: (): React.CSSProperties => {
    const tokens = performanceComponents.overlayPanels;
    return {
      backgroundColor: tokens.colors.header.background,
      borderBottomColor: tokens.colors.header.border
    };
  },

  /**
   * Get inline styles για overlay panel content
   */
  getOverlayContentStyles: (): React.CSSProperties => {
    const tokens = performanceComponents.overlayPanels;
    return {
      backgroundColor: tokens.colors.container.background,
      padding: tokens.spacing.content,
      gap: tokens.spacing.grid
    };
  },

  /**
   * Get inline styles για overlay icons
   */
  getOverlayIconStyles: (type: 'primary' | 'secondary' | 'hover' = 'primary'): React.CSSProperties => {
    const tokens = performanceComponents.overlayPanels;
    return {
      color: tokens.colors.icons[type]
    };
  },

  /**
   * Get inline styles για overlay buttons
   */
  getOverlayButtonStyles: (isHovered: boolean = false): React.CSSProperties => {
    const tokens = performanceComponents.overlayPanels;
    const buttonState = isHovered ? tokens.colors.buttons.default.hover : tokens.colors.buttons.default;

    return {
      backgroundColor: buttonState.background,
      color: buttonState.text,
      transition: 'all 0.2s ease'
    };
  },

  /**
   * Get typography styles για overlay title
   */
  getOverlayTitleStyles: (): React.CSSProperties => {
    const tokens = performanceComponents.overlayPanels;
    return {
      fontSize: tokens.typography.title.fontSize,
      fontWeight: tokens.typography.title.fontWeight,
      color: tokens.typography.title.color,
      margin: tokens.typography.title.margin
    };
  }
} as const;

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

/**
 * 🔄 LEGACY SUPPORT: Re-export για backward compatibility
 */
export {
  performanceComponents as designTokenPerformanceComponents,
  virtualizationUtilities as designTokenVirtualizationUtilities,
  performanceMonitorUtilities as designTokenPerformanceMonitorUtilities
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type PerformanceComponents = typeof performanceComponents;
export type VirtualizationUtilities = typeof virtualizationUtilities;
export type PerformanceMonitorUtilities = typeof performanceMonitorUtilities;
export type VirtualizedTableComponents = typeof performanceComponents.virtualizedTable;
export type MetricsComponents = typeof performanceComponents.metrics;
export type PerformanceStates = typeof performanceComponents.states;
export type PerformanceMonitorTokens = typeof performanceComponents.performanceMonitor;

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