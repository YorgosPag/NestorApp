/**
 * INFRASTRUCTURE TYPE DEFINITIONS
 *
 * Enterprise-class type definitions για cloud infrastructure configuration
 * Split from monolithic CloudInfrastructure.ts για modular architecture
 *
 * @module enterprise/types/infrastructure
 * @version 1.0.0 - ENTERPRISE MODULAR SPLITTING
 * @updated 2025-12-28 - Split from CloudInfrastructure.ts
 */

import type { CloudProvider } from './cloud-providers';

// ============================================================================
// CORE INFRASTRUCTURE TYPES
// ============================================================================

/**
 * Infrastructure configuration - Main orchestration configuration
 * Enterprise: Supports multi-cloud, multi-region deployments
 */
export interface InfrastructureConfig {
  name: string;
  environment: 'development' | 'staging' | 'production';
  providers: CloudProvider[];
  regions: RegionConfig[];
  networking: NetworkConfig;
  compute: ComputeConfig;
  storage: StorageConfig;
  database: DatabaseConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
  scaling: ScalingConfig;
  backup: BackupConfig;
}

/**
 * Region configuration για multi-region deployments
 * Enterprise: Latency optimization και compliance requirements
 */
export interface RegionConfig {
  name: string;
  provider: string;
  primary: boolean;
  availabilityZones: string[];
  latencyRequirements: {
    maxLatency: number;     // ms
    targetLatency: number;  // ms
  };
  complianceRequirements: string[];
}

// ============================================================================
// COMPUTE CONFIGURATION
// ============================================================================

/**
 * Compute configuration - EXACT COPY FROM ORIGINAL
 */
export interface ComputeConfig {
  instances: InstanceConfig[];
  autoScaling: AutoScalingConfig;
  kubernetes: KubernetesConfig;
  serverless: ServerlessConfig;
}

/**
 * Instance configuration - EXACT COPY FROM ORIGINAL
 */
export interface InstanceConfig {
  name: string;
  type: string;
  image: string;
  keyPair: string;
  securityGroups: string[];
  subnet: string;
  publicIP: boolean;
  userData?: string;
  tags: Record<string, string>;
  monitoring: boolean;
}

/**
 * Auto-scaling configuration - EXACT COPY FROM ORIGINAL
 */
export interface AutoScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  desiredCapacity: number;
  scalingPolicies: ScalingPolicy[];
  healthCheckType: 'EC2' | 'ELB';
  healthCheckGracePeriod: number;
}

/**
 * Scaling policy - EXACT COPY FROM ORIGINAL
 */
export interface ScalingPolicy {
  name: string;
  type: 'target-tracking' | 'step' | 'simple';
  metricType: 'cpu' | 'memory' | 'network' | 'custom';
  targetValue?: number;
  scaleUpAdjustment: number;
  scaleDownAdjustment: number;
  cooldown: number;
}

/**
 * Scaling metric configuration
 */
export interface ScalingMetric {
  name: string;
  type: 'cpu' | 'memory' | 'network' | 'custom';
  threshold: number;
  operator: 'greater' | 'less' | 'equal';
  period: number;
  evaluationPeriods: number;
}

/**
 * Load balancing configuration
 */
export interface LoadBalancingConfig {
  enabled: boolean;
  type: 'application' | 'network' | 'classic';
  scheme: 'internet-facing' | 'internal';
  healthCheck: HealthCheckConfig;
  sslTermination: boolean;
  stickySessions: boolean;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  protocol: 'HTTP' | 'HTTPS' | 'TCP' | 'UDP';
  port: number;
  path?: string;
  interval: number;
  timeout: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

/**
 * Container orchestration configuration
 */
export interface ContainerConfig {
  enabled: boolean;
  platform: 'kubernetes' | 'docker-swarm' | 'ecs' | 'aci';
  clusters: ClusterConfig[];
  registry: ContainerRegistryConfig;
}

/**
 * Container cluster configuration
 */
export interface ClusterConfig {
  name: string;
  nodeCount: number;
  nodeType: string;
  autoScaling: boolean;
  networking: ClusterNetworkConfig;
}

/**
 * Container registry configuration
 */
export interface ContainerRegistryConfig {
  provider: 'docker-hub' | 'aws-ecr' | 'azure-acr' | 'gcp-gcr';
  url: string;
  namespace: string;
  authentication: boolean;
}

/**
 * Cluster network configuration
 */
export interface ClusterNetworkConfig {
  podCidr: string;
  serviceCidr: string;
  networkPolicy: boolean;
  ingressController: string;
}

/**
 * Serverless configuration
 */
export interface ServerlessConfig {
  enabled: boolean;
  functions: FunctionConfig[];
  apiGateway: APIGatewayConfig;
  eventSources: EventSourceConfig[];
}

/**
 * Function configuration για serverless
 */
export interface FunctionConfig {
  name: string;
  runtime: string;
  handler: string;
  memory: number;
  timeout: number;
  environment: Record<string, string>;
  triggers: string[];
}

/**
 * API Gateway configuration
 */
export interface APIGatewayConfig {
  enabled: boolean;
  type: 'rest' | 'http' | 'websocket';
  throttling: ThrottlingConfig;
  cors: CORSConfig;
  authentication: AuthenticationConfig;
}

/**
 * Throttling configuration
 */
export interface ThrottlingConfig {
  rateLimit: number;
  burstLimit: number;
  perApiKey: boolean;
}

/**
 * CORS configuration
 */
export interface CORSConfig {
  enabled: boolean;
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  credentials: boolean;
}

/**
 * Authentication configuration
 */
export interface AuthenticationConfig {
  type: 'apikey' | 'jwt' | 'oauth' | 'custom';
  provider?: string;
  settings: Record<string, any>;
}

/**
 * Event source configuration
 */
export interface EventSourceConfig {
  type: 'sqs' | 'sns' | 's3' | 'dynamodb' | 'kinesis';
  source: string;
  batchSize?: number;
  maxBatchingWindow?: number;
}

// ============================================================================
// STORAGE CONFIGURATION
// ============================================================================

/**
 * Storage configuration για data persistence
 */
export interface StorageConfig {
  objectStorage: ObjectStorageConfig;
  blockStorage: BlockStorageConfig;
  fileStorage: FileStorageConfig;
  backup: StorageBackupConfig;
}

/**
 * Object storage configuration (S3, Blob, etc.)
 */
export interface ObjectStorageConfig {
  enabled: boolean;
  provider: 'aws-s3' | 'azure-blob' | 'gcp-storage' | 'minio';
  buckets: BucketConfig[];
  lifecycle: LifecycleConfig[];
  replication: ReplicationConfig;
}

/**
 * Storage bucket configuration
 */
export interface BucketConfig {
  name: string;
  region: string;
  accessLevel: 'private' | 'public-read' | 'public-read-write';
  versioning: boolean;
  encryption: boolean;
  tags: Record<string, string>;
}

/**
 * Storage lifecycle configuration
 */
export interface LifecycleConfig {
  ruleId: string;
  status: 'enabled' | 'disabled';
  transitions: LifecycleTransition[];
  expiration?: number;
}

/**
 * Lifecycle transition configuration
 */
export interface LifecycleTransition {
  days: number;
  storageClass: string;
}

/**
 * Storage replication configuration
 */
export interface ReplicationConfig {
  enabled: boolean;
  destinations: ReplicationDestination[];
  deleteMarkerReplication: boolean;
}

/**
 * Replication destination
 */
export interface ReplicationDestination {
  bucket: string;
  region: string;
  storageClass?: string;
}

/**
 * Block storage configuration
 */
export interface BlockStorageConfig {
  enabled: boolean;
  volumes: VolumeConfig[];
  snapshots: SnapshotConfig;
}

/**
 * Storage volume configuration
 */
export interface VolumeConfig {
  name: string;
  size: number;
  type: 'standard' | 'premium' | 'ultra';
  encrypted: boolean;
  snapshotPolicy: string;
}

/**
 * Snapshot configuration
 */
export interface SnapshotConfig {
  enabled: boolean;
  schedule: string;
  retention: number;
  crossRegion: boolean;
}

/**
 * File storage configuration
 */
export interface FileStorageConfig {
  enabled: boolean;
  type: 'nfs' | 'cifs' | 'efs';
  performance: 'standard' | 'premium';
  throughput: number;
  encryption: boolean;
}

/**
 * Storage backup configuration
 */
export interface StorageBackupConfig {
  enabled: boolean;
  schedule: string;
  retention: BackupRetentionConfig;
  crossRegion: boolean;
  encryption: boolean;
}

/**
 * Backup retention configuration
 */
export interface BackupRetentionConfig {
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
}

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

/**
 * Database configuration για data management
 */
export interface DatabaseConfig {
  relational: RelationalDBConfig[];
  nosql: NoSQLDBConfig[];
  cache: CacheConfig;
  dataWarehouse: DataWarehouseConfig;
}

/**
 * Relational database configuration
 */
export interface RelationalDBConfig {
  name: string;
  engine: 'mysql' | 'postgresql' | 'mssql' | 'oracle';
  version: string;
  instanceType: string;
  storage: DBStorageConfig;
  backup: DBBackupConfig;
  monitoring: boolean;
  multiAZ: boolean;
  readReplicas: ReadReplicaConfig[];
}

/**
 * NoSQL database configuration
 */
export interface NoSQLDBConfig {
  name: string;
  type: 'dynamodb' | 'mongodb' | 'cassandra' | 'redis';
  capacity: DBCapacityConfig;
  backup: DBBackupConfig;
  globalTables: boolean;
}

/**
 * Database storage configuration
 */
export interface DBStorageConfig {
  type: 'standard' | 'premium' | 'ultra';
  size: number;
  iops?: number;
  encrypted: boolean;
  autoExpand: boolean;
}

/**
 * Database backup configuration
 */
export interface DBBackupConfig {
  enabled: boolean;
  schedule: string;
  retention: number;
  pointInTimeRecovery: boolean;
  crossRegion: boolean;
}

/**
 * Read replica configuration
 */
export interface ReadReplicaConfig {
  name: string;
  region: string;
  instanceType: string;
  autoFailover: boolean;
}

/**
 * Database capacity configuration
 */
export interface DBCapacityConfig {
  readUnits: number;
  writeUnits: number;
  autoScaling: boolean;
  billingMode: 'provisioned' | 'on-demand';
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  type: 'redis' | 'memcached';
  nodeType: string;
  nodeCount: number;
  autoFailover: boolean;
  backupEnabled: boolean;
}

/**
 * Data warehouse configuration
 */
export interface DataWarehouseConfig {
  enabled: boolean;
  type: 'redshift' | 'bigquery' | 'snowflake';
  nodeType: string;
  nodeCount: number;
  compression: boolean;
  encryption: boolean;
}

// ============================================================================
// SCALING CONFIGURATION
// ============================================================================

/**
 * Scaling configuration για resource optimization
 */
export interface ScalingConfig {
  autoScaling: GlobalAutoScalingConfig;
  predictiveScaling: PredictiveScalingConfig;
  costOptimization: CostOptimizationConfig;
  resourceLimits: ResourceLimitConfig;
}

/**
 * Global auto-scaling configuration
 */
export interface GlobalAutoScalingConfig {
  enabled: boolean;
  strategy: 'reactive' | 'predictive' | 'hybrid';
  cooldownPeriod: number;
  scaleUpPolicy: ScalingPolicy;
  scaleDownPolicy: ScalingPolicy;
}

/**
 * Scaling policy configuration
 */
export interface ScalingPolicy {
  threshold: number;
  adjustment: number;
  adjustmentType: 'absolute' | 'percentage';
  minAdjustment: number;
  cooldown: number;
}

/**
 * Predictive scaling configuration
 */
export interface PredictiveScalingConfig {
  enabled: boolean;
  model: 'ml' | 'historical' | 'pattern';
  forecastHorizon: number;
  confidence: number;
  bufferTime: number;
}

/**
 * Cost optimization configuration
 */
export interface CostOptimizationConfig {
  enabled: boolean;
  spotInstances: boolean;
  reservedInstances: boolean;
  rightSizing: boolean;
  scheduleBasedScaling: boolean;
  budgetLimits: BudgetLimitConfig[];
}

/**
 * Budget limit configuration
 */
export interface BudgetLimitConfig {
  name: string;
  amount: number;
  currency: string;
  period: 'monthly' | 'quarterly' | 'yearly';
  alertThreshold: number;
}

/**
 * Resource limit configuration
 */
export interface ResourceLimitConfig {
  maxInstances: number;
  maxCPU: number;
  maxMemory: number;
  maxStorage: number;
  maxBandwidth: number;
}

// ============================================================================
// BACKUP CONFIGURATION
// ============================================================================

/**
 * Backup configuration για disaster recovery
 */
export interface BackupConfig {
  strategy: BackupStrategy;
  schedule: BackupScheduleConfig;
  retention: BackupRetentionConfig;
  testing: BackupTestingConfig;
  recovery: DisasterRecoveryConfig;
}

/**
 * Backup strategy configuration
 */
export interface BackupStrategy {
  type: 'full' | 'incremental' | 'differential' | 'hybrid';
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly';
  crossRegion: boolean;
  encryption: boolean;
  compression: boolean;
}

/**
 * Backup schedule configuration
 */
export interface BackupScheduleConfig {
  daily: string;
  weekly: string;
  monthly: string;
  timezone: string;
  excludeDays: string[];
}

/**
 * Backup testing configuration
 */
export interface BackupTestingConfig {
  enabled: boolean;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  restoreTestEnvironment: string;
  validationCriteria: string[];
}

/**
 * Disaster recovery configuration
 */
export interface DisasterRecoveryConfig {
  enabled: boolean;
  rto: number; // Recovery Time Objective (minutes)
  rpo: number; // Recovery Point Objective (minutes)
  strategy: 'pilot-light' | 'warm-standby' | 'multi-site';
  failoverRegion: string;
  automaticFailover: boolean;
}

// ============================================================================
// MONITORING CONFIGURATION
// ============================================================================

/**
 * Monitoring configuration - Will integrate με existing Alert Engine
 */
export interface MonitoringConfig {
  enabled: boolean;
  metrics: MetricConfig[];
  alerting: AlertingConfig;
  logging: LoggingConfig;
  tracing: TracingConfig;
  dashboards: DashboardConfig[];
}

/**
 * Metric configuration
 */
export interface MetricConfig {
  name: string;
  type: 'gauge' | 'counter' | 'histogram';
  unit: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
  retention: number;
}

/**
 * Alerting configuration - Integrates με Alert Engine
 */
export interface AlertingConfig {
  enabled: boolean;
  rules: AlertRuleConfig[];
  channels: AlertChannelConfig[];
  escalation: EscalationConfig;
}

/**
 * Alert rule configuration
 */
export interface AlertRuleConfig {
  name: string;
  condition: string;
  threshold: number;
  duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags: Record<string, string>;
}

/**
 * Alert channel configuration
 */
export interface AlertChannelConfig {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  endpoint: string;
  enabled: boolean;
  conditions: string[];
}

/**
 * Escalation configuration
 */
export interface EscalationConfig {
  enabled: boolean;
  levels: EscalationLevel[];
  autoResolve: boolean;
  suppressDuration: number;
}

/**
 * Escalation level
 */
export interface EscalationLevel {
  level: number;
  delay: number;
  channels: string[];
  condition?: string;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  centralizedLogging: boolean;
  logRetention: number;
  structured: boolean;
}

/**
 * Tracing configuration
 */
export interface TracingConfig {
  enabled: boolean;
  sampling: number;
  provider: 'jaeger' | 'zipkin' | 'datadog' | 'newrelic';
  endpoint: string;
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  name: string;
  panels: DashboardPanel[];
  refreshInterval: number;
  timeRange: string;
}

/**
 * Dashboard panel configuration
 */
export interface DashboardPanel {
  title: string;
  type: 'graph' | 'table' | 'stat' | 'gauge';
  query: string;
  visualization: Record<string, any>;
}

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================

/**
 * Security configuration για infrastructure protection
 */
export interface SecurityConfig {
  encryption: EncryptionConfig;
  accessControl: AccessControlConfig;
  networkSecurity: NetworkSecurityConfig;
  compliance: ComplianceConfig;
  vulnerability: VulnerabilityConfig;
}

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  atRest: boolean;
  inTransit: boolean;
  keyManagement: KeyManagementConfig;
  algorithms: string[];
}

/**
 * Key management configuration
 */
export interface KeyManagementConfig {
  provider: 'aws-kms' | 'azure-keyvault' | 'gcp-kms' | 'hashicorp-vault';
  autoRotation: boolean;
  rotationSchedule: string;
}

/**
 * Access control configuration
 */
export interface AccessControlConfig {
  rbac: boolean;
  mfa: boolean;
  sso: SSOConfig;
  apiSecurity: APISecurityConfig;
}

/**
 * SSO configuration
 */
export interface SSOConfig {
  enabled: boolean;
  provider: 'okta' | 'azure-ad' | 'google' | 'custom';
  domains: string[];
}

/**
 * API security configuration
 */
export interface APISecurityConfig {
  authentication: boolean;
  rateLimiting: boolean;
  ipWhitelisting: boolean;
  corsPolicy: CORSConfig;
}

/**
 * Network security configuration
 */
export interface NetworkSecurityConfig {
  firewall: FirewallConfig;
  waf: WAFConfig;
  ddosProtection: boolean;
  vpn: VPNConfig;
}

/**
 * Firewall configuration
 */
export interface FirewallConfig {
  enabled: boolean;
  rules: FirewallRule[];
  defaultPolicy: 'allow' | 'deny';
  logging: boolean;
}

/**
 * Firewall rule
 */
export interface FirewallRule {
  name: string;
  action: 'allow' | 'deny';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  port?: number | string;
  source?: string;
  destination?: string;
  priority: number;
}

/**
 * Web Application Firewall configuration
 */
export interface WAFConfig {
  enabled: boolean;
  provider: 'aws-waf' | 'cloudflare' | 'azure-waf';
  rules: WAFRule[];
  rateLimit: number;
}

/**
 * WAF rule configuration
 */
export interface WAFRule {
  name: string;
  type: 'sql-injection' | 'xss' | 'rate-limit' | 'geo-block' | 'custom';
  action: 'allow' | 'block' | 'challenge';
  priority: number;
  conditions: string[];
}

/**
 * VPN configuration
 */
export interface VPNConfig {
  enabled: boolean;
  type: 'site-to-site' | 'client-to-site';
  endpoints: VPNEndpoint[];
  encryption: string;
}

/**
 * VPN endpoint configuration
 */
export interface VPNEndpoint {
  name: string;
  address: string;
  tunnels: number;
  bgp: boolean;
}

/**
 * Compliance configuration
 */
export interface ComplianceConfig {
  frameworks: string[];
  auditing: boolean;
  reporting: ComplianceReporting;
  dataGovernance: DataGovernanceConfig;
}

/**
 * Compliance reporting
 */
export interface ComplianceReporting {
  enabled: boolean;
  schedule: string;
  formats: string[];
  recipients: string[];
}

/**
 * Data governance configuration
 */
export interface DataGovernanceConfig {
  classification: boolean;
  retention: DataRetentionPolicy[];
  privacy: PrivacyConfig;
}

/**
 * Data retention policy
 */
export interface DataRetentionPolicy {
  dataType: string;
  retention: number;
  archival: boolean;
  deletion: boolean;
}

/**
 * Privacy configuration
 */
export interface PrivacyConfig {
  gdprCompliance: boolean;
  dataSubjectRights: boolean;
  consentManagement: boolean;
  dataMinimization: boolean;
}

/**
 * Vulnerability configuration
 */
export interface VulnerabilityConfig {
  scanning: boolean;
  schedule: string;
  severity: 'all' | 'high' | 'critical';
  autoPatching: boolean;
  reporting: boolean;
}

// ============================================================================
// EXACT COPIES FROM ORIGINAL CloudInfrastructure.ts (CHUNK 3: LINES 401-600)
// ============================================================================

/**
 * Kubernetes configuration
 */
export interface KubernetesConfig {
  enabled: boolean;
  version: string;
  nodeGroups: NodeGroupConfig[];
  addons: string[];
  rbac: boolean;
  networkPolicy: boolean;
}

/**
 * Node group configuration
 */
export interface NodeGroupConfig {
  name: string;
  instanceType: string;
  minSize: number;
  maxSize: number;
  desiredSize: number;
  diskSize: number;
  labels: Record<string, string>;
  taints: KubernetesTaint[];
}

/**
 * Kubernetes taint
 */
export interface KubernetesTaint {
  key: string;
  value: string;
  effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
}

/**
 * Serverless configuration
 */
export interface ServerlessConfig {
  functions: ServerlessFunction[];
  apiGateway: APIGatewayConfig;
  eventSources: EventSourceConfig[];
}

/**
 * Serverless function
 */
export interface ServerlessFunction {
  name: string;
  runtime: string;
  handler: string;
  memory: number;
  timeout: number;
  environment: Record<string, string>;
  triggers: FunctionTrigger[];
}

/**
 * Function trigger
 */
export interface FunctionTrigger {
  type: 'http' | 'schedule' | 'queue' | 'storage' | 'database';
  config: any;
}

/**
 * API Gateway configuration
 */
export interface APIGatewayConfig {
  name: string;
  type: 'REST' | 'WebSocket';
  cors: boolean;
  authentication: 'none' | 'api-key' | 'cognito' | 'lambda';
  throttling: {
    rateLimit: number;
    burstLimit: number;
  };
}

/**
 * Event source configuration
 */
export interface EventSourceConfig {
  type: 'sqs' | 'sns' | 's3' | 'dynamodb' | 'kinesis';
  config: any;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  objectStorage: ObjectStorageConfig;
  blockStorage: BlockStorageConfig;
  fileStorage: FileStorageConfig;
  backup: BackupConfig;
}

/**
 * Object storage configuration
 */
export interface ObjectStorageConfig {
  buckets: BucketConfig[];
  lifecycle: LifecyclePolicy[];
  replication: ReplicationConfig[];
}

/**
 * Bucket configuration
 */
export interface BucketConfig {
  name: string;
  region: string;
  storageClass: string;
  encryption: boolean;
  versioning: boolean;
  publicRead: boolean;
  cors: CORSConfig;
}

/**
 * Lifecycle policy
 */
export interface LifecyclePolicy {
  id: string;
  status: 'enabled' | 'disabled';
  transitions: LifecycleTransition[];
  expiration?: {
    days: number;
    expiredObjectDeleteMarker: boolean;
  };
}

/**
 * Lifecycle transition
 */
export interface LifecycleTransition {
  days: number;
  storageClass: string;
}

/**
 * Replication configuration
 */
export interface ReplicationConfig {
  destinationBucket: string;
  destinationRegion: string;
  storageClass?: string;
  prefix?: string;
}

/**
 * Block storage configuration
 */
export interface BlockStorageConfig {
  volumes: VolumeConfig[];
  snapshots: SnapshotConfig[];
}

/**
 * Volume configuration
 */
export interface VolumeConfig {
  name: string;
  size: number;
  type: 'gp2' | 'gp3' | 'io1' | 'io2' | 'st1' | 'sc1';
  iops?: number;
  throughput?: number;
  encrypted: boolean;
  availabilityZone: string;
}

/**
 * Snapshot configuration
 */
export interface SnapshotConfig {
  volumeId: string;
  schedule: string;
  retention: number;
  crossRegionCopy: boolean;
}

/**
 * File storage configuration
 */
export interface FileStorageConfig {
  enabled: boolean;
  type: 'nfs' | 'smb';
  performance: 'general-purpose' | 'max-io';
  throughput: 'provisioned' | 'bursting';
  encryption: boolean;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  primary: PrimaryDatabaseConfig;
  replicas: ReplicaDatabaseConfig[];
  backup: DatabaseBackupConfig;
  monitoring: DatabaseMonitoringConfig;
}

/**
 * Primary database configuration
 */
export interface PrimaryDatabaseConfig {
  engine: 'postgresql' | 'mysql' | 'mongodb' | 'redis';
  version: string;
  instanceClass: string;
  allocatedStorage: number;
  maxAllocatedStorage: number;
  storageType: 'gp2' | 'gp3' | 'io1' | 'io2';
  multiAZ: boolean;
  encryption: boolean;
  backupRetention: number;
  maintenanceWindow: string;
  parameterGroup?: string;
}

/**
 * Replica database configuration
 */
export interface ReplicaDatabaseConfig {
  region: string;
  instanceClass: string;
  readOnly: boolean;
  lagThreshold: number;
}

/**
 * Database backup configuration
 */
export interface DatabaseBackupConfig {
  automated: boolean;
  retentionPeriod: number;
  backupWindow: string;
  copyTags: boolean;
  crossRegionBackup: boolean;
  pointInTimeRecovery: boolean;
}

/**
 * Database monitoring configuration
 */
export interface DatabaseMonitoringConfig {
  performanceInsights: boolean;
  enhancedMonitoring: boolean;
  slowQueryLog: boolean;
  generalLog: boolean;
  errorLog: boolean;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  metrics: MetricsConfig;
  logging: LoggingConfig;
  alerting: AlertingConfig;
  dashboards: DashboardConfig[];
}

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  provider: 'cloudwatch' | 'datadog' | 'newrelic' | 'prometheus';
  retention: number;
  customMetrics: CustomMetric[];
  aggregation: MetricAggregation[];
}

/**
 * Custom metric
 */
export interface CustomMetric {
  name: string;
  namespace: string;
  dimensions: Record<string, string>;
  unit: string;
  statistic: 'sum' | 'average' | 'maximum' | 'minimum' | 'count';
}

/**
 * Metric aggregation
 */
export interface MetricAggregation {
  period: number;
  statistic: string;
  threshold: number;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  provider: 'cloudwatch' | 'elasticsearch' | 'splunk' | 'datadog';
  retention: number;
  logGroups: LogGroup[];
  parsing: LogParsingConfig;
}

/**
 * Log group
 */
export interface LogGroup {
  name: string;
  retention: number;
  encryption: boolean;
  filters: LogFilter[];
}

/**
 * Log filter
 */
export interface LogFilter {
  name: string;
  pattern: string;
  metricTransformation?: {
    metricName: string;
    metricNamespace: string;
    metricValue: string;
  };
}

/**
 * Log parsing configuration
 */
export interface LogParsingConfig {
  format: 'json' | 'structured' | 'unstructured';
  patterns: string[];
  fields: string[];
}

/**
 * Alerting configuration
 */
export interface AlertingConfig {
  rules: AlertRule[];
  channels: AlertChannel[];
  escalation: EscalationPolicy[];
}

/**
 * Alert rule
 */
export interface AlertRule {
  name: string;
  condition: AlertCondition;
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  channels: string[];
}

/**
 * Alert condition
 */
export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  threshold: number;
  period: number;
  evaluationPeriods: number;
}

/**
 * Alert channel
 */
export interface AlertChannel {
  name: string;
  type: 'email' | 'sms' | 'slack' | 'pagerduty' | 'webhook';
  config: any;
}

/**
 * Escalation policy
 */
export interface EscalationPolicy {
  name: string;
  levels: EscalationLevel[];
}

/**
 * Escalation level
 */
export interface EscalationLevel {
  delay: number;
  channels: string[];
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  name: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
}

/**
 * Dashboard widget
 */
export interface DashboardWidget {
  type: 'metric' | 'log' | 'number' | 'graph' | 'table';
  title: string;
  config: any;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Dashboard layout
 */
export interface DashboardLayout {
  columns: number;
  rows: number;
  spacing: number;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  encryption: EncryptionConfig;
  iam: IAMConfig;
  compliance: ComplianceConfig;
  secrets: SecretsConfig;
}

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  atRest: boolean;
  inTransit: boolean;
  keyManagement: 'aws-kms' | 'azure-key-vault' | 'google-kms' | 'hashicorp-vault';
  keys: EncryptionKey[];
}

/**
 * Encryption key
 */
export interface EncryptionKey {
  id: string;
  purpose: string;
  algorithm: string;
  keySize: number;
  rotation: boolean;
  rotationPeriod?: number;
}

/**
 * IAM configuration
 */
export interface IAMConfig {
  users: IAMUser[];
  roles: IAMRole[];
  policies: IAMPolicy[];
  groups: IAMGroup[];
}

/**
 * IAM user
 */
export interface IAMUser {
  username: string;
  groups: string[];
  policies: string[];
  accessKeys: boolean;
  mfa: boolean;
}

/**
 * IAM role
 */
export interface IAMRole {
  name: string;
  trustPolicy: any;
  policies: string[];
  maxSessionDuration: number;
}

/**
 * IAM policy
 */
export interface IAMPolicy {
  name: string;
  document: any;
  type: 'managed' | 'inline';
}

/**
 * IAM group
 */
export interface IAMGroup {
  name: string;
  policies: string[];
}

/**
 * Compliance configuration
 */
export interface ComplianceConfig {
  standards: string[];
  auditing: boolean;
  dataResidency: DataResidencyConfig;
  retention: RetentionPolicy[];
}

/**
 * Data residency configuration
 */
export interface DataResidencyConfig {
  allowedRegions: string[];
  blockedRegions: string[];
  dataClassification: DataClassification[];
}

/**
 * Data classification
 */
export interface DataClassification {
  type: 'public' | 'internal' | 'confidential' | 'restricted';
  requirements: string[];
}

/**
 * Retention policy
 */
export interface RetentionPolicy {
  dataType: string;
  retentionPeriod: number;
  archivalPolicy: string;
  deletionPolicy: string;
}

/**
 * Secrets configuration
 */
export interface SecretsConfig {
  provider: 'aws-secrets' | 'azure-key-vault' | 'google-secret-manager' | 'hashicorp-vault';
  rotation: boolean;
  encryption: boolean;
  secrets: SecretConfig[];
}

/**
 * Secret configuration
 */
export interface SecretConfig {
  name: string;
  type: 'password' | 'api-key' | 'certificate' | 'token';
  rotation: boolean;
  rotationPeriod?: number;
  accessPolicy: string;
}

/**
 * Scaling configuration
 */
export interface ScalingConfig {
  autoScaling: boolean;
  predictiveScaling: boolean;
  scheduledScaling: ScheduledScaling[];
  metrics: ScalingMetric[];
  policies: ScalingPolicy[];
}

/**
 * Scheduled scaling
 */
export interface ScheduledScaling {
  name: string;
  schedule: string;
  minCapacity: number;
  maxCapacity: number;
  desiredCapacity: number;
}

/**
 * Scaling metric
 */
export interface ScalingMetric {
  name: string;
  targetValue: number;
  scaleOutCooldown: number;
  scaleInCooldown: number;
}