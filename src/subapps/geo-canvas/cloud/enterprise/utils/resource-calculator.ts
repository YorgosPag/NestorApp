/**
 * RESOURCE CALCULATOR UTILITIES
 *
 * Enterprise-class resource calculation utilities για cloud optimization
 * Split from monolithic CloudInfrastructure.ts για modular architecture
 *
 * @module enterprise/utils/resource-calculator
 * @version 1.0.0 - ENTERPRISE MODULAR SPLITTING
 * @updated 2025-12-28 - Split from CloudInfrastructure.ts
 */

import type {
  PricingTier,
  CloudProvider
} from '../types/cloud-providers';

import type {
  ComponentStatus,
  CostMetrics,
  ResourceMetrics
} from '../types/status';

// ============================================================================
// RESOURCE CALCULATION UTILITIES
// ============================================================================

/**
 * Calculate optimal instance size based on requirements
 * Enterprise: Intelligent instance sizing για cost optimization
 */
export function calculateOptimalInstance(
  requirements: {
    cpu: number;
    memory: number;
    storage?: number;
    network?: number;
  },
  availableInstances: PricingTier[],
  provider: string = 'aws'
): {
  recommended: PricingTier;
  alternatives: PricingTier[];
  costSavings: number;
  overProvisioningPercent: number;
} {
  // Filter instances που meet requirements
  const suitableInstances = availableInstances.filter(instance =>
    instance.cpu >= requirements.cpu &&
    instance.memory >= requirements.memory &&
    (!requirements.storage || instance.storage >= requirements.storage)
  );

  if (suitableInstances.length === 0) {
    throw new Error('No suitable instances found for requirements');
  }

  // Sort by cost efficiency (performance/price ratio)
  const sortedInstances = suitableInstances
    .map(instance => ({
      ...instance,
      efficiency: calculateEfficiencyScore(instance, requirements),
      overProvisioning: calculateOverProvisioning(instance, requirements)
    }))
    .sort((a, b) => b.efficiency - a.efficiency);

  const recommended = sortedInstances[0];
  const alternatives = sortedInstances.slice(1, 4); // Top 3 alternatives

  // Calculate cost savings compared to largest suitable instance
  const largestInstance = suitableInstances
    .sort((a, b) => b.pricePerMonth - a.pricePerMonth)[0];
  const costSavings = largestInstance.pricePerMonth - recommended.pricePerMonth;

  return {
    recommended,
    alternatives,
    costSavings,
    overProvisioningPercent: recommended.overProvisioning
  };
}

/**
 * Calculate cost efficiency score για instance selection
 * Enterprise: Multi-factor efficiency calculation
 */
function calculateEfficiencyScore(
  instance: PricingTier,
  requirements: { cpu: number; memory: number; storage?: number }
): number {
  const cpuScore = requirements.cpu / instance.cpu;
  const memoryScore = requirements.memory / instance.memory;
  const storageScore = requirements.storage ?
    requirements.storage / (instance.storage || 1) : 1;

  // Weight factors: CPU 40%, Memory 40%, Storage 20%
  const utilizationScore = (cpuScore * 0.4 + memoryScore * 0.4 + storageScore * 0.2);

  // Cost efficiency (higher utilization / lower cost = better)
  return utilizationScore / instance.pricePerHour;
}

/**
 * Calculate over-provisioning percentage
 * Enterprise: Resource waste calculation
 */
function calculateOverProvisioning(
  instance: PricingTier,
  requirements: { cpu: number; memory: number; storage?: number }
): number {
  const cpuOver = ((instance.cpu - requirements.cpu) / requirements.cpu) * 100;
  const memoryOver = ((instance.memory - requirements.memory) / requirements.memory) * 100;

  // Return average over-provisioning
  return (cpuOver + memoryOver) / 2;
}

/**
 * Calculate multi-cloud cost comparison
 * Enterprise: Cross-provider cost analysis
 */
export function calculateMultiCloudCosts(
  requirements: {
    cpu: number;
    memory: number;
    storage?: number;
    monthlyHours?: number;
  },
  providers: CloudProvider[]
): {
  provider: string;
  recommendedInstance: PricingTier;
  monthlyCost: number;
  costBreakdown: {
    compute: number;
    storage: number;
    network: number;
    total: number;
  };
}[] {
  const monthlyHours = requirements.monthlyHours || 730; // Default: 24/7

  return providers.map(provider => {
    const computeTiers = provider.pricing.compute;
    const optimal = calculateOptimalInstance(requirements, computeTiers, provider.name);

    const computeCost = optimal.recommended.pricePerHour * monthlyHours;
    const storageCost = requirements.storage ?
      (provider.pricing.storage[0]?.pricePerMonth || 0) * (requirements.storage / 1024) : 0;
    const networkCost = provider.pricing.network[0]?.pricePerMonth || 0;

    return {
      provider: provider.name,
      recommendedInstance: optimal.recommended,
      monthlyCost: computeCost + storageCost + networkCost,
      costBreakdown: {
        compute: computeCost,
        storage: storageCost,
        network: networkCost,
        total: computeCost + storageCost + networkCost
      }
    };
  }).sort((a, b) => a.monthlyCost - b.monthlyCost);
}

/**
 * Calculate resource utilization metrics
 * Enterprise: Comprehensive utilization analysis
 */
export function calculateResourceUtilization(
  components: ComponentStatus[]
): ResourceMetrics {
  if (components.length === 0) {
    return getEmptyResourceMetrics();
  }

  // Aggregate metrics από all components
  const cpuUsages = components
    .map(c => c.metrics?.cpu)
    .filter(usage => usage !== undefined) as number[];

  const memoryUsages = components
    .map(c => c.metrics?.memory)
    .filter(usage => usage !== undefined) as number[];

  const diskUsages = components
    .map(c => c.metrics?.disk)
    .filter(usage => usage !== undefined) as number[];

  return {
    cpu: calculateUtilizationMetric(cpuUsages),
    memory: calculateUtilizationMetric(memoryUsages),
    storage: {
      used: components.reduce((sum, c) => sum + (c.metrics?.customMetrics?.totalSize || 0), 0),
      total: components.length * 1024 * 1024 * 1024 * 100, // 100GB per component estimate
      utilization: Math.min(diskUsages.reduce((sum, usage) => sum + usage, 0) / diskUsages.length || 0, 100),
      iops: 1000, // Simulated
      throughput: 50 // MB/s simulated
    },
    network: {
      inbound: components.reduce((sum, c) => sum + (c.metrics?.network?.inbound || 0), 0),
      outbound: components.reduce((sum, c) => sum + (c.metrics?.network?.outbound || 0), 0),
      connections: components.length * 50, // Estimate
      packetLoss: 0.01,
      latency: 25
    },
    instances: {
      total: components.length,
      running: components.filter(c => c.status === 'online').length,
      stopped: components.filter(c => c.status === 'offline').length,
      failed: components.filter(c => c.health === 'critical').length,
      utilization: cpuUsages.reduce((sum, usage) => sum + usage, 0) / cpuUsages.length || 0
    }
  };
}

/**
 * Calculate utilization metric από usage array
 * Enterprise: Statistical utilization calculation
 */
function calculateUtilizationMetric(usages: number[]): {
  current: number;
  average: number;
  peak: number;
  threshold: number;
  trending: 'up' | 'down' | 'stable';
} {
  if (usages.length === 0) {
    return {
      current: 0,
      average: 0,
      peak: 0,
      threshold: 80,
      trending: 'stable'
    };
  }

  const current = usages[usages.length - 1];
  const average = usages.reduce((sum, usage) => sum + usage, 0) / usages.length;
  const peak = Math.max(...usages);

  // Simple trending calculation
  const recent = usages.slice(-5);
  const older = usages.slice(-10, -5);
  const recentAvg = recent.reduce((sum, usage) => sum + usage, 0) / recent.length;
  const olderAvg = older.reduce((sum, usage) => sum + usage, 0) / older.length;

  let trending: 'up' | 'down' | 'stable' = 'stable';
  if (recentAvg > olderAvg * 1.1) {
    trending = 'up';
  } else if (recentAvg < olderAvg * 0.9) {
    trending = 'down';
  }

  return {
    current,
    average,
    peak,
    threshold: 80, // Default threshold
    trending
  };
}

/**
 * Calculate cost optimization recommendations
 * Enterprise: AI-driven cost optimization
 */
export function calculateCostOptimizations(
  components: ComponentStatus[],
  currentCosts: CostMetrics,
  providers: CloudProvider[]
): {
  totalSavings: number;
  recommendations: {
    type: 'rightsizing' | 'reserved-instances' | 'spot-instances' | 'storage-optimization';
    component: string;
    currentCost: number;
    optimizedCost: number;
    savings: number;
    description: string;
    effort: 'low' | 'medium' | 'high';
    confidence: number;
  }[];
} {
  const recommendations: any[] = [];

  // Rightsizing recommendations
  components.forEach(component => {
    if (component.metrics?.cpu && component.metrics.cpu < 30) {
      recommendations.push({
        type: 'rightsizing',
        component: component.name,
        currentCost: 50, // Estimated
        optimizedCost: 25, // Estimated
        savings: 25,
        description: `CPU utilization is ${component.metrics.cpu}%, consider downsizing`,
        effort: 'low',
        confidence: 85
      });
    }
  });

  // Reserved instances recommendations
  const runningInstances = components.filter(c => c.status === 'online');
  if (runningInstances.length > 0) {
    recommendations.push({
      type: 'reserved-instances',
      component: 'All running instances',
      currentCost: currentCosts.monthly,
      optimizedCost: currentCosts.monthly * 0.7, // 30% savings
      savings: currentCosts.monthly * 0.3,
      description: `Convert ${runningInstances.length} instances to reserved instances για 1-3 year terms`,
      effort: 'low',
      confidence: 90
    });
  }

  // Spot instances recommendations για non-critical workloads
  const nonCriticalComponents = components.filter(c =>
    c.type === 'compute-instance' && c.health === 'healthy'
  );
  if (nonCriticalComponents.length > 0) {
    recommendations.push({
      type: 'spot-instances',
      component: 'Non-critical workloads',
      currentCost: nonCriticalComponents.length * 50,
      optimizedCost: nonCriticalComponents.length * 15, // 70% savings
      savings: nonCriticalComponents.length * 35,
      description: `Use spot instances για ${nonCriticalComponents.length} non-critical workloads`,
      effort: 'medium',
      confidence: 75
    });
  }

  // Storage optimization
  const storageComponents = components.filter(c => c.type === 'storage-bucket');
  if (storageComponents.length > 0) {
    recommendations.push({
      type: 'storage-optimization',
      component: 'Storage buckets',
      currentCost: storageComponents.length * 20,
      optimizedCost: storageComponents.length * 12, // 40% savings
      savings: storageComponents.length * 8,
      description: `Implement lifecycle policies για automatic storage class transitions`,
      effort: 'low',
      confidence: 80
    });
  }

  const totalSavings = recommendations.reduce((sum, rec) => sum + rec.savings, 0);

  return {
    totalSavings,
    recommendations
  };
}

/**
 * Calculate auto-scaling recommendations
 * Enterprise: Intelligent scaling suggestions
 */
export function calculateScalingRecommendations(
  component: ComponentStatus,
  historicalMetrics: {
    timestamp: Date;
    cpu: number;
    memory: number;
    requests: number;
  }[]
): {
  recommendation: 'scale-up' | 'scale-down' | 'maintain';
  confidence: number;
  targetInstances: number;
  reasoning: string;
} {
  if (historicalMetrics.length < 10) {
    return {
      recommendation: 'maintain',
      confidence: 50,
      targetInstances: 1,
      reasoning: 'Insufficient historical data για scaling decision'
    };
  }

  // Analyze trends
  const recentMetrics = historicalMetrics.slice(-10);
  const avgCpu = recentMetrics.reduce((sum, m) => sum + m.cpu, 0) / recentMetrics.length;
  const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory, 0) / recentMetrics.length;
  const avgRequests = recentMetrics.reduce((sum, m) => sum + m.requests, 0) / recentMetrics.length;

  // Calculate peak utilization
  const peakCpu = Math.max(...recentMetrics.map(m => m.cpu));
  const peakMemory = Math.max(...recentMetrics.map(m => m.memory));

  // Scaling logic
  if (avgCpu > 75 || avgMemory > 80 || peakCpu > 90 || peakMemory > 95) {
    return {
      recommendation: 'scale-up',
      confidence: 85,
      targetInstances: Math.ceil(avgCpu / 60), // Target 60% CPU utilization
      reasoning: `High resource utilization: CPU ${avgCpu.toFixed(1)}%, Memory ${avgMemory.toFixed(1)}%`
    };
  } else if (avgCpu < 30 && avgMemory < 40 && peakCpu < 50) {
    return {
      recommendation: 'scale-down',
      confidence: 75,
      targetInstances: Math.max(1, Math.floor(avgCpu / 40)), // Target 40% minimum utilization
      reasoning: `Low resource utilization: CPU ${avgCpu.toFixed(1)}%, Memory ${avgMemory.toFixed(1)}%`
    };
  }

  return {
    recommendation: 'maintain',
    confidence: 90,
    targetInstances: 1,
    reasoning: `Optimal utilization: CPU ${avgCpu.toFixed(1)}%, Memory ${avgMemory.toFixed(1)}%`
  };
}

/**
 * Calculate regional latency optimization
 * Enterprise: Geographic optimization analysis
 */
export function calculateRegionalOptimization(
  userLocations: { region: string; userCount: number; avgLatency: number }[],
  availableRegions: { name: string; provider: string; latency: Record<string, number> }[]
): {
  recommendations: {
    region: string;
    provider: string;
    expectedLatencyImprovement: number;
    affectedUsers: number;
    estimatedCost: number;
  }[];
  totalLatencyImprovement: number;
} {
  const recommendations: any[] = [];

  userLocations.forEach(location => {
    if (location.avgLatency > 100) { // High latency threshold
      // Find best region για this location
      const bestRegion = availableRegions
        .map(region => ({
          ...region,
          expectedLatency: region.latency[location.region] || 999
        }))
        .sort((a, b) => a.expectedLatency - b.expectedLatency)[0];

      if (bestRegion && bestRegion.expectedLatency < location.avgLatency * 0.8) {
        recommendations.push({
          region: bestRegion.name,
          provider: bestRegion.provider,
          expectedLatencyImprovement: location.avgLatency - bestRegion.expectedLatency,
          affectedUsers: location.userCount,
          estimatedCost: 100 // Base estimate
        });
      }
    }
  });

  const totalLatencyImprovement = recommendations
    .reduce((sum, rec) => sum + rec.expectedLatencyImprovement, 0);

  return {
    recommendations,
    totalLatencyImprovement
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get empty resource metrics
 * Enterprise: Safe default values
 */
function getEmptyResourceMetrics(): ResourceMetrics {
  return {
    cpu: { current: 0, average: 0, peak: 0, threshold: 80, trending: 'stable' },
    memory: { current: 0, average: 0, peak: 0, threshold: 85, trending: 'stable' },
    storage: { used: 0, total: 0, utilization: 0, iops: 0, throughput: 0 },
    network: { inbound: 0, outbound: 0, connections: 0, packetLoss: 0, latency: 0 },
    instances: { total: 0, running: 0, stopped: 0, failed: 0, utilization: 0 }
  };
}