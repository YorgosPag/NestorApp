/**
 * @fileoverview Dashboard Sections - Barrel Export
 * @module core/performance/components/sections
 *
 * Dashboard-specific section components.
 * Google-style: Clean public API with explicit exports.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 * @since 2026-01-02
 */

// ============================================================================
// COMPONENT EXPORTS
// ============================================================================

export { CurrentMetrics } from './CurrentMetrics';
export type { CurrentMetricsProps, PerformanceMetrics } from './CurrentMetrics';

export { PerformanceAlerts } from './PerformanceAlerts';
export type { PerformanceAlertsProps, PerformanceAlert } from './PerformanceAlerts';

export { QuickActions } from './QuickActions';
export type { QuickActionsProps, PerformanceControls, Recommendation } from './QuickActions';

export { OptimizationPanel } from './OptimizationPanel';
export type { OptimizationPanelProps, OptimizationRecommendation } from './OptimizationPanel';
