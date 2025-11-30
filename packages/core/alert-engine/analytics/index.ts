/**
 * ANALYTICS MODULE INDEX
 * Geo-Alert System - Phase 5: Event Analytics & Reporting
 *
 * Centralized exports για όλα τα analytics components και services.
 */

// ============================================================================
// ANALYTICS ENGINE
// ============================================================================

import { EventAnalyticsEngine } from './EventAnalyticsEngine';

export {
  EventAnalyticsEngine,
  eventAnalyticsEngine as defaultAnalyticsEngine
} from './EventAnalyticsEngine';

export type {
  AnalyticsTimeRange,
  EventMetrics,
  AlertMetrics,
  RuleMetrics,
  NotificationMetrics,
  ExecutiveMetrics,
  AnalyticsReport,
  AnalyticsInsight,
  AnalyticsRecommendation,
  AlertTrendAnalysis,
  AlertResolutionMetrics,
  AlertPattern,
  RulePerformanceStats,
  RuleEffectivenessAnalysis,
  NotificationMetrics as NotificationAnalytics,
  NotificationRetryAnalysis,
  ChannelPerformanceStats,
  TimeSeriesPoint,
  PeakPeriod,
  SeasonalPattern,
  TrendAnomaly,
  AlertPrediction,
  AlertTypeFrequency,
  CostMetrics
} from './EventAnalyticsEngine';

// ============================================================================
// ANALYTICS DASHBOARD
// ============================================================================

export { default as AnalyticsDashboard } from './AnalyticsDashboard';
export { AnalyticsDashboard as EventAnalyticsDashboard } from './AnalyticsDashboard';

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Initialize analytics system
 */
export const initializeAnalytics = () => {
  const engine = EventAnalyticsEngine.getInstance();
  return engine;
};

/**
 * Generate quick report για specified time range
 */
export const generateQuickReport = async (
  start: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
  end: Date = new Date(),
  granularity: 'minute' | 'hour' | 'day' | 'week' | 'month' = 'hour'
) => {
  const engine = EventAnalyticsEngine.getInstance();
  const timeRange = { start, end, granularity };

  return await engine.generateComprehensiveReport(timeRange, {
    includeExecutiveSummary: true,
    includeDetailedAnalysis: false,
    includeRecommendations: true,
    includeExports: false
  });
};

/**
 * Get real-time system health metrics
 */
export const getSystemHealthMetrics = async () => {
  const engine = EventAnalyticsEngine.getInstance();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const timeRange = {
    start: oneHourAgo,
    end: now,
    granularity: 'minute' as const
  };

  const [eventMetrics, alertMetrics, ruleMetrics, notificationMetrics] = await Promise.all([
    engine.computeEventMetrics(timeRange),
    engine.computeAlertMetrics(timeRange),
    engine.computeRuleMetrics(timeRange),
    engine.computeNotificationMetrics(timeRange)
  ]);

  return {
    timestamp: now,
    eventCount: eventMetrics.totalEvents,
    activeAlerts: alertMetrics.alertsByStatus.active || 0,
    ruleSuccessRate: ruleMetrics.ruleSuccessRate,
    notificationSuccessRate: notificationMetrics.deliverySuccessRate,
    systemStatus: (alertMetrics.alertsByStatus.active || 0) > 5 ? 'degraded' : 'healthy'
  };
};

/**
 * Export analytics data για external systems
 */
export const exportAnalyticsData = async (
  timeRange: AnalyticsTimeRange,
  format: 'json' | 'csv' = 'json'
) => {
  const engine = EventAnalyticsEngine.getInstance();
  const report = await engine.generateComprehensiveReport(timeRange);

  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  } else {
    // Simple CSV export για executive metrics
    const csvData = [
      'Metric,Value,Unit',
      `System Health Score,${report.executiveMetrics.systemHealthScore},%`,
      `Alert Resolution Efficiency,${report.executiveMetrics.alertResolutionEfficiency},%`,
      `False Positive Rate,${report.executiveMetrics.falsePositiveRate},%`,
      `System Uptime,${report.executiveMetrics.systemUptime},%`,
      `User Satisfaction Score,${report.executiveMetrics.userSatisfactionScore},/5`,
      `Total Events,${report.eventMetrics.totalEvents},count`,
      `Total Alerts,${report.alertMetrics.totalAlerts},count`,
      `Active Rules,${report.ruleMetrics.activeRules},count`,
      `Total Notifications,${report.notificationMetrics.totalNotifications},count`
    ].join('\n');

    return csvData;
  }
};