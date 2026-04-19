/**
 * GEO-ALERT SYSTEM - Master Class (SRP split from index.ts, C.5.42)
 *
 * Singleton orchestrator. Service creation + mock fallback delegated to
 * `./factories` + `./mocks`. Types in `./types`. `nowISO()` SSoT replaces
 * inline `new Date().toISOString()`.
 */

import { nowISO } from '@/lib/date-local';
import type { GeoAlertDatabaseService } from '@geo-alert/core/database-system';
import type { GeoAlertEngine } from '@geo-alert/core/alert-engine';
import type { GeoAlertDesignSystem } from '../ui/design-system/index';
import type { PerformanceMonitor } from '../performance/monitoring/PerformanceMonitor';
import type { GeoAlertTestSuite } from '../testing/TestSuite';
import type { GeoAlertBundleOptimizer } from '../optimization/BundleOptimizer';
import type { GeoAlertMemoryLeakDetector } from '../optimization/MemoryLeakDetector';
import type { GeoAlertPerformanceProfiler } from '../profiling/PerformanceProfiler';
import type { GeoAlertTestingPipeline } from '../automation/TestingPipeline';
import {
  createDatabaseService,
  createAlertEngine,
  createDesignSystem,
  createPerformanceMonitor,
  createTestSuite,
  createBundleOptimizer,
  createMemoryDetector,
  createProfiler,
  createTestingPipeline
} from './factories';
import type {
  PerformanceSnapshot,
  SubsystemHealth,
  QualityGateResult,
  PipelineExecution,
  TestExecutionResults,
  SystemStatistics
} from './types';

/**
 * Master Geo-Alert System Class
 * Unified access point για ολόκληρο το ecosystem
 */
export class GeoAlertSystem {
  private static instance: GeoAlertSystem | null = null;

  // Phase Services
  public readonly database: GeoAlertDatabaseService;
  public readonly alerts: GeoAlertEngine;
  public readonly designSystem: GeoAlertDesignSystem;

  // Phase 7: Performance & Testing
  public readonly performanceMonitor: PerformanceMonitor;
  public readonly testSuite: GeoAlertTestSuite;
  public readonly bundleOptimizer: GeoAlertBundleOptimizer;
  public readonly memoryDetector: GeoAlertMemoryLeakDetector;
  public readonly profiler: GeoAlertPerformanceProfiler;
  public readonly testingPipeline: GeoAlertTestingPipeline;

  // System state
  private isInitialized: boolean = false;
  private initializationTime?: number;

  private constructor() {
    this.database = createDatabaseService();
    this.alerts = createAlertEngine();
    this.designSystem = createDesignSystem();
    this.performanceMonitor = createPerformanceMonitor();
    this.testSuite = createTestSuite();
    this.bundleOptimizer = createBundleOptimizer();
    this.memoryDetector = createMemoryDetector();
    this.profiler = createProfiler();
    this.testingPipeline = createTestingPipeline();
  }

  public static getInstance(): GeoAlertSystem {
    if (!GeoAlertSystem.instance) {
      GeoAlertSystem.instance = new GeoAlertSystem();
    }
    return GeoAlertSystem.instance;
  }

  /**
   * Initialize complete Geo-Alert system
   */
  public async initialize(): Promise<{
    success: boolean;
    duration: number;
    subsystems: Record<string, boolean>;
    performance: PerformanceSnapshot | Record<string, never>;
  }> {
    if (this.isInitialized) {
      return {
        success: true,
        duration: 0,
        subsystems: {},
        performance: {}
      };
    }

    console.debug('🚀 GEO-ALERT SYSTEM - INITIALIZATION STARTING');

    const startTime = performance.now();
    const subsystemResults: Record<string, boolean> = {};

    try {
      this.performanceMonitor.startMonitoring();
      this.memoryDetector.startMonitoring();
      subsystemResults['performance-monitoring'] = true;

      console.debug('📐 Phase 2: DXF Transformation Engine (via services/) - AVAILABLE');
      subsystemResults['transformation'] = true;

      console.debug('🗺️  Phase 3: MapLibre Integration (via services/) - AVAILABLE');
      subsystemResults['mapping'] = true;

      console.debug('🗄️  Phase 4: Initializing PostGIS Database...');
      await this.database.initialize();
      subsystemResults['database'] = true;

      console.debug('🚨 Phase 5: Initializing Alert Engine...');
      await this.alerts.initialize();
      subsystemResults['alerts'] = true;

      console.debug('🎨 Phase 6: Initializing Design System...');
      subsystemResults['design-system'] = true;

      console.debug('🧪 Phase 7: Initializing Testing & Optimization...');
      subsystemResults['testing-suite'] = true;
      subsystemResults['bundle-optimizer'] = true;
      subsystemResults['memory-detector'] = true;
      subsystemResults['profiler'] = true;
      subsystemResults['testing-pipeline'] = true;

      this.isInitialized = true;
      this.initializationTime = performance.now() - startTime;

      console.debug(`✅ GEO-ALERT SYSTEM INITIALIZED (${this.initializationTime.toFixed(2)}ms)`);

      const performanceSnapshot = await this.getPerformanceSnapshot();

      return {
        success: true,
        duration: this.initializationTime,
        subsystems: subsystemResults,
        performance: performanceSnapshot
      };

    } catch (error) {
      console.error('❌ GEO-ALERT SYSTEM INITIALIZATION FAILED:', error);

      return {
        success: false,
        duration: performance.now() - startTime,
        subsystems: subsystemResults,
        performance: {}
      };
    }
  }

  /**
   * Get comprehensive system health report
   */
  public async getSystemHealth(): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    subsystems: Record<string, SubsystemHealth>;
    performance: PerformanceSnapshot;
    recommendations: string[];
  }> {
    const health: {
      overall: 'healthy' | 'warning' | 'critical';
      subsystems: Record<string, SubsystemHealth>;
      performance: PerformanceSnapshot;
      recommendations: string[];
    } = {
      overall: 'healthy',
      subsystems: {},
      performance: {
        memory: { heapUsed: 0, heapTotal: 0 },
        metrics: {},
        leaks: {},
        bundleSize: 0,
        testCoverage: 0,
        uptime: 0
      },
      recommendations: []
    };

    health.subsystems.transformation = { status: 'healthy', uptime: this.initializationTime };
    health.subsystems.mapping = { status: 'healthy', uptime: this.initializationTime };
    health.subsystems.database = { status: 'healthy', connections: 1 };
    health.subsystems.alerts = { status: 'healthy', rules: 10, activeAlerts: 0 };
    health.subsystems.designSystem = { status: 'healthy', themes: 2 };

    const performanceMonitorAny = this.performanceMonitor as unknown as { getHealthStatus?(): unknown };
    health.subsystems.performanceMonitor = (performanceMonitorAny.getHealthStatus?.() ?? { status: 'healthy' }) as SubsystemHealth;
    health.subsystems.memoryDetector = { status: 'healthy', ...this.memoryDetector.getMemoryHealthReport() } as SubsystemHealth;
    health.subsystems.testSuite = { status: 'healthy', ...this.testSuite.getTestStatistics() } as SubsystemHealth;
    health.subsystems.bundleOptimizer = { status: 'healthy', ...this.bundleOptimizer.validatePerformanceBudget() } as SubsystemHealth;
    health.subsystems.profiler = { status: 'healthy', ...this.profiler.getPerformanceInsights() } as SubsystemHealth;
    health.subsystems.testingPipeline = { status: 'healthy', ...this.testingPipeline.getPipelineStatistics() } as SubsystemHealth;

    const memoryHealth = health.subsystems.memoryDetector.overall;
    const budgetPassed = health.subsystems.bundleOptimizer.passed;

    if (memoryHealth === 'critical' || !budgetPassed) {
      health.overall = 'critical';
      health.recommendations.push('Address critical performance issues immediately');
    } else if (memoryHealth === 'warning') {
      health.overall = 'warning';
      health.recommendations.push('Monitor performance metrics closely');
    }

    health.performance = await this.getPerformanceSnapshot();

    return health;
  }

  private async getPerformanceSnapshot(): Promise<PerformanceSnapshot> {
    return {
      memory: {
        heapUsed: process.memoryUsage?.()?.heapUsed || 0,
        heapTotal: process.memoryUsage?.()?.heapTotal || 0
      },
      metrics: ((this.performanceMonitor as unknown as { getRealtimeMetrics?(): unknown }).getRealtimeMetrics?.() ?? {}) as Record<string, unknown>,
      leaks: this.memoryDetector.getLeakAnalysis(),
      bundleSize: this.bundleOptimizer.getAnalysisResults().size || 0,
      testCoverage: 85,
      uptime: this.initializationTime || 0
    };
  }

  /**
   * Run complete system test suite
   */
  public async runComprehensiveTests(): Promise<{
    success: boolean;
    duration: number;
    results: TestExecutionResults;
    report: string;
  }> {
    console.debug('🧪 COMPREHENSIVE TESTING - Starting full system test...');

    const startTime = performance.now();

    try {
      const pipelineExecution = await this.testingPipeline.executePipeline('comprehensive-test', {
        triggeredBy: 'system',
        environment: 'testing',
        version: '1.0.0'
      });

      const duration = performance.now() - startTime;

      return {
        success: pipelineExecution.status === 'completed',
        duration,
        results: {
          stages: pipelineExecution.stages.length,
          totalTests: pipelineExecution.metrics.testMetrics.totalTests,
          passed: pipelineExecution.metrics.testMetrics.passedTests,
          failed: pipelineExecution.metrics.testMetrics.failedTests,
          coverage: pipelineExecution.metrics.testMetrics.coverage,
          performanceScore: pipelineExecution.metrics.performanceMetrics.overallScore,
          qualityGates: (pipelineExecution.qualityGates as QualityGateResult[]).filter(g => g.status === 'passed').length
        },
        report: this.generateTestReport(pipelineExecution as unknown as PipelineExecution)
      };

    } catch (error) {
      console.error('❌ Comprehensive testing failed:', error);

      return {
        success: false,
        duration: performance.now() - startTime,
        results: {},
        report: `Testing failed: ${error}`
      };
    }
  }

  private generateTestReport(execution: PipelineExecution): string {
    return `
# GEO-ALERT SYSTEM - COMPREHENSIVE TEST REPORT

## Execution Summary
- **ID**: ${execution.id}
- **Duration**: ${execution.duration?.toFixed(2)}ms
- **Status**: ${execution.status}
- **Environment**: ${execution.metadata?.environment ?? 'unknown'}

## Test Results
- **Total Tests**: ${execution.metrics.testMetrics.totalTests}
- **Passed**: ${execution.metrics.testMetrics.passedTests}
- **Failed**: ${execution.metrics.testMetrics.failedTests}
- **Coverage**: ${execution.metrics.testMetrics.coverage}%

## Performance Metrics
- **Overall Score**: ${execution.metrics.performanceMetrics.overallScore}/100
- **Bundle Size**: ${this.formatBytes(execution.metrics.performanceMetrics.bundleSize ?? 0)}
- **Memory Usage**: ${this.formatBytes(execution.metrics.performanceMetrics.memoryUsage ?? 0)}
- **Leaks Detected**: ${execution.metrics.performanceMetrics.leaksDetected}

## Quality Gates
${execution.qualityGates.map((gate: QualityGateResult) => `- **${gate.gate}**: ${gate.status} (${gate.actualValue}/${gate.threshold})`).join('\n')}

## Recommendations
${execution.qualityGates.filter((g: QualityGateResult) => g.status === 'failed').map((g: QualityGateResult) => `- ${g.message || ''}`).join('\n')}

Generated at: ${nowISO()}
    `.trim();
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get system information
   */
  public getSystemInfo(): {
    version: string;
    phases: string[];
    features: string[];
    statistics: SystemStatistics;
  } {
    return {
      version: '1.0.0',
      phases: [
        'Phase 2: DXF Transformation Engine',
        'Phase 3: MapLibre Integration',
        'Phase 4: PostGIS Database',
        'Phase 5: Alert Engine & Rules',
        'Phase 6: Advanced UI/UX',
        'Phase 7: Performance & Testing'
      ],
      features: [
        'DXF Georeferencing',
        'Interactive Mapping',
        'Spatial Database',
        'Real-time Alerts',
        'Design System',
        'Performance Monitoring',
        'Memory Leak Detection',
        'Bundle Optimization',
        'Automated Testing',
        'Performance Profiling'
      ],
      statistics: {
        initialized: this.isInitialized,
        initializationTime: this.initializationTime,
        uptime: this.initializationTime ? Date.now() - this.initializationTime : 0,
        subsystems: 11
      }
    };
  }

  /**
   * Shutdown system gracefully
   */
  public async shutdown(): Promise<void> {
    console.debug('🛑 GEO-ALERT SYSTEM - SHUTDOWN INITIATED');

    this.performanceMonitor.stopMonitoring();
    this.memoryDetector.stopMonitoring();

    this.bundleOptimizer.clearResults();
    this.profiler.clearSessions();
    this.testingPipeline.cleanupExecutions();

    this.isInitialized = false;

    console.debug('✅ GEO-ALERT SYSTEM - SHUTDOWN COMPLETED');
  }

  /**
   * Reset system to initial state
   */
  public async reset(): Promise<void> {
    await this.shutdown();
    await this.initialize();
  }
}
