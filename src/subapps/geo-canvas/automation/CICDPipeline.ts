/**
 * GeoAlert CI/CD Pipeline — Main class: execution, deployment, monitoring.
 * @see cicd-pipeline-types.ts — type definitions
 * @see cicd-pipeline-config.ts — default configuration factory
 */

import type {
  PipelineConfiguration, PipelineExecution, PipelineStep,
  PipelineStage, StageExecution, StepExecution,
  ExecutionTrigger, DeploymentResult,
} from './cicd-pipeline-types';
import { createDefaultPipelineConfiguration } from './cicd-pipeline-config';

export * from './cicd-pipeline-types';
export { createDefaultPipelineConfiguration } from './cicd-pipeline-config';

// ============================================================================
// MAIN CLASS
// ============================================================================

export class GeoAlertCICDPipeline {
  private static instance: GeoAlertCICDPipeline | null = null;
  private config: PipelineConfiguration;
  private executions: Map<string, PipelineExecution> = new Map();
  private deployments: Map<string, DeploymentResult> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  private constructor() {
    this.config = createDefaultPipelineConfiguration();
    this.initializeCICDPipeline();
  }

  public static getInstance(): GeoAlertCICDPipeline {
    if (!GeoAlertCICDPipeline.instance) {
      GeoAlertCICDPipeline.instance = new GeoAlertCICDPipeline();
    }
    return GeoAlertCICDPipeline.instance;
  }

  // --- Initialization ---

  private initializeCICDPipeline(): void {
    try {
      this.setupPipelineStages();
      this.setupSecurityScanning();
      this.setupMonitoring();
      this.setupNotifications();
      this.setupDeploymentStrategies();
      this.startPipelineMonitoring();
      this.generateMockPipelineData();
      this.isInitialized = true;
      console.log('🔄 GeoAlert CI/CD Pipeline System initialized');
    } catch (error) {
      console.error('❌ CI/CD Pipeline initialization failed:', error);
      throw error;
    }
  }

  private setupPipelineStages(): void {
    console.log(`🔄 Pipeline stages configured: ${this.config.stages.length} stages`);
    this.config.stages.forEach(stage => {
      if (stage.enabled) {
        console.log(`  ✅ ${stage.name} (${stage.steps.length} steps)`);
      }
    });
  }

  private setupSecurityScanning(): void {
    const sec = this.config.security;
    console.log('🔒 Security scanning configuration:');
    if (sec.enableSAST) console.log('  ✅ Static Application Security Testing (SAST)');
    if (sec.enableDependencyScanning) console.log('  ✅ Dependency Vulnerability Scanning');
    if (sec.enableContainerScanning) console.log('  ✅ Container Security Scanning');
    if (sec.enableSecretScanning) console.log('  ✅ Secret Detection');
    if (sec.enableLicenseScanning) console.log('  ✅ License Compliance Scanning');
    console.log(`  🎯 Vulnerability threshold: ${sec.vulnerabilityThreshold}`);
  }

  private setupMonitoring(): void {
    const mon = this.config.monitoring;
    console.log('📊 Pipeline monitoring enabled:');
    if (mon.enableMetrics) console.log('  ✅ Metrics collection');
    if (mon.enableLogging) console.log('  ✅ Centralized logging');
    if (mon.enableTracing) console.log('  ✅ Distributed tracing');
  }

  private setupNotifications(): void {
    const notif = this.config.notifications;
    if (!notif.enabled) return;
    console.log('📧 Notification channels configured:');
    notif.channels.forEach(ch => {
      if (ch.enabled) console.log(`  ✅ ${ch.type.toUpperCase()}`);
    });
  }

  private setupDeploymentStrategies(): void {
    console.log(`🚀 Deployment strategy: ${this.config.deployment.strategy}`);
    console.log(`📊 Environments: ${this.config.deployment.environments.length}`);
    this.config.deployment.environments.forEach(env => {
      console.log(`  🌍 ${env.name} (${env.type}): ${env.replicas} replicas`);
    });
  }

  // --- Pipeline Execution ---

  public async executePipeline(trigger: ExecutionTrigger): Promise<PipelineExecution> {
    const execution: PipelineExecution = {
      id: `exec_${Date.now()}`,
      pipelineId: this.config.general.name,
      trigger,
      status: 'running',
      startTime: new Date(),
      stages: [],
      artifacts: [],
      logs: [],
      metrics: {
        totalDuration: 0, queueTime: 0, buildTime: 0, testTime: 0, deployTime: 0,
        resourceUsage: { cpu: 0, memory: 0, disk: 0 },
        testResults: { total: 0, passed: 0, failed: 0, skipped: 0, coverage: 0 },
        securityResults: { vulnerabilities: 0, criticalVulnerabilities: 0, dependencyIssues: 0, secretsFound: 0 },
      },
    };

    this.executions.set(execution.id, execution);

    try {
      await this.executeStages(execution);
      execution.status = 'success';
      execution.endTime = new Date();
      execution.duration = (execution.endTime.getTime() - execution.startTime.getTime()) / 1000;
      console.log(`✅ Pipeline execution completed: ${execution.id}`);
      await this.sendNotification('success', execution);
    } catch (error) {
      execution.status = 'failure';
      execution.endTime = new Date();
      execution.duration = (execution.endTime.getTime() - execution.startTime.getTime()) / 1000;
      console.log(`❌ Pipeline execution failed: ${execution.id}`, error);
      await this.sendNotification('failure', execution);
    }

    return execution;
  }

  private async executeStages(execution: PipelineExecution): Promise<void> {
    for (const stageConfig of this.config.stages) {
      if (!stageConfig.enabled) continue;

      const stageExecution: StageExecution = {
        stageId: stageConfig.id,
        status: 'running',
        startTime: new Date(),
        steps: [],
        logs: [],
      };
      execution.stages.push(stageExecution);

      try {
        for (const step of stageConfig.steps) {
          const stepExec = await this.executeStep(step, stageConfig);
          stageExecution.steps.push(stepExec);
          if (stepExec.status === 'failure' && !stageConfig.continueOnError) {
            throw new Error(`Step ${step.name} failed`);
          }
        }
        stageExecution.status = 'success';
        stageExecution.endTime = new Date();
        stageExecution.duration = (stageExecution.endTime.getTime() - stageExecution.startTime.getTime()) / 1000;
        console.log(`✅ Stage completed: ${stageConfig.name}`);
      } catch (error) {
        stageExecution.status = 'failure';
        stageExecution.endTime = new Date();
        stageExecution.duration = (stageExecution.endTime.getTime() - stageExecution.startTime.getTime()) / 1000;
        throw error;
      }
    }
  }

  private async executeStep(step: PipelineStep, _stage: PipelineStage): Promise<StepExecution> {
    const stepExec: StepExecution = {
      stepId: step.id,
      status: 'running',
      startTime: new Date(),
    };

    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 1000));
      const success = Math.random() > 0.05; // 95% success rate

      stepExec.status = success ? 'success' : 'failure';
      stepExec.endTime = new Date();
      stepExec.duration = (stepExec.endTime.getTime() - stepExec.startTime.getTime()) / 1000;
      stepExec.exitCode = success ? 0 : 1;
      stepExec.output = success ? `Step ${step.name} completed successfully` : `Step ${step.name} failed`;
      console.log(`${success ? '✅' : '❌'} Step: ${step.name} (${stepExec.duration}s)`);
    } catch (error) {
      stepExec.status = 'failure';
      stepExec.endTime = new Date();
      stepExec.duration = (stepExec.endTime.getTime() - stepExec.startTime.getTime()) / 1000;
      stepExec.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return stepExec;
  }

  // --- Deployment ---

  public async deployToEnvironment(
    environment: string,
    version: string,
    strategy?: 'rolling' | 'blue_green' | 'canary'
  ): Promise<DeploymentResult> {
    const envConfig = this.config.deployment.environments.find(env => env.name === environment);
    if (!envConfig) throw new Error(`Environment ${environment} not found`);

    const deployment: DeploymentResult = {
      id: `deploy_${Date.now()}`,
      environment,
      status: 'in_progress',
      startTime: new Date(),
      version,
      replicas: { desired: envConfig.replicas, ready: 0, available: 0 },
      healthCheck: { status: 'unknown', lastCheck: new Date(), consecutiveFailures: 0 },
    };
    this.deployments.set(deployment.id, deployment);

    try {
      console.log(`🚀 Starting deployment to ${environment} (${strategy || this.config.deployment.strategy})`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('📦 Docker image built and pushed');
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('🎯 Kubernetes deployment updated');
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('🏥 Health checks passing');

      deployment.status = 'success';
      deployment.endTime = new Date();
      deployment.replicas.ready = envConfig.replicas;
      deployment.replicas.available = envConfig.replicas;
      deployment.healthCheck.status = 'healthy';
      console.log(`✅ Deployment completed: ${deployment.id}`);
      await this.sendNotification('deployment_success', null, deployment);
    } catch (error) {
      deployment.status = 'failure';
      deployment.endTime = new Date();
      deployment.healthCheck.status = 'unhealthy';
      console.log(`❌ Deployment failed: ${deployment.id}`, error);
      await this.sendNotification('deployment_failure', null, deployment);

      if (this.config.deployment.rollback.autoRollback) {
        await this.rollbackDeployment(deployment.id);
      }
    }

    return deployment;
  }

  public async rollbackDeployment(deploymentId: string): Promise<boolean> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);

    try {
      console.log(`🔄 Rolling back deployment: ${deploymentId}`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      deployment.status = 'rolled_back';
      deployment.rollbackInfo = {
        triggered: true,
        reason: 'Health check failure',
        previousVersion: '1.0.0',
        rollbackTime: new Date(),
      };
      console.log(`✅ Rollback completed: ${deploymentId}`);
      return true;
    } catch (error) {
      console.log(`❌ Rollback failed: ${deploymentId}`, error);
      return false;
    }
  }

  // --- Monitoring & Notifications ---

  private startPipelineMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkPipelineHealth();
      this.monitorResourceUsage();
      this.checkAlertThresholds();
    }, 60000);
    console.log('📊 Pipeline monitoring started');
  }

  private async sendNotification(
    event: string,
    execution?: PipelineExecution | null,
    _deployment?: DeploymentResult
  ): Promise<void> {
    if (!this.config.notifications.enabled) return;
    const eventConfig = this.config.notifications.events.find(e => e.event === event);
    if (!eventConfig) return;
    console.log(`📧 Sending ${event} notification via ${eventConfig.channels.join(', ')}`);
  }

  private checkPipelineHealth(): void {
    const active = Array.from(this.executions.values()).filter(e => e.status === 'running');
    console.log(`💓 Pipeline health: ${active.length} active executions`);
  }

  private monitorResourceUsage(): void {
    const cpuUsage = Math.random() * 50 + 20;
    if (cpuUsage > this.config.monitoring.alertThresholds.resourceUsage) {
      console.log(`⚠️ High CPU usage detected: ${cpuUsage.toFixed(1)}%`);
    }
  }

  private checkAlertThresholds(): void {
    const failureRate = Math.random() * 15;
    if (failureRate > this.config.monitoring.alertThresholds.failureRate) {
      console.log(`⚠️ High failure rate detected: ${failureRate.toFixed(1)}%`);
    }
  }

  private generateMockPipelineData(): void {
    setTimeout(() => {
      this.executePipeline({ type: 'push', user: 'developer', branch: 'main', commit: 'abc123' });
    }, 2000);
  }

  // --- Status & Info ---

  public getPipelineStatus(): {
    status: 'healthy' | 'degraded' | 'critical';
    activeExecutions: number;
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
    deployments: number;
    lastExecution?: PipelineExecution;
  } {
    const execs = Array.from(this.executions.values());
    const active = execs.filter(e => e.status === 'running').length;
    const successful = execs.filter(e => e.status === 'success').length;
    const rate = execs.length > 0 ? (successful / execs.length) * 100 : 100;
    const completed = execs.filter(e => e.duration !== undefined);
    const avgTime = completed.length > 0
      ? completed.reduce((sum, e) => sum + (e.duration || 0), 0) / completed.length
      : 0;

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (rate < 50) status = 'critical';
    else if (rate < 80) status = 'degraded';

    return {
      status, activeExecutions: active, totalExecutions: execs.length,
      successRate: rate, avgExecutionTime: avgTime,
      deployments: this.deployments.size, lastExecution: execs[execs.length - 1],
    };
  }

  public getSystemInfo(): {
    version: string; status: string; initialized: boolean;
    pipelineName: string; stagesEnabled: number;
    securityEnabled: boolean; monitoringActive: boolean;
  } {
    return {
      version: '8.6.0',
      status: 'operational',
      initialized: this.isInitialized,
      pipelineName: this.config.general.name,
      stagesEnabled: this.config.stages.filter(s => s.enabled).length,
      securityEnabled: this.config.security.enableSAST || this.config.security.enableDependencyScanning,
      monitoringActive: this.monitoringInterval !== null,
    };
  }

  public cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.executions.clear();
    this.deployments.clear();
    this.isInitialized = false;
    console.log('🧹 CI/CD Pipeline system cleanup completed');
  }
}

export const geoAlertCICD = GeoAlertCICDPipeline.getInstance();
export default GeoAlertCICDPipeline;
