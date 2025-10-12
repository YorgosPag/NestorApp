/**
 * INTELLIGENT RULES ENGINE
 * Geo-Alert System - Phase 5: Alert Engine & Rules System
 *
 * Enterprise rules engine για spatial data analysis με:
 * - Dynamic rule evaluation
 * - Complex condition logic (AND/OR/NOT)
 * - Spatial relationship triggers
 * - Temporal pattern detection
 * - Machine learning integration ready
 */

import type { DatabaseManager } from '../../database-system/connection/DatabaseManager';
import { databaseManager } from '../../database-system/connection/DatabaseManager';
import type { GeoControlPoint } from '../../database-system/repositories/ControlPointRepository';
import type { GeoProject } from '../../database-system/repositories/ProjectRepository';

// ============================================================================
// RULES ENGINE TYPES
// ============================================================================

export interface Rule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  priority: RulePriority;

  // Rule configuration
  isEnabled: boolean;
  schedule?: RuleSchedule;

  // Conditions (tree structure για complex logic)
  conditions: RuleCondition;

  // Actions to execute when rule triggers
  actions: RuleAction[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastTriggered?: Date;
  triggerCount: number;

  // Performance metrics
  averageExecutionTime: number;
  successRate: number;
}

export type RuleCategory =
  | 'accuracy_quality'      // Accuracy degradation, outliers
  | 'spatial_anomaly'       // Geometric inconsistencies, overlaps
  | 'temporal_change'       // Changes over time, trends
  | 'data_integrity'        // Missing data, validation errors
  | 'performance_monitoring' // System performance issues
  | 'security_compliance'   // Access violations, audit issues
  | 'business_logic'        // Domain-specific rules
  | 'predictive_analytics'; // ML-based predictions

export type RulePriority = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface RuleSchedule {
  type: 'continuous' | 'interval' | 'cron' | 'event_driven';
  interval?: number; // milliseconds για interval type
  cronExpression?: string; // για cron type
  events?: string[]; // event names που trigger the rule
}

// Condition tree structure για complex logic
export interface RuleCondition {
  type: 'logical' | 'comparison' | 'spatial' | 'temporal' | 'statistical';
  operator?: LogicalOperator | ComparisonOperator | SpatialOperator | TemporalOperator;

  // For logical conditions (AND/OR/NOT)
  children?: RuleCondition[];

  // For comparison conditions
  field?: string;
  value?: any;

  // For spatial conditions
  geometry?: GeoJSON.Geometry;
  spatialRelation?: SpatialRelation;

  // For temporal conditions
  timeWindow?: TimeWindow;

  // For statistical conditions
  aggregation?: StatisticalAggregation;
  threshold?: number;
}

export type LogicalOperator = 'AND' | 'OR' | 'NOT';
export type ComparisonOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'regex';
export type SpatialOperator = 'intersects' | 'within' | 'contains' | 'disjoint' | 'touches' | 'crosses';
export type TemporalOperator = 'before' | 'after' | 'during' | 'within_last' | 'older_than';

export type SpatialRelation = 'intersects' | 'within' | 'contains' | 'overlaps' | 'near';

export interface TimeWindow {
  duration: number; // milliseconds
  unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
}

export interface StatisticalAggregation {
  function: 'count' | 'sum' | 'average' | 'min' | 'max' | 'stddev' | 'variance';
  field: string;
  groupBy?: string;
}

// Actions to execute when rule triggers
export interface RuleAction {
  type: ActionType;
  parameters: Record<string, any>;
  retryPolicy?: RetryPolicy;
}

export type ActionType =
  | 'create_alert'          // Create alert notification
  | 'send_email'            // Send email notification
  | 'webhook'               // Call external webhook
  | 'update_record'         // Update database record
  | 'run_query'             // Execute SQL query
  | 'trigger_workflow'      // Start external workflow
  | 'log_event'             // Write to audit log
  | 'escalate_alert';       // Escalate existing alert

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number; // milliseconds
  backoffMultiplier: number;
}

// Rule evaluation context
export interface RuleContext {
  ruleId: string;
  triggeredAt: Date;
  projectId?: string;
  entityId?: string;
  entityType?: string;

  // Data context για rule evaluation
  data: Record<string, any>;

  // Previous evaluation results (για temporal rules)
  previousResults?: RuleEvaluationResult[];

  // Performance tracking
  executionStart: number;
}

export interface RuleEvaluationResult {
  ruleId: string;
  triggered: boolean;
  confidence: number; // 0-1, how confident we are in the result

  // Condition evaluation details
  conditionResults: ConditionResult[];

  // Actions executed
  actionsExecuted: ActionResult[];

  // Performance metrics
  executionTime: number;

  // Context
  evaluatedAt: Date;
  context: RuleContext;
}

export interface ConditionResult {
  conditionPath: string; // Path in condition tree
  result: boolean;
  confidence: number;
  details?: any;
}

export interface ActionResult {
  actionType: ActionType;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

// ============================================================================
// RULES ENGINE CLASS
// ============================================================================

export class RulesEngine {
  private dbManager: DatabaseManager;
  private rules: Map<string, Rule> = new Map();
  private evaluationQueue: RuleContext[] = [];
  private isRunning = false;
  private evaluationInterval?: NodeJS.Timeout;

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager || databaseManager;
  }

  // ========================================================================
  // RULE MANAGEMENT
  // ========================================================================

  /**
   * Register new rule in the engine
   */
  async registerRule(rule: Rule): Promise<void> {
    // Validate rule structure
    this.validateRule(rule);

    // Store rule
    this.rules.set(rule.id, rule);

    console.log(`✅ Rule registered: ${rule.name} (${rule.id})`);
  }

  /**
   * Update existing rule
   */
  async updateRule(ruleId: string, updates: Partial<Rule>): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    const updatedRule = { ...rule, ...updates, updatedAt: new Date() };
    this.validateRule(updatedRule);

    this.rules.set(ruleId, updatedRule);

    console.log(`📝 Rule updated: ${updatedRule.name} (${ruleId})`);
  }

  /**
   * Remove rule from engine
   */
  async removeRule(ruleId: string): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    this.rules.delete(ruleId);
    console.log(`🗑️ Rule removed: ${rule.name} (${ruleId})`);
  }

  /**
   * Get all registered rules
   */
  getRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): Rule | undefined {
    return this.rules.get(ruleId);
  }

  // ========================================================================
  // RULE EVALUATION ENGINE
  // ========================================================================

  /**
   * Start continuous rule evaluation
   */
  startEvaluation(intervalMs: number = 5000): void {
    if (this.isRunning) {
      console.log('⚠️ Rules engine is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting rules engine evaluation...');

    this.evaluationInterval = setInterval(async () => {
      await this.evaluateAllRules();
    }, intervalMs);
  }

  /**
   * Stop rule evaluation
   */
  stopEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = undefined;
    }

    this.isRunning = false;
    console.log('⏹️ Rules engine stopped');
  }

  /**
   * Evaluate all active rules
   */
  async evaluateAllRules(): Promise<RuleEvaluationResult[]> {
    const results: RuleEvaluationResult[] = [];
    const activeRules = Array.from(this.rules.values()).filter(rule => rule.isEnabled);

    console.log(`🔍 Evaluating ${activeRules.length} active rules...`);

    for (const rule of activeRules) {
      try {
        const result = await this.evaluateRule(rule);
        results.push(result);

        if (result.triggered) {
          console.log(`🚨 Rule triggered: ${rule.name} (confidence: ${(result.confidence * 100).toFixed(1)}%)`);

          // Update rule statistics
          rule.lastTriggered = new Date();
          rule.triggerCount++;

          // Update performance metrics
          rule.averageExecutionTime = (rule.averageExecutionTime + result.executionTime) / 2;
        }
      } catch (error) {
        console.error(`❌ Error evaluating rule ${rule.name}:`, error);
      }
    }

    return results;
  }

  /**
   * Evaluate specific rule
   */
  async evaluateRule(rule: Rule, context?: Partial<RuleContext>): Promise<RuleEvaluationResult> {
    const startTime = performance.now();

    const ruleContext: RuleContext = {
      ruleId: rule.id,
      triggeredAt: new Date(),
      executionStart: startTime,
      data: {},
      ...context
    };

    try {
      // Gather data για rule evaluation
      await this.gatherRuleData(rule, ruleContext);

      // Evaluate conditions
      const conditionResult = await this.evaluateCondition(rule.conditions, ruleContext);

      // Determine if rule triggered
      const triggered = conditionResult.result && conditionResult.confidence > 0.5;

      let actionsExecuted: ActionResult[] = [];

      // Execute actions if triggered
      if (triggered) {
        actionsExecuted = await this.executeActions(rule.actions, ruleContext);
      }

      const executionTime = performance.now() - startTime;

      return {
        ruleId: rule.id,
        triggered,
        confidence: conditionResult.confidence,
        conditionResults: [conditionResult],
        actionsExecuted,
        executionTime,
        evaluatedAt: new Date(),
        context: ruleContext
      };

    } catch (error) {
      const executionTime = performance.now() - startTime;

      return {
        ruleId: rule.id,
        triggered: false,
        confidence: 0,
        conditionResults: [{
          conditionPath: 'root',
          result: false,
          confidence: 0,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        }],
        actionsExecuted: [],
        executionTime,
        evaluatedAt: new Date(),
        context: ruleContext
      };
    }
  }

  // ========================================================================
  // CONDITION EVALUATION
  // ========================================================================

  /**
   * Evaluate rule condition (recursive for complex conditions)
   */
  private async evaluateCondition(condition: RuleCondition, context: RuleContext): Promise<ConditionResult> {
    switch (condition.type) {
      case 'logical':
        return this.evaluateLogicalCondition(condition, context);

      case 'comparison':
        return this.evaluateComparisonCondition(condition, context);

      case 'spatial':
        return this.evaluateSpatialCondition(condition, context);

      case 'temporal':
        return this.evaluateTemporalCondition(condition, context);

      case 'statistical':
        return this.evaluateStatisticalCondition(condition, context);

      default:
        throw new Error(`Unknown condition type: ${condition.type}`);
    }
  }

  private async evaluateLogicalCondition(condition: RuleCondition, context: RuleContext): Promise<ConditionResult> {
    if (!condition.children || condition.children.length === 0) {
      return { conditionPath: 'logical', result: false, confidence: 0 };
    }

    const childResults = await Promise.all(
      condition.children.map(child => this.evaluateCondition(child, context))
    );

    let result = false;
    let confidence = 0;

    switch (condition.operator as LogicalOperator) {
      case 'AND':
        result = childResults.every(r => r.result);
        confidence = result ? Math.min(...childResults.map(r => r.confidence)) : 0;
        break;

      case 'OR':
        result = childResults.some(r => r.result);
        confidence = result ? Math.max(...childResults.map(r => r.confidence)) : 0;
        break;

      case 'NOT':
        if (childResults.length !== 1) {
          throw new Error('NOT operator requires exactly one child condition');
        }
        result = !childResults[0].result;
        confidence = childResults[0].confidence;
        break;
    }

    return {
      conditionPath: `logical_${condition.operator}`,
      result,
      confidence,
      details: { childResults }
    };
  }

  private async evaluateComparisonCondition(condition: RuleCondition, context: RuleContext): Promise<ConditionResult> {
    if (!condition.field || condition.value === undefined) {
      return { conditionPath: 'comparison', result: false, confidence: 0 };
    }

    const fieldValue = this.getFieldValue(condition.field, context);
    const targetValue = condition.value;

    let result = false;

    switch (condition.operator as ComparisonOperator) {
      case 'equals':
        result = fieldValue === targetValue;
        break;

      case 'not_equals':
        result = fieldValue !== targetValue;
        break;

      case 'greater_than':
        result = Number(fieldValue) > Number(targetValue);
        break;

      case 'less_than':
        result = Number(fieldValue) < Number(targetValue);
        break;

      case 'contains':
        result = String(fieldValue).includes(String(targetValue));
        break;

      case 'regex':
        result = new RegExp(String(targetValue)).test(String(fieldValue));
        break;
    }

    return {
      conditionPath: `comparison_${condition.operator}`,
      result,
      confidence: 1.0, // Comparison conditions are deterministic
      details: { fieldValue, targetValue, operator: condition.operator }
    };
  }

  private async evaluateSpatialCondition(condition: RuleCondition, context: RuleContext): Promise<ConditionResult> {
    // Mock spatial evaluation - in real implementation would use PostGIS
    // This would query spatial relationships από database

    return {
      conditionPath: 'spatial',
      result: false, // Placeholder
      confidence: 0.8,
      details: { message: 'Spatial condition evaluation not fully implemented' }
    };
  }

  private async evaluateTemporalCondition(condition: RuleCondition, context: RuleContext): Promise<ConditionResult> {
    if (!condition.timeWindow) {
      return { conditionPath: 'temporal', result: false, confidence: 0 };
    }

    const now = new Date();
    const timeWindowMs = this.convertTimeWindowToMs(condition.timeWindow);

    let result = false;

    switch (condition.operator as TemporalOperator) {
      case 'within_last':
        const cutoffTime = new Date(now.getTime() - timeWindowMs);
        result = context.triggeredAt > cutoffTime;
        break;

      case 'older_than':
        const ageThreshold = new Date(now.getTime() - timeWindowMs);
        result = context.triggeredAt < ageThreshold;
        break;
    }

    return {
      conditionPath: `temporal_${condition.operator}`,
      result,
      confidence: 1.0,
      details: { timeWindow: condition.timeWindow, operator: condition.operator }
    };
  }

  private async evaluateStatisticalCondition(condition: RuleCondition, context: RuleContext): Promise<ConditionResult> {
    if (!condition.aggregation || !condition.threshold) {
      return { conditionPath: 'statistical', result: false, confidence: 0 };
    }

    // Mock statistical evaluation - would query database για real stats
    const mockValue = Math.random() * 100;
    const result = mockValue > condition.threshold;

    return {
      conditionPath: 'statistical',
      result,
      confidence: 0.9,
      details: {
        aggregation: condition.aggregation,
        calculatedValue: mockValue,
        threshold: condition.threshold
      }
    };
  }

  // ========================================================================
  // ACTION EXECUTION
  // ========================================================================

  private async executeActions(actions: RuleAction[], context: RuleContext): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of actions) {
      const startTime = performance.now();

      try {
        const result = await this.executeAction(action, context);
        const executionTime = performance.now() - startTime;

        results.push({
          actionType: action.type,
          success: true,
          result,
          executionTime
        });

      } catch (error) {
        const executionTime = performance.now() - startTime;

        results.push({
          actionType: action.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime
        });
      }
    }

    return results;
  }

  private async executeAction(action: RuleAction, context: RuleContext): Promise<any> {
    switch (action.type) {
      case 'create_alert':
        return this.createAlert(action.parameters, context);

      case 'send_email':
        return this.sendEmail(action.parameters, context);

      case 'log_event':
        return this.logEvent(action.parameters, context);

      default:
        console.log(`📋 Mock action executed: ${action.type}`, action.parameters);
        return { success: true, message: `Mock execution of ${action.type}` };
    }
  }

  private async createAlert(parameters: any, context: RuleContext): Promise<any> {
    console.log(`🚨 ALERT CREATED: ${parameters.message || 'Rule triggered'}`);
    return { alertId: `alert_${Date.now()}`, message: parameters.message };
  }

  private async sendEmail(parameters: any, context: RuleContext): Promise<any> {
    console.log(`📧 EMAIL SENT: ${parameters.subject || 'Alert Notification'} → ${parameters.to || 'admin@example.com'}`);
    return { emailId: `email_${Date.now()}`, status: 'sent' };
  }

  private async logEvent(parameters: any, context: RuleContext): Promise<any> {
    console.log(`📝 EVENT LOGGED: ${parameters.message || 'Rule event'}`);
    return { logId: `log_${Date.now()}`, timestamp: new Date() };
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private async gatherRuleData(rule: Rule, context: RuleContext): Promise<void> {
    // Mock data gathering - in real implementation would query database
    context.data = {
      currentTime: new Date(),
      projectCount: 5,
      controlPointCount: 25,
      averageAccuracy: 1.2,
      recentErrors: 2
    };
  }

  private getFieldValue(fieldPath: string, context: RuleContext): any {
    const parts = fieldPath.split('.');
    let value = context.data;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private convertTimeWindowToMs(timeWindow: TimeWindow): number {
    const multipliers = {
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
      months: 30 * 24 * 60 * 60 * 1000
    };

    return timeWindow.duration * multipliers[timeWindow.unit];
  }

  private validateRule(rule: Rule): void {
    if (!rule.id || !rule.name) {
      throw new Error('Rule must have id and name');
    }

    if (!rule.conditions) {
      throw new Error('Rule must have conditions');
    }

    if (!rule.actions || rule.actions.length === 0) {
      throw new Error('Rule must have at least one action');
    }
  }

  // ========================================================================
  // STATUS και METRICS
  // ========================================================================

  getEngineStatus(): {
    isRunning: boolean;
    totalRules: number;
    enabledRules: number;
    totalEvaluations: number;
    averageExecutionTime: number;
  } {
    const rules = Array.from(this.rules.values());
    const enabledRules = rules.filter(r => r.isEnabled);

    return {
      isRunning: this.isRunning,
      totalRules: rules.length,
      enabledRules: enabledRules.length,
      totalEvaluations: rules.reduce((sum, r) => sum + r.triggerCount, 0),
      averageExecutionTime: rules.length > 0
        ? rules.reduce((sum, r) => sum + r.averageExecutionTime, 0) / rules.length
        : 0
    };
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const rulesEngine = new RulesEngine();
export default rulesEngine;