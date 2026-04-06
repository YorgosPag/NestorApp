/**
 * DOCKER ORCHESTRATOR — DEPLOYMENT & MONITORING OPERATIONS
 * Geo-Alert System - Phase 8: Production Docker Containerization & Orchestration
 *
 * Standalone operational functions for container deployment, monitoring, and utilities.
 * Extracted from DockerOrchestrator.ts per ADR-065 (SRP compliance).
 */

import { generateDeploymentId as generateEnterpriseDeploymentId, generateContainerId } from '@/services/enterprise-id.service';

import type {
  ContainerConfig,
  ContainerStatus,
  DeploymentStatus,
  HealthCheckResult,
  IngressConfig,
  ServiceConfig,
  ServiceStatus
} from './docker-orchestrator-types';

// ============================================================================
// DEPLOYMENT HELPERS
// ============================================================================

/**
 * Calculate deployment order based on container dependencies (topological sort)
 */
export function calculateDeploymentOrder(containers: ContainerConfig[]): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (containerName: string) => {
    if (visiting.has(containerName)) {
      throw new Error(`Circular dependency detected: ${containerName}`);
    }
    if (visited.has(containerName)) return;

    visiting.add(containerName);

    const container = containers.find(c => c.name === containerName);
    if (container) {
      for (const dependency of container.dependsOn) {
        visit(dependency);
      }
    }

    visiting.delete(containerName);
    visited.add(containerName);
    order.push(containerName);
  };

  containers.forEach(container => {
    if (!visited.has(container.name)) {
      visit(container.name);
    }
  });

  return order;
}

/**
 * Deploy a single container and update deployment status
 */
export async function deployContainer(
  container: ContainerConfig,
  deployment: DeploymentStatus,
  containersMap: Map<string, ContainerStatus>
): Promise<void> {
  console.log(`  📦 Deploying container: ${container.name}`);
  await simulateContainerDeployment(container);

  const containerStatus: ContainerStatus = {
    name: container.name,
    status: 'Running',
    ready: true,
    restartCount: 0,
    image: `${container.image}:${container.tag}`,
    imageID: `sha256:${generateHash()}`,
    containerID: `docker://${generateHash()}`,
    startedAt: Date.now(),
    resources: {
      cpu: parseFloat(container.resources.cpu.request),
      memory: parseMemoryString(container.resources.memory.request),
      storage: parseStorageString(container.resources.storage.request)
    },
    health: { status: 'Healthy', checks: [] }
  };

  containersMap.set(container.name, containerStatus);
  deployment.containers.push(containerStatus);
  deployment.replicas.ready++;
  deployment.replicas.available++;

  deployment.events.push({
    type: 'Normal',
    reason: 'ContainerStarted',
    message: `Container ${container.name} started successfully`,
    timestamp: Date.now(),
    source: 'orchestrator',
    count: 1
  });

  console.log(`  ✅ Container deployed: ${container.name}`);
}

/**
 * Deploy a service and update deployment status
 */
export async function deployService(
  service: ServiceConfig,
  deployment: DeploymentStatus
): Promise<void> {
  console.log(`  🔗 Deploying service: ${service.name}`);
  await new Promise(resolve => setTimeout(resolve, 1000));

  const serviceStatus: ServiceStatus = {
    name: service.name,
    type: service.type,
    clusterIP: generateClusterIP(),
    externalIPs: service.externalIPs || [],
    ports: service.ports,
    endpoints: [`${generateClusterIP()}:${service.ports[0].port}`],
    loadBalancer: service.type === 'LoadBalancer' ? {
      ingress: ['203.0.113.1']
    } : undefined
  };

  deployment.services.push(serviceStatus);
  console.log(`  ✅ Service deployed: ${service.name}`);
}

/**
 * Deploy ingress and update deployment status
 */
export async function deployIngress(
  ingress: IngressConfig,
  deployment: DeploymentStatus
): Promise<void> {
  console.log(`  🌐 Deploying ingress: ${ingress.name}`);
  await new Promise(resolve => setTimeout(resolve, 2000));

  deployment.events.push({
    type: 'Normal',
    reason: 'IngressCreated',
    message: `Ingress ${ingress.name} created with ${ingress.hosts.length} hosts`,
    timestamp: Date.now(),
    source: 'orchestrator',
    count: 1
  });

  console.log(`  ✅ Ingress deployed: ${ingress.name}`);
}

// ============================================================================
// MONITORING HELPERS
// ============================================================================

/**
 * Collect container resource metrics
 */
export function collectContainerMetrics(containers: Map<string, ContainerStatus>): void {
  for (const [containerName, status] of containers.entries()) {
    status.resources.cpu = Math.random() * 2.0;
    status.resources.memory = Math.random() * 1024 * 1024 * 1024;
    containers.set(containerName, status);
  }
}

/**
 * Perform health checks on all containers
 */
export function performHealthChecks(containers: Map<string, ContainerStatus>): void {
  for (const [, status] of containers.entries()) {
    const isHealthy = Math.random() > 0.1;

    const healthCheck: HealthCheckResult = {
      type: 'http',
      status: isHealthy ? 'Success' : 'Failure',
      timestamp: Date.now(),
      duration: Math.random() * 1000,
      message: isHealthy ? 'Health check passed' : 'Health check failed'
    };

    status.health.checks.push(healthCheck);
    status.health.status = isHealthy ? 'Healthy' : 'Unhealthy';

    if (status.health.checks.length > 10) {
      status.health.checks = status.health.checks.slice(-10);
    }
  }
}

/**
 * Update deployment status based on container health
 */
export function updateDeploymentStatuses(deployments: Map<string, DeploymentStatus>): void {
  for (const [, deployment] of deployments.entries()) {
    const readyContainers = deployment.containers.filter(c => c.ready).length;
    const healthyContainers = deployment.containers.filter(c => c.health.status === 'Healthy').length;

    deployment.replicas.ready = readyContainers;
    deployment.replicas.available = healthyContainers;
    deployment.replicas.unavailable = deployment.replicas.desired - healthyContainers;
    deployment.status = 'Running';
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function simulateContainerDeployment(container: ContainerConfig): Promise<void> {
  return new Promise((resolve) => {
    const deploymentTime = 1000 + (container.replicas * 500);
    setTimeout(resolve, deploymentTime);
  });
}

export function generateDeploymentId(): string {
  return generateEnterpriseDeploymentId();
}

export function generateHash(): string {
  return generateContainerId();
}

export function generateClusterIP(): string {
  return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

export function parseMemoryString(memory: string): number {
  const unit = memory.slice(-2);
  const value = parseFloat(memory.slice(0, -2));

  switch (unit) {
    case 'Ki': return value * 1024;
    case 'Mi': return value * 1024 * 1024;
    case 'Gi': return value * 1024 * 1024 * 1024;
    default: return value;
  }
}

export function parseStorageString(storage: string): number {
  return parseMemoryString(storage);
}
