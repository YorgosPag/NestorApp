/**
 * CI/CD Pipeline — Type Definitions
 *
 * All interfaces and type aliases for the GeoAlert CI/CD Pipeline system.
 * Covers pipeline config, execution, deployment, security, and monitoring.
 *
 * @see CICDPipeline.ts — main class
 * @see cicd-pipeline-config.ts — default configuration factory
 */

// ============================================================================
// PIPELINE CONFIGURATION
// ============================================================================

export interface PipelineConfiguration {
  general: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
    triggerEvents: PipelineTrigger[];
    parallelExecution: boolean;
    maxRetries: number;
    timeout: number; // minutes
  };
  stages: PipelineStage[];
  notifications: NotificationSettings;
  security: PipelineSecuritySettings;
  monitoring: PipelineMonitoringSettings;
  deployment: DeploymentSettings;
}

export interface PipelineTrigger {
  type: 'push' | 'pull_request' | 'schedule' | 'manual' | 'webhook';
  branches?: string[];
  schedule?: string; // cron expression
  conditions?: TriggerCondition[];
}

export interface TriggerCondition {
  type: 'file_changed' | 'branch_pattern' | 'tag_pattern' | 'environment';
  pattern: string;
  exclude?: string[];
}

export interface PipelineStage {
  id: string;
  name: string;
  type: 'build' | 'test' | 'security' | 'quality' | 'deploy' | 'notify';
  dependsOn?: string[];
  parallelWith?: string[];
  enabled: boolean;
  continueOnError: boolean;
  timeout: number; // minutes
  environment?: EnvironmentSettings;
  steps: PipelineStep[];
}

export interface PipelineStep {
  id: string;
  name: string;
  type: 'script' | 'docker' | 'kubernetes' | 'npm' | 'custom';
  command?: string;
  script?: string[];
  image?: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  retries?: number;
  timeout?: number; // minutes
  artifacts?: ArtifactSettings;
  cache?: CacheSettings;
}

export interface EnvironmentSettings {
  name: string;
  url?: string;
  variables: Record<string, string>;
  secrets: string[];
  approvalRequired?: boolean;
  approvers?: string[];
}

export interface ArtifactSettings {
  name: string;
  paths: string[];
  retention: number; // days
  public: boolean;
}

export interface CacheSettings {
  key: string;
  paths: string[];
  restoreKeys?: string[];
  ttl?: number; // hours
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface NotificationSettings {
  enabled: boolean;
  channels: NotificationChannel[];
  events: NotificationEvent[];
  templates: NotificationTemplate[];
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'teams' | 'webhook' | 'sms';
  enabled: boolean;
  config: Record<string, unknown>;
  recipients?: string[];
}

export interface NotificationEvent {
  event: 'started' | 'success' | 'failure' | 'cancelled' | 'deployment_success' | 'deployment_failure';
  channels: string[];
  conditions?: string[];
}

export interface NotificationTemplate {
  name: string;
  subject: string;
  body: string;
  format: 'text' | 'html' | 'markdown';
}

// ============================================================================
// SECURITY & MONITORING
// ============================================================================

export interface PipelineSecuritySettings {
  enableSAST: boolean;
  enableDAST: boolean;
  enableDependencyScanning: boolean;
  enableContainerScanning: boolean;
  enableSecretScanning: boolean;
  enableLicenseScanning: boolean;
  vulnerabilityThreshold: 'low' | 'medium' | 'high' | 'critical';
  blockOnVulnerabilities: boolean;
}

export interface PipelineMonitoringSettings {
  enableMetrics: boolean;
  enableLogging: boolean;
  enableTracing: boolean;
  metricsEndpoint: string;
  alertThresholds: PipelineAlertThresholds;
}

export interface PipelineAlertThresholds {
  buildDurationMinutes: number;
  failureRate: number; // percentage
  queueTime: number; // minutes
  resourceUsage: number; // percentage
}

// ============================================================================
// DEPLOYMENT TYPES
// ============================================================================

export interface DeploymentSettings {
  strategy: 'rolling' | 'blue_green' | 'canary' | 'recreate';
  environments: DeploymentEnvironment[];
  rollback: RollbackSettings;
  healthChecks: HealthCheckSettings;
  scaling: ScalingSettings;
}

export interface DeploymentEnvironment {
  name: string;
  type: 'development' | 'staging' | 'production';
  cluster: string;
  namespace: string;
  replicas: number;
  resources: ResourceRequirements;
  autoPromote: boolean;
  manualApproval: boolean;
  approvers: string[];
}

export interface ResourceRequirements {
  cpu: string;
  memory: string;
  storage: string;
}

export interface RollbackSettings {
  enabled: boolean;
  autoRollback: boolean;
  rollbackOnFailure: boolean;
  maxRevisions: number;
  rollbackTimeout: number; // minutes
}

export interface HealthCheckSettings {
  enabled: boolean;
  endpoint: string;
  timeout: number; // seconds
  interval: number; // seconds
  retries: number;
  initialDelay: number; // seconds
}

export interface ScalingSettings {
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  targetCPU: number; // percentage
  targetMemory: number; // percentage
  scaleUpPolicy: ScalePolicy;
  scaleDownPolicy: ScalePolicy;
}

export interface ScalePolicy {
  stabilizationWindow: number; // seconds
  policies: {
    type: 'pods' | 'percent';
    value: number;
    period: number; // seconds
  }[];
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  trigger: ExecutionTrigger;
  status: PipelineStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  stages: StageExecution[];
  artifacts: ExecutionArtifact[];
  logs: ExecutionLog[];
  metrics: ExecutionMetrics;
}

export interface ExecutionTrigger {
  type: string;
  user?: string;
  branch?: string;
  commit?: string;
  pullRequest?: number;
  tag?: string;
}

export type PipelineStatus = 'pending' | 'running' | 'success' | 'failure' | 'cancelled' | 'timeout';

export interface StageExecution {
  stageId: string;
  status: PipelineStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  steps: StepExecution[];
  logs: string[];
}

export interface StepExecution {
  stepId: string;
  status: PipelineStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  exitCode?: number;
  output?: string;
  error?: string;
}

export interface ExecutionArtifact {
  name: string;
  type: 'build' | 'test' | 'coverage' | 'security' | 'deployment';
  size: number; // bytes
  url: string;
  checksum: string;
}

export interface ExecutionLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionMetrics {
  totalDuration: number; // seconds
  queueTime: number;
  buildTime: number;
  testTime: number;
  deployTime: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
  };
  testResults: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    coverage: number;
  };
  securityResults: {
    vulnerabilities: number;
    criticalVulnerabilities: number;
    dependencyIssues: number;
    secretsFound: number;
  };
}

export interface DeploymentResult {
  id: string;
  environment: string;
  status: 'success' | 'failure' | 'in_progress' | 'rolled_back';
  startTime: Date;
  endTime?: Date;
  version: string;
  replicas: {
    desired: number;
    ready: number;
    available: number;
  };
  healthCheck: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    lastCheck: Date;
    consecutiveFailures: number;
  };
  rollbackInfo?: {
    triggered: boolean;
    reason: string;
    previousVersion: string;
    rollbackTime: Date;
  };
}
