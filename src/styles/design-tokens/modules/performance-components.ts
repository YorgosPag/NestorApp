/**
 * 🏢 ENTERPRISE: Performance Components Module
 * Extracted from design-tokens.ts for modular architecture
 *
 * Contains: PerformanceComponentsType, performanceComponents, FloatingStyleUtils,
 *           PerformanceDashboardTokens, performanceMonitorUtilities
 */

import * as React from 'react';
import { colors, semanticColors, spacing, typography, animation } from './foundations';
import { borderRadius } from './borders';
import { zIndex } from './layout';
import { layoutUtilities } from './layout-utilities-constants';

export interface PerformanceComponentsType {
  readonly performanceMonitor: {
    readonly dimensions: {
      readonly estimatedHeight: number;
      readonly maxWidth: string;
      readonly minWidth: string;
    };
    readonly colors: {
      readonly fps: {
        readonly excellent: string;
        readonly poor: string;
      };
      readonly alerts: {
        readonly background: string;
        readonly border: string;
        readonly text: string;
        readonly icon: string;
      };
    };
  };
  readonly virtualizedTable: {
    readonly className: string;
    readonly container: React.CSSProperties;
    readonly header: {
      readonly container: React.CSSProperties;
    };
    readonly virtualList: React.CSSProperties;
    readonly row: {
      readonly base: React.CSSProperties;
      readonly even: React.CSSProperties;
      readonly selected: React.CSSProperties;
      readonly hover: React.CSSProperties;
    };
    readonly cell: {
      readonly base: React.CSSProperties;
    };
    readonly mobile: React.CSSProperties;
  };
  readonly virtualizedImage: {
    readonly container: {
      readonly base: React.CSSProperties;
    };
    readonly image: {
      readonly base: React.CSSProperties;
    };
    readonly placeholder: React.CSSProperties;
  };
  readonly metrics: {
    readonly dashboard: {
      readonly container: React.CSSProperties;
    };
    readonly card: {
      readonly base: React.CSSProperties;
      readonly title: React.CSSProperties;
      readonly value: React.CSSProperties;
    };
  };
  readonly loading: {
    readonly container: React.CSSProperties;
    readonly content: React.CSSProperties;
    readonly spinner: {
      readonly container: React.CSSProperties;
      readonly element: React.CSSProperties;
    };
    readonly text: React.CSSProperties;
  };
  readonly performanceMetrics: {
    readonly container: React.CSSProperties;
    readonly section: {
      readonly border: React.CSSProperties;
      readonly title: React.CSSProperties;
    };
    readonly metric: {
      readonly label: React.CSSProperties;
      readonly timestamp: React.CSSProperties;
    };
    readonly alerts: {
      readonly severity: {
        readonly critical: string;
        readonly high: string;
        readonly medium: string;
        readonly low: string;
      };
      readonly item: {
        readonly base: React.CSSProperties;
        readonly title: React.CSSProperties;
        readonly description: React.CSSProperties;
        readonly timestamp: React.CSSProperties;
      };
    };
  };
}

export const performanceComponents: PerformanceComponentsType = {
  performanceMonitor: {
    dimensions: {
      estimatedHeight: 300,
      maxWidth: '400px',
      minWidth: '320px'
    },
    colors: {
      fps: {
        excellent: semanticColors.status.success,
        poor: semanticColors.status.error
      },
      alerts: {
        background: colors.background.secondary,
        border: colors.border.primary,
        text: colors.text.primary,
        icon: semanticColors.status.warning
      }
    }
  },
  virtualizedTable: {
    className: 'virtualizedTable',
    container: {
      display: layoutUtilities.display.flex,
      flexDirection: 'column',
      width: layoutUtilities.dimensions.full,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.md,
      overflow: 'hidden'
    },
    header: {
      container: {
        display: layoutUtilities.display.flex,
        alignItems: 'center',
        borderBottom: `1px solid ${colors.border.primary}`,
        backgroundColor: colors.background.secondary,
        fontWeight: typography.fontWeight.semibold
      }
    },
    virtualList: {
      position: layoutUtilities.positioning.relative,
      width: layoutUtilities.dimensions.full
    },
    row: {
      base: {
        display: layoutUtilities.display.flex,
        alignItems: 'center',
        borderBottom: `1px solid ${colors.border.secondary}`,
        transition: `background-color ${animation.duration.fast}`
      },
      even: {
        backgroundColor: colors.background.secondary
      },
      selected: {
        backgroundColor: colors.background.accent
      },
      hover: {
        backgroundColor: colors.background.hover
      }
    },
    cell: {
      base: {
        display: layoutUtilities.display.flex,
        alignItems: 'center',
        padding: `${spacing.sm} ${spacing.md}`
      }
    },
    mobile: {
      fontSize: typography.fontSize.sm
    }
  },
  virtualizedImage: {
    container: {
      base: {
        position: layoutUtilities.positioning.relative,
        overflow: 'hidden',
        borderRadius: borderRadius.sm,
        backgroundColor: colors.background.secondary
      }
    },
    image: {
      base: {
        width: layoutUtilities.dimensions.full,
        height: layoutUtilities.dimensions.full,
        objectFit: 'cover',
        transition: `opacity ${animation.duration.fast}`
      }
    },
    placeholder: {
      position: layoutUtilities.positioning.absolute,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      display: layoutUtilities.display.flex,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.secondary
    }
  },
  metrics: {
    dashboard: {
      container: {
        display: layoutUtilities.display.grid,
        gap: spacing.md
      }
    },
    card: {
      base: {
        backgroundColor: colors.background.primary,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: borderRadius.md,
        padding: spacing.md
      },
      title: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold,
        color: colors.text.secondary
      },
      value: {
        fontSize: typography.fontSize.lg,
        fontWeight: typography.fontWeight.semibold,
        color: colors.text.primary
      }
    }
  },
  loading: {
    container: {
      display: layoutUtilities.display.flex,
      alignItems: 'center',
      justifyContent: 'center',
      width: layoutUtilities.dimensions.full,
      height: layoutUtilities.dimensions.full
    },
    content: {
      display: layoutUtilities.display.flex,
      flexDirection: 'column',
      alignItems: 'center',
      gap: spacing.sm
    },
    spinner: {
      container: {
        display: layoutUtilities.display.flex,
        alignItems: 'center',
        justifyContent: 'center'
      },
      element: {
        width: spacing.lg,
        height: spacing.lg,
        borderRadius: borderRadius.full,
        border: `2px solid ${colors.border.tertiary}`,
        borderTop: `2px solid ${colors.primary["500"]}`
      }
    },
    text: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary
    }
  },
  performanceMetrics: {
    container: {
      display: layoutUtilities.display.flex,
      flexDirection: 'column',
      gap: spacing.md
    },
    section: {
      border: {
        borderBottom: `1px solid ${colors.border.secondary}`,
        paddingBottom: spacing.sm
      },
      title: {
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.semibold
      }
    },
    metric: {
      label: {
        fontSize: typography.fontSize.xs,
        color: colors.text.secondary
      },
      timestamp: {
        fontSize: typography.fontSize.xs,
        color: colors.text.tertiary
      }
    },
    alerts: {
      severity: {
        critical: semanticColors.status.error,
        high: semanticColors.status.warning,
        medium: semanticColors.status.info,
        low: semanticColors.status.success
      },
      item: {
        base: {
          border: `1px solid ${colors.border.primary}`,
          borderRadius: borderRadius.sm,
          padding: spacing.sm,
          backgroundColor: colors.background.secondary
        },
        title: {
          fontSize: typography.fontSize.sm,
          fontWeight: typography.fontWeight.semibold
        },
        description: {
          fontSize: typography.fontSize.xs,
          color: colors.text.secondary
        },
        timestamp: {
          fontSize: typography.fontSize.xs,
          color: colors.text.tertiary
        }
      }
    }
  }
} as const;

// Floating system utilities
export const FloatingStyleUtils = {
  getPerformanceDashboardClasses: (isDragging: boolean) => `${isDragging ? 'opacity-70' : ''}`,
  getCornerButtonClasses: (position: string) => `absolute ${position === 'top-right' ? 'top-2 right-2' : ''}`
};

export const PerformanceDashboardTokens = {
  behavior: {
    autoCenter: true
  }
};

// Performance Monitor Utilities
// 🏢 ENTERPRISE: Draggable floating panels - OPAQUE backgrounds (no transparency!)
export const performanceMonitorUtilities = {
  // ✅ ENTERPRISE FIX: Use bg-card (standard Tailwind) instead of arbitrary bg-[hsl(...)]
  // This ensures solid, opaque backgrounds for draggable panels
  // ✅ CRITICAL: pointer-events-auto ensures panels work even when parent has pointer-events-none
  getOverlayContainerClasses: () => 'fixed bg-card border border-border rounded-lg shadow-lg pointer-events-auto',
  // ✅ ENTERPRISE FIX: Use higher z-index (1700) to ensure panels are ALWAYS above canvas overlays
  getOverlayContainerStyles: () => ({ zIndex: zIndex.toast }),  // 1700 - above all canvas elements
  // 🏢 ENTERPRISE: Standardized 8px padding (p-2) for consistent spacing across all floating panels
  getOverlayHeaderClasses: () => 'flex items-center justify-between p-2 border-b border-border cursor-grab pointer-events-auto',
  // ✅ ENTERPRISE FIX: Removed inline backgroundColor - using Tailwind classes for consistency
  getOverlayHeaderStyles: () => ({}),
  // ✅ ENTERPRISE FIX: Return empty objects - use Tailwind classes in components for theme-aware colors
  getOverlayIconStyles: (type: string) => ({}),
  getOverlayTitleStyles: () => ({}),
  getOverlayButtonStyles: () => ({
    color: colors.text.secondary,
    padding: spacing.xs
  }),
  // ✅ ENTERPRISE: Content styles - no maxHeight restriction for full content visibility
  getOverlayContentStyles: () => ({}),
  getMetricValueClasses: (type: string, value: number) =>
    value > 50 ? 'text-green-600' : 'text-red-600',
  getActionButtonClasses: (variant: string, fullWidth: boolean) =>
    `${variant === 'primary' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} ${fullWidth ? 'w-full' : ''}`,
  getChartBarClasses: (value: number) =>
    value > 70 ? 'bg-green-500' : value > 40 ? 'bg-yellow-500' : 'bg-red-500',

  // 🏢 ENTERPRISE: Trend indicator color classes (NO inline styles!)
  // @since 2026-01-02 - Added for full centralization compliance
  getTrendColorClass: (direction: 'up' | 'down'): string =>
    direction === 'up' ? 'text-green-600' : 'text-red-600',

  // 🏢 ENTERPRISE: Success state classes for performance optimization panel
  // Returns consistent Tailwind classes instead of inline style={{ color }}
  getSuccessStateClasses: (): { icon: string; text: string } => ({
    icon: 'text-green-600',
    text: 'text-green-600'
  }),

  // 🏢 ENTERPRISE: Performance grade color classes
  // Maps performance grades to semantic Tailwind classes
  getPerformanceGradeClasses: (grade: 'excellent' | 'good' | 'fair' | 'poor'): string => {
    const gradeClassMap: Record<string, string> = {
      excellent: 'text-green-600',
      good: 'text-green-500',
      fair: 'text-yellow-600',
      poor: 'text-red-600'
    };
    return gradeClassMap[grade] || 'text-muted-foreground';
  }
};
