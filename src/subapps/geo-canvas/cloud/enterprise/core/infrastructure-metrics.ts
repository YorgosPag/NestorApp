/**
 * INFRASTRUCTURE METRICS — Utility functions for metrics calculation
 *
 * Mock data generators and metrics calculators for the
 * infrastructure monitoring system. Pure functions.
 * Extracted from InfrastructureManager (ADR-065).
 *
 * @module enterprise/core/infrastructure-metrics
 * @see infrastructure-manager.ts
 */

import type { CloudProvider } from '../types/cloud-providers';
import type {
  InfrastructureConfig,
  ComponentStatus,
  StatusMetrics
} from '../types/infrastructure';
import type {
  ResponseTimeMetrics,
  ThroughputMetrics,
  SecurityStatus,
  CostStatus,
  RegionStatus,
  ProviderStatus
} from '../types/status';

// ============================================================================
// PROVIDER COMPONENTS (simulated)
// ============================================================================

export async function getProviderComponents(provider: CloudProvider): Promise<ComponentStatus[]> {
  return [
    {
      id: `${provider.name}-compute-1`,
      name: `${provider.name}-instance-1`,
      type: 'compute-instance',
      status: 'online',
      health: 'healthy',
      provider: provider.name,
      region: provider.region,
      metrics: {
        cpu: 45, memory: 67, disk: 23,
        network: { inbound: 1.2, outbound: 0.8 }
      },
      lastChecked: new Date(),
      uptime: Math.floor(Math.random() * 86400 * 30),
      errors: []
    },
    {
      id: `${provider.name}-storage-1`,
      name: `${provider.name}-bucket-1`,
      type: 'storage-bucket',
      status: 'online',
      health: 'healthy',
      provider: provider.name,
      region: provider.region,
      metrics: {
        customMetrics: { objectCount: 1250, totalSize: 1024 * 1024 * 512 }
      },
      lastChecked: new Date(),
      uptime: Math.floor(Math.random() * 86400 * 60),
      errors: []
    }
  ];
}

// ============================================================================
// CALCULATION UTILITIES
// ============================================================================

export function calculateAverageResponseTime(components: ComponentStatus[]): ResponseTimeMetrics {
  const responseTimes = components.map(() => Math.random() * 100 + 50);
  const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  return { average, p50: average * 0.8, p95: average * 1.5, p99: average * 2.0, max: average * 2.5 };
}

export function calculateTotalThroughput(components: ComponentStatus[]): ThroughputMetrics {
  const rps = components.length * (Math.random() * 1000 + 500);
  return { requestsPerSecond: rps, requestsPerMinute: rps * 60, requestsPerHour: rps * 3600, peakThroughput: rps * 1.8 };
}

export function calculateCurrentSpend(components: ComponentStatus[]): number {
  return components.length * (Math.random() * 100 + 50);
}

// ============================================================================
// STATUS OBJECT FACTORIES
// ============================================================================

export function createSecurityStatus(health: 'healthy' | 'degraded' | 'critical' | 'unknown'): SecurityStatus {
  return {
    overall: {
      score: health === 'healthy' ? 95 : health === 'degraded' ? 75 : 50,
      level: health === 'critical' ? 'high' : 'medium',
      risks: [], recommendations: [],
      lastAssessment: new Date()
    },
    vulnerabilities: {
      total: 0, critical: 0, high: 0, medium: 0, low: 0,
      resolved: 0, newThisWeek: 0, averageResolutionTime: 0
    },
    compliance: { frameworks: [], overallScore: 90, gaps: [], audits: [] },
    incidents: [],
    threats: {
      riskLevel: health === 'critical' ? 'high' : 'low',
      activeThreatCount: 0, blockedAttacks: 0, sources: [], indicators: [],
      lastUpdated: new Date()
    }
  };
}

export function createCostStatus(components: ComponentStatus[]): CostStatus {
  const currentSpend = calculateCurrentSpend(components);
  return {
    current: {
      daily: currentSpend / 30, monthly: currentSpend, quarterly: currentSpend * 3, yearly: currentSpend * 12,
      currency: 'USD',
      breakdown: {
        byProvider: { aws: currentSpend * 0.5, azure: currentSpend * 0.3, gcp: currentSpend * 0.2 },
        byRegion: { 'us-east-1': currentSpend * 0.4, 'eu-west-1': currentSpend * 0.6 },
        byService: { compute: currentSpend * 0.4, storage: currentSpend * 0.3, networking: currentSpend * 0.3 },
        byEnvironment: { production: currentSpend * 0.7, staging: currentSpend * 0.3 },
        byProject: { 'geo-alert': currentSpend }
      },
      trending: 'stable'
    },
    forecast: {
      nextMonth: currentSpend * 1.1, nextQuarter: currentSpend * 3.2, nextYear: currentSpend * 12.5,
      confidence: 85, factors: ['seasonal growth', 'new features'],
      period: 'monthly', estimatedCost: currentSpend * 1.1
    },
    budget: {
      allocated: currentSpend * 1.5, used: currentSpend, remaining: currentSpend * 0.5,
      utilization: 67, status: 'on-track' as const, alerts: []
    },
    optimization: { total: 3, suggestions: [], lastUpdated: new Date() }
  };
}

// ============================================================================
// COMPREHENSIVE METRICS
// ============================================================================

export async function collectStatusMetrics(components: ComponentStatus[]): Promise<StatusMetrics> {
  return {
    availability: {
      current: 99.5, slaTarget: 99.9,
      uptime: { today: 99.8, week: 99.6, month: 99.5, quarter: 99.4, year: 99.3 },
      downtimeEvents: [], mttr: 15, mtbf: 720
    },
    performance: {
      responseTime: { average: 85, p50: 75, p95: 120, p99: 180, max: 250 },
      throughput: { requestsPerSecond: 1250, requestsPerMinute: 75000, requestsPerHour: 4500000, peakThroughput: 2000 },
      errorRate: 0.1, saturation: 65
    },
    resource: {
      cpu: { current: 55, average: 45, peak: 85, threshold: 80, trending: 'stable' },
      memory: { current: 67, average: 62, peak: 78, threshold: 85, trending: 'up' },
      storage: { used: 1024 * 1024 * 1024 * 500, total: 1024 * 1024 * 1024 * 1000, utilization: 50, iops: 1000, throughput: 50 },
      network: { inbound: 10, outbound: 8, connections: 150, packetLoss: 0.01, latency: 25 },
      instances: {
        total: components.length,
        running: components.filter(c => c.status === 'online').length,
        stopped: 0,
        failed: components.filter(c => c.status === 'offline').length,
        utilization: 65
      }
    },
    cost: {
      daily: 50, monthly: 1500, quarterly: 4500, yearly: 18000, currency: 'USD',
      breakdown: {
        byProvider: { aws: 800, azure: 400, gcp: 300 },
        byRegion: { 'us-east-1': 600, 'eu-west-1': 500, 'ap-southeast-1': 400 },
        byService: { compute: 600, storage: 400, networking: 300, database: 200 },
        byEnvironment: { production: 900, staging: 400, development: 200 },
        byProject: { 'geo-alert': 800, analytics: 400, monitoring: 300 }
      },
      trending: 'stable'
    },
    security: [
      { id: 'risk-1', type: 'vulnerability' as const, severity: 'medium' as const, description: 'Outdated security patches detected', impact: 'Potential security vulnerabilities in production environment', likelihood: 25, mitigation: 'Apply latest security updates' },
      { id: 'risk-2', type: 'misconfiguration' as const, severity: 'low' as const, description: 'Non-critical configuration drift', impact: 'Minor security configuration inconsistencies', likelihood: 15, mitigation: 'Review and standardize configurations' }
    ],
    reliability: {
      sli: { availability: 99.5, latency: 85, throughput: 1250, errorRate: 0.1, quality: 95 },
      slo: { target: 99.9, current: 99.5, compliance: 'at-risk', timeWindow: '30d', remainingBudget: 40 },
      errorBudget: { total: 100, consumed: 60, remaining: 40, burnRate: 2.5, projectedExhaustion: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000) },
      incidents: { total: 3, resolved: 2, averageResolutionTime: 45, p95ResolutionTime: 120, escalations: 1, customerImpact: 15 }
    }
  };
}

// ============================================================================
// REGION & PROVIDER STATUSES (simulated)
// ============================================================================

export async function getRegionStatuses(config: InfrastructureConfig): Promise<RegionStatus[]> {
  return config.regions.map(region => ({
    name: region.name,
    provider: region.provider,
    status: 'active',
    latency: { average: 25, min: 15, max: 45, p95: 35, lastMeasured: new Date() },
    availability: 99.8,
    components: 2,
    healthyComponents: 2,
    lastUpdated: new Date()
  }));
}

export async function getProviderStatuses(providers: Map<string, unknown>): Promise<ProviderStatus[]> {
  return Array.from(providers.keys()).map(providerName => ({
    name: providerName,
    status: 'operational',
    services: [],
    overallHealth: 98,
    incidentCount: 0,
    lastUpdated: new Date()
  }));
}
