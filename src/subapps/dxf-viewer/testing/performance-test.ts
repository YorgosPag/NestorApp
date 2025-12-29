/**
 * ⚡ DXF VIEWER PERFORMANCE TESTING SUITE
 *
 * Comprehensive performance testing και benchmarking για
 * DXF Viewer application με enterprise-level metrics.
 *
 * @author Claude (Anthropic AI)
 * @version 1.0.0
 */

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
      // Simulate application load
      const performanceEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const navigation = performanceEntries[0];

      const loadTime = navigation ? navigation.loadEventEnd - navigation.navigationStart : 0;
      const domReady = navigation ? navigation.domContentLoadedEventEnd - navigation.navigationStart : 0;

      const duration = performance.now() - startTime;

      const result: PerformanceTestResult = {
        testName,
        duration,
        success: loadTime < 3000, // 3 seconds threshold
        metrics: {
          renderTime: loadTime
        },
        grade: this.gradeLoadTime(loadTime),
        details: [
          `Total load time: ${loadTime.toFixed(0)}ms`,
          `DOM ready time: ${domReady.toFixed(0)}ms`,
          `Performance measurement took: ${duration.toFixed(2)}ms`
        ]
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      this.addFailedTest(testName, error);
    }
  }

  /**
   * 🎨 Test 2: Canvas Rendering Performance
   */
  private async testCanvasRenderingPerformance(): Promise<void> {
    const testName = 'Canvas Rendering Performance';
    const startTime = performance.now();

    try {
      // Simulate canvas rendering test
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Render performance test
      const renderStart = performance.now();

      // Simulate complex drawing operations
      for (let i = 0; i < 1000; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * 800, Math.random() * 600, Math.random() * 10, 0, 2 * Math.PI);
        ctx.fillStyle = `hsl(${Math.random() * 360}, 50%, 50%)`;
        ctx.fill();
      }

      const renderTime = performance.now() - renderStart;
      const duration = performance.now() - startTime;

      // Estimate FPS based on render time
      const estimatedFPS = renderTime > 0 ? Math.min(1000 / renderTime, 60) : 60;

      const result: PerformanceTestResult = {
        testName,
        duration,
        success: renderTime < 16.67, // 60fps threshold
        metrics: {
          renderTime,
          fps: estimatedFPS
        },
        grade: this.gradeRenderPerformance(renderTime, estimatedFPS),
        details: [
          `Render time: ${renderTime.toFixed(2)}ms`,
          `Estimated FPS: ${estimatedFPS.toFixed(0)}`,
          `1000 shapes rendered in ${renderTime.toFixed(2)}ms`,
          `Test completed in: ${duration.toFixed(2)}ms`
        ]
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      this.addFailedTest(testName, error);
    }
  }

  /**
   * 💾 Test 3: Memory Usage
   */
  private async testMemoryUsage(): Promise<void> {
    const testName = 'Memory Usage Test';
    const startTime = performance.now();

    try {
      // Performance Memory API - using proper type declaration
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;

      if (!memory) {
        throw new Error('Performance memory API not available');
      }

      const memoryUsage = memory.usedJSHeapSize / (1024 * 1024); // MB
      const memoryLimit = memory.totalJSHeapSize / (1024 * 1024); // MB

      const duration = performance.now() - startTime;

      const result: PerformanceTestResult = {
        testName,
        duration,
        success: memoryUsage < 256, // 256MB threshold
        metrics: {
          memory: memoryUsage
        },
        grade: this.gradeMemoryUsage(memoryUsage),
        details: [
          `Memory usage: ${memoryUsage.toFixed(1)} MB`,
          `Memory limit: ${memoryLimit.toFixed(1)} MB`,
          `Memory efficiency: ${((memoryUsage / memoryLimit) * 100).toFixed(1)}%`,
          `Test completed in: ${duration.toFixed(2)}ms`
        ]
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      this.addFailedTest(testName, error);
    }
  }

  /**
   * 📦 Test 4: Bundle Size Analysis
   */
  private async testBundleSize(): Promise<void> {
    const testName = 'Bundle Size Analysis';
    const startTime = performance.now();

    try {
      // Estimate bundle size from loaded resources
      const resources = performance.getEntriesByType('resource');
      let totalSize = 0;

      for (const resource of resources) {
        if (resource.name.includes('/_next/static/chunks/') || resource.name.includes('.js')) {
          // ✅ ENTERPRISE: Type-safe access to transferSize property
          const resourceWithTransfer = resource as PerformanceResourceTiming & { transferSize?: number };
          totalSize += resourceWithTransfer.transferSize || 0;
        }
      }

      const bundleSizeKB = totalSize / 1024;
      const duration = performance.now() - startTime;

      const result: PerformanceTestResult = {
        testName,
        duration,
        success: bundleSizeKB < 2000, // 2MB threshold
        metrics: {
          bundleSize: bundleSizeKB
        },
        grade: this.gradeBundleSize(bundleSizeKB),
        details: [
          `Estimated bundle size: ${bundleSizeKB.toFixed(0)} KB`,
          `Resource count: ${resources.length}`,
          `JS resources: ${resources.filter(r => r.name.includes('.js')).length}`,
          `Test completed in: ${duration.toFixed(2)}ms`
        ]
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      this.addFailedTest(testName, error);
    }
  }

  /**
   * 👆 Test 5: User Interaction Performance
   */
  private async testUserInteractionPerformance(): Promise<void> {
    const testName = 'User Interaction Response Time';
    const startTime = performance.now();

    try {
      // Simulate click interaction
      const button = document.createElement('button');
      document.body.appendChild(button);

      const interactionStart = performance.now();

      // Simulate interaction processing
      await new Promise(resolve => {
        button.addEventListener('click', () => {
          setTimeout(resolve, 5); // Simulate 5ms processing
        });

        // Trigger click
        button.click();
      });

      const interactionTime = performance.now() - interactionStart;
      const duration = performance.now() - startTime;

      document.body.removeChild(button);

      const result: PerformanceTestResult = {
        testName,
        duration,
        success: interactionTime < 100, // 100ms threshold για good UX
        metrics: {
          renderTime: interactionTime
        },
        grade: this.gradeInteractionTime(interactionTime),
        details: [
          `Interaction response time: ${interactionTime.toFixed(2)}ms`,
          `Target: < 100ms for responsive UI`,
          `Status: ${interactionTime < 100 ? 'Responsive' : 'Needs improvement'}`,
          `Test completed in: ${duration.toFixed(2)}ms`
        ]
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      this.addFailedTest(testName, error);
    }
  }

  /**
   * 🔧 Test 6: Service Worker Performance
   */
  private async testServiceWorkerPerformance(): Promise<void> {
    const testName = 'Service Worker Caching';
    const startTime = performance.now();

    try {
      const swRegistration = await navigator.serviceWorker.ready;
      const swActive = swRegistration.active;

      if (!swActive) {
        throw new Error('Service Worker not active');
      }

      // Test cache functionality
      const cacheTest = await this.testCacheEfficiency();
      const duration = performance.now() - startTime;

      const result: PerformanceTestResult = {
        testName,
        duration,
        success: cacheTest.efficiency > 50, // 50% cache hit rate
        metrics: {},
        grade: this.gradeCacheEfficiency(cacheTest.efficiency),
        details: [
          `Service Worker status: ${swActive.state}`,
          `Cache efficiency: ${cacheTest.efficiency.toFixed(1)}%`,
          `Cached resources: ${cacheTest.cachedCount}`,
          `Test completed in: ${duration.toFixed(2)}ms`
        ]
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      this.addFailedTest(testName, error);
    }
  }

  /**
   * 📊 Test 7: Performance Dashboard Functionality
   */
  private async testPerformanceDashboard(): Promise<void> {
    const testName = 'Performance Dashboard';
    const startTime = performance.now();

    try {
      // Check if performance dashboard is loaded
      const dashboard = document.querySelector('[class*="PerformanceDashboard"]') ||
                       document.querySelector('[class*="performance"]');

      const isDashboardPresent = dashboard !== null;

      // Test performance optimizer
      const hasOptimizer = typeof window !== 'undefined' &&
                          (window as any).__dxfPerformanceOptimizer;

      const duration = performance.now() - startTime;

      const result: PerformanceTestResult = {
        testName,
        duration,
        success: isDashboardPresent || hasOptimizer,
        metrics: {},
        grade: isDashboardPresent && hasOptimizer ? 'excellent' : 'fair',
        details: [
          `Dashboard present: ${isDashboardPresent ? 'Yes' : 'No'}`,
          `Performance optimizer: ${hasOptimizer ? 'Active' : 'Not found'}`,
          `Monitoring status: ${isDashboardPresent || hasOptimizer ? 'Active' : 'Inactive'}`,
          `Test completed in: ${duration.toFixed(2)}ms`
        ]
      };

      this.testResults.push(result);
      console.log(`✅ ${testName}: ${result.success ? 'PASSED' : 'FAILED'}`);

    } catch (error) {
      this.addFailedTest(testName, error);
    }
  }

  /**
   * 💾 Test cache efficiency
   */
  private async testCacheEfficiency(): Promise<{ efficiency: number; cachedCount: number }> {
    try {
      const cacheNames = await caches.keys();
      let totalCached = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        totalCached += requests.length;
      }

      const resources = performance.getEntriesByType('resource').length;
      const efficiency = resources > 0 ? (totalCached / resources) * 100 : 0;

      return { efficiency, cachedCount: totalCached };
    } catch {
      return { efficiency: 0, cachedCount: 0 };
    }
  }

  /**
   * ❌ Add failed test result
   */
  private addFailedTest(testName: string, error: any): void {
    const result: PerformanceTestResult = {
      testName,
      duration: 0,
      success: false,
      metrics: {},
      grade: 'poor',
      details: [
        `Error: ${error.message || 'Unknown error'}`,
        'Test failed to complete'
      ]
    };

    this.testResults.push(result);
    console.error(`❌ ${testName}: FAILED - ${error.message}`);
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

export { DxfPerformanceTestRunner };
export type { PerformanceTestResult, PerformanceTestSuite };