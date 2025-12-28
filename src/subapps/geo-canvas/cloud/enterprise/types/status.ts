/**
 * STATUS TYPE DEFINITIONS
 *
 * Enterprise-class type definitions για infrastructure status monitoring
 * Split from monolithic CloudInfrastructure.ts για modular architecture
 *
 * @module enterprise/types/status
 * @version 1.0.0 - ENTERPRISE MODULAR SPLITTING
 * @updated 2025-12-28 - Split from CloudInfrastructure.ts
 */

// ============================================================================
// CORE STATUS TYPES
// ============================================================================

/**
 * Infrastructure status overview
 * Enterprise: Real-time status monitoring across all components
 */
export interface InfrastructureStatus {
  overall: OverallStatus;
  timestamp: Date;
  components: ComponentStatus[];
  regions: RegionStatus[];
  providers: ProviderStatus[];
  metrics: StatusMetrics;
  alerts: ActiveAlert[];
}

/**
 * Overall infrastructure health status
 * Enterprise: Aggregated health με severity levels
 */
export interface OverallStatus {
  health: 'healthy' | 'degraded' | 'critical' | 'unknown';
  availability: number; // percentage
  performance: PerformanceStatus;
  security: SecurityStatus;
  cost: CostStatus;
}

/**
 * Component status για individual infrastructure components
 * Enterprise: Granular component monitoring
 */
export interface ComponentStatus {
  id: string;
  name: string;
  type: ComponentType;
  status: 'online' | 'offline' | 'degraded' | 'maintenance' | 'unknown';
  health: 'healthy' | 'warning' | 'critical';
  provider: string;
  region: string;
  metrics: ComponentMetrics;
  lastChecked: Date;
  uptime: number; // seconds
  errors: ErrorInfo[];
}

/**
 * Component type enumeration
 * Enterprise: All infrastructure component types
 */
export type ComponentType =
  | 'compute-instance'
  | 'load-balancer'
  | 'database'
  | 'storage-bucket'
  | 'cdn-endpoint'
  | 'dns-zone'
  | 'vpn-gateway'
  | 'firewall'
  | 'auto-scaling-group'
  | 'kubernetes-cluster'
  | 'lambda-function'
  | 'container-service'
  | 'monitoring-service';

/**
 * Region status για multi-region deployments
 * Enterprise: Regional health monitoring
 */
export interface RegionStatus {
  name: string;
  provider: string;
  status: 'active' | 'inactive' | 'degraded' | 'maintenance';
  latency: LatencyMetrics;
  availability: number;
  components: number;
  healthyComponents: number;
  lastUpdated: Date;
}

/**
 * Provider status για multi-cloud monitoring
 * Enterprise: Cloud provider health tracking
 */
export interface ProviderStatus {
  name: string;
  status: 'operational' | 'degraded' | 'outage' | 'maintenance';
  services: ProviderServiceStatus[];
  overallHealth: number; // percentage
  incidentCount: number;
  lastIncident?: IncidentInfo;
  lastUpdated: Date;
}

/**
 * Provider service status
 * Enterprise: Individual service monitoring per provider
 */
export interface ProviderServiceStatus {
  service: string;
  status: 'operational' | 'degraded' | 'outage';
  region?: string;
  impactLevel: 'none' | 'low' | 'medium' | 'high';
  startTime?: Date;
  estimatedResolution?: Date;
}

// ============================================================================
// METRICS TYPES
// ============================================================================

/**
 * Status metrics για infrastructure monitoring
 * Enterprise: Comprehensive metrics collection
 */
export interface StatusMetrics {
  availability: AvailabilityMetrics;
  performance: PerformanceMetrics;
  resource: ResourceMetrics;
  cost: CostMetrics;
  security: SecurityMetrics;
  reliability: ReliabilityMetrics;
}

/**
 * Availability metrics
 * Enterprise: SLA tracking και uptime monitoring
 */
export interface AvailabilityMetrics {
  current: number; // percentage
  slaTarget: number; // percentage
  uptime: UptimeMetrics;
  downtimeEvents: DowntimeEvent[];
  mttr: number; // Mean Time To Recovery (minutes)
  mtbf: number; // Mean Time Between Failures (hours)
}

/**
 * Uptime metrics tracking
 * Enterprise: Historical uptime data
 */
export interface UptimeMetrics {
  today: number;
  week: number;
  month: number;
  quarter: number;
  year: number;
}

/**
 * Downtime event tracking
 * Enterprise: Incident tracking και analysis
 */
export interface DowntimeEvent {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // minutes
  cause: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  componentsAffected: string[];
  resolved: boolean;
}

/**
 * Performance metrics
 * Enterprise: Response time και throughput monitoring
 */
export interface PerformanceMetrics {
  responseTime: ResponseTimeMetrics;
  throughput: ThroughputMetrics;
  errorRate: number; // percentage
  saturation: number; // percentage
}

/**
 * Response time metrics
 * Enterprise: Latency monitoring across percentiles
 */
export interface ResponseTimeMetrics {
  average: number; // ms
  p50: number; // ms
  p95: number; // ms
  p99: number; // ms
  max: number; // ms
}

/**
 * Throughput metrics
 * Enterprise: Request volume monitoring
 */
export interface ThroughputMetrics {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  peakThroughput: number;
}

/**
 * Latency metrics για regional monitoring
 * Enterprise: Multi-region latency tracking
 */
export interface LatencyMetrics {
  average: number; // ms
  min: number; // ms
  max: number; // ms
  p95: number; // ms
  lastMeasured: Date;
}

/**
 * Resource utilization metrics
 * Enterprise: Resource optimization monitoring
 */
export interface ResourceMetrics {
  cpu: UtilizationMetric;
  memory: UtilizationMetric;
  storage: StorageMetric;
  network: NetworkMetric;
  instances: InstanceMetrics;
}

/**
 * Utilization metric για CPU/Memory monitoring
 * Enterprise: Real-time resource utilization
 */
export interface UtilizationMetric {
  current: number; // percentage
  average: number; // percentage
  peak: number; // percentage
  threshold: number; // percentage
  trending: 'up' | 'down' | 'stable';
}

/**
 * Storage metrics
 * Enterprise: Storage capacity και usage monitoring
 */
export interface StorageMetric {
  used: number; // bytes
  total: number; // bytes
  utilization: number; // percentage
  iops: number;
  throughput: number; // MB/s
}

/**
 * Network metrics
 * Enterprise: Network performance monitoring
 */
export interface NetworkMetric {
  inbound: number; // MB/s
  outbound: number; // MB/s
  connections: number;
  packetLoss: number; // percentage
  latency: number; // ms
}

/**
 * Instance metrics
 * Enterprise: Compute instance monitoring
 */
export interface InstanceMetrics {
  total: number;
  running: number;
  stopped: number;
  failed: number;
  utilization: number; // percentage
}

/**
 * Component-specific metrics
 * Enterprise: Detailed component monitoring
 */
export interface ComponentMetrics {
  cpu?: number; // percentage
  memory?: number; // percentage
  disk?: number; // percentage
  network?: {
    inbound: number; // MB/s
    outbound: number; // MB/s
  };
  customMetrics?: Record<string, number>;
}

// ============================================================================
// COST MONITORING TYPES
// ============================================================================

/**
 * Cost status monitoring
 * Enterprise: Financial tracking και optimization
 */
export interface CostStatus {
  current: CostMetrics;
  forecast: CostForecast;
  budget: BudgetStatus;
  optimization: OptimizationSuggestions;
}

/**
 * Cost metrics tracking
 * Enterprise: Multi-dimensional cost analysis
 */
export interface CostMetrics {
  daily: number;
  monthly: number;
  quarterly: number;
  yearly: number;
  currency: string;
  breakdown: CostBreakdown;
  trending: 'up' | 'down' | 'stable';
}

/**
 * Cost breakdown analysis
 * Enterprise: Granular cost attribution
 */
export interface CostBreakdown {
  byProvider: Record<string, number>;
  byRegion: Record<string, number>;
  byService: Record<string, number>;
  byEnvironment: Record<string, number>;
  byProject: Record<string, number>;
}

/**
 * Cost forecast data
 * Enterprise: Predictive cost analysis
 */
export interface CostForecast {
  nextMonth: number;
  nextQuarter: number;
  nextYear: number;
  confidence: number; // percentage
  factors: string[];
}

/**
 * Budget status tracking
 * Enterprise: Budget monitoring και alerts
 */
export interface BudgetStatus {
  allocated: number;
  used: number;
  remaining: number;
  utilization: number; // percentage
  status: 'on-track' | 'at-risk' | 'over-budget';
  alerts: BudgetAlert[];
}

/**
 * Budget alert information
 * Enterprise: Proactive budget monitoring
 */
export interface BudgetAlert {
  type: 'warning' | 'critical';
  threshold: number; // percentage
  message: string;
  triggered: Date;
}

/**
 * Cost optimization suggestions
 * Enterprise: AI-driven cost optimization
 */
export interface OptimizationSuggestions {
  total: number;
  suggestions: OptimizationSuggestion[];
  lastUpdated: Date;
}

/**
 * Individual optimization suggestion
 * Enterprise: Actionable cost reduction recommendations
 */
export interface OptimizationSuggestion {
  id: string;
  type: 'rightsizing' | 'reserved-instances' | 'spot-instances' | 'storage-optimization' | 'unused-resources';
  resource: string;
  currentCost: number;
  projectedSavings: number;
  confidence: number; // percentage
  effort: 'low' | 'medium' | 'high';
  description: string;
  action: string;
}

// ============================================================================
// SECURITY MONITORING TYPES
// ============================================================================

/**
 * Security status monitoring
 * Enterprise: Comprehensive security posture tracking
 */
export interface SecurityStatus {
  overall: SecurityPosture;
  vulnerabilities: VulnerabilityStatus;
  compliance: ComplianceStatus;
  incidents: SecurityIncident[];
  threats: ThreatIntelligence;
}

/**
 * Security posture assessment
 * Enterprise: Holistic security health evaluation
 */
export interface SecurityPosture {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high' | 'critical';
  risks: SecurityRisk[];
  recommendations: SecurityRecommendation[];
  lastAssessment: Date;
}

/**
 * Security risk assessment
 * Enterprise: Risk-based security monitoring
 */
export interface SecurityRisk {
  id: string;
  type: 'vulnerability' | 'misconfiguration' | 'compliance' | 'threat';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  likelihood: number; // percentage
  mitigation: string;
}

/**
 * Security recommendation
 * Enterprise: Actionable security improvements
 */
export interface SecurityRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  implementation: string;
  effort: 'low' | 'medium' | 'high';
}

/**
 * Vulnerability status tracking
 * Enterprise: Comprehensive vulnerability management
 */
export interface VulnerabilityStatus {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
  newThisWeek: number;
  averageResolutionTime: number; // days
}

/**
 * Compliance status monitoring
 * Enterprise: Regulatory compliance tracking
 */
export interface ComplianceStatus {
  frameworks: ComplianceFramework[];
  overallScore: number; // percentage
  gaps: ComplianceGap[];
  audits: ComplianceAudit[];
}

/**
 * Compliance framework status
 * Enterprise: Framework-specific compliance tracking
 */
export interface ComplianceFramework {
  name: string;
  version: string;
  score: number; // percentage
  status: 'compliant' | 'non-compliant' | 'partial';
  controls: ControlStatus[];
  lastAssessment: Date;
}

/**
 * Control status για compliance frameworks
 * Enterprise: Individual control monitoring
 */
export interface ControlStatus {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'not-applicable';
  evidence?: string;
  lastChecked: Date;
}

/**
 * Compliance gap tracking
 * Enterprise: Gap analysis για compliance improvement
 */
export interface ComplianceGap {
  framework: string;
  control: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
  dueDate?: Date;
}

/**
 * Compliance audit tracking
 * Enterprise: Audit trail και history
 */
export interface ComplianceAudit {
  id: string;
  framework: string;
  auditor: string;
  date: Date;
  result: 'pass' | 'fail' | 'conditional';
  score?: number;
  findings: AuditFinding[];
}

/**
 * Audit finding information
 * Enterprise: Detailed audit results
 */
export interface AuditFinding {
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
  status: 'open' | 'in-progress' | 'closed';
}

/**
 * Security incident tracking
 * Enterprise: Incident response monitoring
 */
export interface SecurityIncident {
  id: string;
  type: 'breach' | 'malware' | 'unauthorized-access' | 'ddos' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'contained' | 'resolved';
  startTime: Date;
  detectedTime: Date;
  containedTime?: Date;
  resolvedTime?: Date;
  affectedSystems: string[];
  impact: string;
  response: IncidentResponse[];
}

/**
 * Incident response tracking
 * Enterprise: Response action monitoring
 */
export interface IncidentResponse {
  timestamp: Date;
  action: string;
  responsible: string;
  result: string;
}

/**
 * Threat intelligence data
 * Enterprise: Proactive threat monitoring
 */
export interface ThreatIntelligence {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  activeThreatCount: number;
  blockedAttacks: number;
  sources: ThreatSource[];
  indicators: ThreatIndicator[];
  lastUpdated: Date;
}

/**
 * Threat source tracking
 * Enterprise: Attack vector monitoring
 */
export interface ThreatSource {
  type: 'ip' | 'domain' | 'url' | 'hash';
  value: string;
  threat: string;
  confidence: number; // percentage
  lastSeen: Date;
}

/**
 * Threat indicator information
 * Enterprise: IoC tracking
 */
export interface ThreatIndicator {
  type: 'malware' | 'phishing' | 'c2' | 'apt';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  matched: number;
  firstSeen: Date;
  lastSeen: Date;
}

// ============================================================================
// RELIABILITY METRICS TYPES
// ============================================================================

/**
 * Reliability metrics tracking
 * Enterprise: System reliability monitoring
 */
export interface ReliabilityMetrics {
  sli: SLIMetrics;
  slo: SLOMetrics;
  errorBudget: ErrorBudgetMetrics;
  incidents: IncidentMetrics;
}

/**
 * Service Level Indicator metrics
 * Enterprise: SLI tracking για reliability
 */
export interface SLIMetrics {
  availability: number; // percentage
  latency: number; // ms
  throughput: number; // requests/second
  errorRate: number; // percentage
  quality: number; // percentage
}

/**
 * Service Level Objective metrics
 * Enterprise: SLO compliance tracking
 */
export interface SLOMetrics {
  target: number; // percentage
  current: number; // percentage
  compliance: 'meeting' | 'at-risk' | 'breaching';
  timeWindow: string;
  remainingBudget: number; // percentage
}

/**
 * Error budget metrics
 * Enterprise: Error budget management
 */
export interface ErrorBudgetMetrics {
  total: number;
  consumed: number;
  remaining: number;
  burnRate: number;
  projectedExhaustion?: Date;
}

/**
 * Incident metrics tracking
 * Enterprise: Incident pattern analysis
 */
export interface IncidentMetrics {
  total: number;
  resolved: number;
  averageResolutionTime: number; // minutes
  p95ResolutionTime: number; // minutes
  escalations: number;
  customerImpact: number; // percentage
}

// ============================================================================
// ERROR AND ALERT TYPES
// ============================================================================

/**
 * Error information tracking
 * Enterprise: Comprehensive error monitoring
 */
export interface ErrorInfo {
  id: string;
  timestamp: Date;
  type: 'configuration' | 'network' | 'authentication' | 'resource' | 'application';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: string;
  component: string;
  resolved: boolean;
  resolvedAt?: Date;
}

/**
 * Active alert tracking
 * Enterprise: Real-time alert management
 */
export interface ActiveAlert {
  id: string;
  type: 'performance' | 'availability' | 'security' | 'cost' | 'resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  source: string;
  timestamp: Date;
  acknowledged: boolean;
  assignee?: string;
  estimatedResolution?: Date;
}

/**
 * Incident information για major outages
 * Enterprise: Major incident tracking
 */
export interface IncidentInfo {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  impact: 'minor' | 'major' | 'critical';
  startTime: Date;
  endTime?: Date;
  affectedServices: string[];
  updates: IncidentUpdate[];
}

/**
 * Incident update tracking
 * Enterprise: Incident communication tracking
 */
export interface IncidentUpdate {
  timestamp: Date;
  status: string;
  message: string;
  author: string;
}

// ============================================================================
// EXACT COPIES FROM ORIGINAL CloudInfrastructure.ts (CHUNK 6: LINES 1001-1200)
// ============================================================================

/**
 * Backup configuration
 */
export interface BackupConfig {
  enabled: boolean;
  schedule: string;
  retention: number;
  crossRegion: boolean;
  encryption: boolean;
  testing: boolean;
  resources: BackupResource[];
}

/**
 * Backup resource
 */
export interface BackupResource {
  type: 'database' | 'volume' | 'file-system' | 'application';
  name: string;
  schedule: string;
  retention: number;
}

/**
 * Infrastructure status - EXACT COPY FROM ORIGINAL
 */
export interface InfrastructureStatusOriginal {
  name: string;
  environment: string;
  status: 'provisioning' | 'running' | 'updating' | 'failed' | 'destroyed';
  regions: RegionStatusOriginal[];
  resources: ResourceStatusOriginal[];
  costs: CostAnalysis;
  health: HealthStatusOriginal;
  lastUpdated: number;
}

/**
 * Region status - EXACT COPY FROM ORIGINAL
 */
export interface RegionStatusOriginal {
  name: string;
  status: 'active' | 'inactive' | 'maintenance';
  latency: number;
  availability: number;
  resources: number;
}

/**
 * Resource status - EXACT COPY FROM ORIGINAL
 */
export interface ResourceStatusOriginal {
  id: string;
  type: string;
  name: string;
  status: 'running' | 'stopped' | 'terminated' | 'failed';
  region: string;
  tags: Record<string, string>;
  cost: number;
  metrics: ResourceMetricsOriginal;
}

/**
 * Resource metrics - EXACT COPY FROM ORIGINAL
 */
export interface ResourceMetricsOriginal {
  cpu: number;
  memory: number;
  network: number;
  storage: number;
  requests: number;
}

/**
 * Cost analysis
 */
export interface CostAnalysis {
  total: number;
  byService: Record<string, number>;
  byRegion: Record<string, number>;
  trends: CostTrend[];
  forecasts: CostForecast[];
  recommendations: CostOptimization[];
}

/**
 * Cost trend
 */
export interface CostTrend {
  period: string;
  cost: number;
  change: number;
}

/**
 * Cost forecast
 */
export interface CostForecast {
  period: string;
  estimatedCost: number;
  confidence: number;
}

/**
 * Cost optimization
 */
export interface CostOptimization {
  type: 'right-sizing' | 'reserved-instances' | 'spot-instances' | 'storage-optimization';
  description: string;
  potentialSavings: number;
  effort: 'low' | 'medium' | 'high';
}

/**
 * Health status - EXACT COPY FROM ORIGINAL
 */
export interface HealthStatusOriginal {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  incidents: IncidentOriginal[];
}

/**
 * Service health
 */
export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  responseTime: number;
  errorRate: number;
}

/**
 * Incident - EXACT COPY FROM ORIGINAL
 */
export interface IncidentOriginal {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved';
  title: string;
  description: string;
  startTime: number;
  resolvedTime?: number;
  affectedServices: string[];
}