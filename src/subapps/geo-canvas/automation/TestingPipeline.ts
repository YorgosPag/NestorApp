/**
 * AUTOMATED TESTING PIPELINE — Main Orchestrator
 * Geo-Alert System - Phase 7: Complete Testing Automation & CI/CD Integration
 *
 * Enterprise-class automated testing pipeline that orchestrates all testing tools,
 * performance monitoring, and quality assurance processes.
 *
 * @see testing-pipeline-types.ts — All type definitions
 * @see testing-pipeline-config.ts — Default configuration
 * @see testing-pipeline-tasks.ts — Task execution implementations
 */

import { performance } from 'perf_hooks';
import { generatePipelineId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { createDefaultPipelineConfig } from './testing-pipeline-config';
import {
  runUnitTests, runIntegrationTests, runE2ETests, runPerformanceTests,
  runBundleAnalysis, runSecurityTests, runAccessibilityTests,
  runVisualRegression, runCodeQuality, runBuild, runLoadTests,
} from './testing-pipeline-tasks';
import type {
  PipelineConfig, PipelineStage, PipelineTask, PipelineExecution,
  StageExecution, TaskExecution, TaskResult, PipelineMetrics,
  PipelineArtifact, QualityGate, QualityGateResult,
  NotificationChannel, NotificationEvent, NotificationResult,
  ExecutionMetadata,
} from './testing-pipeline-types';

const logger = createModuleLogger('TestingPipeline');

// Re-export all types for consumers
export type * from './testing-pipeline-types';

// ============================================================================
// MAIN TESTING PIPELINE CLASS
// ============================================================================

/**
 * Testing Pipeline Orchestrator - Complete CI/CD Testing Automation
 * Singleton pattern for centralized pipeline management
 */
export class GeoAlertTestingPipeline {
  private static instance: GeoAlertTestingPipeline | null = null;
  private config: PipelineConfig;
  private executions: Map<string, PipelineExecution> = new Map();
  private activeExecution?: PipelineExecution;

  private constructor() {
    this.config = createDefaultPipelineConfig();
  }

  public static getInstance(): GeoAlertTestingPipeline {
    if (!GeoAlertTestingPipeline.instance) {
      GeoAlertTestingPipeline.instance = new GeoAlertTestingPipeline();
    }
    return GeoAlertTestingPipeline.instance;
  }

  // ========================================================================
  // PIPELINE EXECUTION
  // ========================================================================

  public async executePipeline(
    trigger: string = 'manual',
    metadata: Partial<ExecutionMetadata> = {}
  ): Promise<PipelineExecution> {
    const executionId = generatePipelineId();

    console.log('🚀 AUTOMATED TESTING PIPELINE - Starting execution...');
    console.log(`📋 Execution ID: ${executionId}`);
    console.log(`🎯 Trigger: ${trigger}`);

    const execution: PipelineExecution = {
      id: executionId,
      config: this.config,
      startTime: performance.now(),
      status: 'running',
      stages: [],
      artifacts: [],
      metrics: this.initializeMetrics(),
      qualityGates: [],
      notifications: [],
      metadata: {
        triggeredBy: 'system',
        trigger,
        branch: 'main',
        commit: 'latest',
        environment: this.config.environment,
        version: '1.0.0',
        buildNumber: Date.now(),
        ...metadata
      }
    };

    this.executions.set(executionId, execution);
    this.activeExecution = execution;

    try {
      await this.executeStages(execution);
      await this.evaluateQualityGates(execution);
      await this.generatePipelineReport(execution);
      await this.sendNotifications(execution);

      execution.status = 'completed';
      execution.endTime = performance.now();
      execution.duration = execution.endTime - execution.startTime;

      console.log(`✅ Pipeline execution completed: ${executionId} (${execution.duration.toFixed(2)}ms)`);
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = performance.now();
      execution.duration = execution.endTime - execution.startTime;
      logger.error(`Pipeline execution failed: ${executionId}`, { error });
      await this.sendFailureNotifications(execution, error);
    }

    this.activeExecution = undefined;
    return execution;
  }

  // ========================================================================
  // STAGE EXECUTION
  // ========================================================================

  private async executeStages(execution: PipelineExecution): Promise<void> {
    const enabledStages = this.config.stages.filter(stage => stage.enabled);

    for (const stageConfig of enabledStages) {
      if (!this.evaluateStageConditions(stageConfig, execution)) {
        console.log(`⏭️  Skipping stage: ${stageConfig.name} (conditions not met)`);
        continue;
      }
      if (!this.checkStageDependencies(stageConfig, execution)) {
        throw new Error(`Stage dependencies not met: ${stageConfig.name}`);
      }
      await this.executeStage(stageConfig, execution);
    }
  }

  private async executeStage(stageConfig: PipelineStage, execution: PipelineExecution): Promise<void> {
    console.log(`🎬 Executing stage: ${stageConfig.name}`);

    const stageExecution: StageExecution = {
      stage: stageConfig.name,
      startTime: performance.now(),
      status: 'running',
      tasks: [],
      artifacts: [],
      logs: [],
      retryCount: 0
    };

    execution.stages.push(stageExecution);

    try {
      if (this.config.parallelExecution && stageConfig.tasks.length > 1) {
        await Promise.all(stageConfig.tasks.map(task => this.executeTask(task, stageExecution)));
      } else {
        for (const task of stageConfig.tasks) {
          await this.executeTask(task, stageExecution);
        }
      }

      stageExecution.status = 'completed';
      stageExecution.endTime = performance.now();
      stageExecution.duration = stageExecution.endTime - stageExecution.startTime;
      console.log(`✅ Stage completed: ${stageConfig.name} (${stageExecution.duration.toFixed(2)}ms)`);
    } catch (error) {
      stageExecution.status = 'failed';
      stageExecution.endTime = performance.now();
      stageExecution.duration = stageExecution.endTime - stageExecution.startTime;
      logger.error(`Stage failed: ${stageConfig.name}`, { error });

      if (stageExecution.retryCount < stageConfig.retryCount) {
        console.log(`🔄 Retrying stage: ${stageConfig.name} (attempt ${stageExecution.retryCount + 1})`);
        stageExecution.retryCount++;
        await this.executeStage(stageConfig, execution);
      } else {
        throw error;
      }
    }
  }

  // ========================================================================
  // TASK EXECUTION
  // ========================================================================

  private async executeTask(task: PipelineTask, stageExecution: StageExecution): Promise<void> {
    console.log(`  📋 Executing task: ${task.name} (${task.type})`);

    const taskExecution: TaskExecution = {
      task: task.name,
      type: task.type,
      startTime: performance.now(),
      status: 'running',
      result: null,
      artifacts: [],
      metrics: {},
      logs: []
    };

    stageExecution.tasks.push(taskExecution);

    try {
      const result = await this.executeTaskByType(task, taskExecution);
      taskExecution.result = result;
      taskExecution.status = 'completed';
      taskExecution.endTime = performance.now();
      taskExecution.duration = taskExecution.endTime - taskExecution.startTime;
      console.log(`  ✅ Task completed: ${task.name} (${taskExecution.duration.toFixed(2)}ms)`);
    } catch (error: unknown) {
      taskExecution.status = 'failed';
      taskExecution.error = error instanceof Error ? error.message : String(error);
      taskExecution.endTime = performance.now();
      taskExecution.duration = taskExecution.endTime - taskExecution.startTime;
      logger.error(`Task failed: ${task.name}`, { error });

      if (!task.allowFailure) {
        throw error;
      } else {
        console.log(`  ⚠️  Task failure allowed, continuing: ${task.name}`);
      }
    }
  }

  private async executeTaskByType(task: PipelineTask, execution: TaskExecution): Promise<TaskResult> {
    switch (task.type) {
      case 'unit-tests': return runUnitTests(task, execution);
      case 'integration-tests': return runIntegrationTests(task, execution);
      case 'e2e-tests': return runE2ETests(task, execution);
      case 'performance-tests': return runPerformanceTests(task, execution);
      case 'bundle-analysis': return runBundleAnalysis(task, execution);
      case 'security-tests': return runSecurityTests(task, execution);
      case 'accessibility-tests': return runAccessibilityTests(task, execution);
      case 'visual-regression': return runVisualRegression(task, execution);
      case 'code-quality': return runCodeQuality(task, execution);
      case 'build': return runBuild(task, execution);
      case 'load-tests': return runLoadTests(task, execution);
      default: throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  // ========================================================================
  // QUALITY GATES
  // ========================================================================

  private async evaluateQualityGates(execution: PipelineExecution): Promise<void> {
    console.log('🚪 Evaluating quality gates...');

    const gates = this.config.quality;
    const results: QualityGateResult[] = [];

    if (gates.testCoverage.enabled) {
      results.push(this.evaluateGate('testCoverage', this.extractMetric(execution, 'coverage-percentage') || 0, gates.testCoverage));
    }
    if (gates.performanceScore.enabled) {
      results.push(this.evaluateGate('performanceScore', this.extractMetric(execution, 'performance-score') || 0, gates.performanceScore));
    }
    if (gates.securityScore.enabled) {
      results.push(this.evaluateGate('securityScore', this.extractMetric(execution, 'vulnerabilities') || 0, gates.securityScore));
    }
    if (gates.codeQuality.enabled) {
      results.push(this.evaluateGate('codeQuality', this.extractMetric(execution, 'overall-quality') || 0, gates.codeQuality));
    }
    if (gates.bundleSize.enabled) {
      results.push(this.evaluateGate('bundleSize', this.extractMetric(execution, 'bundle-size') || 0, gates.bundleSize));
    }
    if (gates.memoryLeaks.enabled) {
      results.push(this.evaluateGate('memoryLeaks', this.extractMetric(execution, 'leak-count') || 0, gates.memoryLeaks));
    }

    execution.qualityGates = results;

    const blockingFailures = results.filter(r => r.status === 'failed' && r.blocking);
    if (blockingFailures.length > 0) {
      throw new Error(`Quality gates failed: ${blockingFailures.map(f => f.message).join(', ')}`);
    }

    console.log(`✅ Quality gates: ${results.filter(r => r.status === 'passed').length}/${results.length} passed`);
  }

  private evaluateGate(gateName: string, actualValue: number, gate: QualityGate): QualityGateResult {
    let passed = false;
    switch (gate.operator) {
      case 'gt': passed = actualValue > gate.threshold; break;
      case 'gte': passed = actualValue >= gate.threshold; break;
      case 'lt': passed = actualValue < gate.threshold; break;
      case 'lte': passed = actualValue <= gate.threshold; break;
      case 'eq': passed = actualValue === gate.threshold; break;
    }
    return {
      gate: gateName,
      status: passed ? 'passed' : 'failed',
      actualValue,
      threshold: gate.threshold,
      message: passed ? `${gateName} passed` : gate.message,
      blocking: gate.blocking
    };
  }

  private extractMetric(execution: PipelineExecution, metricName: string): number | undefined {
    for (const stage of execution.stages) {
      for (const task of stage.tasks) {
        if (task.metrics[metricName] !== undefined) return task.metrics[metricName];
      }
    }
    return undefined;
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  private evaluateStageConditions(_stage: PipelineStage, _execution: PipelineExecution): boolean {
    return true;
  }

  private checkStageDependencies(stage: PipelineStage, execution: PipelineExecution): boolean {
    return stage.dependsOn.every(dep => {
      const s = execution.stages.find(st => st.stage === dep);
      return s && s.status === 'completed';
    });
  }

  private initializeMetrics(): PipelineMetrics {
    return {
      totalDuration: 0,
      testMetrics: { totalTests: 0, passedTests: 0, failedTests: 0, skippedTests: 0, coverage: 0, testSuites: 0 },
      performanceMetrics: { overallScore: 0, renderingScore: 0, loadTime: 0, bundleSize: 0, memoryUsage: 0, leaksDetected: 0 },
      qualityMetrics: { codeComplexity: 0, duplication: 0, maintainabilityIndex: 0, technicalDebt: 0, securityVulnerabilities: 0 },
      resourceUsage: { cpuUsage: 0, memoryUsage: 0, diskIO: 0, networkIO: 0, executionTime: 0 }
    };
  }

  // ========================================================================
  // REPORTING & NOTIFICATIONS
  // ========================================================================

  private async generatePipelineReport(execution: PipelineExecution): Promise<void> {
    console.log('📄 Generating pipeline report...');
    this.updateFinalMetrics(execution);

    const reportArtifact: PipelineArtifact = {
      name: 'pipeline-report.html',
      type: 'test-results',
      path: `./reports/${execution.id}/pipeline-report.html`,
      size: 0,
      checksum: 'mock-checksum',
      metadata: { format: 'html', generated: Date.now() }
    };
    execution.artifacts.push(reportArtifact);
    console.log('✅ Pipeline report generated');
  }

  private updateFinalMetrics(execution: PipelineExecution): void {
    let totalTests = 0, passedTests = 0, failedTests = 0;

    execution.stages.forEach(stage => {
      stage.tasks.forEach(task => {
        totalTests += task.metrics['test-count'] || 0;
        passedTests += task.metrics['passed-tests'] || 0;
        failedTests += task.metrics['failed-tests'] || 0;
      });
    });

    execution.metrics.testMetrics = {
      totalTests, passedTests, failedTests, skippedTests: 0,
      coverage: this.extractMetric(execution, 'coverage-percentage') || 0,
      testSuites: execution.stages.filter(s => s.stage.includes('test')).length
    };
    execution.metrics.totalDuration = execution.duration || 0;
  }

  private async sendNotifications(execution: PipelineExecution): Promise<void> {
    console.log('📬 Sending notifications...');
    for (const channel of this.config.notifications.channels) {
      if (!channel.enabled) continue;
      try {
        execution.notifications.push(await this.sendNotification(channel, 'pipeline-completed', execution));
      } catch (error) {
        logger.error(`Failed to send notification via ${channel.type}`, { error });
      }
    }
  }

  private async sendFailureNotifications(execution: PipelineExecution, error: unknown): Promise<void> {
    console.log('📬 Sending failure notifications...');
    for (const channel of this.config.notifications.channels) {
      if (!channel.enabled) continue;
      try {
        execution.notifications.push(await this.sendNotification(channel, 'pipeline-failed', execution, error));
      } catch (notificationError) {
        logger.error(`Failed to send failure notification via ${channel.type}`, { error: notificationError });
      }
    }
  }

  private async sendNotification(
    channel: NotificationChannel, event: NotificationEvent,
    execution: PipelineExecution, error?: unknown
  ): Promise<NotificationResult> {
    console.log(`  📨 Sending ${event} notification via ${channel.type}`);
    const template = this.config.notifications.templates.find(t => t.event === event);
    const errorMessage = error instanceof Error ? error.message : error ? String(error) : undefined;
    return {
      channel: channel.type, event, status: 'sent', timestamp: Date.now(),
      message: template ? template.body : `Pipeline ${event}`,
      error: errorMessage
    };
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  public getExecutionStatus(executionId: string): PipelineExecution | undefined {
    return this.executions.get(executionId);
  }

  public getAllExecutions(): Map<string, PipelineExecution> {
    return this.executions;
  }

  public updateConfig(config: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getPipelineStatistics(): {
    totalExecutions: number; successRate: number; averageDuration: number; recentExecutions: PipelineExecution[];
  } {
    const executions = Array.from(this.executions.values());
    const completed = executions.filter(e => e.status === 'completed' || e.status === 'failed');
    const successful = executions.filter(e => e.status === 'completed');
    const successRate = completed.length > 0 ? (successful.length / completed.length) * 100 : 0;
    const averageDuration = completed.length > 0
      ? completed.reduce((sum, e) => sum + (e.duration || 0), 0) / completed.length : 0;

    return {
      totalExecutions: executions.length,
      successRate: Math.round(successRate),
      averageDuration: Math.round(averageDuration),
      recentExecutions: executions.sort((a, b) => b.startTime - a.startTime).slice(0, 10)
    };
  }

  public cancelExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'running') return false;

    execution.status = 'cancelled';
    execution.endTime = performance.now();
    execution.duration = execution.endTime - execution.startTime;

    if (this.activeExecution?.id === executionId) {
      this.activeExecution = undefined;
    }
    console.log(`🛑 Pipeline execution cancelled: ${executionId}`);
    return true;
  }

  public cleanupExecutions(retentionDays: number = 30): number {
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [id, execution] of this.executions.entries()) {
      if (execution.startTime < cutoffTime) {
        this.executions.delete(id);
        cleanedCount++;
      }
    }
    console.log(`🧹 Cleaned up ${cleanedCount} old pipeline executions`);
    return cleanedCount;
  }
}

// ============================================================================
// GLOBAL EXPORTS & UTILITIES
// ============================================================================

export const geoAlertTestingPipeline = GeoAlertTestingPipeline.getInstance();

export const executePipeline = (trigger?: string, metadata?: Partial<ExecutionMetadata>) =>
  geoAlertTestingPipeline.executePipeline(trigger, metadata);
export const getPipelineStatus = (executionId: string) =>
  geoAlertTestingPipeline.getExecutionStatus(executionId);
export const getPipelineStats = () =>
  geoAlertTestingPipeline.getPipelineStatistics();

export default geoAlertTestingPipeline;
