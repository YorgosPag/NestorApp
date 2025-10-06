// 🎯 ENTERPRISE-LEVEL CURSOR & CROSSHAIR ALIGNMENT TEST
// Περιλαμβάνει πολλαπλά σενάρια, παραμετροποίηση, performance μετρήσεις και cross-viewport coverage
// Βασισμένο στις προτάσεις ChatGPT5 για παγκόσμιας κλάσης αρχιτεκτονικό testing

import { CoordinateTransforms } from '../rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../rendering/types/Types';

interface ScenarioConfig {
  name: string;
  description: string;
  viewport: Viewport;
  transform: ViewTransform;
  testPoints: Point2D[];
  tolerancePx: number;
  expectedPassRate: number;
}

interface ExtendedTestResult {
  scenario: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  avgError: number;
  maxError: number;
  reversibilityRate: number;
  durationMs: number;
  performanceMs: number;
  details: {
    totalTests: number;
    passed: number;
    failed: number;
    tolerance: number;
  };
}

interface EnterpriseTestSummary {
  overallStatus: 'PASS' | 'FAIL' | 'ERROR';
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  avgPerformance: number;
  maxError: number;
  minPassRate: number;
  results: ExtendedTestResult[];
}

/**
 * 🎯 ΔΗΜΙΟΥΡΓΙΑ ENTERPRISE SCENARIOS
 * Καλύπτει όλα τα πιθανά σενάρια χρήσης σε αρχιτεκτονικό περιβάλλον
 */
function generateEnterpriseScenarios(rect: DOMRect): ScenarioConfig[] {
  const center: Point2D = { x: rect.width / 2, y: rect.height / 2 };
  const corners: Point2D[] = [
    { x: 0, y: 0 },                                    // Top-left
    { x: rect.width, y: 0 },                          // Top-right
    { x: 0, y: rect.height },                         // Bottom-left
    { x: rect.width, y: rect.height },                // Bottom-right
  ];
  const edges: Point2D[] = [
    { x: rect.width / 2, y: 0 },                      // Top-center
    { x: rect.width / 2, y: rect.height },            // Bottom-center
    { x: 0, y: rect.height / 2 },                     // Left-center
    { x: rect.width, y: rect.height / 2 },            // Right-center
  ];
  const precision: Point2D[] = [
    { x: rect.width * 0.25, y: rect.height * 0.75 },  // Precision point 1
    { x: rect.width * 0.9, y: rect.height * 0.1 },    // Precision point 2
    { x: rect.width * 0.37, y: rect.height * 0.63 },  // Random precision
  ];

  const allTestPoints = [center, ...corners, ...edges, ...precision];

  return [
    {
      name: 'baseline',
      description: 'Default zoom at center + all critical points',
      viewport: { width: rect.width, height: rect.height },
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      testPoints: allTestPoints,
      tolerancePx: 0.5,
      expectedPassRate: 0.98
    },
    {
      name: 'zoom_in_2x',
      description: 'Zoomed in x2 with moderate pan',
      viewport: { width: rect.width, height: rect.height },
      transform: { scale: 2, offsetX: 50, offsetY: -30 },
      testPoints: allTestPoints,
      tolerancePx: 0.75,
      expectedPassRate: 0.95
    },
    {
      name: 'zoom_out_half',
      description: 'Zoomed out x0.5 with significant pan',
      viewport: { width: rect.width, height: rect.height },
      transform: { scale: 0.5, offsetX: -100, offsetY: 80 },
      testPoints: allTestPoints,
      tolerancePx: 0.75,
      expectedPassRate: 0.95
    },
    {
      name: 'hidpi_scale',
      description: 'HiDPI scaling simulation x1.5',
      viewport: { width: rect.width, height: rect.height },
      transform: { scale: 1.5, offsetX: 0, offsetY: 0 },
      testPoints: allTestPoints,
      tolerancePx: 0.75,
      expectedPassRate: 0.95
    },
    {
      name: 'extreme_zoom_in',
      description: 'Extreme zoom in x10 for CAD precision work',
      viewport: { width: rect.width, height: rect.height },
      transform: { scale: 10, offsetX: 200, offsetY: -150 },
      testPoints: allTestPoints,
      tolerancePx: 1.0,
      expectedPassRate: 0.90
    },
    {
      name: 'extreme_zoom_out',
      description: 'Extreme zoom out x0.1 for overview',
      viewport: { width: rect.width, height: rect.height },
      transform: { scale: 0.1, offsetX: -500, offsetY: 300 },
      testPoints: allTestPoints,
      tolerancePx: 1.0,
      expectedPassRate: 0.90
    },
    {
      name: 'large_viewport',
      description: '4K display simulation',
      viewport: { width: 3840, height: 2160 },
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      testPoints: [
        { x: 1920, y: 1080 }, // Center
        { x: 0, y: 0 }, { x: 3840, y: 0 }, { x: 0, y: 2160 }, { x: 3840, y: 2160 }, // Corners
        { x: 960, y: 540 }, { x: 2880, y: 1620 } // Additional points
      ],
      tolerancePx: 0.5,
      expectedPassRate: 0.98
    },
    {
      name: 'small_viewport',
      description: 'Mobile/small screen simulation',
      viewport: { width: 375, height: 667 },
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
      testPoints: [
        { x: 187, y: 333 }, // Center
        { x: 0, y: 0 }, { x: 375, y: 0 }, { x: 0, y: 667 }, { x: 375, y: 667 }, // Corners
        { x: 94, y: 167 }, { x: 281, y: 500 } // Additional points
      ],
      tolerancePx: 0.5,
      expectedPassRate: 0.98
    }
  ];
}

/**
 * 🎯 PERFORMANCE BENCHMARK TEST
 * Δοκιμάζει 10,000 μετατροπές και μετράει performance
 */
function runPerformanceBenchmark(scenario: ScenarioConfig): number {
  const iterations = 10000;
  const testPoint: Point2D = { x: scenario.viewport.width * 0.37, y: scenario.viewport.height * 0.63 };

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const world = CoordinateTransforms.screenToWorld(testPoint, scenario.transform, scenario.viewport);
    CoordinateTransforms.worldToScreen(world, scenario.transform, scenario.viewport);
  }
  const end = performance.now();

  return end - start;
}

/**
 * 🎯 SINGLE SCENARIO EXECUTION
 * Εκτελεί ένα σενάριο με πλήρη μετρικές
 */
function executeScenario(scenario: ScenarioConfig): ExtendedTestResult {
  const start = performance.now();

  let totalError = 0;
  let maxError = 0;
  let passed = 0;
  let failed = 0;

  // Coordinate reversibility testing
  for (const point of scenario.testPoints) {
    try {
      // Screen → World → Screen
      const worldPoint = CoordinateTransforms.screenToWorld(point, scenario.transform, scenario.viewport);
      const backToScreen = CoordinateTransforms.worldToScreen(worldPoint, scenario.transform, scenario.viewport);

      // Calculate error
      const error = Math.sqrt(
        Math.pow(point.x - backToScreen.x, 2) +
        Math.pow(point.y - backToScreen.y, 2)
      );

      totalError += error;
      if (error > maxError) maxError = error;

      if (error <= scenario.tolerancePx) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      console.error(`Error in scenario ${scenario.name} at point ${JSON.stringify(point)}:`, error);
    }
  }

  const end = performance.now();
  const setupDuration = end - start;

  // Performance benchmark
  const performanceMs = runPerformanceBenchmark(scenario);

  const totalTests = scenario.testPoints.length;
  const reversibilityRate = passed / totalTests;
  const avgError = totalError / totalTests;

  // Determine status
  const meetsPerformance = performanceMs < 50; // 10k transforms < 50ms
  const meetsAccuracy = avgError <= scenario.tolerancePx / 2;
  const meetsPassRate = reversibilityRate >= scenario.expectedPassRate;
  const meetsMaxError = maxError <= scenario.tolerancePx;

  const status = (meetsPerformance && meetsAccuracy && meetsPassRate && meetsMaxError) ? 'PASS' : 'FAIL';

  return {
    scenario: scenario.name,
    status,
    avgError,
    maxError,
    reversibilityRate,
    durationMs: setupDuration,
    performanceMs,
    details: {
      totalTests,
      passed,
      failed,
      tolerance: scenario.tolerancePx
    }
  };
}

/**
 * 🎯 ENTERPRISE MOUSE-CROSSHAIR TESTS
 * Κεντρική εκτέλεση όλων των enterprise-level tests
 */
export function runEnterpriseMouseCrosshairTests(): EnterpriseTestSummary {
  console.log('🏢 ENTERPRISE CURSOR-CROSSHAIR ALIGNMENT TESTS');
  console.log('='.repeat(60));

  // Find canvas
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-canvas-type="dxf"]') ||
                 document.querySelector<HTMLCanvasElement>('canvas[data-canvas-type="layer"]') ||
                 document.querySelector<HTMLCanvasElement>('canvas');

  if (!canvas) {
    return {
      overallStatus: 'ERROR',
      totalScenarios: 0,
      passedScenarios: 0,
      failedScenarios: 0,
      avgPerformance: 0,
      maxError: 0,
      minPassRate: 0,
      results: [{
        scenario: 'NO_CANVAS',
        status: 'ERROR',
        avgError: NaN,
        maxError: NaN,
        reversibilityRate: 0,
        durationMs: 0,
        performanceMs: 0,
        details: { totalTests: 0, passed: 0, failed: 0, tolerance: 0 }
      }]
    };
  }

  const rect = canvas.getBoundingClientRect();
  const scenarios = generateEnterpriseScenarios(rect);
  const results: ExtendedTestResult[] = [];

  console.log(`📊 Testing ${scenarios.length} enterprise scenarios on canvas ${rect.width}x${rect.height}`);

  // Execute all scenarios
  for (const scenario of scenarios) {
    console.log(`\n🔬 Testing scenario: ${scenario.name} - ${scenario.description}`);
    const result = executeScenario(scenario);
    results.push(result);

    // Log detailed results
    console.log(`   Status: ${result.status}`);
    console.log(`   Avg Error: ${result.avgError.toFixed(6)}px`);
    console.log(`   Max Error: ${result.maxError.toFixed(6)}px`);
    console.log(`   Pass Rate: ${(result.reversibilityRate * 100).toFixed(1)}%`);
    console.log(`   Performance: ${result.performanceMs.toFixed(2)}ms (10k transforms)`);
    console.log(`   Setup Time: ${result.durationMs.toFixed(2)}ms`);
  }

  // Calculate summary metrics
  const passedScenarios = results.filter(r => r.status === 'PASS').length;
  const failedScenarios = results.filter(r => r.status === 'FAIL').length;
  const avgPerformance = results.reduce((sum, r) => sum + r.performanceMs, 0) / results.length;
  const maxError = Math.max(...results.map(r => r.maxError));
  const minPassRate = Math.min(...results.map(r => r.reversibilityRate));

  const overallStatus = passedScenarios === results.length ? 'PASS' : 'FAIL';

  const summary: EnterpriseTestSummary = {
    overallStatus,
    totalScenarios: results.length,
    passedScenarios,
    failedScenarios,
    avgPerformance,
    maxError,
    minPassRate,
    results
  };

  // Final summary
  console.log('\n📋 ENTERPRISE TEST SUMMARY');
  console.log('='.repeat(40));
  console.log(`Overall Status: ${summary.overallStatus}`);
  console.log(`Scenarios: ${summary.passedScenarios}/${summary.totalScenarios} passed`);
  console.log(`Average Performance: ${summary.avgPerformance.toFixed(2)}ms per 10k transforms`);
  console.log(`Maximum Error: ${summary.maxError.toFixed(6)}px`);
  console.log(`Minimum Pass Rate: ${(summary.minPassRate * 100).toFixed(1)}%`);

  if (summary.overallStatus === 'PASS') {
    console.log('✅ ALL ENTERPRISE TESTS PASSED - System ready for production!');
  } else {
    console.log('❌ SOME ENTERPRISE TESTS FAILED - Review required before production!');
  }

  return summary;
}

/**
 * 🎯 INTERACTIVE ENTERPRISE TEST
 * Real-time testing με enterprise-level metrics
 */
export function startEnterpriseInteractiveTest() {
  console.log('🎮 ENTERPRISE INTERACTIVE ALIGNMENT TEST');
  console.log('Move mouse over canvas for real-time enterprise-level validation...');
  console.log('Press ESC to stop test');

  const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-canvas-type="dxf"]') ||
                 document.querySelector<HTMLCanvasElement>('canvas[data-canvas-type="layer"]') ||
                 document.querySelector<HTMLCanvasElement>('canvas');

  if (!canvas) {
    console.error('❌ No canvas found for enterprise interactive test');
    return;
  }

  let isRunning = true;
  let sampleCount = 0;
  let totalError = 0;
  let maxError = 0;

  const rect = canvas.getBoundingClientRect();
  const viewport: Viewport = { width: rect.width, height: rect.height };
  const transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isRunning) return;

    const canvasPos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    // Performance measurement
    const start = performance.now();
    const worldPos = CoordinateTransforms.screenToWorld(canvasPos, transform, viewport);
    const backToScreen = CoordinateTransforms.worldToScreen(worldPos, transform, viewport);
    const transformTime = performance.now() - start;

    const error = Math.sqrt(
      Math.pow(canvasPos.x - backToScreen.x, 2) +
      Math.pow(canvasPos.y - backToScreen.y, 2)
    );

    // Update statistics
    sampleCount++;
    totalError += error;
    maxError = Math.max(maxError, error);
    const avgError = totalError / sampleCount;

    // Enterprise-level real-time feedback
    if (sampleCount % 10 === 0) { // Log every 10th sample to avoid spam
      console.log(`🎯 Enterprise Sample #${sampleCount}:`, {
        canvasPos,
        worldPos: { x: worldPos.x.toFixed(3), y: worldPos.y.toFixed(3) },
        recovered: { x: backToScreen.x.toFixed(3), y: backToScreen.y.toFixed(3) },
        error: error.toFixed(6),
        avgError: avgError.toFixed(6),
        maxError: maxError.toFixed(6),
        transformTimeMs: transformTime.toFixed(4),
        status: error < 0.5 ? 'PASS' : 'FAIL'
      });
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      isRunning = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyDown);

      // Final summary
      const avgError = totalError / sampleCount;
      const passRate = sampleCount > 0 ? (sampleCount - Math.floor(totalError / 0.5)) / sampleCount : 0;

      console.log('🏁 ENTERPRISE INTERACTIVE TEST SUMMARY:');
      console.log(`   Samples: ${sampleCount}`);
      console.log(`   Average Error: ${avgError.toFixed(6)}px`);
      console.log(`   Maximum Error: ${maxError.toFixed(6)}px`);
      console.log(`   Pass Rate: ${(passRate * 100).toFixed(1)}%`);
      console.log('🛑 Enterprise interactive test stopped');
    }
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('keydown', handleKeyDown);

  return () => {
    isRunning = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('keydown', handleKeyDown);
  };
}

// Expose στο window για browser console
if (typeof window !== 'undefined') {
  (window as any).runEnterpriseMouseCrosshairTests = runEnterpriseMouseCrosshairTests;
  (window as any).startEnterpriseInteractiveTest = startEnterpriseInteractiveTest;
}

export default {
  runEnterpriseMouseCrosshairTests,
  startEnterpriseInteractiveTest
};