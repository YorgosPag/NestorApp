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

/**
 * 🏢 ENTERPRISE: Centralized Performance Thresholds
 *
 * SINGLE SOURCE OF TRUTH για όλα τα performance thresholds.
 * Χρησιμοποιείται από: DxfPerformanceOptimizer, DxfViewerContent, PerformanceDashboard
 *
 * @see CLAUDE.md - Rule N.1: Enterprise-grade solutions
 * @see ADR-019 in docs/centralized-systems/reference/adr-index.md
 */
export const PERFORMANCE_THRESHOLDS = {
  fps: {
    /** Excellent: 60+ FPS (smooth animations) */
    excellent: 60,
    /** Good: 45+ FPS (acceptable for CAD) */
    good: 45,
    /** Warning: 30+ FPS (noticeable lag) */
    warning: 30,
    /** Poor: <15 FPS (unusable) */
    poor: 15,
    /** Minimum target FPS for alerts */
    minTarget: 45
  },
  memory: {
    /** Excellent: <128MB */
    excellent: 128,
    /** Good: <256MB */
    good: 256,
    /** Warning: <384MB */
    warning: 384,
    /** Poor: >512MB */
    poor: 512,
    /** Maximum allowed memory (MB) for DXF Viewer */
    maxAllowed: 512,
    /** Trigger GC when above this percentage of maxAllowed */
    gcTriggerPercent: 0.7
  },
  renderTime: {
    /** Excellent: <8ms per frame */
    excellent: 8,
    /** Good: <16.67ms (60fps budget) */
    good: 16.67,
    /** Warning: <33ms (30fps budget) */
    warning: 33,
    /** Poor: >50ms */
    poor: 50
  },
  loadTime: {
    /** Excellent: <1000ms */
    excellent: 1000,
    /** Good: <2500ms (Lighthouse target) */
    good: 2500,
    /** Warning: <5000ms */
    warning: 5000,
    /** Poor: >7000ms */
    poor: 7000
  }
} as const;

/** TypeScript type for PERFORMANCE_THRESHOLDS */
export type PerformanceThresholds = typeof PERFORMANCE_THRESHOLDS;

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
