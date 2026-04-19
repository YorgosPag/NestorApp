/**
 * GEO-ALERT SYSTEM - Type Definitions (SRP split from index.ts, C.5.42)
 * ADR-compliant — NO any
 */

/**
 * Performance snapshot data
 */
export interface PerformanceSnapshot {
  memory: {
    heapUsed: number;
    heapTotal: number;
  };
  metrics: Record<string, unknown>;
  leaks: Record<string, unknown>;
  bundleSize: number;
  testCoverage: number;
  uptime: number;
}

/**
 * Subsystem health status
 */
export interface SubsystemHealth {
  status: string;
  uptime?: number;
  connections?: number;
  rules?: number;
  activeAlerts?: number;
  themes?: number;
  overall?: string;
  passed?: boolean;
  results?: unknown[];
}

/**
 * Quality gate result
 */
export interface QualityGateResult {
  gate: string;
  status: 'passed' | 'failed';
  actualValue: number;
  threshold: number;
  message?: string;
}

/**
 * Pipeline execution result
 */
export interface PipelineExecution {
  id: string;
  status: string;
  stages: unknown[];
  metrics: {
    testMetrics: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      coverage: number;
    };
    performanceMetrics: {
      overallScore: number;
      bundleSize?: number;
      memoryUsage?: number;
      leaksDetected?: number;
    };
  };
  qualityGates: QualityGateResult[];
  duration?: number;
  metadata?: {
    environment?: string;
  };
}

/**
 * Test execution results
 */
export interface TestExecutionResults {
  stages?: number;
  totalTests?: number;
  passed?: number;
  failed?: number;
  coverage?: number;
  performanceScore?: number;
  qualityGates?: number;
}

/**
 * System statistics
 */
export interface SystemStatistics {
  initialized: boolean;
  initializationTime?: number;
  uptime: number;
  subsystems: number;
}
