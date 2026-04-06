/**
 * PERFORMANCE PROFILER — ANALYSIS ENGINE
 * Geo-Alert System - Phase 7: Advanced Performance Profiling & Analysis
 *
 * Standalone functions for bottleneck detection, recommendations,
 * scoring, and trend analysis. Extracted from PerformanceProfiler.ts (ADR-065).
 */

import type {
  ProfileAnalysis,
  Bottleneck,
  PerformanceRecommendation,
  ProfileSession,
} from './performance-profiler-types';

// ============================================================================
// ANALYSIS INITIALIZATION
// ============================================================================

export function initializeAnalysis(): ProfileAnalysis {
  return {
    bottlenecks: [],
    recommendations: [],
    score: {
      overall: 0,
      rendering: 0,
      computation: 0,
      network: 0,
      userExperience: 0,
    },
    trends: {
      performance: 'stable',
      memory: 'stable',
      responsiveness: 'good',
    },
  };
}

// ============================================================================
// BOTTLENECK DETECTION
// ============================================================================

export async function detectBottlenecks(session: ProfileSession): Promise<Bottleneck[]> {
  const bottlenecks: Bottleneck[] = [];

  // Rendering bottlenecks
  if (session.metrics.rendering.frameRate.average < 30) {
    bottlenecks.push({
      type: 'rendering',
      severity: 'critical',
      description: `Low frame rate: ${session.metrics.rendering.frameRate.average.toFixed(1)} FPS`,
      impact: 1000 / session.metrics.rendering.frameRate.average - 16.67,
      frequency: session.metrics.rendering.frameRate.drops,
      affectedOperations: ['canvas rendering', 'animations', 'user interactions'],
      rootCause: 'Expensive rendering operations or layout thrashing',
      estimatedFix: 'Optimize rendering pipeline, reduce draw calls',
    });
  }

  // Computation bottlenecks
  if (session.metrics.computation.taskTiming.longestTask > 50) {
    bottlenecks.push({
      type: 'computation',
      severity: 'high',
      description: `Long running task: ${session.metrics.computation.taskTiming.longestTask.toFixed(2)}ms`,
      impact: session.metrics.computation.taskTiming.longestTask,
      frequency: 1,
      affectedOperations: ['DXF processing', 'spatial calculations'],
      rootCause: 'CPU-intensive algorithms blocking main thread',
      estimatedFix: 'Move heavy computation to Web Workers',
    });
  }

  // Network bottlenecks
  const slowResources = session.metrics.network.resources.filter((r) => r.duration > 1000);
  if (slowResources.length > 0) {
    bottlenecks.push({
      type: 'network',
      severity: 'medium',
      description: `Slow resource loading: ${slowResources.length} resources > 1s`,
      impact: slowResources.reduce((sum, r) => sum + r.duration, 0) / slowResources.length,
      frequency: slowResources.length,
      affectedOperations: ['initial load', 'feature loading'],
      rootCause: 'Large bundle sizes or slow network conditions',
      estimatedFix: 'Implement code splitting and resource optimization',
    });
  }

  // Memory bottlenecks
  if (session.metrics.memory.leaks.suspected > 0) {
    bottlenecks.push({
      type: 'memory',
      severity: 'high',
      description: `Memory leaks detected: ${session.metrics.memory.leaks.suspected} suspected`,
      impact: session.metrics.memory.leaks.impact,
      frequency: session.metrics.memory.leaks.suspected,
      affectedOperations: ['component lifecycle', 'event handling'],
      rootCause: 'Improper cleanup of event listeners or references',
      estimatedFix: 'Implement proper cleanup in useEffect hooks',
    });
  }

  return bottlenecks;
}

// ============================================================================
// RECOMMENDATION GENERATION
// ============================================================================

export async function generateRecommendations(
  session: ProfileSession
): Promise<PerformanceRecommendation[]> {
  const recommendations: PerformanceRecommendation[] = [];

  // Rendering optimizations
  if (session.metrics.rendering.frameRate.average < 60) {
    recommendations.push({
      category: 'optimization',
      priority: 'high',
      title: 'Optimize Rendering Performance',
      description: 'Implement rendering optimizations to achieve 60 FPS',
      implementation: 'Use requestAnimationFrame, implement object pooling, optimize shaders',
      expectedImprovement: 40,
      effort: 'medium',
      risk: 'low',
    });
  }

  // Code splitting recommendations
  const totalBundleSize = session.metrics.network.resources
    .filter((r) => r.type === 'script')
    .reduce((sum, r) => sum + r.size, 0);

  if (totalBundleSize > 1024 * 1024) {
    recommendations.push({
      category: 'architecture',
      priority: 'high',
      title: 'Implement Code Splitting',
      description: 'Reduce initial bundle size through code splitting',
      implementation: 'Use dynamic imports and route-based splitting',
      expectedImprovement: 30,
      effort: 'medium',
      risk: 'low',
    });
  }

  // Memory optimization
  if (session.metrics.memory.heap.used > 100 * 1024 * 1024) {
    recommendations.push({
      category: 'optimization',
      priority: 'medium',
      title: 'Optimize Memory Usage',
      description: 'Reduce memory footprint through better memory management',
      implementation: 'Implement object pooling, optimize data structures, add cleanup',
      expectedImprovement: 25,
      effort: 'high',
      risk: 'medium',
    });
  }

  return recommendations;
}

// ============================================================================
// PERFORMANCE SCORING
// ============================================================================

export function calculatePerformanceScores(session: ProfileSession): ProfileAnalysis['score'] {
  const renderingScore = Math.min(
    100,
    (session.metrics.rendering.frameRate.average / 60) * 100
  );

  const computationScore = Math.max(
    0,
    100 - (session.metrics.computation.taskTiming.averageTaskDuration / 50) * 100
  );

  const avgResourceTime =
    session.metrics.network.resources.length > 0
      ? session.metrics.network.resources.reduce((sum, r) => sum + r.duration, 0) /
        session.metrics.network.resources.length
      : 0;
  const networkScore = Math.max(0, 100 - (avgResourceTime / 1000) * 100);

  const uxScore = Math.max(
    0,
    100 -
      (session.metrics.userInteraction.responsiveness.averageResponseTime / 100) * 100
  );

  const overallScore =
    renderingScore * 0.3 +
    computationScore * 0.25 +
    networkScore * 0.25 +
    uxScore * 0.2;

  return {
    overall: Math.round(overallScore),
    rendering: Math.round(renderingScore),
    computation: Math.round(computationScore),
    network: Math.round(networkScore),
    userExperience: Math.round(uxScore),
  };
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

export function analyzeTrends(session: ProfileSession): ProfileAnalysis['trends'] {
  return {
    performance: session.analysis.score.overall > 80 ? 'stable' : 'degrading',
    memory: session.metrics.memory.leaks.suspected > 0 ? 'leaking' : 'stable',
    responsiveness:
      session.metrics.userInteraction.responsiveness.averageResponseTime < 100
        ? 'good'
        : 'poor',
  };
}
