/**
 * GEO-ALERT SYSTEM - Mock Implementations (SRP split from index.ts, C.5.42)
 * Type-safe enterprise mocks used as fallback when `getInstance()` unavailable.
 */

import type { GeoAlertDatabaseService } from '@geo-alert/core/database-system';
import type { GeoAlertEngine } from '@geo-alert/core/alert-engine';
import type { GeoAlertDesignSystem } from '../ui/design-system/index';
import type { PerformanceMonitor } from '../performance/monitoring/PerformanceMonitor';
import type { GeoAlertTestSuite } from '../testing/TestSuite';
import type { GeoAlertBundleOptimizer } from '../optimization/BundleOptimizer';
import type { GeoAlertMemoryLeakDetector } from '../optimization/MemoryLeakDetector';
import type { GeoAlertPerformanceProfiler } from '../profiling/PerformanceProfiler';
import type { GeoAlertTestingPipeline } from '../automation/TestingPipeline';

export function createMockDatabaseService(): GeoAlertDatabaseService {
  return {
    initialize: () => Promise.resolve(),
    isConnected: () => true,
    query: () => Promise.resolve([]),
    close: () => Promise.resolve()
  } as unknown as GeoAlertDatabaseService;
}

export function createMockAlertEngine(): GeoAlertEngine {
  return {
    initialize: () => Promise.resolve(),
    isActive: () => true,
    getAlerts: () => [],
    addRule: () => Promise.resolve('mock-rule'),
    removeRule: () => Promise.resolve(),
    clearRules: () => Promise.resolve()
  } as unknown as GeoAlertEngine;
}

export function createMockDesignSystem(): GeoAlertDesignSystem {
  return {
    initialize: () => Promise.resolve(),
    getTheme: () => 'light',
    setTheme: () => void 0,
    getColors: () => ({}),
    getTypography: () => ({})
  } as unknown as GeoAlertDesignSystem;
}

export function createMockPerformanceMonitor(): PerformanceMonitor {
  return {
    startMonitoring: () => void 0,
    stopMonitoring: () => void 0,
    getRealtimeMetrics: () => ({}),
    getHealthStatus: () => ({ status: 'healthy' })
  } as unknown as PerformanceMonitor;
}

export function createMockTestSuite(): GeoAlertTestSuite {
  return {
    getInstance: () => createMockTestSuite(),
    getTestStatistics: () => ({ total: 0, passed: 0, failed: 0 }),
    runTests: () => Promise.resolve({ success: true, results: [] })
  } as unknown as GeoAlertTestSuite;
}

export function createMockBundleOptimizer(): GeoAlertBundleOptimizer {
  return {
    getInstance: () => createMockBundleOptimizer(),
    validatePerformanceBudget: () => ({ passed: true, results: [] }),
    getAnalysisResults: () => ({ size: 0, modules: [] }),
    clearResults: () => void 0
  } as unknown as GeoAlertBundleOptimizer;
}

export function createMockMemoryDetector(): GeoAlertMemoryLeakDetector {
  return {
    getInstance: () => createMockMemoryDetector(),
    startMonitoring: () => void 0,
    stopMonitoring: () => void 0,
    getMemoryHealthReport: () => ({ overall: 'healthy', leaks: [] }),
    getLeakAnalysis: () => ({ detected: false, count: 0 })
  } as unknown as GeoAlertMemoryLeakDetector;
}

export function createMockProfiler(): GeoAlertPerformanceProfiler {
  return {
    getInstance: () => createMockProfiler(),
    getPerformanceInsights: () => ({ score: 100, recommendations: [] }),
    clearSessions: () => void 0,
    startProfiling: () => 'mock-session'
  } as unknown as GeoAlertPerformanceProfiler;
}

export function createMockTestingPipeline(): GeoAlertTestingPipeline {
  return {
    getInstance: () => createMockTestingPipeline(),
    executePipeline: () => Promise.resolve({
      id: 'mock',
      status: 'completed',
      stages: [],
      metrics: { testMetrics: { totalTests: 0, passedTests: 0, failedTests: 0, coverage: 100 }, performanceMetrics: { overallScore: 100 } },
      qualityGates: [],
      duration: 0
    }),
    getPipelineStatistics: () => ({ executed: 0, passed: 0, failed: 0 }),
    cleanupExecutions: () => void 0
  } as unknown as GeoAlertTestingPipeline;
}
