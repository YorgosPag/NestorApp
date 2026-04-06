/**
 * DOCKER ORCHESTRATOR — TYPE DEFINITIONS
 * Geo-Alert System - Phase 8: Production Docker Containerization & Orchestration
 *
 * All type definitions for the Docker Orchestrator system.
 * Extracted from DockerOrchestrator.ts per ADR-065 (SRP compliance).
 */

// ============================================================================
// CONTAINER TYPES
// ============================================================================

/**
 * Container configuration
 */
export interface ContainerConfig {
  name: string;
  image: string;
  tag: string;
  replicas: number;
  resources: ResourceRequirements;
  environment: EnvironmentVariable[];
  ports: PortMapping[];
  volumes: VolumeMount[];
  healthCheck: HealthCheckConfig;
  restartPolicy: RestartPolicy;
  networks: string[];
  labels: Record<string, string>;
  dependsOn: string[];
}

/**
 * Resource requirements
 */
export interface ResourceRequirements {
  cpu: {
    request: string;    // e.g., "0.5"
    limit: string;      // e.g., "2.0"
  };
  memory: {
    request: string;    // e.g., "512Mi"
    limit: string;      // e.g., "2Gi"
  };
  storage: {
    request: string;    // e.g., "10Gi"
    class: string;      // storage class
  };
}

/**
 * Environment variable
 */
export interface EnvironmentVariable {
  name: string;
  value?: string;
  valueFrom?: {
    secretKeyRef?: {
      name: string;
      key: string;
    };
    configMapKeyRef?: {
      name: string;
      key: string;
    };
  };
}

/**
 * Port mapping
 */
export interface PortMapping {
  name: string;
  containerPort: number;
  hostPort?: number;
  protocol: 'TCP' | 'UDP';
  expose: boolean;
}

/**
 * Volume mount
 */
export interface VolumeMount {
  name: string;
  mountPath: string;
  readOnly: boolean;
  subPath?: string;
  volume: VolumeSource;
}

// ============================================================================
// VOLUME SOURCE TYPES
// ============================================================================

export interface EmptyDirSource {
  medium?: 'Memory' | '';
  sizeLimit?: string;
}

export interface HostPathSource {
  path: string;
  type?: 'Directory' | 'DirectoryOrCreate' | 'File' | 'FileOrCreate';
}

export interface ConfigMapSource {
  name: string;
  items?: { key: string; path: string }[];
}

export interface SecretSource {
  secretName: string;
  items?: { key: string; path: string }[];
}

export interface PVCSource {
  claimName: string;
  readOnly?: boolean;
}

/**
 * Volume source - properly typed for all volume types
 */
export interface VolumeSource {
  type: 'emptyDir' | 'hostPath' | 'configMap' | 'secret' | 'persistentVolumeClaim';
  source: EmptyDirSource | HostPathSource | ConfigMapSource | SecretSource | PVCSource;
}

// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  type: 'http' | 'tcp' | 'exec';
  path?: string;
  port?: number;
  command?: string[];
  initialDelaySeconds: number;
  periodSeconds: number;
  timeoutSeconds: number;
  failureThreshold: number;
  successThreshold: number;
}

/**
 * Restart policy
 */
export type RestartPolicy = 'Always' | 'OnFailure' | 'Never';

/**
 * Health check result
 */
export interface HealthCheckResult {
  type: string;
  status: 'Success' | 'Failure';
  timestamp: number;
  duration: number;
  message?: string;
}

// ============================================================================
// SERVICE TYPES
// ============================================================================

/**
 * Service configuration
 */
export interface ServiceConfig {
  name: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  selector: Record<string, string>;
  ports: ServicePort[];
  externalIPs?: string[];
  loadBalancerIP?: string;
  sessionAffinity: 'None' | 'ClientIP';
}

/**
 * Service port
 */
export interface ServicePort {
  name: string;
  port: number;
  targetPort: number;
  protocol: 'TCP' | 'UDP';
  nodePort?: number;
}

// ============================================================================
// DEPLOYMENT TYPES
// ============================================================================

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  name: string;
  namespace: string;
  containers: ContainerConfig[];
  services: ServiceConfig[];
  ingress?: IngressConfig;
  configMaps: ConfigMapConfig[];
  secrets: SecretConfig[];
  strategy: DeploymentStrategy;
  scaling: ScalingConfig;
}

/**
 * Deployment strategy
 */
export interface DeploymentStrategy {
  type: 'RollingUpdate' | 'Recreate';
  rollingUpdate?: {
    maxUnavailable: string;
    maxSurge: string;
  };
}

/**
 * Deployment status
 */
export interface DeploymentStatus {
  name: string;
  namespace: string;
  status: 'Deploying' | 'Running' | 'Failed' | 'Stopped';
  replicas: {
    desired: number;
    ready: number;
    available: number;
    unavailable: number;
  };
  containers: ContainerStatus[];
  services: ServiceStatus[];
  lastDeployment: number;
  conditions: DeploymentCondition[];
  events: DeploymentEvent[];
}

/**
 * Deployment condition
 */
export interface DeploymentCondition {
  type: 'Available' | 'Progressing' | 'ReplicaFailure';
  status: 'True' | 'False' | 'Unknown';
  lastUpdateTime: number;
  lastTransitionTime: number;
  reason: string;
  message: string;
}

/**
 * Deployment event
 */
export interface DeploymentEvent {
  type: 'Normal' | 'Warning';
  reason: string;
  message: string;
  timestamp: number;
  source: string;
  count: number;
}

// ============================================================================
// INGRESS TYPES
// ============================================================================

/**
 * Ingress configuration
 */
export interface IngressConfig {
  name: string;
  className: string;
  tls: boolean;
  hosts: IngressHost[];
  annotations: Record<string, string>;
}

/**
 * Ingress host
 */
export interface IngressHost {
  host: string;
  paths: IngressPath[];
}

/**
 * Ingress path
 */
export interface IngressPath {
  path: string;
  pathType: 'Exact' | 'Prefix';
  service: {
    name: string;
    port: number;
  };
}

// ============================================================================
// CONFIG & SECRETS TYPES
// ============================================================================

/**
 * ConfigMap configuration
 */
export interface ConfigMapConfig {
  name: string;
  data: Record<string, string>;
  binaryData?: Record<string, string>;
}

/**
 * Secret configuration
 */
export interface SecretConfig {
  name: string;
  type: 'Opaque' | 'kubernetes.io/tls' | 'kubernetes.io/dockerconfigjson';
  data: Record<string, string>;
  stringData?: Record<string, string>;
}

// ============================================================================
// SCALING TYPES
// ============================================================================

/**
 * Scaling configuration
 */
export interface ScalingConfig {
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  targetCPUUtilization: number;
  targetMemoryUtilization: number;
  scaleUpPolicy: ScalingPolicy;
  scaleDownPolicy: ScalingPolicy;
}

/**
 * Scaling policy
 */
export interface ScalingPolicy {
  stabilizationWindowSeconds: number;
  policies: ScalingPolicyRule[];
}

/**
 * Scaling policy rule
 */
export interface ScalingPolicyRule {
  type: 'Percent' | 'Pods';
  value: number;
  periodSeconds: number;
}

/**
 * Scaling action (used by auto-scaler)
 */
export interface ScalingAction {
  container: string;
  currentReplicas: number;
  targetReplicas: number;
  reason: string;
  action: 'scale-up' | 'scale-down';
}

// ============================================================================
// CONTAINER STATUS TYPES
// ============================================================================

/**
 * Container status
 */
export interface ContainerStatus {
  name: string;
  status: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';
  ready: boolean;
  restartCount: number;
  image: string;
  imageID: string;
  containerID?: string;
  startedAt?: number;
  finishedAt?: number;
  exitCode?: number;
  reason?: string;
  message?: string;
  resources: {
    cpu: number;
    memory: number;
    storage: number;
  };
  health: {
    status: 'Healthy' | 'Unhealthy' | 'Unknown';
    checks: HealthCheckResult[];
  };
}

/**
 * Service status
 */
export interface ServiceStatus {
  name: string;
  type: string;
  clusterIP: string;
  externalIPs: string[];
  ports: ServicePort[];
  endpoints: string[];
  loadBalancer?: {
    ingress: string[];
  };
}

// ============================================================================
// ORCHESTRATOR CONFIG TYPE
// ============================================================================

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  platform: 'docker' | 'kubernetes' | 'docker-swarm' | 'openshift';
  registry: {
    url: string;
    username?: string;
    password?: string;
    insecure: boolean;
  };
  cluster: {
    name: string;
    endpoint: string;
    token?: string;
    certificate?: string;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    healthCheckInterval: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  deployment: {
    timeout: number;
    rollbackOnFailure: boolean;
    autoScaling: boolean;
    blueGreenDeployment: boolean;
  };
}
