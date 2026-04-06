/**
 * DOCKER ORCHESTRATOR
 * Geo-Alert System - Phase 8: Production Docker Containerization & Orchestration
 *
 * Enterprise-class Docker containerization και orchestration system που διαχειρίζεται
 * containers, services, scaling, και deployment στο production environment.
 *
 * Split per ADR-065 (SRP compliance):
 * - docker-orchestrator-types.ts — All type definitions
 * - docker-container-configs.ts — Container configuration factories
 * - docker-infrastructure-configs.ts — Service/Ingress/ConfigMap/Secret factories
 * - docker-orchestrator-ops.ts — Deployment, monitoring & utility operations
 */

import { performance } from 'perf_hooks';

import {
  createFrontendContainerConfig,
  createBackendContainerConfig,
  createDatabaseContainerConfig,
  createRedisContainerConfig,
  createNginxContainerConfig
} from './docker-container-configs';

import {
  createFrontendServiceConfig,
  createBackendServiceConfig,
  createDatabaseServiceConfig,
  createRedisServiceConfig,
  createNginxServiceConfig,
  createIngressConfig,
  createAppConfigMap,
  createNginxConfigMap,
  createDatabaseSecrets,
  createAPISecrets,
  createTLSSecrets
} from './docker-infrastructure-configs';

import {
  calculateDeploymentOrder,
  deployContainer,
  deployService,
  deployIngress,
  collectContainerMetrics,
  performHealthChecks,
  updateDeploymentStatuses,
  generateDeploymentId
} from './docker-orchestrator-ops';

import type {
  ContainerStatus,
  DeploymentConfig,
  DeploymentStatus,
  OrchestratorConfig,
  ScalingAction
} from './docker-orchestrator-types';

// Re-export all types for consumers
export type * from './docker-orchestrator-types';

// ============================================================================
// MAIN DOCKER ORCHESTRATOR CLASS
// ============================================================================

/**
 * Docker Orchestrator - Enterprise Container Management & Orchestration
 * Singleton pattern για centralized container orchestration
 */
export class GeoAlertDockerOrchestrator {
  private static instance: GeoAlertDockerOrchestrator | null = null;
  private config: OrchestratorConfig;
  private deployments: Map<string, DeploymentStatus> = new Map();
  private containers: Map<string, ContainerStatus> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  public static getInstance(): GeoAlertDockerOrchestrator {
    if (!GeoAlertDockerOrchestrator.instance) {
      GeoAlertDockerOrchestrator.instance = new GeoAlertDockerOrchestrator();
    }
    return GeoAlertDockerOrchestrator.instance;
  }

  // ========================================================================
  // CONFIGURATION
  // ========================================================================

  private getDefaultConfig(): OrchestratorConfig {
    return {
      platform: 'kubernetes',
      registry: { url: 'registry.example.com', insecure: false },
      cluster: { name: 'geo-alert-cluster', endpoint: 'https://kubernetes.example.com' },
      monitoring: {
        enabled: true,
        metricsInterval: 30000,
        healthCheckInterval: 10000,
        logLevel: 'info'
      },
      deployment: {
        timeout: 600000,
        rollbackOnFailure: true,
        autoScaling: true,
        blueGreenDeployment: true
      }
    };
  }

  // ========================================================================
  // GEO-ALERT DEPLOYMENT CONFIGURATION
  // ========================================================================

  public getGeoAlertDeploymentConfig(): DeploymentConfig {
    return {
      name: 'geo-alert-system',
      namespace: 'geo-alert',
      containers: [
        createFrontendContainerConfig(),
        createBackendContainerConfig(),
        createDatabaseContainerConfig(),
        createRedisContainerConfig(),
        createNginxContainerConfig()
      ],
      services: [
        createFrontendServiceConfig(),
        createBackendServiceConfig(),
        createDatabaseServiceConfig(),
        createRedisServiceConfig(),
        createNginxServiceConfig()
      ],
      ingress: createIngressConfig(),
      configMaps: [createAppConfigMap(), createNginxConfigMap()],
      secrets: [createDatabaseSecrets(), createAPISecrets(), createTLSSecrets()],
      strategy: {
        type: 'RollingUpdate',
        rollingUpdate: { maxUnavailable: '25%', maxSurge: '25%' }
      },
      scaling: {
        enabled: true,
        minReplicas: 2,
        maxReplicas: 10,
        targetCPUUtilization: 70,
        targetMemoryUtilization: 80,
        scaleUpPolicy: {
          stabilizationWindowSeconds: 300,
          policies: [
            { type: 'Percent', value: 100, periodSeconds: 60 },
            { type: 'Pods', value: 2, periodSeconds: 60 }
          ]
        },
        scaleDownPolicy: {
          stabilizationWindowSeconds: 300,
          policies: [{ type: 'Percent', value: 50, periodSeconds: 60 }]
        }
      }
    };
  }

  // ========================================================================
  // DEPLOYMENT OPERATIONS
  // ========================================================================

  public async deployGeoAlertSystem(): Promise<{
    success: boolean;
    deploymentId: string;
    duration: number;
    status: DeploymentStatus;
  }> {
    console.log('🚀 DOCKER ORCHESTRATOR - Deploying Geo-Alert System...');

    const startTime = performance.now();
    const deploymentConfig = this.getGeoAlertDeploymentConfig();
    const deploymentId = generateDeploymentId();

    try {
      const deploymentStatus: DeploymentStatus = {
        name: deploymentConfig.name,
        namespace: deploymentConfig.namespace,
        status: 'Deploying',
        replicas: {
          desired: deploymentConfig.containers.reduce((sum, c) => sum + c.replicas, 0),
          ready: 0, available: 0, unavailable: 0
        },
        containers: [],
        services: [],
        lastDeployment: Date.now(),
        conditions: [],
        events: []
      };

      this.deployments.set(deploymentId, deploymentStatus);

      const order = calculateDeploymentOrder(deploymentConfig.containers);
      for (const name of order) {
        const container = deploymentConfig.containers.find(c => c.name === name);
        if (container) {
          await deployContainer(container, deploymentStatus, this.containers);
        }
      }

      for (const service of deploymentConfig.services) {
        await deployService(service, deploymentStatus);
      }

      if (deploymentConfig.ingress) {
        await deployIngress(deploymentConfig.ingress, deploymentStatus);
      }

      if (this.config.monitoring.enabled) {
        this.startContainerMonitoring();
      }

      deploymentStatus.status = 'Running';
      const duration = performance.now() - startTime;
      console.log(`✅ Deployed: ${deploymentId} (${duration.toFixed(2)}ms)`);

      return { success: true, deploymentId, duration, status: deploymentStatus };
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      const failedStatus = this.deployments.get(deploymentId);
      if (failedStatus) {
        failedStatus.status = 'Failed';
        failedStatus.events.push({
          type: 'Warning',
          reason: 'DeploymentFailed',
          message: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          source: 'orchestrator',
          count: 1
        });
      }
      return {
        success: false,
        deploymentId,
        duration: performance.now() - startTime,
        status: failedStatus || {} as DeploymentStatus
      };
    }
  }

  // ========================================================================
  // CONTAINER MONITORING
  // ========================================================================

  public startContainerMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('Container monitoring already active');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      collectContainerMetrics(this.containers);
      performHealthChecks(this.containers);
      updateDeploymentStatuses(this.deployments);
    }, this.config.monitoring.metricsInterval);
  }

  public stopContainerMonitoring(): void {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  // ========================================================================
  // SCALING OPERATIONS
  // ========================================================================

  public async scaleContainer(containerName: string, replicas: number): Promise<{
    success: boolean;
    currentReplicas: number;
    targetReplicas: number;
  }> {
    const container = this.containers.get(containerName);
    if (!container) {
      throw new Error(`Container not found: ${containerName}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true, currentReplicas: replicas, targetReplicas: replicas };
  }

  public async performAutoScaling(): Promise<{
    scalingActions: ScalingAction[];
    totalActions: number;
  }> {
    const scalingActions: ScalingAction[] = [];

    for (const [containerName, status] of this.containers.entries()) {
      const cpuUsage = (status.resources.cpu / 2.0) * 100;
      const memoryUsage = (status.resources.memory / (1024 * 1024 * 1024)) * 100;

      let shouldScale = false;
      let targetReplicas = 1;
      let reason = '';

      if (cpuUsage > 70) {
        shouldScale = true;
        targetReplicas = Math.min(10, Math.ceil(cpuUsage / 50));
        reason = `CPU usage high: ${cpuUsage.toFixed(1)}%`;
      } else if (memoryUsage > 80) {
        shouldScale = true;
        targetReplicas = Math.min(10, Math.ceil(memoryUsage / 60));
        reason = `Memory usage high: ${memoryUsage.toFixed(1)}%`;
      } else if (cpuUsage < 20 && memoryUsage < 30) {
        shouldScale = true;
        targetReplicas = Math.max(1, Math.floor(cpuUsage / 20));
        reason = `Low resource usage: CPU ${cpuUsage.toFixed(1)}%, Memory ${memoryUsage.toFixed(1)}%`;
      }

      if (shouldScale) {
        scalingActions.push({
          container: containerName,
          currentReplicas: 1,
          targetReplicas,
          reason,
          action: targetReplicas > 1 ? 'scale-up' : 'scale-down'
        });
      }
    }

    for (const action of scalingActions) {
      await this.scaleContainer(action.container, action.targetReplicas);
    }

    return { scalingActions, totalActions: scalingActions.length };
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  public getDeploymentStatus(deploymentId: string): DeploymentStatus | undefined {
    return this.deployments.get(deploymentId);
  }

  public getAllDeployments(): Map<string, DeploymentStatus> {
    return this.deployments;
  }

  public getContainerStatus(containerName: string): ContainerStatus | undefined {
    return this.containers.get(containerName);
  }

  public getAllContainers(): Map<string, ContainerStatus> {
    return this.containers;
  }

  public updateConfig(config: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getOrchestratorStatistics(): {
    totalDeployments: number;
    activeContainers: number;
    healthyContainers: number;
    totalServices: number;
    resourceUsage: { cpu: number; memory: number; storage: number };
  } {
    const containers = Array.from(this.containers.values());
    const healthyContainers = containers.filter(c => c.health.status === 'Healthy').length;

    let totalServices = 0;
    for (const deployment of this.deployments.values()) {
      totalServices += deployment.services.length;
    }

    return {
      totalDeployments: this.deployments.size,
      activeContainers: containers.length,
      healthyContainers,
      totalServices,
      resourceUsage: {
        cpu: containers.reduce((sum, c) => sum + c.resources.cpu, 0),
        memory: containers.reduce((sum, c) => sum + c.resources.memory, 0),
        storage: containers.reduce((sum, c) => sum + c.resources.storage, 0)
      }
    };
  }
}

// ============================================================================
// GLOBAL EXPORTS & UTILITIES
// ============================================================================

export const geoAlertDockerOrchestrator = GeoAlertDockerOrchestrator.getInstance();
export const deployGeoAlert = () => geoAlertDockerOrchestrator.deployGeoAlertSystem();
export const startMonitoring = () => geoAlertDockerOrchestrator.startContainerMonitoring();
export const getDeploymentStats = () => geoAlertDockerOrchestrator.getOrchestratorStatistics();

export default geoAlertDockerOrchestrator;
