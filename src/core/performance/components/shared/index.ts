/**
 * @fileoverview Shared Performance Components - Barrel Export
 * @module core/performance/components/shared
 *
 * Reusable components that can be used across different dashboards.
 * Google-style: Clean public API with explicit exports.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 * @since 2026-01-02
 */

// ============================================================================
// COMPONENT EXPORTS
// ============================================================================

export { MetricCard } from './MetricCard';
export type { MetricCardProps } from './MetricCard';

export { PerformanceChart } from './PerformanceChart';
export type { PerformanceChartProps, PerformanceDataPoint } from './PerformanceChart';

export { PerformanceGradeBadge } from './PerformanceGradeBadge';
export type { PerformanceGradeBadgeProps } from './PerformanceGradeBadge';
