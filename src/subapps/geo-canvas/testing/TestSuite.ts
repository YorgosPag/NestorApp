/**
 * COMPREHENSIVE TESTING SUITE
 * Geo-Alert System - Phase 7: Complete Testing Framework
 *
 * Enterprise-class testing framework που καλύπτει όλους τους subsystems
 * από τις Phases 2-6 με automated testing pipeline.
 *
 * Split per ADR-065 (SRP compliance):
 * - test-suite-types.ts — All type definitions
 * - test-suite-phase2-3-tests.ts — Transformation + Mapping tests
 * - test-suite-phase4-5-tests.ts — Database + Alerts tests
 * - test-suite-phase6-7-e2e-tests.ts — UI + Performance + Integration/E2E tests
 * - test-suite-reporting.ts — Report generation
 */

import { performance } from 'perf_hooks';

// Test function imports — Phase 2 & 3
import {
  testAffineTransformation,
  testControlPointValidation,
  testTransformationAccuracy,
  testTransformationEdgeCases,
  testCoordinatePicker,
  testBasemapLayers,
  testRealTimePreview,
  testViewportSync
} from './test-suite-phase2-3-tests';

// Test function imports — Phase 4 & 5
import {
  testDatabaseConnection,
  testSpatialQueries,
  testRepositoryPattern,
  testMigrationSystem,
  testRulesEngine,
  testDetectionSystem,
  testNotificationDispatch,
  testRealTimeMonitoring
} from './test-suite-phase4-5-tests';

// Test function imports — Phase 6, 7 & E2E
import {
  testDesignTokens,
  testThemeSystem,
  testResponsiveDashboard,
  testPerformanceComponents,
  testPerformanceMonitoring,
  testMemoryManagement,
  testRenderOptimization,
  testBundleAnalysis,
  testFullWorkflow,
  testCrossSystemIntegration,
  testErrorHandling,
  testDxfToMapWorkflow,
  testAlertLifecycle,
  testUserInteractionFlow
} from './test-suite-phase6-7-e2e-tests';

// Reporting imports
import {
  generateTestReport,
  generateCSVReport,
  generateHTMLReport,
  calculateOverallCoverage
} from './test-suite-reporting';

import type {
  TestResult,
  TestCategory,
  TestSuiteConfig,
  TestContext
} from './test-suite-types';

// Re-export all types for consumers
export type * from './test-suite-types';

// ============================================================================
// MAIN TEST SUITE CLASS
// ============================================================================

/**
 * Comprehensive Test Suite - Enterprise Testing Framework
 * Singleton pattern για centralized testing across όλο το Geo-Alert system
 */
export class GeoAlertTestSuite {
  private static instance: GeoAlertTestSuite | null = null;
  private config: TestSuiteConfig;
  private context: TestContext;
  private tests: Map<string, () => Promise<TestResult>> = new Map();

  private constructor() {
    this.config = this.getDefaultConfig();
    this.context = this.createInitialContext();
    this.registerAllTests();
  }

  public static getInstance(): GeoAlertTestSuite {
    if (!GeoAlertTestSuite.instance) {
      GeoAlertTestSuite.instance = new GeoAlertTestSuite();
    }
    return GeoAlertTestSuite.instance;
  }

  // ========================================================================
  // CONFIGURATION
  // ========================================================================

  private getDefaultConfig(): TestSuiteConfig {
    return {
      enableParallel: true,
      timeout: 30000,
      retryCount: 2,
      coverage: { enabled: true, threshold: 85 },
      performance: { maxDuration: 5000, memoryThreshold: 100 * 1024 * 1024 },
      categories: ['transformation', 'mapping', 'database', 'alerts', 'ui', 'performance', 'integration', 'e2e'],
      mockMode: true
    };
  }

  private createInitialContext(): TestContext {
    return {
      startTime: Date.now(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      warningTests: 0,
      totalDuration: 0,
      coverage: 0,
      results: []
    };
  }

  // ========================================================================
  // TEST REGISTRATION
  // ========================================================================

  private registerAllTests(): void {
    // Phase 2: DXF Transformation Engine
    this.registerTest('transformation-affine-matrix', testAffineTransformation);
    this.registerTest('transformation-control-points', testControlPointValidation);
    this.registerTest('transformation-accuracy', testTransformationAccuracy);
    this.registerTest('transformation-edge-cases', testTransformationEdgeCases);

    // Phase 3: MapLibre Integration
    this.registerTest('mapping-coordinate-picker', testCoordinatePicker);
    this.registerTest('mapping-basemap-layers', testBasemapLayers);
    this.registerTest('mapping-real-time-preview', testRealTimePreview);
    this.registerTest('mapping-viewport-synchronization', testViewportSync);

    // Phase 4: PostGIS Database
    this.registerTest('database-connection', testDatabaseConnection);
    this.registerTest('database-spatial-queries', testSpatialQueries);
    this.registerTest('database-repository-pattern', testRepositoryPattern);
    this.registerTest('database-migration-system', testMigrationSystem);

    // Phase 5: Alert Engine
    this.registerTest('alerts-rules-engine', testRulesEngine);
    this.registerTest('alerts-detection-system', testDetectionSystem);
    this.registerTest('alerts-notification-dispatch', testNotificationDispatch);
    this.registerTest('alerts-real-time-monitoring', testRealTimeMonitoring);

    // Phase 6: Design System
    this.registerTest('ui-design-tokens', testDesignTokens);
    this.registerTest('ui-theme-system', testThemeSystem);
    this.registerTest('ui-responsive-dashboard', testResponsiveDashboard);
    this.registerTest('ui-performance-components', testPerformanceComponents);

    // Phase 7: Performance
    this.registerTest('performance-monitoring', testPerformanceMonitoring);
    this.registerTest('performance-memory-management', testMemoryManagement);
    this.registerTest('performance-render-optimization', testRenderOptimization);
    this.registerTest('performance-bundle-analysis', testBundleAnalysis);

    // Integration Tests
    this.registerTest('integration-full-workflow', testFullWorkflow);
    this.registerTest('integration-cross-system', testCrossSystemIntegration);
    this.registerTest('integration-error-handling', testErrorHandling);

    // End-to-End Tests
    this.registerTest('e2e-dxf-to-map-workflow', testDxfToMapWorkflow);
    this.registerTest('e2e-alert-lifecycle', testAlertLifecycle);
    this.registerTest('e2e-user-interaction', testUserInteractionFlow);
  }

  private registerTest(name: string, testFunction: () => Promise<TestResult>): void {
    this.tests.set(name, testFunction);
  }

  // ========================================================================
  // TEST EXECUTION ENGINE
  // ========================================================================

  public async runAllTests(): Promise<TestContext> {
    console.log('🧪 GEO-ALERT TESTING SUITE - PHASE 7');
    console.log('=====================================');

    this.context = this.createInitialContext();
    this.context.totalTests = this.tests.size;

    const testPromises: Promise<TestResult>[] = [];

    for (const [testName, testFunction] of this.tests.entries()) {
      if (this.config.enableParallel) {
        testPromises.push(this.executeTest(testName, testFunction));
      } else {
        const result = await this.executeTest(testName, testFunction);
        this.processTestResult(result);
      }
    }

    if (this.config.enableParallel && testPromises.length > 0) {
      const results = await Promise.allSettled(testPromises);
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          this.processTestResult(result.value);
        }
      });
    }

    this.context.totalDuration = Date.now() - this.context.startTime;
    generateTestReport(this.context, this.config);

    return this.context;
  }

  private async executeTest(testName: string, testFunction: () => Promise<TestResult>): Promise<TestResult> {
    const startTime = performance.now();

    try {
      const result = await Promise.race([
        testFunction(),
        this.createTimeoutPromise(testName)
      ]);

      result.duration = performance.now() - startTime;
      return result;
    } catch (error) {
      return {
        testName,
        category: 'integration',
        status: 'failed',
        duration: performance.now() - startTime,
        details: `Test execution failed: ${error}`,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: { phase: 'unknown', subsystem: 'test-framework', priority: 'high', coverage: 0 }
      };
    }
  }

  private createTimeoutPromise(testName: string): Promise<TestResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Test ${testName} timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  private processTestResult(result: TestResult): void {
    this.context.results.push(result);

    switch (result.status) {
      case 'passed': this.context.passedTests++; break;
      case 'failed': this.context.failedTests++; break;
      case 'skipped': this.context.skippedTests++; break;
      case 'warning': this.context.warningTests++; break;
    }
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  public async runTestCategory(category: TestCategory): Promise<TestResult[]> {
    const categoryTests = Array.from(this.tests.entries())
      .filter(([name]) => name.startsWith(category));

    const results: TestResult[] = [];
    for (const [testName, testFunction] of categoryTests) {
      const result = await this.executeTest(testName, testFunction);
      results.push(result);
    }

    return results;
  }

  public async runSingleTest(testName: string): Promise<TestResult | null> {
    const testFunction = this.tests.get(testName);
    if (!testFunction) return null;
    return await this.executeTest(testName, testFunction);
  }

  public getTestStatistics(): {
    totalTests: number;
    categoryCounts: Record<TestCategory, number>;
    priorityCounts: Record<string, number>;
  } {
    const categoryCounts = {} as Record<TestCategory, number>;
    const priorityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    this.config.categories.forEach(category => {
      categoryCounts[category] = 0;
    });

    this.context.results.forEach(result => {
      categoryCounts[result.category]++;
      priorityCounts[result.metadata.priority]++;
    });

    return { totalTests: this.tests.size, categoryCounts, priorityCounts };
  }

  public exportResults(format: 'json' | 'csv' | 'html' = 'json'): string {
    switch (format) {
      case 'json': return JSON.stringify(this.context, null, 2);
      case 'csv': return generateCSVReport(this.context);
      case 'html': return generateHTMLReport(this.context);
      default: return JSON.stringify(this.context, null, 2);
    }
  }
}

// ============================================================================
// GLOBAL EXPORTS & UTILITIES
// ============================================================================

export const geoAlertTestSuite = GeoAlertTestSuite.getInstance();
export const runAllTests = () => geoAlertTestSuite.runAllTests();
export const runPhaseTests = (phase: TestCategory) => geoAlertTestSuite.runTestCategory(phase);
export const getTestStats = () => geoAlertTestSuite.getTestStatistics();

export default geoAlertTestSuite;
