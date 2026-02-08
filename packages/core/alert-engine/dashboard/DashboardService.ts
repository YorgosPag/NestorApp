/**
 * DASHBOARD SERVICE LAYER
 * Geo-Alert System - Phase 5: Enterprise Dashboard Service
 *
 * Centralized service για dashboard data management και real-time updates.
 * Implements enterprise service patterns με caching και performance optimization.
 */

import {
  AlertDetectionSystem,
  alertDetectionSystem,
  Alert,
  AlertSeverity,
  AlertStatus
} from '../detection/AlertDetectionSystem';
import {
  NotificationDispatchEngine,
  notificationDispatchEngine,
  DeliveryStatistics
} from '../notifications/NotificationDispatchEngine';
import {
  RulesEngine,
  rulesEngine,
  RuleEvaluationResult
} from '../rules/RulesEngine';

// ============================================================================
// TYPES και INTERFACES
// ============================================================================

export interface DashboardMetrics {
  alerts: {
    total: number;
    active: number;
    resolved: number;
    acknowledged: number;
    suppressed: number;
    bySeverity: Record<AlertSeverity, number>;
    byStatus: Record<AlertStatus, number>;
    last24Hours: number;
    last7Days: number;
    avgResolutionTime: number; // σε λεπτά
  };
  rules: {
    total: number;
    active: number;
    inactive: number;
    triggered: number;
    successRate: number;
    avgExecutionTime: number; // σε ms
    failureRate: number;
  };
  notifications: DeliveryStatistics & {
    queueSize: number;
    avgDeliveryTime: number; // σε δευτερόλεπτα
    channelStats: Record<string, number>;
    deliveryRate: number;
  };
  system: {
    status: 'healthy' | 'degraded' | 'critical';
    uptime: number; // σε δευτερόλεπτα
    lastUpdate: Date;
    detectionActive: boolean;
    rulesEngineActive: boolean;
    notificationEngineActive: boolean;
    performanceMetrics: {
      cpuUsage: number;
      memoryUsage: number;
      activeConnections: number;
      responseTime: number;
    };
  };
  trends: {
    alertTrends: AlertTrendPoint[];
    ruleTriggerTrends: RuleTrendPoint[];
    notificationTrends: NotificationTrendPoint[];
  };
}

export interface AlertTrendPoint {
  timestamp: Date;
  count: number;
  severity: AlertSeverity;
  cumulative: number;
}

export interface RuleTrendPoint {
  timestamp: Date;
  triggered: number;
  failed: number;
  avgExecutionTime: number;
}

export interface NotificationTrendPoint {
  timestamp: Date;
  sent: number;
  failed: number;
  avgDeliveryTime: number;
}

export interface RealTimeEvent {
  id: string;
  type: 'alert' | 'rule' | 'notification' | 'system' | 'user';
  subtype?: string;
  timestamp: Date;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  source: string;
  metadata?: {
    alertId?: string;
    ruleId?: string;
    notificationId?: string;
    userId?: string;
    projectId?: string;
    [key: string]: unknown;
  };
}

export interface DashboardConfig {
  refreshInterval: number; // σε ms
  maxEvents: number;
  maxTrendPoints: number;
  alertRetentionDays: number;
  enableRealTimeUpdates: boolean;
  metricsAggregationInterval: number; // σε ms
}

// ============================================================================
// DASHBOARD SERVICE CLASS
// ============================================================================

export class DashboardService {
  private static instance: DashboardService | null = null;

  private alertDetection: AlertDetectionSystem;
  private notificationEngine: NotificationDispatchEngine;
  private rulesEngine: RulesEngine;

  // Caching και state management
  private metricsCache: DashboardMetrics | null = null;
  private lastMetricsUpdate: Date | null = null;
  private realtimeEvents: RealTimeEvent[] = [];

  // Configuration
  private config: DashboardConfig = {
    refreshInterval: 5000, // 5 seconds
    maxEvents: 100,
    maxTrendPoints: 50,
    alertRetentionDays: 30,
    enableRealTimeUpdates: true,
    metricsAggregationInterval: 1000 // 1 second για real-time
  };

  // Performance tracking
  private startTime: Date = new Date();
  private lastUpdateDuration: number = 0;

  // ========================================================================
  // SINGLETON PATTERN
  // ========================================================================

  private constructor() {
    this.alertDetection = alertDetectionSystem;
    this.notificationEngine = notificationDispatchEngine;
    this.rulesEngine = rulesEngine;

    // Initialize real-time monitoring
    this.initializeRealTimeMonitoring();
  }

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  // ========================================================================
  // CONFIGURATION
  // ========================================================================

  public updateConfig(newConfig: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.addEvent({
      type: 'system',
      subtype: 'config_update',
      message: 'Dashboard configuration updated',
      severity: 'info',
      source: 'DashboardService'
    });
  }

  public getConfig(): DashboardConfig {
    return { ...this.config };
  }

  // ========================================================================
  // METRICS COLLECTION
  // ========================================================================

  public async getDashboardMetrics(forceRefresh: boolean = false): Promise<DashboardMetrics> {
    const now = new Date();
    const cacheExpired = !this.lastMetricsUpdate ||
      (now.getTime() - this.lastMetricsUpdate.getTime()) > this.config.refreshInterval;

    if (!forceRefresh && this.metricsCache && !cacheExpired) {
      return this.metricsCache;
    }

    const startTime = performance.now();

    try {
      // Παράλληλη συλλογή data από όλα τα subsystems
      const [alerts, notificationStats, rulesStats] = await Promise.all([
        this.collectAlertMetrics(),
        this.collectNotificationMetrics(),
        this.collectRulesMetrics()
      ]);

      const systemMetrics = this.collectSystemMetrics();
      const trends = await this.collectTrendData();

      const metrics: DashboardMetrics = {
        alerts,
        rules: rulesStats,
        notifications: notificationStats,
        system: systemMetrics,
        trends
      };

      // Update cache
      this.metricsCache = metrics;
      this.lastMetricsUpdate = now;
      this.lastUpdateDuration = performance.now() - startTime;

      this.addEvent({
        type: 'system',
        subtype: 'metrics_update',
        message: `Metrics refreshed (${this.lastUpdateDuration.toFixed(1)}ms)`,
        severity: 'info',
        source: 'DashboardService'
      });

      return metrics;

    } catch (error) {
      this.addEvent({
        type: 'system',
        subtype: 'metrics_error',
        message: `Metrics collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
        source: 'DashboardService'
      });

      // Return cached data αν υπάρχει, ή default values
      return this.metricsCache || this.getDefaultMetrics();
    }
  }

  // ========================================================================
  // INDIVIDUAL METRICS COLLECTORS
  // ========================================================================

  // ✅ ENTERPRISE: Fixed method name and type annotations
  private async collectAlertMetrics(): Promise<DashboardMetrics['alerts']> {
    const alerts = this.alertDetection.getAlerts({});
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ✅ ENTERPRISE: Use correct property 'detectedAt' and typed parameters
    const alertsLast24h = alerts.filter((a: Alert) => a.detectedAt >= last24Hours);
    const alertsLast7d = alerts.filter((a: Alert) => a.detectedAt >= last7Days);

    // ✅ ENTERPRISE: Properly typed reduce accumulators
    const bySeverity = alerts.reduce((acc: Record<AlertSeverity, number>, alert: Alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<AlertSeverity, number>);

    // ✅ ENTERPRISE: Properly typed reduce accumulators
    const byStatus = alerts.reduce((acc: Record<AlertStatus, number>, alert: Alert) => {
      acc[alert.status] = (acc[alert.status] || 0) + 1;
      return acc;
    }, {} as Record<AlertStatus, number>);

    // ✅ ENTERPRISE: Properly typed filter and reduce
    const resolvedAlerts = alerts.filter((a: Alert) => a.status === 'resolved');
    const avgResolutionTime = resolvedAlerts.length > 0
      ? resolvedAlerts.reduce((sum: number, _alert: Alert) => {
          // Mock resolution time calculation (στην πραγματικότητα θα υπάρχει resolvedAt field)
          const resolutionTime = 30; // minutes (mock data)
          return sum + resolutionTime;
        }, 0) / resolvedAlerts.length
      : 0;

    // ✅ ENTERPRISE: Use correct AlertStatus values from AlertDetectionSystem.ts
    // AlertStatus = 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive'
    return {
      total: alerts.length,
      active: byStatus.new || 0, // 'new' is the active status
      resolved: byStatus.resolved || 0,
      acknowledged: byStatus.acknowledged || 0,
      suppressed: byStatus.investigating || 0, // Map 'investigating' to suppressed for now
      bySeverity: {
        critical: bySeverity.critical || 0,
        high: bySeverity.high || 0,
        medium: bySeverity.medium || 0,
        low: bySeverity.low || 0,
        info: bySeverity.info || 0
      },
      byStatus: {
        new: byStatus.new || 0,
        acknowledged: byStatus.acknowledged || 0,
        investigating: byStatus.investigating || 0,
        resolved: byStatus.resolved || 0,
        false_positive: byStatus.false_positive || 0
      },
      last24Hours: alertsLast24h.length,
      last7Days: alertsLast7d.length,
      avgResolutionTime
    };
  }

  // ✅ ENTERPRISE: Use correct method name getDeliveryStatistics()
  private async collectNotificationMetrics(): Promise<DashboardMetrics['notifications']> {
    const baseStats = this.notificationEngine.getDeliveryStatistics();

    // Extended metrics (mock data για development)
    return {
      ...baseStats,
      queueSize: 5, // Current queue size
      avgDeliveryTime: 2.3, // seconds
      channelStats: {
        'email': baseStats.totalSent * 0.6,
        'sms': baseStats.totalSent * 0.2,
        'webhook': baseStats.totalSent * 0.15,
        'in_app': baseStats.totalSent * 0.05
      },
      deliveryRate: baseStats.totalSent > 0 ? ((baseStats.totalSent - baseStats.totalFailed) / baseStats.totalSent) * 100 : 0
    };
  }

  private async collectRulesMetrics(): Promise<DashboardMetrics['rules']> {
    // Mock rules metrics (στην πραγματικότητα θα έρχονται από RulesEngine)
    return {
      total: 15,
      active: 12,
      inactive: 3,
      triggered: 47,
      successRate: 94.7,
      avgExecutionTime: 156, // ms
      failureRate: 5.3
    };
  }

  private collectSystemMetrics(): DashboardMetrics['system'] {
    const now = new Date();
    const uptime = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);

    // Mock performance metrics
    const performanceMetrics = {
      cpuUsage: Math.random() * 30 + 10, // 10-40%
      memoryUsage: Math.random() * 20 + 30, // 30-50%
      activeConnections: Math.floor(Math.random() * 50 + 10), // 10-60
      responseTime: this.lastUpdateDuration
    };

    // Determine overall system status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (performanceMetrics.cpuUsage > 80 || performanceMetrics.memoryUsage > 90) {
      status = 'critical';
    } else if (performanceMetrics.cpuUsage > 60 || performanceMetrics.memoryUsage > 70) {
      status = 'degraded';
    }

    return {
      status,
      uptime,
      lastUpdate: now,
      detectionActive: true,
      rulesEngineActive: true,
      notificationEngineActive: true,
      performanceMetrics
    };
  }

  private async collectTrendData(): Promise<DashboardMetrics['trends']> {
    const now = new Date();
    const points: AlertTrendPoint[] = [];
    const rulePoints: RuleTrendPoint[] = [];
    const notificationPoints: NotificationTrendPoint[] = [];

    // Generate trend data για τις τελευταίες 24 ώρες (mock data)
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);

      points.push({
        timestamp,
        count: Math.floor(Math.random() * 10),
        severity: 'medium',
        cumulative: i * 2 + Math.floor(Math.random() * 5)
      });

      rulePoints.push({
        timestamp,
        triggered: Math.floor(Math.random() * 5),
        failed: Math.floor(Math.random() * 2),
        avgExecutionTime: Math.random() * 100 + 50
      });

      notificationPoints.push({
        timestamp,
        sent: Math.floor(Math.random() * 20),
        failed: Math.floor(Math.random() * 3),
        avgDeliveryTime: Math.random() * 2 + 1
      });
    }

    return {
      alertTrends: points,
      ruleTriggerTrends: rulePoints,
      notificationTrends: notificationPoints
    };
  }

  // ========================================================================
  // REAL-TIME EVENTS
  // ========================================================================

  private initializeRealTimeMonitoring(): void {
    // System startup event
    this.addEvent({
      type: 'system',
      subtype: 'startup',
      message: 'Dashboard service initialized',
      severity: 'success',
      source: 'DashboardService'
    });

    // Mock periodic events για demonstration
    if (this.config.enableRealTimeUpdates) {
      setInterval(() => {
        this.generateMockEvent();
      }, 10000); // Every 10 seconds
    }
  }

  private generateMockEvent(): void {
    const eventTypes = [
      { type: 'alert', message: 'New accuracy degradation detected', severity: 'warning' },
      { type: 'rule', message: 'Spatial conflict rule triggered', severity: 'info' },
      { type: 'notification', message: 'Email notification delivered', severity: 'success' },
      { type: 'system', message: 'Performance metrics updated', severity: 'info' }
    ] as const;

    const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    this.addEvent({
      type: randomEvent.type,
      subtype: 'automated',
      message: randomEvent.message,
      severity: randomEvent.severity,
      source: 'MockGenerator'
    });
  }

  public addEvent(eventData: Omit<RealTimeEvent, 'id' | 'timestamp'>): void {
    const event: RealTimeEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...eventData
    };

    this.realtimeEvents.unshift(event);

    // Maintain max events limit
    if (this.realtimeEvents.length > this.config.maxEvents) {
      this.realtimeEvents = this.realtimeEvents.slice(0, this.config.maxEvents);
    }
  }

  public getRealtimeEvents(maxCount?: number): RealTimeEvent[] {
    return this.realtimeEvents.slice(0, maxCount || this.config.maxEvents);
  }

  public clearEvents(): void {
    this.realtimeEvents = [];
    this.addEvent({
      type: 'system',
      subtype: 'clear',
      message: 'Event log cleared',
      severity: 'info',
      source: 'DashboardService'
    });
  }

  // ========================================================================
  // UTILITIES και HELPERS
  // ========================================================================

  private getDefaultMetrics(): DashboardMetrics {
    return {
      alerts: {
        total: 0,
        active: 0,
        resolved: 0,
        acknowledged: 0,
        suppressed: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        // ✅ ENTERPRISE: Use correct AlertStatus values
        byStatus: { new: 0, acknowledged: 0, investigating: 0, resolved: 0, false_positive: 0 },
        last24Hours: 0,
        last7Days: 0,
        avgResolutionTime: 0
      },
      rules: {
        total: 0,
        active: 0,
        inactive: 0,
        triggered: 0,
        successRate: 0,
        avgExecutionTime: 0,
        failureRate: 0
      },
      notifications: {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        deliveryRate: 0,
        byChannel: {},
        byPriority: {
          immediate: { sent: 0, delivered: 0, avgDeliveryTime: 0 },
          high: { sent: 0, delivered: 0, avgDeliveryTime: 0 },
          normal: { sent: 0, delivered: 0, avgDeliveryTime: 0 },
          low: { sent: 0, delivered: 0, avgDeliveryTime: 0 },
          batch: { sent: 0, delivered: 0, avgDeliveryTime: 0 }
        },
        last24Hours: { sent: 0, delivered: 0, failed: 0 },
        queueSize: 0,
        avgDeliveryTime: 0,
        channelStats: {}
      },
      system: {
        status: 'critical',
        uptime: 0,
        lastUpdate: new Date(),
        detectionActive: false,
        rulesEngineActive: false,
        notificationEngineActive: false,
        performanceMetrics: {
          cpuUsage: 0,
          memoryUsage: 0,
          activeConnections: 0,
          responseTime: 0
        }
      },
      trends: {
        alertTrends: [],
        ruleTriggerTrends: [],
        notificationTrends: []
      }
    };
  }

  public getPerformanceMetrics(): {
    lastUpdateDuration: number;
    cacheHitRate: number;
    eventsCount: number;
    uptime: number;
  } {
    return {
      lastUpdateDuration: this.lastUpdateDuration,
      cacheHitRate: this.metricsCache ? 100 : 0, // Simplified calculation
      eventsCount: this.realtimeEvents.length,
      uptime: Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000)
    };
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  public dispose(): void {
    this.metricsCache = null;
    this.realtimeEvents = [];
    DashboardService.instance = null;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const dashboardService = DashboardService.getInstance();
export default dashboardService;
