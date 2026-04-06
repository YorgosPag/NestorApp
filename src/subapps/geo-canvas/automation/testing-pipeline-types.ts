/**
 * AUTOMATED TESTING PIPELINE — Type Definitions
 * Geo-Alert System - Phase 7: Complete Testing Automation & CI/CD Integration
 *
 * All interfaces, types, and enums for the testing pipeline.
 */

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/** Pipeline execution configuration */
export interface PipelineConfig {
  stages: PipelineStage[];
  triggers: PipelineTrigger[];
  environment: 'development' | 'staging' | 'production';
  parallelExecution: boolean;
  retryPolicy: RetryPolicy;
  notifications: NotificationConfig;
  reporting: ReportingConfig;
  quality: QualityGates;
}

/** Pipeline stage definition */
export interface PipelineStage {
  name: string;
  type: 'test' | 'build' | 'analysis' | 'deployment' | 'monitoring';
  enabled: boolean;
  dependsOn: string[];
  timeout: number;
  retryCount: number;
  tasks: PipelineTask[];
  conditions: StageCondition[];
}

/** Task configuration - type-safe config structure */
export interface TaskConfig {
  rules?: string;
  threshold?: number | string;
  scanType?: string;
  severity?: string;
  target?: string;
  optimization?: boolean;
  detailed?: boolean;
  visualization?: boolean;
  coverage?: boolean;
  parallel?: boolean;
  components?: string;
  mocking?: boolean;
  apis?: string;
  database?: string;
  systems?: string[];
  real?: boolean;
  duration?: number;
  scenarios?: string;
  monitoring?: number;
  users?: number;
  browser?: string;
  headless?: boolean;
  baseline?: string;
  standard?: string;
  tools?: string;
  gates?: string;
  strict?: boolean;
}

/** Pipeline task definition */
export interface PipelineTask {
  name: string;
  type: TaskType;
  config: TaskConfig;
  criticalPath: boolean;
  allowFailure: boolean;
  artifacts: string[];
  metrics: string[];
}

/** Task types available in the pipeline */
export type TaskType =
  | 'unit-tests'
  | 'integration-tests'
  | 'e2e-tests'
  | 'performance-tests'
  | 'security-tests'
  | 'accessibility-tests'
  | 'bundle-analysis'
  | 'memory-analysis'
  | 'code-quality'
  | 'build'
  | 'deploy'
  | 'smoke-tests'
  | 'load-tests'
  | 'visual-regression';

// ============================================================================
// TRIGGER & CONDITION TYPES
// ============================================================================

/** Trigger condition configuration */
export interface TriggerCondition {
  cron?: string;
  target?: string[];
  patterns?: string[];
  webhook?: string;
}

/** Pipeline trigger conditions */
export interface PipelineTrigger {
  type: 'manual' | 'schedule' | 'webhook' | 'file-change' | 'merge-request';
  condition: TriggerCondition;
  branches: string[];
  enabled: boolean;
}

/** Retry policy configuration */
export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential';
  retryableErrors: string[];
  skipRetryOn: string[];
}

/** Stage execution conditions */
export interface StageCondition {
  type: 'previous-stage-success' | 'environment' | 'branch' | 'custom';
  value: string | string[] | boolean;
  operator: 'equals' | 'contains' | 'regex';
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

/** Notification configuration */
export interface NotificationConfig {
  channels: NotificationChannel[];
  events: NotificationEvent[];
  templates: NotificationTemplate[];
}

/** Notification channel configuration */
export interface NotificationChannelConfig {
  to?: string[];
  webhook?: string;
  channel?: string;
  url?: string;
}

/** Notification channel */
export interface NotificationChannel {
  type: 'email' | 'slack' | 'teams' | 'webhook';
  config: NotificationChannelConfig;
  enabled: boolean;
  conditions: string[];
}

/** Notification events */
export type NotificationEvent =
  | 'pipeline-started'
  | 'pipeline-completed'
  | 'pipeline-failed'
  | 'stage-failed'
  | 'quality-gate-failed'
  | 'security-vulnerability'
  | 'performance-regression';

/** Notification template */
export interface NotificationTemplate {
  event: NotificationEvent;
  subject: string;
  body: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// REPORTING TYPES
// ============================================================================

/** Reporting configuration */
export interface ReportingConfig {
  formats: ReportFormat[];
  storage: StorageConfig;
  retention: number;
  aggregation: AggregationConfig;
}

/** Report formats */
export type ReportFormat = 'html' | 'json' | 'junit' | 'allure' | 'sonar' | 'dashboard';

/** Storage provider configuration */
export interface StorageProviderConfig {
  path?: string;
  bucket?: string;
  region?: string;
  accessKey?: string;
  secretKey?: string;
  container?: string;
}

/** Storage configuration */
export interface StorageConfig {
  type: 'local' | 's3' | 'azure' | 'gcp';
  config: StorageProviderConfig;
  encryption: boolean;
}

/** Aggregation configuration */
export interface AggregationConfig {
  metrics: string[];
  trends: boolean;
  comparisons: boolean;
  baseline: string;
}

// ============================================================================
// QUALITY GATE TYPES
// ============================================================================

/** Quality gates configuration */
export interface QualityGates {
  testCoverage: QualityGate;
  performanceScore: QualityGate;
  securityScore: QualityGate;
  codeQuality: QualityGate;
  bundleSize: QualityGate;
  memoryLeaks: QualityGate;
}

/** Individual quality gate */
export interface QualityGate {
  enabled: boolean;
  threshold: number;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  blocking: boolean;
  message: string;
}

// ============================================================================
// EXECUTION RESULT TYPES
// ============================================================================

/** Pipeline execution result */
export interface PipelineExecution {
  id: string;
  config: PipelineConfig;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped';
  stages: StageExecution[];
  artifacts: PipelineArtifact[];
  metrics: PipelineMetrics;
  qualityGates: QualityGateResult[];
  notifications: NotificationResult[];
  metadata: ExecutionMetadata;
}

/** Stage execution result */
export interface StageExecution {
  stage: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  tasks: TaskExecution[];
  artifacts: string[];
  logs: string[];
  retryCount: number;
}

/** Task execution result types */
export interface TaskResult {
  totalTests?: number;
  passed?: number;
  failed?: number;
  coverage?: number;
  totalSuites?: number;
  passedSuites?: number;
  failedSuites?: number;
  scenarios?: number;
  successRate?: number;
  performanceScore?: number;
  memoryHealth?: string;
  leaksDetected?: number;
  totalSize?: number;
  chunkCount?: number;
  budgetPassed?: boolean;
  recommendations?: number;
  vulnerabilities?: number;
  riskScore?: string;
  scannedFiles?: number;
  issues?: string[];
  score?: number;
  violations?: number;
  standard?: string;
  testedPages?: number;
  screenshots?: number;
  changes?: number;
  threshold?: number;
  overallScore?: number;
  complexity?: number;
  duplication?: number;
  maintainability?: number;
  technicalDebt?: number;
  success?: boolean;
  duration?: number;
  outputSize?: number;
  warnings?: number;
  errors?: number;
  virtualUsers?: number;
  requests?: number;
  averageResponse?: number;
  throughput?: number;
}

/** Task execution record */
export interface TaskExecution {
  task: string;
  type: TaskType;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result: TaskResult | null;
  artifacts: string[];
  metrics: Record<string, number>;
  logs: string[];
  error?: string;
}

// ============================================================================
// ARTIFACT & METRICS TYPES
// ============================================================================

/** Artifact metadata */
export interface ArtifactMetadata {
  format?: string;
  generated?: number;
  version?: string;
  contentType?: string;
}

/** Pipeline artifact */
export interface PipelineArtifact {
  name: string;
  type: 'test-results' | 'coverage-report' | 'performance-report' | 'bundle-analysis' | 'build-output';
  path: string;
  size: number;
  checksum: string;
  metadata: ArtifactMetadata;
}

/** Pipeline metrics */
export interface PipelineMetrics {
  totalDuration: number;
  testMetrics: TestMetrics;
  performanceMetrics: PerformanceMetrics;
  qualityMetrics: QualityMetrics;
  resourceUsage: ResourceUsage;
}

/** Test metrics */
export interface TestMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  coverage: number;
  testSuites: number;
}

/** Performance metrics */
export interface PerformanceMetrics {
  overallScore: number;
  renderingScore: number;
  loadTime: number;
  bundleSize: number;
  memoryUsage: number;
  leaksDetected: number;
}

/** Quality metrics */
export interface QualityMetrics {
  codeComplexity: number;
  duplication: number;
  maintainabilityIndex: number;
  technicalDebt: number;
  securityVulnerabilities: number;
}

/** Resource usage metrics */
export interface ResourceUsage {
  cpuUsage: number;
  memoryUsage: number;
  diskIO: number;
  networkIO: number;
  executionTime: number;
}

/** Quality gate result */
export interface QualityGateResult {
  gate: string;
  status: 'passed' | 'failed' | 'skipped';
  actualValue: number;
  threshold: number;
  message: string;
  blocking: boolean;
}

/** Notification result */
export interface NotificationResult {
  channel: string;
  event: NotificationEvent;
  status: 'sent' | 'failed' | 'skipped';
  timestamp: number;
  message: string;
  error?: string;
}

/** Execution metadata */
export interface ExecutionMetadata {
  triggeredBy: string;
  trigger: string;
  branch: string;
  commit: string;
  environment: string;
  version: string;
  buildNumber: number;
}
