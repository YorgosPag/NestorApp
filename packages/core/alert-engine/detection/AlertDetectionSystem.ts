/**
 * ALERT DETECTION SYSTEM
 * Geo-Alert System - Phase 5: Intelligent Alert Detection
 *
 * Specialized alert detection για geo-spatial scenarios με:
 * - Pre-configured alert templates
 * - Real-time data monitoring
 * - Anomaly detection algorithms
 * - Geographic event correlation
 * - Accuracy degradation monitoring
 */

import type { RulesEngine, Rule, RuleEvaluationResult } from '../rules/RulesEngine';
import { rulesEngine } from '../rules/RulesEngine';
import type { DatabaseManager } from '../../database-system/connection/DatabaseManager';
import { databaseManager } from '../../database-system/connection/DatabaseManager';
import type { GeoControlPoint } from '../../database-system/repositories/ControlPointRepository';
import { controlPointRepository } from '../../database-system/repositories/ControlPointRepository';
import type { GeoProject } from '../../database-system/repositories/ProjectRepository';
import { projectRepository } from '../../database-system/repositories/ProjectRepository';

// ============================================================================
// ALERT DETECTION TYPES
// ============================================================================

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;

  // Alert content
  title: string;
  message: string;
  details: Record<string, any>;

  // Context
  projectId?: string;
  entityId?: string;
  entityType?: string;

  // Geographic context
  location?: {
    lng: number;
    lat: number;
    accuracy?: number;
  };

  // Temporal context
  detectedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;

  // Rule context
  triggeredByRule: string;
  ruleEvaluation: RuleEvaluationResult;

  // Actions taken
  actionsTaken: AlertAction[];

  // Metadata
  createdBy: string;
  tags: string[];
}

export type AlertType =
  | 'accuracy_degradation'    // Control point accuracy has degraded
  | 'geometric_anomaly'       // Unusual geometric patterns detected
  | 'spatial_conflict'        // Overlapping or conflicting spatial data
  | 'temporal_drift'          // Coordinate drift over time
  | 'data_quality_issue'      // Missing or corrupted data
  | 'transformation_error'    // Coordinate transformation failures
  | 'system_performance'      // Performance degradation
  | 'security_breach'         // Unauthorized access or changes
  | 'compliance_violation'    // Standards compliance issues
  | 'predictive_warning';     // ML-based predictions

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertStatus = 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';

export interface AlertAction {
  type: 'notification_sent' | 'email_sent' | 'workflow_triggered' | 'record_updated' | 'escalated';
  timestamp: Date;
  details: Record<string, any>;
  success: boolean;
  error?: string;
}

export interface AlertTemplate {
  id: string;
  name: string;
  description: string;
  alertType: AlertType;
  defaultSeverity: AlertSeverity;

  // Rule configuration για this alert type
  ruleTemplate: Omit<Rule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount' | 'averageExecutionTime' | 'successRate'>;

  // Alert message templates
  titleTemplate: string;
  messageTemplate: string;

  // Default actions
  defaultActions: string[]; // Action IDs to execute

  // Thresholds και parameters
  parameters: Record<string, {
    type: 'number' | 'string' | 'boolean';
    defaultValue: any;
    description: string;
    min?: number;
    max?: number;
  }>;
}

export interface DetectionStatistics {
  totalAlertsDetected: number;
  alertsBySeverity: Record<AlertSeverity, number>;
  alertsByType: Record<AlertType, number>;
  averageDetectionTime: number;
  falsePositiveRate: number;
  resolutionRate: number;

  // Temporal metrics
  alertsLast24Hours: number;
  alertsLastWeek: number;
  alertTrends: Array<{
    date: string;
    count: number;
    severity: AlertSeverity;
  }>;

  // Performance metrics
  detectionAccuracy: number; // 0-1
  averageResolutionTime: number; // milliseconds
}

// ============================================================================
// ALERT DETECTION SYSTEM CLASS
// ============================================================================

export class AlertDetectionSystem {
  private dbManager: DatabaseManager;
  private rulesEngine: RulesEngine;
  private alerts: Map<string, Alert> = new Map();
  private alertTemplates: Map<string, AlertTemplate> = new Map();
  private detectionStatistics: DetectionStatistics;

  constructor(dbManager?: DatabaseManager, rulesEngine?: RulesEngine) {
    this.dbManager = dbManager || databaseManager;
    this.rulesEngine = rulesEngine || rulesEngine;

    this.detectionStatistics = {
      totalAlertsDetected: 0,
      alertsBySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      alertsByType: {} as Record<AlertType, number>,
      averageDetectionTime: 0,
      falsePositiveRate: 0,
      resolutionRate: 0,
      alertsLast24Hours: 0,
      alertsLastWeek: 0,
      alertTrends: [],
      detectionAccuracy: 0.95,
      averageResolutionTime: 3600000 // 1 hour
    };

    this.initializeAlertTemplates();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  /**
   * Initialize με pre-configured alert templates
   */
  private initializeAlertTemplates(): void {
    // Accuracy Degradation Alert
    this.alertTemplates.set('accuracy_degradation', {
      id: 'accuracy_degradation',
      name: 'Accuracy Degradation Detection',
      description: 'Detects when control point accuracy degrades beyond acceptable thresholds',
      alertType: 'accuracy_degradation',
      defaultSeverity: 'high',
      titleTemplate: 'Accuracy Degradation Detected',
      messageTemplate: 'Control point accuracy has degraded to ${accuracy}m (threshold: ${threshold}m)',
      defaultActions: ['send_email', 'create_ticket'],
      parameters: {
        accuracyThreshold: {
          type: 'number',
          defaultValue: 2.0,
          description: 'Maximum acceptable accuracy in meters',
          min: 0.1,
          max: 10.0
        },
        checkInterval: {
          type: 'number',
          defaultValue: 300000, // 5 minutes
          description: 'Check interval in milliseconds'
        }
      },
      ruleTemplate: {
        name: 'Accuracy Degradation Rule',
        description: 'Monitors control point accuracy degradation',
        category: 'accuracy_quality',
        priority: 'high',
        isEnabled: true,
        conditions: {
          type: 'comparison',
          operator: 'greater_than',
          field: 'accuracy',
          value: 2.0
        },
        actions: [
          {
            type: 'create_alert',
            parameters: {
              alertType: 'accuracy_degradation',
              severity: 'high'
            }
          }
        ],
        createdBy: 'system',
        triggerCount: 0,
        averageExecutionTime: 0,
        successRate: 1.0
      }
    });

    // Spatial Conflict Alert
    this.alertTemplates.set('spatial_conflict', {
      id: 'spatial_conflict',
      name: 'Spatial Conflict Detection',
      description: 'Detects overlapping or conflicting spatial geometries',
      alertType: 'spatial_conflict',
      defaultSeverity: 'medium',
      titleTemplate: 'Spatial Conflict Detected',
      messageTemplate: 'Overlapping geometries detected in project ${projectName}',
      defaultActions: ['log_event', 'send_notification'],
      parameters: {
        overlapThreshold: {
          type: 'number',
          defaultValue: 0.1,
          description: 'Minimum overlap percentage to trigger alert',
          min: 0.01,
          max: 1.0
        }
      },
      ruleTemplate: {
        name: 'Spatial Conflict Rule',
        description: 'Detects spatial overlaps και conflicts',
        category: 'spatial_anomaly',
        priority: 'medium',
        isEnabled: true,
        conditions: {
          type: 'spatial',
          operator: 'intersects',
          spatialRelation: 'overlaps'
        },
        actions: [
          {
            type: 'create_alert',
            parameters: {
              alertType: 'spatial_conflict',
              severity: 'medium'
            }
          }
        ],
        createdBy: 'system',
        triggerCount: 0,
        averageExecutionTime: 0,
        successRate: 1.0
      }
    });

    // Data Quality Issue Alert
    this.alertTemplates.set('data_quality_issue', {
      id: 'data_quality_issue',
      name: 'Data Quality Issue Detection',
      description: 'Detects missing or corrupted spatial data',
      alertType: 'data_quality_issue',
      defaultSeverity: 'medium',
      titleTemplate: 'Data Quality Issue Detected',
      messageTemplate: 'Data quality issues found: ${issueCount} problems detected',
      defaultActions: ['log_event', 'send_notification'],
      parameters: {
        missingDataThreshold: {
          type: 'number',
          defaultValue: 0.05,
          description: 'Maximum percentage of missing data allowed',
          min: 0.01,
          max: 0.5
        }
      },
      ruleTemplate: {
        name: 'Data Quality Rule',
        description: 'Monitors data completeness και quality',
        category: 'data_integrity',
        priority: 'medium',
        isEnabled: true,
        conditions: {
          type: 'statistical',
          aggregation: {
            function: 'count',
            field: 'missing_fields'
          },
          threshold: 5
        },
        actions: [
          {
            type: 'create_alert',
            parameters: {
              alertType: 'data_quality_issue',
              severity: 'medium'
            }
          }
        ],
        createdBy: 'system',
        triggerCount: 0,
        averageExecutionTime: 0,
        successRate: 1.0
      }
    });

    console.log(`✅ Initialized ${this.alertTemplates.size} alert templates`);
  }

  // ========================================================================
  // ALERT DETECTION
  // ========================================================================

  /**
   * Start alert detection system
   */
  async startDetection(): Promise<void> {
    console.log('🚀 Starting Alert Detection System...');

    // Register alert rules με rules engine
    for (const template of this.alertTemplates.values()) {
      const rule: Rule = {
        ...template.ruleTemplate,
        id: `alert_rule_${template.id}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.rulesEngine.registerRule(rule);
    }

    // Start rules engine
    this.rulesEngine.startEvaluation(10000); // Evaluate κάθε 10 seconds

    console.log('✅ Alert Detection System started');
  }

  /**
   * Stop alert detection system
   */
  stopDetection(): void {
    this.rulesEngine.stopEvaluation();
    console.log('⏹️ Alert Detection System stopped');
  }

  /**
   * Process rule evaluation result και create alert if needed
   */
  async processRuleEvaluation(evaluation: RuleEvaluationResult): Promise<Alert | null> {
    if (!evaluation.triggered) {
      return null; // No alert needed
    }

    // Find corresponding alert template
    const ruleId = evaluation.ruleId;
    const templateId = ruleId.replace('alert_rule_', '');
    const template = this.alertTemplates.get(templateId);

    if (!template) {
      console.warn(`⚠️ No alert template found για rule ${ruleId}`);
      return null;
    }

    // Create alert
    const alert = await this.createAlert(template, evaluation);

    // Update statistics
    this.updateStatistics(alert);

    console.log(`🚨 Alert created: ${alert.title} (${alert.severity})`);
    return alert;
  }

  // ========================================================================
  // ALERT MANAGEMENT
  // ========================================================================

  /**
   * Create alert από template και evaluation result
   */
  private async createAlert(template: AlertTemplate, evaluation: RuleEvaluationResult): Promise<Alert> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Extract context από evaluation
    const context = evaluation.context;

    // Render message templates
    const title = this.renderTemplate(template.titleTemplate, context.data);
    const message = this.renderTemplate(template.messageTemplate, context.data);

    const alert: Alert = {
      id: alertId,
      type: template.alertType,
      severity: template.defaultSeverity,
      status: 'new',
      title,
      message,
      details: {
        ruleEvaluation: evaluation,
        template: template.id,
        parameters: template.parameters
      },
      projectId: context.projectId,
      entityId: context.entityId,
      entityType: context.entityType,
      detectedAt: evaluation.evaluatedAt,
      triggeredByRule: evaluation.ruleId,
      ruleEvaluation: evaluation,
      actionsTaken: [],
      createdBy: 'alert_detection_system',
      tags: [template.alertType, evaluation.ruleId]
    };

    // Store alert
    this.alerts.set(alertId, alert);

    // Execute default actions
    await this.executeAlertActions(alert, template.defaultActions);

    return alert;
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  /**
   * Get all alerts με filtering
   */
  getAlerts(filters?: {
    type?: AlertType;
    severity?: AlertSeverity;
    status?: AlertStatus;
    projectId?: string;
    since?: Date;
    limit?: number;
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters) {
      if (filters.type) {
        alerts = alerts.filter(a => a.type === filters.type);
      }
      if (filters.severity) {
        alerts = alerts.filter(a => a.severity === filters.severity);
      }
      if (filters.status) {
        alerts = alerts.filter(a => a.status === filters.status);
      }
      if (filters.projectId) {
        alerts = alerts.filter(a => a.projectId === filters.projectId);
      }
      if (filters.since) {
        alerts = alerts.filter(a => a.detectedAt >= filters.since!);
      }
    }

    // Sort by detection time (newest first)
    alerts.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

    // Apply limit
    if (filters?.limit) {
      alerts = alerts.slice(0, filters.limit);
    }

    return alerts;
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();

    const action: AlertAction = {
      type: 'record_updated',
      timestamp: new Date(),
      details: { acknowledgedBy, previousStatus: 'new' },
      success: true
    };

    alert.actionsTaken.push(action);

    console.log(`✅ Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, resolvedBy: string, resolution?: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    const previousStatus = alert.status;
    alert.status = 'resolved';
    alert.resolvedAt = new Date();

    if (resolution) {
      alert.details.resolution = resolution;
    }

    const action: AlertAction = {
      type: 'record_updated',
      timestamp: new Date(),
      details: { resolvedBy, previousStatus, resolution },
      success: true
    };

    alert.actionsTaken.push(action);

    console.log(`✅ Alert resolved: ${alertId} by ${resolvedBy}`);
  }

  // ========================================================================
  // SPECIALIZED DETECTION METHODS
  // ========================================================================

  /**
   * Check για accuracy degradation σε specific project
   */
  async checkAccuracyDegradation(projectId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      // Get control points για project
      const controlPoints = await controlPointRepository.getControlPointsByProject(projectId);

      // Analyze accuracy
      for (const point of controlPoints) {
        if (point.accuracyMeters > 2.0) { // Threshold από template
          const alert = await this.createAccuracyAlert(point, projectId);
          alerts.push(alert);
        }
      }

    } catch (error) {
      console.error('❌ Error checking accuracy degradation:', error);
    }

    return alerts;
  }

  /**
   * Check για spatial conflicts σε project
   */
  async checkSpatialConflicts(projectId: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    // Mock spatial conflict detection
    // In real implementation, would use PostGIS spatial queries
    console.log(`🔍 Checking spatial conflicts για project ${projectId}`);

    return alerts;
  }

  /**
   * Check για data quality issues
   */
  async checkDataQuality(projectId?: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      // Check projects
      const projects = projectId
        ? [await projectRepository.getProjectById(projectId)].filter(Boolean) as GeoProject[]
        : await projectRepository.listProjects({ limit: 100 });

      for (const project of projects) {
        // Check για incomplete transformation
        if (!project.isCalibrated) {
          const alert = await this.createDataQualityAlert(
            'Uncalibrated Project',
            `Project ${project.name} lacks proper coordinate transformation`,
            project.id
          );
          alerts.push(alert);
        }

        // Check για missing control points
        const controlPoints = await controlPointRepository.getControlPointsByProject(project.id);
        if (controlPoints.length < 3) {
          const alert = await this.createDataQualityAlert(
            'Insufficient Control Points',
            `Project ${project.name} has only ${controlPoints.length} control points (minimum: 3)`,
            project.id
          );
          alerts.push(alert);
        }
      }

    } catch (error) {
      console.error('❌ Error checking data quality:', error);
    }

    return alerts;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private async createAccuracyAlert(point: GeoControlPoint, projectId: string): Promise<Alert> {
    const alertId = `accuracy_${Date.now()}_${point.id}`;

    const alert: Alert = {
      id: alertId,
      type: 'accuracy_degradation',
      severity: point.accuracyMeters > 5.0 ? 'critical' : 'high',
      status: 'new',
      title: 'Control Point Accuracy Degradation',
      message: `Control point accuracy has degraded to ${point.accuracyMeters}m (threshold: 2.0m)`,
      details: {
        controlPointId: point.id,
        accuracy: point.accuracyMeters,
        threshold: 2.0
      },
      projectId,
      entityId: point.id,
      entityType: 'control_point',
      location: {
        lng: point.geoPoint.lng,
        lat: point.geoPoint.lat,
        accuracy: point.accuracyMeters
      },
      detectedAt: new Date(),
      triggeredByRule: 'accuracy_degradation_manual',
      // ✅ ENTERPRISE: Proper mock object instead of 'as any'
      ruleEvaluation: {
        ruleId: 'accuracy_degradation_manual',
        triggered: true,
        confidence: 1.0,
        conditionResults: [],
        actionsExecuted: [],
        executionTime: 0,
        evaluatedAt: new Date(),
        metadata: { source: 'manual_detection' }
      },
      actionsTaken: [],
      createdBy: 'alert_detection_system',
      tags: ['accuracy', 'control_point']
    };

    this.alerts.set(alertId, alert);
    this.updateStatistics(alert);

    return alert;
  }

  private async createDataQualityAlert(title: string, message: string, projectId?: string): Promise<Alert> {
    const alertId = `quality_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const alert: Alert = {
      id: alertId,
      type: 'data_quality_issue',
      severity: 'medium',
      status: 'new',
      title,
      message,
      details: {},
      projectId,
      detectedAt: new Date(),
      triggeredByRule: 'data_quality_manual',
      // ✅ ENTERPRISE: Proper mock object instead of 'as any'
      ruleEvaluation: {
        ruleId: 'data_quality_manual',
        triggered: true,
        confidence: 1.0,
        conditionResults: [],
        actionsExecuted: [],
        executionTime: 0,
        evaluatedAt: new Date(),
        metadata: { source: 'manual_detection' }
      },
      actionsTaken: [],
      createdBy: 'alert_detection_system',
      tags: ['data_quality']
    };

    this.alerts.set(alertId, alert);
    this.updateStatistics(alert);

    return alert;
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\${(\w+)}/g, (match, key) => {
      return data[key]?.toString() || match;
    });
  }

  private async executeAlertActions(alert: Alert, actionTypes: string[]): Promise<void> {
    // ✅ ENTERPRISE: Valid action types
    const validActionTypes = new Set<AlertAction['type']>([
      'notification_sent',
      'email_sent',
      'workflow_triggered',
      'record_updated',
      'escalated'
    ]);

    for (const actionType of actionTypes) {
      // ✅ ENTERPRISE: Type guard instead of 'as any'
      if (!validActionTypes.has(actionType as AlertAction['type'])) {
        console.warn(`⚠️ Invalid action type: ${actionType}`);
        continue;
      }

      try {
        const action: AlertAction = {
          type: actionType as AlertAction['type'],
          timestamp: new Date(),
          details: { alertId: alert.id, actionType },
          success: true
        };

        // Mock action execution
        console.log(`📧 Executing action: ${actionType} για alert ${alert.id}`);

        alert.actionsTaken.push(action);
      } catch (error) {
        const action: AlertAction = {
          type: actionType as AlertAction['type'],
          timestamp: new Date(),
          details: { alertId: alert.id, actionType },
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        alert.actionsTaken.push(action);
      }
    }
  }

  private updateStatistics(alert: Alert): void {
    this.detectionStatistics.totalAlertsDetected++;
    this.detectionStatistics.alertsBySeverity[alert.severity]++;

    if (!this.detectionStatistics.alertsByType[alert.type]) {
      this.detectionStatistics.alertsByType[alert.type] = 0;
    }
    this.detectionStatistics.alertsByType[alert.type]++;

    // Update temporal metrics
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (alert.detectedAt >= last24Hours) {
      this.detectionStatistics.alertsLast24Hours++;
    }
  }

  // ========================================================================
  // STATUS και REPORTING
  // ========================================================================

  getDetectionStatistics(): DetectionStatistics {
    return { ...this.detectionStatistics };
  }

  getAlertTemplates(): AlertTemplate[] {
    return Array.from(this.alertTemplates.values());
  }

  getSystemStatus(): {
    isRunning: boolean;
    totalAlerts: number;
    activeAlerts: number;
    templatesLoaded: number;
    rulesRegistered: number;
  } {
    const activeAlerts = Array.from(this.alerts.values()).filter(
      a => a.status === 'new' || a.status === 'acknowledged'
    ).length;

    return {
      isRunning: this.rulesEngine.getEngineStatus().isRunning,
      totalAlerts: this.alerts.size,
      activeAlerts,
      templatesLoaded: this.alertTemplates.size,
      rulesRegistered: this.rulesEngine.getEngineStatus().totalRules
    };
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const alertDetectionSystem = new AlertDetectionSystem();
export default alertDetectionSystem;