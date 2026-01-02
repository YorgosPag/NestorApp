/**
 * @fileoverview Performance Components - Public API
 * @module core/performance/components
 *
 * Google-style barrel export for performance monitoring components.
 * Clean public API with explicit exports.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 * @since 2026-01-02
 */

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export { GlobalPerformanceDashboard } from './GlobalPerformanceDashboard';
export type { GlobalPerformanceDashboardProps } from './GlobalPerformanceDashboard';

// ============================================================================
// SHARED COMPONENTS (Reusable)
// ============================================================================

export {
  MetricCard,
  PerformanceChart,
  PerformanceGradeBadge
} from './shared';

export type {
  MetricCardProps,
  PerformanceChartProps,
  PerformanceDataPoint,
  PerformanceGradeBadgeProps
} from './shared';

// ============================================================================
// SECTION COMPONENTS (Dashboard-specific)
// ============================================================================

export {
  CurrentMetrics,
  PerformanceAlerts,
  QuickActions,
  OptimizationPanel
} from './sections';

export type {
  CurrentMetricsProps,
  PerformanceMetrics,
  PerformanceAlertsProps,
  PerformanceAlert,
  QuickActionsProps,
  PerformanceControls,
  Recommendation,
  OptimizationPanelProps,
  OptimizationRecommendation
} from './sections';

// ============================================================================
// UTILITIES
// ============================================================================

export {
  getTrend,
  getGradeStatusColor,
  formatMetricValue,
  getInitialPosition,
  PANEL_DIMENSIONS,
  PERFORMANCE_THRESHOLDS
} from './utils/performance-utils';

export type {
  TrendDirection,
  MetricType,
  PerformanceGrade
} from './utils/performance-utils';
