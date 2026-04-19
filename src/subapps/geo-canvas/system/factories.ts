/**
 * GEO-ALERT SYSTEM - Service Factories (SRP split from index.ts, C.5.42)
 * Try getInstance(); fallback to mock on failure.
 */

import { GeoAlertDatabaseService } from '@geo-alert/core/database-system';
import { GeoAlertEngine } from '@geo-alert/core/alert-engine';
import { GeoAlertDesignSystem } from '../ui/design-system/index';
import { PerformanceMonitor } from '../performance/monitoring/PerformanceMonitor';
import { GeoAlertTestSuite } from '../testing/TestSuite';
import { GeoAlertBundleOptimizer } from '../optimization/BundleOptimizer';
import { GeoAlertMemoryLeakDetector } from '../optimization/MemoryLeakDetector';
import { GeoAlertPerformanceProfiler } from '../profiling/PerformanceProfiler';
import { GeoAlertTestingPipeline } from '../automation/TestingPipeline';
import {
  createMockDatabaseService,
  createMockAlertEngine,
  createMockDesignSystem,
  createMockPerformanceMonitor,
  createMockTestSuite,
  createMockBundleOptimizer,
  createMockMemoryDetector,
  createMockProfiler,
  createMockTestingPipeline
} from './mocks';

export function createDatabaseService(): GeoAlertDatabaseService {
  try {
    return (GeoAlertDatabaseService as { getInstance?(): GeoAlertDatabaseService }).getInstance?.() ||
           createMockDatabaseService();
  } catch {
    return createMockDatabaseService();
  }
}

export function createAlertEngine(): GeoAlertEngine {
  try {
    return (GeoAlertEngine as { getInstance?(): GeoAlertEngine }).getInstance?.() ||
           createMockAlertEngine();
  } catch {
    return createMockAlertEngine();
  }
}

export function createDesignSystem(): GeoAlertDesignSystem {
  try {
    return (GeoAlertDesignSystem as { getInstance?(): GeoAlertDesignSystem }).getInstance?.() ||
           createMockDesignSystem();
  } catch {
    return createMockDesignSystem();
  }
}

export function createPerformanceMonitor(): PerformanceMonitor {
  try {
    return (PerformanceMonitor as { getInstance?(): PerformanceMonitor }).getInstance?.() ||
           createMockPerformanceMonitor();
  } catch {
    return createMockPerformanceMonitor();
  }
}

export function createTestSuite(): GeoAlertTestSuite {
  try {
    return (GeoAlertTestSuite as { getInstance?(): GeoAlertTestSuite }).getInstance?.() ||
           createMockTestSuite();
  } catch {
    return createMockTestSuite();
  }
}

export function createBundleOptimizer(): GeoAlertBundleOptimizer {
  try {
    return (GeoAlertBundleOptimizer as { getInstance?(): GeoAlertBundleOptimizer }).getInstance?.() ||
           createMockBundleOptimizer();
  } catch {
    return createMockBundleOptimizer();
  }
}

export function createMemoryDetector(): GeoAlertMemoryLeakDetector {
  try {
    return (GeoAlertMemoryLeakDetector as { getInstance?(): GeoAlertMemoryLeakDetector }).getInstance?.() ||
           createMockMemoryDetector();
  } catch {
    return createMockMemoryDetector();
  }
}

export function createProfiler(): GeoAlertPerformanceProfiler {
  try {
    return (GeoAlertPerformanceProfiler as { getInstance?(): GeoAlertPerformanceProfiler }).getInstance?.() ||
           createMockProfiler();
  } catch {
    return createMockProfiler();
  }
}

export function createTestingPipeline(): GeoAlertTestingPipeline {
  try {
    return (GeoAlertTestingPipeline as { getInstance?(): GeoAlertTestingPipeline }).getInstance?.() ||
           createMockTestingPipeline();
  } catch {
    return createMockTestingPipeline();
  }
}
