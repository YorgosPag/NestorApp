/**
 * ALERT SERVICE - ENTERPRISE INTEGRATION
 *
 * Enterprise-class alert service που integrates με existing Alert Engine
 * Split from monolithic CloudInfrastructure.ts για modular architecture
 * ZERO DUPLICATES: Uses existing Alert Engine System
 *
 * @module enterprise/services/alert-service
 * @version 1.0.0 - ENTERPRISE MODULAR SPLITTING
 * @updated 2025-12-28 - Split from CloudInfrastructure.ts
 */

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Alert severity levels */
type AlertSeverity = 'low' | 'medium' | 'high' | 'critical' | 'info';

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

// ENTERPRISE: Mock Alert Engine για compilation - θα συνδεθεί με πραγματικό Alert Engine
const geoAlertEngine = {
  reportAlert: (alert: AlertData) => console.log('🚨 Alert Engine:', alert),
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
    track: (event: AnalyticsEvent) => console.log('📊 Analytics:', event),
    getMetrics: () => ({ totalAlerts: 0, resolvedAlerts: 0 }),
    ingestEvent: (event: AnalyticsEvent) => console.log('📊 Analytics:', event)
  }
};

import type { ActiveAlert, SecurityIncident } from '../types/status';
import type { InfrastructureStatus, ComponentStatus } from '../types/infrastructure';

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

  /**
   * Initialize alert service
   * Enterprise: Integrates με existing Alert Engine
   */
  public async initialize(): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Ensure Alert Engine is initialized
      if (!this.alertEngine.isSystemInitialized) {
        const initResult = await this.alertEngine.initialize();
        if (!initResult.success) {
          return {
            success: false,
            error: `Alert Engine initialization failed: ${initResult.error}`
          };
        }
      }

      this.isInitialized = true;
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Alert service initialization failed';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // ========================================================================
  // INFRASTRUCTURE ALERTS
  // ========================================================================

  /**
   * Send infrastructure health alert
   * Enterprise: Infrastructure-specific alert patterns
   */
  public async sendHealthAlert(
    status: InfrastructureStatus,
    alertType: 'critical' | 'degraded' | 'recovered'
  ): Promise<void> {
    try {
      const severity = alertType === 'critical' ? 'critical' :
                     alertType === 'degraded' ? 'high' : 'medium';

      const title = `Infrastructure ${alertType === 'recovered' ? 'Recovery' : 'Health Alert'}`;
      const description = this.buildHealthAlertDescription(status, alertType);

      await this.alertEngine.createAlert(
        'infrastructure-health',
        title,
        description,
        severity,
        'cloud-infrastructure',
        {
          overall: status.overall,
          timestamp: status.timestamp,
          componentCount: status.components.length,
          providerCount: status.providers.length
        }
      );

    } catch (error) {
      console.error('Failed to send health alert:', error);
    }
  }

  /**
   * Send component failure alert
   * Enterprise: Component-specific alerting
   */
  public async sendComponentAlert(
    component: ComponentStatus,
    alertType: 'failure' | 'recovery' | 'degradation'
  ): Promise<void> {
    try {
      const severity = alertType === 'failure' ? 'high' :
                     alertType === 'degradation' ? 'medium' : 'low';

      const title = `Component ${component.name} ${alertType === 'recovery' ? 'Recovered' : 'Issue'}`;
      const description = this.buildComponentAlertDescription(component, alertType);

      await this.alertEngine.createAlert(
        'component-alert',
        title,
        description,
        severity,
        'cloud-infrastructure',
        {
          componentId: component.id,
          componentType: component.type,
          provider: component.provider,
          region: component.region,
          status: component.status,
          health: component.health
        }
      );

    } catch (error) {
      console.error('Failed to send component alert:', error);
    }
  }

  /**
   * Send cost threshold alert
   * Enterprise: Cost management alerting
   */
  public async sendCostAlert(
    currentSpend: number,
    budgetLimit: number,
    utilizationPercent: number
  ): Promise<void> {
    try {
      const severity = utilizationPercent > 95 ? 'critical' :
                     utilizationPercent > 80 ? 'high' : 'medium';

      const title = `Budget Alert: ${utilizationPercent.toFixed(1)}% Utilized`;
      const description = `Current spending: $${currentSpend.toFixed(2)} of $${budgetLimit.toFixed(2)} budget (${utilizationPercent.toFixed(1)}% utilized)`;

      await this.alertEngine.createAlert(
        'cost-threshold',
        title,
        description,
        severity,
        'cloud-infrastructure',
        {
          currentSpend,
          budgetLimit,
          utilizationPercent,
          remainingBudget: budgetLimit - currentSpend
        }
      );

    } catch (error) {
      console.error('Failed to send cost alert:', error);
    }
  }

  /**
   * Send security incident alert
   * Enterprise: Security-focused alerting
   */
  public async sendSecurityAlert(
    incident: SecurityIncident
  ): Promise<void> {
    try {
      const title = `Security Incident: ${incident.type.toUpperCase()}`;
      const description = `${incident.severity.toUpperCase()} security incident detected. ${incident.impact}`;

      await this.alertEngine.createAlert(
        'security-incident',
        title,
        description,
        incident.severity as AlertSeverity,
        'cloud-infrastructure',
        {
          incidentId: incident.id,
          incidentType: incident.type,
          affectedSystems: incident.affectedSystems,
          status: incident.status,
          startTime: incident.startTime
        }
      );

    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }

  // ========================================================================
  // PERFORMANCE ALERTS
  // ========================================================================

  /**
   * Send performance degradation alert
   * Enterprise: Performance monitoring alerts
   */
  public async sendPerformanceAlert(
    metric: string,
    currentValue: number,
    threshold: number,
    unit: string = ''
  ): Promise<void> {
    try {
      const severity = currentValue > threshold * 1.5 ? 'high' : 'medium';
      const title = `Performance Alert: ${metric}`;
      const description = `${metric} is ${currentValue}${unit}, exceeding threshold of ${threshold}${unit}`;

      await this.alertEngine.createAlert(
        'performance-degradation',
        title,
        description,
        severity,
        'cloud-infrastructure',
        {
          metric,
          currentValue,
          threshold,
          unit,
          exceedancePercent: ((currentValue - threshold) / threshold * 100)
        }
      );

    } catch (error) {
      console.error('Failed to send performance alert:', error);
    }
  }

  /**
   * Send availability alert
   * Enterprise: SLA monitoring alerts
   */
  public async sendAvailabilityAlert(
    currentAvailability: number,
    slaTarget: number,
    timeWindow: string = '24h'
  ): Promise<void> {
    try {
      const severity = currentAvailability < slaTarget * 0.9 ? 'critical' : 'high';
      const title = `Availability SLA Breach`;
      const description = `Current availability ${currentAvailability.toFixed(2)}% is below SLA target of ${slaTarget}% (${timeWindow})`;

      await this.alertEngine.createAlert(
        'sla-breach',
        title,
        description,
        severity,
        'cloud-infrastructure',
        {
          currentAvailability,
          slaTarget,
          timeWindow,
          breach: slaTarget - currentAvailability
        }
      );

    } catch (error) {
      console.error('Failed to send availability alert:', error);
    }
  }

  // ========================================================================
  // ALERT UTILITIES
  // ========================================================================

  /**
   * Build health alert description
   * Enterprise: Structured alert messaging
   */
  private buildHealthAlertDescription(
    status: InfrastructureStatus,
    alertType: 'critical' | 'degraded' | 'recovered'
  ): string {
    const { overall, components } = status;

    const healthyComponents = components.filter(c => c.health === 'healthy').length;
    const warningComponents = components.filter(c => c.health === 'warning').length;
    const criticalComponents = components.filter(c => c.health === 'critical').length;

    let description = `Infrastructure health is ${overall.health}. `;
    description += `Availability: ${overall.availability.toFixed(1)}%. `;
    description += `Components: ${healthyComponents} healthy, ${warningComponents} warning, ${criticalComponents} critical.`;

    if (alertType === 'recovered') {
      description += ' System has recovered to normal operation.';
    } else if (alertType === 'critical') {
      description += ' Immediate attention required.';
    }

    return description;
  }

  /**
   * Build component alert description
   * Enterprise: Component-specific messaging
   */
  private buildComponentAlertDescription(
    component: ComponentStatus,
    alertType: 'failure' | 'recovery' | 'degradation'
  ): string {
    let description = `Component ${component.name} (${component.type}) `;
    description += `in ${component.provider}/${component.region} `;

    switch (alertType) {
      case 'failure':
        description += `has failed. Status: ${component.status}, Health: ${component.health}`;
        if (component.errors.length > 0) {
          description += `. Errors: ${component.errors.map(e => e.message).join(', ')}`;
        }
        break;
      case 'degradation':
        description += `is experiencing degraded performance. Health: ${component.health}`;
        break;
      case 'recovery':
        description += `has recovered. Status: ${component.status}`;
        break;
    }

    return description;
  }

  // ========================================================================
  // ALERT MANAGEMENT
  // ========================================================================

  /**
   * Get active infrastructure alerts
   * Enterprise: Alert retrieval με filtering
   */
  public async getActiveAlerts(
    filterType?: string,
    severity?: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<ActiveAlert[]> {
    try {
      // Use Alert Engine to get recent alerts
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


      // Apply filters
      if (filterType) {
        alerts = alerts.filter((alert: AlertData) => alert.type === filterType);
      }

      if (severity) {
        alerts = alerts.filter((alert: AlertData) => alert.severity === severity);
      }

      // Convert to ActiveAlert format
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
      console.error('Failed to get active alerts:', error);
      return [];
    }
  }

  /**
   * Acknowledge alert
   * Enterprise: Alert lifecycle management
   */
  public async acknowledgeAlert(
    alertId: string,
    assignee?: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Log acknowledgment event
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
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Resolve alert
   * Enterprise: Alert resolution tracking
   */
  public async resolveAlert(
    alertId: string,
    resolution: string,
    resolvedBy?: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Log resolution event
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
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // ========================================================================
  // ALERT STATISTICS
  // ========================================================================

  /**
   * Get alert statistics
   * Enterprise: Alert analytics και insights
   */
  public async getAlertStatistics(
    timeRange: {
      start: Date;
      end: Date;
    }
  ): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    averageResolutionTime: number;
    escalations: number;
  }> {
    try {
      const report = await this.alertEngine.generateQuickReport();

      // Process statistics από Alert Engine data
      return {
        total: report.alerts?.total || 0,
        bySeverity: report.alerts?.bySeverity || {},
        byType: report.alerts?.byType || {},
        averageResolutionTime: report.metrics?.averageResolutionTime || 0,
        escalations: report.alerts?.escalations || 0
      };

    } catch (error) {
      console.error('Failed to get alert statistics:', error);
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

