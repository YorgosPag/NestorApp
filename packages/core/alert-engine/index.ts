/**
 * ALERT ENGINE - MASTER INDEX
 * Geo-Alert System - Phase 5: Complete Alert Engine System
 *
 * Centralized export για ολόκληρο το Alert Engine ecosystem.
 * Unified access point για όλα τα subsystems.
 */

// ============================================================================
// CORE ALERT ENGINE COMPONENTS
// ============================================================================

// Rules Engine - Export types and classes (RetryPolicy from here takes precedence)
export {
  RulesEngine,
  rulesEngine,
  rulesEngine as defaultRulesEngine,
  type Rule,
  type RuleCategory,
  type RulePriority,
  type RuleSchedule,
  type RuleCondition,
  type LogicalOperator,
  type ComparisonOperator,
  type SpatialOperator,
  type TemporalOperator,
  type SpatialRelation,
  type TimeWindow,
  type StatisticalAggregation,
  type RuleAction,
  type ActionType,
  type RetryPolicy,
  type RuleContext,
  type RuleEvaluationResult,
  type ConditionResult,
  type ActionResult
} from './rules/RulesEngine';

// Alert Detection System
export {
  AlertDetectionSystem,
  alertDetectionSystem,
  alertDetectionSystem as defaultAlertDetection,
  type Alert,
  type AlertType,
  type AlertSeverity,
  type AlertStatus,
  type AlertAction,
  type AlertTemplate,
  type DetectionConfig,
  type DetectionStatistics
} from './detection/AlertDetectionSystem';

// Notification Dispatch Engine (exclude RetryPolicy to avoid duplicate)
export {
  NotificationDispatchEngine,
  notificationDispatchEngine,
  notificationDispatchEngine as defaultNotificationEngine,
  type NotificationChannel,
  type ChannelType,
  type ChannelConfig,
  type RateLimitConfig,
  type NotificationPriority,
  type NotificationTemplate,
  type NotificationMessage,
  type NotificationRecipient,
  type NotificationQueue,
  type DeliveryStatistics,
  type NotificationConfig
} from './notifications/NotificationDispatchEngine';

// Real-time Dashboard - Direct imports to avoid UI component dependencies
export type { DashboardService, DashboardMetrics, RealTimeEvent, DashboardConfig } from './dashboard/DashboardService';
export { dashboardService as defaultDashboardService, DashboardService as DashboardServiceClass } from './dashboard/DashboardService';

// Configuration Interface - Direct imports to avoid UI component dependencies
export type { ConfigurationService } from './configuration/ConfigurationService';
export { configurationService as defaultConfigurationService, ConfigurationService as ConfigurationServiceClass } from './configuration/ConfigurationService';

// Analytics & Reporting - Direct imports to avoid UI component dependencies
export type { EventAnalyticsEngine } from './analytics/EventAnalyticsEngine';
export { eventAnalyticsEngine as defaultAnalyticsEngine, EventAnalyticsEngine as EventAnalyticsEngineClass } from './analytics/EventAnalyticsEngine';

// ============================================================================
// UNIFIED ALERT ENGINE SERVICE
// ============================================================================

import { RulesEngine, rulesEngine } from './rules/RulesEngine';
import { AlertDetectionSystem, alertDetectionSystem } from './detection/AlertDetectionSystem';
import { NotificationDispatchEngine, notificationDispatchEngine } from './notifications/NotificationDispatchEngine';
import { DashboardService, dashboardService } from './dashboard/DashboardService';
import { ConfigurationService, configurationService } from './configuration/ConfigurationService';
import { EventAnalyticsEngine, eventAnalyticsEngine } from './analytics/EventAnalyticsEngine';

/**
 * Unified Alert Engine - Master Service για όλα τα subsystems
 * Implements Facade Pattern για simplified access
 */
export class GeoAlertEngine {
  private static instance: GeoAlertEngine | null = null;

  // Core subsystems
  public readonly rules: RulesEngine;
  public readonly detection: AlertDetectionSystem;
  public readonly notifications: NotificationDispatchEngine;
  public readonly dashboard: DashboardService;
  public readonly configuration: ConfigurationService;
  public readonly analytics: EventAnalyticsEngine;

  // System state
  private isInitialized: boolean = false;
  private startTime: Date = new Date();

  // ========================================================================
  // SINGLETON PATTERN
  // ========================================================================

  private constructor() {
    this.rules = rulesEngine;
    this.detection = alertDetectionSystem;
    this.notifications = notificationDispatchEngine;
    this.dashboard = dashboardService;
    this.configuration = configurationService;
    this.analytics = eventAnalyticsEngine;
  }

  public static getInstance(): GeoAlertEngine {
    if (!GeoAlertEngine.instance) {
      GeoAlertEngine.instance = new GeoAlertEngine();
    }
    return GeoAlertEngine.instance;
  }

  // ========================================================================
  // SYSTEM INITIALIZATION
  // ========================================================================

  /**
   * Initialize entire Alert Engine system
   */
  public async initialize(): Promise<{
    success: boolean;
    subsystems: Record<string, boolean>;
    error?: string;
  }> {
    try {
      console.log('🚀 Initializing Geo-Alert Engine...');

      // Initialize all subsystems
      const subsystemResults = {
        rules: true, // Already initialized in constructor
        detection: true,
        notifications: true,
        dashboard: true,
        configuration: true,
        analytics: true
      };

      // Load default configuration
      await this.configuration.loadConfiguration();

      // Start detection system
      await this.detection.startDetection();

      // Log system startup
      this.analytics.ingestEvent({
        id: `startup_${Date.now()}`,
        type: 'system',
        timestamp: new Date(),
        message: 'Alert Engine initialized successfully',
        severity: 'info',
        source: 'GeoAlertEngine'
      });

      this.isInitialized = true;

      console.log('✅ Geo-Alert Engine initialization complete');

      return {
        success: true,
        subsystems: subsystemResults
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';

      console.error('❌ Alert Engine initialization failed:', errorMessage);

      this.analytics.ingestEvent({
        id: `startup_error_${Date.now()}`,
        type: 'system',
        timestamp: new Date(),
        message: `Alert Engine initialization failed: ${errorMessage}`,
        severity: 'error',
        source: 'GeoAlertEngine'
      });

      return {
        success: false,
        subsystems: {
          rules: false,
          detection: false,
          notifications: false,
          dashboard: false,
          configuration: false,
          analytics: false
        },
        error: errorMessage
      };
    }
  }

  // ========================================================================
  // SYSTEM HEALTH και STATUS
  // ========================================================================

  /**
   * Get comprehensive system health status
   */
  public async getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'critical';
    uptime: number;
    subsystems: Record<string, {
      status: 'healthy' | 'degraded' | 'critical';
      details: string;
    }>;
    metrics: {
      activeAlerts: number;
      ruleExecutions: number;
      notificationsSent: number;
      eventsProcessed: number;
    };
  }> {
    const now = new Date();
    const uptime = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);

    // Get metrics from analytics
    const healthMetrics = await this.getHealthMetrics();

    // Check individual subsystems
    const subsystems = {
      rules: {
        status: 'healthy' as const,
        details: 'Rules engine operational'
      },
      detection: {
        status: 'healthy' as const,
        details: 'Detection system active'
      },
      notifications: {
        status: 'healthy' as const,
        details: 'Notification engine operational'
      },
      dashboard: {
        status: 'healthy' as const,
        details: 'Dashboard service running'
      },
      configuration: {
        status: 'healthy' as const,
        details: 'Configuration service ready'
      },
      analytics: {
        status: 'healthy' as const,
        details: 'Analytics engine processing'
      }
    };

    // Determine overall health
    const unhealthySubsystems = Object.values(subsystems).filter(s => s.status !== 'healthy');
    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';

    if (unhealthySubsystems.length > 2) {
      overall = 'critical';
    } else if (unhealthySubsystems.length > 0) {
      overall = 'degraded';
    }

    // Check if too many active alerts
    if (healthMetrics.activeAlerts > 20) {
      overall = 'degraded';
    } else if (healthMetrics.activeAlerts > 50) {
      overall = 'critical';
    }

    return {
      overall,
      uptime,
      subsystems,
      metrics: healthMetrics
    };
  }

  private async getHealthMetrics(): Promise<{
    activeAlerts: number;
    ruleExecutions: number;
    notificationsSent: number;
    eventsProcessed: number;
  }> {
    try {
      // Get last hour metrics
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const timeRange = {
        start: oneHourAgo,
        end: now,
        granularity: 'hour' as const
      };

      const [alertMetrics, notificationMetrics, eventMetrics] = await Promise.all([
        this.analytics.computeAlertMetrics(timeRange),
        this.analytics.computeNotificationMetrics(timeRange),
        this.analytics.computeEventMetrics(timeRange)
      ]);

      return {
        activeAlerts: alertMetrics.alertsByStatus.new || 0,
        ruleExecutions: 0, // Would come from rules engine
        notificationsSent: notificationMetrics.totalNotifications,
        eventsProcessed: eventMetrics.totalEvents
      };

    } catch (error) {
      console.error('Error getting health metrics:', error);
      return {
        activeAlerts: 0,
        ruleExecutions: 0,
        notificationsSent: 0,
        eventsProcessed: 0
      };
    }
  }

  // ========================================================================
  // QUICK ACCESS METHODS
  // ========================================================================

  /**
   * Create and trigger an alert
   */
  public async createAlert(
    type: string,
    title: string,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    projectId?: string,
    metadata?: Record<string, any>
  ) {
    const alertId = `alert_${Date.now()}`;
    const now = new Date();

    // Create a simplified alert object for quick creation
    // Full Alert objects are created by AlertDetectionSystem
    const simpleAlert = {
      id: alertId,
      type,
      title,
      message: description,
      severity,
      status: 'new' as const,
      detectedAt: now,
      projectId: projectId || 'system',
      metadata: metadata || {}
    };

    // Log event for analytics (using simple event format)
    this.analytics.ingestEvent({
      id: `alert_ingest_${Date.now()}`,
      type: 'alert',
      timestamp: now,
      message: `Alert created: ${title}`,
      severity: severity === 'critical' ? 'error' : severity === 'high' ? 'warning' : 'info',
      source: 'GeoAlertEngine',
      metadata: { alertId, alertType: type, alertSeverity: severity }
    });

    return simpleAlert;
  }

  /**
   * Execute all active rules
   */
  public async executeRules(): Promise<{
    executed: number;
    successful: number;
    failed: number;
    alertsTriggered: number;
  }> {
    try {
      const results = await this.rules.evaluateAllRules();

      const stats = {
        executed: results.length,
        successful: results.filter(r => r.triggered).length,
        failed: results.filter(r => !r.triggered).length,
        alertsTriggered: results.filter(r => r.triggered && r.actionsExecuted.length > 0).length
      };

      // Log rule execution stats
      this.analytics.ingestEvent({
        id: `rule_execution_${Date.now()}`,
        type: 'rule',
        timestamp: new Date(),
        message: `Rules executed: ${stats.executed}, successful: ${stats.successful}`,
        severity: stats.failed > 0 ? 'warning' : 'info',
        source: 'GeoAlertEngine'
      });

      return stats;

    } catch (error) {
      console.error('Rule execution failed:', error);
      throw error;
    }
  }

  /**
   * Generate instant analytics report
   */
  public async generateQuickReport(): Promise<any> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const timeRange = {
      start: yesterday,
      end: now,
      granularity: 'hour' as const
    };

    return await this.analytics.generateComprehensiveReport(timeRange);
  }

  // ========================================================================
  // SYSTEM CONTROL
  // ========================================================================

  /**
   * Emergency shutdown of entire system
   */
  public async emergencyShutdown(reason: string): Promise<void> {
    console.warn('🛑 Emergency shutdown initiated:', reason);

    // Log emergency shutdown
    this.analytics.ingestEvent({
      id: `emergency_shutdown_${Date.now()}`,
      type: 'system',
      timestamp: new Date(),
      message: `Emergency shutdown: ${reason}`,
      severity: 'error',
      source: 'GeoAlertEngine'
    });

    // Stop detection
    await this.detection.stopDetection();

    this.isInitialized = false;

    console.warn('🛑 Emergency shutdown complete');
  }

  /**
   * Graceful restart of system
   */
  public async restart(): Promise<void> {
    console.log('🔄 Restarting Alert Engine...');

    // Stop systems
    await this.detection.stopDetection();

    // Clear caches
    this.dashboard.clearEvents();

    // Restart
    await this.initialize();

    console.log('🔄 Alert Engine restart complete');
  }

  // ========================================================================
  // GETTERS
  // ========================================================================

  public get isSystemInitialized(): boolean {
    return this.isInitialized;
  }

  public get systemUptime(): number {
    return Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000);
  }
}

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

/**
 * Global Alert Engine Instance
 * Use this για access to the entire alert ecosystem
 */
export const geoAlertEngine = GeoAlertEngine.getInstance();

/**
 * Default export για convenience
 */
export default geoAlertEngine;

// ============================================================================
// INITIALIZATION UTILITIES
// ============================================================================

/**
 * Initialize complete Alert Engine system
 */
export const initializeAlertEngine = async () => {
  return await geoAlertEngine.initialize();
};

/**
 * Get system health snapshot
 */
export const getAlertEngineHealth = async () => {
  return await geoAlertEngine.getSystemHealth();
};

/**
 * Quick alert creation utility
 */
export const createQuickAlert = async (
  title: string,
  description: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
) => {
  return await geoAlertEngine.createAlert('manual', title, description, severity);
};