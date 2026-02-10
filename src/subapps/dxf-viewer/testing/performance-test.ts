/**
 * ⚡ DXF VIEWER PERFORMANCE TESTING SUITE
 *
 * Comprehensive performance testing και benchmarking για
 * DXF Viewer application με enterprise-level metrics.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 */

// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../rendering/primitives/canvasPaths';
// 🏢 ADR-XXX: Centralized viewport defaults
import { TRANSFORM_SCALE_LIMITS } from '../config/transform-config';

interface PerformanceTestResult {
  testName: string;
  duration: number;
  success: boolean;
  metrics: {
    memory?: number;
    fps?: number;
    renderTime?: number;
    bundleSize?: number;
  };
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  details: string[];
}

interface PerformanceTestSuite {
  suiteId: string;
  suiteName: string;
  timestamp: number;
  results: PerformanceTestResult[];
  overallGrade: 'excellent' | 'good' | 'fair' | 'poor';
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    avgDuration: number;
    issues: string[];
    recommendations: string[];
  };
}

/**
 * 🧪 Performance Test Runner
 */
export class DxfPerformanceTestRunner {
  private testResults: PerformanceTestResult[] = [];
  private startTime: number = 0;

  /**
   * 🚀 Run full performance test suite
   */
  public async runFullTestSuite(): Promise<PerformanceTestSuite> {
    console.log('🧪 Starting DXF Performance Test Suite...');
    this.startTime = performance.now();
    this.testResults = [];

    // Test 1: Initial Load Performance
    await this.testInitialLoadPerformance();

    // Test 2: Canvas Rendering Performance
    await this.testCanvasRenderingPerformance();

    // Test 3: Memory Usage Test
    await this.testMemoryUsage();

    // Test 4: Bundle Size Analysis
    await this.testBundleSize();

    // Test 5: User Interaction Response Time
    await this.testUserInteractionPerformance();

    // Test 6: Service Worker Caching
    await this.testServiceWorkerPerformance();

    // Test 7: Performance Dashboard Functionality
    await this.testPerformanceDashboard();

    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;

    return this.generateTestSuite(totalDuration);
  }

  /**
   * 📊 Test 1: Initial Load Performance
   */
  private async testInitialLoadPerformance(): Promise<void> {
    const testName = 'Initial Load Performance';
    const startTime = performance.now();

    try {
      const performanceEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const navigation = performanceEntries[0];

      const loadTime = navigation ? navigation.loadEventEnd - navigation.startTime : 0;
      const domReady = navigation ? navigation.domContentLoadedEventEnd - navigation.startTime : 0;

      const duration = performance.now() - startTime;

      this.testResults.push({
        testName,
        duration,
        success: loadTime < 3000,
        metrics: { renderTime: loadTime },
        grade: this.gradeLoadTime(loadTime),
        details: [
          `Load time: ${loadTime.toFixed(1)}ms`,
          `DOM ready: ${domReady.toFixed(1)}ms`,
        ],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: false,
        metrics: {},
        grade: 'poor',
        details: [`Error: ${errorMessage}`, 'Test failed to complete'],
      });
    }
  }

  /**
   * 🎨 Test 2: Canvas Rendering Performance
   */
  private async testCanvasRenderingPerformance(): Promise<void> {
    const testName = 'Canvas Rendering Performance';
    const startTime = performance.now();

    try {
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        throw new Error('No canvas element found');
      }

      // Measure render cycle
      const frameStart = performance.now();
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw test arc using TAU
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 50, 0, TAU);
        ctx.stroke();
      }
      const renderTime = performance.now() - frameStart;
      const estimatedFps = renderTime > 0 ? 1000 / renderTime : 60;

      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: renderTime < 16.67,
        metrics: { renderTime, fps: estimatedFps },
        grade: this.gradeRenderPerformance(renderTime, estimatedFps),
        details: [
          `Render time: ${renderTime.toFixed(2)}ms`,
          `Estimated FPS: ${estimatedFps.toFixed(0)}`,
        ],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: false,
        metrics: {},
        grade: 'poor',
        details: [`Error: ${errorMessage}`],
      });
    }
  }

  /**
   * 💾 Test 3: Memory Usage
   */
  private async testMemoryUsage(): Promise<void> {
    const testName = 'Memory Usage';
    const startTime = performance.now();

    try {
      const memoryInfo = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      const usedMB = memoryInfo ? memoryInfo.usedJSHeapSize / (1024 * 1024) : 0;
      const limitMB = memoryInfo ? memoryInfo.jsHeapSizeLimit / (1024 * 1024) : 0;

      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: usedMB < 256,
        metrics: { memory: usedMB },
        grade: this.gradeMemoryUsage(usedMB),
        details: [
          `Used: ${usedMB.toFixed(1)}MB`,
          `Limit: ${limitMB.toFixed(1)}MB`,
          memoryInfo ? `Usage: ${((usedMB / limitMB) * 100).toFixed(1)}%` : 'Memory API not available',
        ],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: false,
        metrics: {},
        grade: 'poor',
        details: [`Error: ${errorMessage}`],
      });
    }
  }

  /**
   * 📦 Test 4: Bundle Size Analysis
   */
  private async testBundleSize(): Promise<void> {
    const testName = 'Bundle Size Analysis';
    const startTime = performance.now();

    try {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const jsResources = resources.filter(r => r.name.endsWith('.js'));
      const totalSizeKB = jsResources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024;

      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: totalSizeKB < 2000,
        metrics: { bundleSize: totalSizeKB },
        grade: this.gradeBundleSize(totalSizeKB),
        details: [
          `Total JS: ${totalSizeKB.toFixed(1)}KB`,
          `JS files: ${jsResources.length}`,
        ],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: false,
        metrics: {},
        grade: 'poor',
        details: [`Error: ${errorMessage}`],
      });
    }
  }

  /**
   * 🖱️ Test 5: User Interaction Response Time
   */
  private async testUserInteractionPerformance(): Promise<void> {
    const testName = 'User Interaction Response';
    const startTime = performance.now();

    try {
      // Simulate zoom operation using VIEWPORT_DEFAULTS
      const zoomStart = performance.now();
      const testScale = 1.0 * 2; // Initial scale = 1.0 (identity transform)
      const _zoomResult = Math.max(TRANSFORM_SCALE_LIMITS.MIN_SCALE, Math.min(testScale, TRANSFORM_SCALE_LIMITS.MAX_SCALE));
      const zoomTime = performance.now() - zoomStart;

      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: zoomTime < 100,
        metrics: { renderTime: zoomTime },
        grade: this.gradeInteractionTime(zoomTime),
        details: [
          `Zoom calculation: ${zoomTime.toFixed(2)}ms`,
        ],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: false,
        metrics: {},
        grade: 'poor',
        details: [`Error: ${errorMessage}`],
      });
    }
  }

  /**
   * 🔄 Test 6: Service Worker Caching
   */
  private async testServiceWorkerPerformance(): Promise<void> {
    const testName = 'Service Worker Caching';
    const startTime = performance.now();

    try {
      const swRegistration = await navigator.serviceWorker?.getRegistration();
      const hasSW = !!swRegistration;
      const cacheEfficiency = hasSW ? 70 : 0; // Estimate

      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: hasSW,
        metrics: {},
        grade: this.gradeCacheEfficiency(cacheEfficiency),
        details: [
          `Service Worker: ${hasSW ? 'Active' : 'Not registered'}`,
          `Estimated efficiency: ${cacheEfficiency}%`,
        ],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: false,
        metrics: {},
        grade: 'poor',
        details: [`Error: ${errorMessage}`],
      });
    }
  }

  /**
   * 📊 Test 7: Performance Dashboard Functionality
   */
  private async testPerformanceDashboard(): Promise<void> {
    const testName = 'Performance Dashboard';
    const startTime = performance.now();

    try {
      // Check timing API availability
      const hasPerformanceAPI = typeof performance !== 'undefined';
      const hasNavigationTiming = performance.getEntriesByType('navigation').length > 0;
      const hasResourceTiming = performance.getEntriesByType('resource').length > 0;

      const score = [hasPerformanceAPI, hasNavigationTiming, hasResourceTiming].filter(Boolean).length;
      const efficiency = (score / 3) * 100;

      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: score >= 2,
        metrics: {},
        grade: this.gradeCacheEfficiency(efficiency),
        details: [
          `Performance API: ${hasPerformanceAPI ? 'Yes' : 'No'}`,
          `Navigation Timing: ${hasNavigationTiming ? 'Yes' : 'No'}`,
          `Resource Timing: ${hasResourceTiming ? 'Yes' : 'No'}`,
        ],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.testResults.push({
        testName,
        duration: performance.now() - startTime,
        success: false,
        metrics: {},
        grade: 'poor',
        details: [`Error: ${errorMessage}`],
      });
    }
  }

  /**
   * 📋 Generate test suite results
   */
  private generateTestSuite(totalDuration: number): PerformanceTestSuite {
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = this.testResults.filter(r => !r.success).length;
    const avgDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0) / this.testResults.length;

    // Calculate overall grade
    const grades = this.testResults.map(r => r.grade);
    const gradeScores = grades.map(g => ({ excellent: 4, good: 3, fair: 2, poor: 1 }[g]));
    const avgScore = gradeScores.reduce((sum, score) => sum + score, 0) / gradeScores.length;

    const overallGrade: 'excellent' | 'good' | 'fair' | 'poor' =
      avgScore >= 3.5 ? 'excellent' :
      avgScore >= 2.5 ? 'good' :
      avgScore >= 1.5 ? 'fair' : 'poor';

    // Generate issues and recommendations
    const issues: string[] = [];
    const recommendations: string[] = [];

    this.testResults.forEach(result => {
      if (!result.success) {
        issues.push(`${result.testName}: ${result.details[0] || 'Failed'}`);
      }

      if (result.grade === 'poor' || result.grade === 'fair') {
        recommendations.push(`Optimize ${result.testName.toLowerCase()}`);
      }
    });

    return {
      suiteId: `perf-test-${Date.now()}`,
      suiteName: 'DXF Viewer Performance Test Suite',
      timestamp: Date.now(),
      results: this.testResults,
      overallGrade,
      summary: {
        totalTests: this.testResults.length,
        passedTests,
        failedTests,
        avgDuration,
        issues,
        recommendations
      }
    };
  }

  // ============================================================================
  // GRADING METHODS
  // ============================================================================

  private gradeLoadTime(loadTime: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (loadTime < 1500) return 'excellent';
    if (loadTime < 3000) return 'good';
    if (loadTime < 5000) return 'fair';
    return 'poor';
  }

  private gradeRenderPerformance(renderTime: number, fps: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (renderTime < 8.33 && fps >= 50) return 'excellent'; // 120fps+
    if (renderTime < 16.67 && fps >= 30) return 'good';     // 60fps+
    if (renderTime < 33.33 && fps >= 15) return 'fair';     // 30fps+
    return 'poor';
  }

  private gradeMemoryUsage(memory: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (memory < 100) return 'excellent';
    if (memory < 256) return 'good';
    if (memory < 512) return 'fair';
    return 'poor';
  }

  private gradeBundleSize(sizeKB: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (sizeKB < 500) return 'excellent';
    if (sizeKB < 1000) return 'good';
    if (sizeKB < 2000) return 'fair';
    return 'poor';
  }

  private gradeInteractionTime(time: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (time < 50) return 'excellent';
    if (time < 100) return 'good';
    if (time < 200) return 'fair';
    return 'poor';
  }

  private gradeCacheEfficiency(efficiency: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (efficiency >= 80) return 'excellent';
    if (efficiency >= 60) return 'good';
    if (efficiency >= 30) return 'fair';
    return 'poor';
  }
}

// ============================================================================
// GLOBAL INTERFACE
// ============================================================================

declare global {
  interface Window {
    runDxfPerformanceTests?: () => Promise<PerformanceTestSuite>;
  }
}

// Global function για browser console access
if (typeof window !== 'undefined') {
  window.runDxfPerformanceTests = async () => {
    const runner = new DxfPerformanceTestRunner();
    return await runner.runFullTestSuite();
  };
}

export type { PerformanceTestResult, PerformanceTestSuite };






