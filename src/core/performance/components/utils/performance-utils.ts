/**
 * @fileoverview Performance Dashboard Utility Functions
 * @module core/performance/components/utils
 *
 * Pure utility functions για performance calculations.
 * Google-style: Single responsibility, pure functions, type-safe.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 * @since 2026-01-02
 */

// ============================================================================
// TYPES
// ============================================================================

/** Trend direction indicator */
export type TrendDirection = 'up' | 'down' | null;

/** Metric type for value classification */
export type MetricType = 'fps' | 'memory' | 'render' | 'elements';

/** Performance grade levels */
export type PerformanceGrade = 'excellent' | 'good' | 'warning' | 'poor';

// ============================================================================
// TREND UTILITIES
// ============================================================================

/**
 * Calculates trend direction based on current value vs optimal threshold.
 *
 * @param current - Current metric value
 * @param optimal - Optimal/target value
 * @param inverted - If true, lower is better (e.g., memory, render time)
 * @returns Trend direction: 'up' (good), 'down' (bad), or null
 *
 * @example
 * // FPS: higher is better
 * getTrend(60, 60) // 'up' (at optimal)
 * getTrend(30, 60) // 'down' (below optimal)
 *
 * // Memory: lower is better (inverted)
 * getTrend(200, 256, true) // 'up' (below limit)
 * getTrend(300, 256, true) // 'down' (above limit)
 */
export function getTrend(
  current: number,
  optimal: number,
  inverted = false
): TrendDirection {
  if (!optimal) return null;

  const isGood = inverted
    ? current < optimal
    : current > optimal * 0.9;

  return isGood ? 'up' : 'down';
}

// ============================================================================
// GRADE UTILITIES
// ============================================================================

/**
 * Maps performance grade string to semantic status color.
 *
 * @param grade - Performance grade string
 * @returns Semantic color key for design system
 */
export function getGradeStatusColor(
  grade: string
): 'success' | 'warning' | 'error' | 'info' {
  switch (grade) {
    case 'excellent':
    case 'good':
      return 'success';
    case 'warning':
      return 'warning';
    case 'poor':
    case 'critical':
      return 'error';
    default:
      return 'info';
  }
}

// ============================================================================
// VALUE FORMATTING
// ============================================================================

/**
 * Formats numeric value with appropriate decimal places.
 *
 * @param value - Numeric value to format
 * @param threshold - Values below this get 1 decimal place
 * @returns Formatted string
 *
 * @example
 * formatMetricValue(50) // "50"
 * formatMetricValue(8.5) // "8.5"
 * formatMetricValue(0.123) // "0.1"
 */
export function formatMetricValue(value: number, threshold = 10): string {
  if (typeof value !== 'number' || isNaN(value)) return '—';
  return value.toFixed(value < threshold ? 1 : 0);
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default panel dimensions for performance dashboard */
export const PANEL_DIMENSIONS = {
  width: 400,
  height: 500
} as const;

/** Performance thresholds for metric evaluation */
export const PERFORMANCE_THRESHOLDS = {
  fps: {
    excellent: 60,
    good: 45,
    warning: 30,
    poor: 15
  },
  memory: {
    excellent: 128,
    good: 256,
    warning: 384,
    poor: 512
  },
  renderTime: {
    excellent: 8,
    good: 16,
    warning: 33,
    poor: 50
  }
} as const;

/**
 * Calculates initial panel position (top-right corner).
 * SSR-safe: returns fallback if window is undefined.
 *
 * @returns Position coordinates {x, y}
 */
export function getInitialPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return { x: 100, y: 100 };
  }
  return {
    x: window.innerWidth - PANEL_DIMENSIONS.width - 30,
    y: 100
  };
}
