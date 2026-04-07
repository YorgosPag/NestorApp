/**
 * ALERT SERVICE - ENTERPRISE INTEGRATION
 *
 * Enterprise-class alert service που integrates με existing Alert Engine
 * Split from monolithic CloudInfrastructure.ts για modular architecture
 * ZERO DUPLICATES: Uses existing Alert Engine System
 *
 * Alert senders extracted to alert-senders.ts (ADR-065)
 *
 * @module enterprise/services/alert-service
 * @version 1.1.0 - ADR-065 split
 */

import { createModuleLogger } from '@/lib/telemetry';
import {
  sendHealthAlert,
  sendComponentAlert,
  sendCostAlert,
  sendSecurityAlert,
  sendPerformanceAlert,
  sendAvailabilityAlert,
} from './alert-senders';
import type { AlertSeverity, AlertEngineSender } from './alert-senders';
import type { ActiveAlert, SecurityIncident } from '../types/status';
import type { InfrastructureStatus, ComponentStatus } from '../types/infrastructure';

const logger = createModuleLogger('AlertService');

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Alert data structure */
interface AlertData {
  id?: string;
  type: string;
  title?: string;
  message?: string;
  description?: string;
  severity?: AlertSeverity;
  source?: string;
  timestamp?: Date;
  acknowledged?: boolean;
  assignee?: string;
  estimatedResolution?: Date;
  metadata?: Record<string, unknown>;
}

/** Analytics event structure */
interface AnalyticsEvent {
  id: string;
  type: string;
  timestamp: Date;
  message: string;
  severity: AlertSeverity;
  source: string;
  metadata?: Record<string, unknown>;
}

/** Alert creation arguments */
type CreateAlertArgs = [
  type: string,
  title: string,
  description: string,
  severity: AlertSeverity,
  source: string,
  metadata?: Record<string, unknown>
];

// ENTERPRISE: Mock Alert Engine για compilation
const geoAlertEngine = {
  reportAlert: (alert: AlertData) => console.debug('🚨 Alert Engine:', alert),
  processAlert: (alert: AlertData) => ({ processed: true, alert }),
  getActiveAlerts: () => ({
    active: [] as AlertData[],
    total: 0,
    bySeverity: {} as Record<string, number>,
    byType: {} as Record<string, number>,
    escalations: 0
  }),
  createAlert: (...args: CreateAlertArgs) => ({ id: Date.now().toString(), type: args[0] }),
  isSystemInitialized: true,
  initialize: () => ({ success: true, error: null }),
  generateQuickReport: () => ({
    status: 'ok',
    alerts: {
      active: [] as AlertData[],
      total: 0,
      bySeverity: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      escalations: 0
    },
    metrics: {
      uptime: 100,
      averageResolutionTime: 0
    }
  }),
  analytics: {
    track: (event: AnalyticsEvent) => console.debug('📊 Analytics:', event),
    getMetrics: () => ({ totalAlerts: 0, resolvedAlerts: 0 }),
    ingestEvent: (event: AnalyticsEvent) => console.debug('📊 Analytics:', event)
  }
};

// ============================================================================
// ALERT SERVICE CLASS
// ============================================================================

/**
 * Alert Service - Enterprise integration με Alert Engine
 * Enterprise: Unified alerting system για cloud infrastructure
 * INTEGRATES: Existing Alert Engine για ZERO code duplication
 */
export class AlertService {
  private alertEngine = geoAlertEngine;
  private isInitialized: boolean = false;

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  public async initialize(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.alertEngine.isSystemInitialized) {
        const initResult = await this.alertEngine.initialize();
        if (!initResult.success) {
          return { success: false, error: `Alert Engine initialization failed: ${initResult.error}` };
        }
      }
      this.isInitialized = true;
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Alert service initialization failed';
      return { success: false, error: errorMessage };
    }
  }

  // ========================================================================
  // DELEGATED ALERT SENDERS (see alert-senders.ts)
  // ========================================================================

  private get sender(): AlertEngineSender {
    return this.alertEngine;
  }

  public async sendHealthAlert(
    status: InfrastructureStatus,
    alertType: 'critical' | 'degraded' | 'recovered'
  ): Promise<void> {
    return sendHealthAlert(this.sender, status, alertType);
  }

  public async sendComponentAlert(
    component: ComponentStatus,
    alertType: 'failure' | 'recovery' | 'degradation'
  ): Promise<void> {
    return sendComponentAlert(this.sender, component, alertType);
  }

  public async sendCostAlert(
    currentSpend: number,
    budgetLimit: number,
    utilizationPercent: number
  ): Promise<void> {
    return sendCostAlert(this.sender, currentSpend, budgetLimit, utilizationPercent);
  }

  public async sendSecurityAlert(incident: SecurityIncident): Promise<void> {
    return sendSecurityAlert(this.sender, incident);
  }

  public async sendPerformanceAlert(
    metric: string,
    currentValue: number,
    threshold: number,
    unit: string = ''
  ): Promise<void> {
    return sendPerformanceAlert(this.sender, metric, currentValue, threshold, unit);
  }

  public async sendAvailabilityAlert(
    currentAvailability: number,
    slaTarget: number,
    timeWindow: string = '24h'
  ): Promise<void> {
    return sendAvailabilityAlert(this.sender, currentAvailability, slaTarget, timeWindow);
  }

  // ========================================================================
  // ALERT MANAGEMENT
  // ========================================================================

  public async getActiveAlerts(
    filterType?: string,
    severity?: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<ActiveAlert[]> {
    try {
      const report = await this.alertEngine.generateQuickReport();
      let alerts = report.alerts?.active || [];

      const normalizeAlertType = (type?: string): ActiveAlert['type'] => {
        switch (type) {
          case 'performance':
          case 'security':
          case 'cost':
          case 'availability':
          case 'resource':
            return type;
          default:
            return 'availability';
        }
      };

      const normalizeAlertSeverity = (level?: AlertSeverity): ActiveAlert['severity'] => {
        switch (level) {
          case 'low':
          case 'medium':
          case 'high':
          case 'critical':
            return level;
          default:
            return 'low';
        }
      };

      if (filterType) {
        alerts = alerts.filter((alert: AlertData) => alert.type === filterType);
      }
      if (severity) {
        alerts = alerts.filter((alert: AlertData) => alert.severity === severity);
      }

      return alerts.map((alert: AlertData) => ({
        id: alert.id ?? '',
        type: normalizeAlertType(alert.type),
        severity: normalizeAlertSeverity(alert.severity),
        title: alert.title || alert.message || '',
        description: alert.description || alert.message || '',
        source: alert.source || 'cloud-infrastructure',
        timestamp: alert.timestamp || new Date(),
        acknowledged: alert.acknowledged || false,
        assignee: alert.assignee,
        estimatedResolution: alert.estimatedResolution
      }));
    } catch (error) {
      logger.error('Failed to get active alerts', { error });
      return [];
    }
  }

  public async acknowledgeAlert(
    alertId: string,
    assignee?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.alertEngine.analytics.ingestEvent({
        id: `alert_ack_${Date.now()}`,
        type: 'alert',
        timestamp: new Date(),
        message: `Alert ${alertId} acknowledged${assignee ? ` by ${assignee}` : ''}`,
        severity: 'info',
        source: 'AlertService',
        metadata: { alertId, assignee }
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to acknowledge alert';
      return { success: false, error: errorMessage };
    }
  }

  public async resolveAlert(
    alertId: string,
    resolution: string,
    resolvedBy?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.alertEngine.analytics.ingestEvent({
        id: `alert_resolve_${Date.now()}`,
        type: 'alert',
        timestamp: new Date(),
        message: `Alert ${alertId} resolved: ${resolution}${resolvedBy ? ` by ${resolvedBy}` : ''}`,
        severity: 'info',
        source: 'AlertService',
        metadata: { alertId, resolution, resolvedBy }
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resolve alert';
      return { success: false, error: errorMessage };
    }
  }

  // ========================================================================
  // ALERT STATISTICS
  // ========================================================================

  public async getAlertStatistics(
    _timeRange: { start: Date; end: Date }
  ): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    averageResolutionTime: number;
    escalations: number;
  }> {
    try {
      const report = await this.alertEngine.generateQuickReport();
      return {
        total: report.alerts?.total || 0,
        bySeverity: report.alerts?.bySeverity || {},
        byType: report.alerts?.byType || {},
        averageResolutionTime: report.metrics?.averageResolutionTime || 0,
        escalations: report.alerts?.escalations || 0
      };
    } catch (error) {
      logger.error('Failed to get alert statistics', { error });
      return {
        total: 0,
        bySeverity: {},
        byType: {},
        averageResolutionTime: 0,
        escalations: 0
      };
    }
  }

  // ========================================================================
  // GETTERS
  // ========================================================================

  public get isReady(): boolean {
    return this.isInitialized;
  }

  public get alertEngineHealth(): boolean {
    return this.alertEngine.isSystemInitialized;
  }
}
