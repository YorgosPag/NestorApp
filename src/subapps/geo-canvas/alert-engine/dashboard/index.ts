/**
 * DASHBOARD MODULE INDEX
 * Geo-Alert System - Phase 5: Real-time Monitoring Dashboard
 *
 * Centralized exports για όλα τα dashboard components και services.
 */

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export { default as AlertMonitoringDashboard } from './AlertMonitoringDashboard';
export { AlertMonitoringDashboard as Dashboard } from './AlertMonitoringDashboard';

// ============================================================================
// DASHBOARD SERVICE LAYER
// ============================================================================

export {
  DashboardService,
  dashboardService as defaultDashboardService
} from './DashboardService';

export type {
  DashboardMetrics,
  AlertTrendPoint,
  RuleTrendPoint,
  NotificationTrendPoint,
  RealTimeEvent,
  DashboardConfig
} from './DashboardService';

// ============================================================================
// REACT HOOKS
// ============================================================================

export {
  useDashboard,
  useDashboardMetrics,
  useDashboardEvents,
  useSystemStatus
} from './useDashboard';

export type {
  UseDashboardOptions,
  UseDashboardResult
} from './useDashboard';

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * All-in-one dashboard initialization
 */
export const initializeDashboard = async () => {
  const service = DashboardService.getInstance();
  return service;
};

/**
 * Quick access για system health
 */
export const getSystemHealth = async () => {
  const service = DashboardService.getInstance();
  const metrics = await service.getDashboardMetrics();
  return {
    status: metrics.system.status,
    uptime: metrics.system.uptime,
    lastUpdate: metrics.system.lastUpdate,
    alerts: metrics.alerts.active,
    performance: metrics.system.performanceMetrics
  };
};

/**
 * Emergency dashboard reset
 */
export const resetDashboard = () => {
  const service = DashboardService.getInstance();
  service.clearEvents();
  service.dispose();
  return DashboardService.getInstance();
};