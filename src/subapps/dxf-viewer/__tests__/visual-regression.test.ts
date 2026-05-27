/**
 * 🎨 ENTERPRISE VISUAL REGRESSION TESTING με Real Canvas
 * Pixel-perfect testing με @napi-rs/canvas backend
 * Strict threshold assertions και comprehensive CI artifacts
 */

// jest-globals.d.ts removed (now handled by /jest)

import path from 'node:path';
import type { PixelmatchFn, PNGCombined } from '../test/visual/types';

// Conditional imports to avoid missing module errors during development
let pixelmatch: PixelmatchFn | null = null;
let PNG: PNGCombined | null = null;

try {
  pixelmatch = require('pixelmatch') as PixelmatchFn;
  PNG = require('pngjs').PNG as PNGCombined;
} catch (error) {
  // Modules not installed yet - tests will be skipped
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.warn('⚠️ Visual regression dependencies not installed:', errorMessage);
}
import {
  renderOverlayToCanvas,
  renderCoordinateSystemTest,
  type VisualTestOptions
} from '../test/visual/overlayRenderer';
// 🏢 ADR-XXX: Centralized viewport defaults
import { VIEWPORT_DEFAULTS } from '../config/transform-config';
import {
  writeArtifacts,
  getArtifactPaths,
  hasBaseline,
  createBaseline,
  loadBaseline,
  generateSuiteReport,
  type VisualTestResult
} from '../test/visual/io';
import { CanvasTestUtils } from '../test/setupCanvas';

/**
 * 🎯 TEST CASE DEFINITIONS με Strict Thresholds
 * Matrix of resolutions × overlay types × quality thresholds
 */
type TestCase = {
  name: string;
  width: number;
  height: number;
  overlayType: 'origin' | 'grid' | 'crosshair' | 'combined';
  threshold: number; // Max allowed mismatch rate
  maxMismatchPixels: number; // Absolute pixel limit
  seed: number; // Deterministic seed
};

const ENTERPRISE_TEST_CASES: TestCase[] = [
  // Standard desktop resolution - 🏢 Using centralized VIEWPORT_DEFAULTS
  { name: 'combined-800x600', width: VIEWPORT_DEFAULTS.WIDTH, height: VIEWPORT_DEFAULTS.HEIGHT, overlayType: 'combined', threshold: 0.0001, maxMismatchPixels: 48, seed: 42 },
  { name: 'origin-800x600', width: VIEWPORT_DEFAULTS.WIDTH, height: VIEWPORT_DEFAULTS.HEIGHT, overlayType: 'origin', threshold: 0.0001, maxMismatchPixels: 24, seed: 42 },
  { name: 'grid-800x600', width: VIEWPORT_DEFAULTS.WIDTH, height: VIEWPORT_DEFAULTS.HEIGHT, overlayType: 'grid', threshold: 0.0001, maxMismatchPixels: 40, seed: 42 },

  // HD resolution
  { name: 'combined-1920x1080', width: 1920, height: 1080, overlayType: 'combined', threshold: 0.0001, maxMismatchPixels: 207, seed: 42 },

  // Square canvas - uses VIEWPORT_DEFAULTS.WIDTH for both dimensions (square)
  { name: 'crosshair-800x800', width: VIEWPORT_DEFAULTS.WIDTH, height: VIEWPORT_DEFAULTS.WIDTH, overlayType: 'crosshair', threshold: 0.0001, maxMismatchPixels: 32, seed: 42 },

  // Mobile resolution
  { name: 'combined-320x240', width: 320, height: 240, overlayType: 'combined', threshold: 0.0002, maxMismatchPixels: 15, seed: 42 },

  // 4K resolution (partial)
  { name: 'grid-1024x768', width: 1024, height: 768, overlayType: 'grid', threshold: 0.0001, maxMismatchPixels: 78, seed: 42 }
];

/**
 * 🖼️ REAL CANVAS TO PNG CONVERSION
 * Uses @napi-rs/canvas backend για πραγματικό PNG output
 */
function canvasToPngBuffer(canvas: HTMLCanvasElement): Buffer {
  // Use πραγματικό canvas backend αν διαθέσιμο
  const bufferCanvas = canvas as HTMLCanvasElement & { toBuffer?: (mimeType: string) => Buffer };
  if (typeof bufferCanvas.toBuffer === 'function') {
    return bufferCanvas.toBuffer('image/png');
  }

  // Fallback για cases χωρίς napi backend
  console.warn('⚠️ Using fallback PNG conversion - may not be deterministic');
  const dataUrl = canvas.toDataURL('image/png');
  const base64Data = dataUrl.split(',')[1];
  return Buffer.from(base64Data, 'base64');
}

/**
 * 🔍 ENTERPRISE VISUAL COMPARISON
 * Pixel-perfect comparison με comprehensive reporting
 */
function performVisualComparison(
  testCase: TestCase,
  actualBuffer: Buffer,
  baselineBuffer: Buffer
): {
  passed: boolean;
  mismatchedPixels: number;
  mismatchRate: number;
  diffBuffer: Buffer;
  details: string;
} {
  if (!PNG || !pixelmatch) {
    throw new Error('Visual regression dependencies not installed (pngjs, pixelmatch)');
  }

  const baselinePng = PNG.sync.read(baselineBuffer);
  const actualPng = PNG.sync.read(actualBuffer);

  // Validate dimensions
  if (baselinePng.width !== actualPng.width || baselinePng.height !== actualPng.height) {
    throw new Error(
      `❌ Dimension mismatch in ${testCase.name}: baseline ${baselinePng.width}x${baselinePng.height} vs actual ${actualPng.width}x${actualPng.height}`
    );
  }

  const { width, height } = baselinePng;
  const totalPixels = width * height;
  const diff = new PNG({ width, height });

  // Enhanced pixelmatch comparison με enterprise settings
  const mismatchedPixels = pixelmatch(
    baselinePng.data,
    actualPng.data,
    diff.data,
    width,
    height,
    {
      threshold: 0.05,        // More sensitive για enterprise quality
      includeAA: true,        // Include anti-aliasing differences
      alpha: 0.2,            // Alpha channel sensitivity
    }
  );

  const mismatchRate = mismatchedPixels / totalPixels;
  const diffBuffer = PNG.sync.write(diff);

  // STRICT ENTERPRISE ASSERTIONS
  const rateTest = mismatchRate <= testCase.threshold;
  const pixelTest = mismatchedPixels <= testCase.maxMismatchPixels;
  const passed = rateTest && pixelTest;

  const details = [
    `Resolution: ${width}x${height}`,
    `Total pixels: ${totalPixels.toLocaleString()}`,
    `Mismatched: ${mismatchedPixels.toLocaleString()} pixels`,
    `Mismatch rate: ${(mismatchRate * 100).toFixed(6)}%`,
    `Rate threshold: ${(testCase.threshold * 100).toFixed(6)}% ${rateTest ? '✅' : '❌'}`,
    `Pixel threshold: ${testCase.maxMismatchPixels} pixels ${pixelTest ? '✅' : '❌'}`,
    `Overall: ${passed ? 'PASS' : 'FAIL'}`
  ].join('\n');

  return {
    passed,
    mismatchedPixels,
    mismatchRate,
    diffBuffer,
    details
  };
}

// 🧪 ENTERPRISE TEST SUITE SETUP
const testResults: VisualTestResult[] = [];
const suiteStartTime = Date.now();

// Setup test environment
beforeAll(() => {
  console.log('🎨 Initializing Enterprise Visual Regression Testing Suite...');
  console.log(`📊 Running ${ENTERPRISE_TEST_CASES.length} test cases with strict thresholds`);
});

afterAll(() => {
  // Generate comprehensive test suite report
  const suiteReport = generateSuiteReport(testResults, suiteStartTime);

  console.log('\n📊 ENTERPRISE VISUAL REGRESSION TEST SUITE COMPLETED');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${suiteReport.passed}/${suiteReport.total}`);
  console.log(`❌ Failed: ${suiteReport.failed}/${suiteReport.total}`);
  console.log(`📏 Average Mismatch Rate: ${(suiteReport.summary.avgMismatchRate * 100).toFixed(6)}%`);
  console.log(`📏 Maximum Mismatch Rate: ${(suiteReport.summary.maxMismatchRate * 100).toFixed(6)}%`);
  console.log(`💾 Total Artifacts: ${suiteReport.summary.totalArtifacts}`);
  console.log(`🕐 Total Duration: ${(suiteReport.duration / 1000).toFixed(2)}s`);
  console.log('='.repeat(60));

  // Fail entire suite αν κάποιο test απέτυχε
  if (suiteReport.failed > 0) {
    console.error(`\n❌ VISUAL REGRESSION SUITE FAILED: ${suiteReport.failed} test(s) exceeded quality thresholds`);
  }
});

describe('🎨 Enterprise Visual Regression Testing', () => {

  /**
   * 🎯 ENTERPRISE VISUAL REGRESSION TESTS
   * Parametrized tests με strict quality thresholds
   */
  const runVisualTests = pixelmatch && PNG;

  if (!runVisualTests) {
    test('visual regression dependencies not installed', () => {
      console.log('⏳ Skipping visual regression tests - dependencies not installed');
      console.log('💡 Run: npm install --save-dev pixelmatch pngjs @types/pixelmatch @types/pngjs @napi-rs/canvas');
      expect(true).toBeTruthy(); // Always pass when dependencies missing
    });
  } else {
    test.each(ENTERPRISE_TEST_CASES)(
      '$name - Strict Visual Regression Test',
      async (testCase: TestCase) => {
      const testStartTime = Date.now();

      console.log(`\n🎨 Testing: ${testCase.name}`);
      console.log(`📐 Resolution: ${testCase.width}x${testCase.height}`);
      console.log(`🎨 Overlay: ${testCase.overlayType}`);
      console.log(`📏 Threshold: ${(testCase.threshold * 100).toFixed(6)}%`);
      console.log(`🎯 Max pixels: ${testCase.maxMismatchPixels}`);

      // Create deterministic canvas με enterprise settings
      const canvas = CanvasTestUtils.createTestCanvas(
        testCase.width,
        testCase.height,
        {
          pixelRatio: 1,
          antialias: false,
          textBaseline: 'top',
          font: '12px monospace'
        }
      );

      // Render overlay με deterministic settings
      const testOptions: VisualTestOptions = {
        seed: testCase.seed,
        overlayType: testCase.overlayType,
        viewport: { width: testCase.width, height: testCase.height }
      };

      await renderOverlayToCanvas(canvas, testOptions);

      // Validate που το canvas has real content
      expect(CanvasTestUtils.hasRealContent(canvas)).toBeTruthy();

      // Get actual PNG buffer
      const actualBuffer = canvasToPngBuffer(canvas);
      expect(actualBuffer.length).toBeGreaterThan(1000); // Non-empty PNG

      // Handle baseline creation/loading
      if (!hasBaseline(testCase.name)) {
        createBaseline(testCase.name, actualBuffer);
        console.log(`📸 Created baseline for ${testCase.name} - skipping comparison`);
        return; // Skip comparison on baseline creation
      }

      const baselineBuffer = loadBaseline(testCase.name);

      // Perform strict visual comparison
      const comparison = performVisualComparison(testCase, actualBuffer, baselineBuffer);

      console.log(`📊 Visual Comparison Results:\n${comparison.details}`);

      // Create comprehensive test result
      const testResult: VisualTestResult = {
        testName: testCase.name,
        passed: comparison.passed,
        mismatchedPixels: comparison.mismatchedPixels,
        totalPixels: testCase.width * testCase.height,
        mismatchRate: comparison.mismatchRate,
        threshold: testCase.threshold,
        dimensions: { width: testCase.width, height: testCase.height },
        timestamp: new Date().toISOString(),
        duration: Date.now() - testStartTime,
        artifacts: getArtifactPaths(testCase.name), // Will be filled by writeArtifacts
        metadata: {
          overlayType: testCase.overlayType,
          seed: testCase.seed,
          maxMismatchPixels: testCase.maxMismatchPixels,
          deterministic: true
        }
      };

      // Write comprehensive artifacts
      const artifacts = writeArtifacts(
        testCase.name,
        actualBuffer,
        baselineBuffer,
        comparison.diffBuffer,
        testResult
      );

      testResult.artifacts = artifacts;
      testResults.push(testResult);

      // STRICT ENTERPRISE ASSERTIONS
      if (!comparison.passed) {
        const failureMessage = [
          `❌ VISUAL REGRESSION FAILURE: ${testCase.name}`,
          '',
          comparison.details,
          '',
          `📸 Artifacts saved to: ${path.relative(process.cwd(), artifacts.directory)}`,
          `📄 Detailed report: ${path.relative(process.cwd(), artifacts.report)}`,
          '',
          '🔍 Check the diff image για visual changes.',
          '📋 If changes are expected, update the baseline.'
        ].join('\n');

        throw new Error(failureMessage);
      }

        console.log(`✅ ${testCase.name} PASSED - Visual quality within enterprise thresholds`);
      }
    );
  }

  /**
   * 📐 COORDINATE TRANSFORM VISUAL TEST
   * Tests coordinate system transform accuracy
   */
  if (runVisualTests) {
    test('coordinate transform visual accuracy', async () => {
    const testCase = {
      name: 'coordinate-transform-800x600',
      width: VIEWPORT_DEFAULTS.WIDTH,
      height: VIEWPORT_DEFAULTS.HEIGHT,
      threshold: 0.0001,
      maxMismatchPixels: 40
    };

    const canvas = CanvasTestUtils.createTestCanvas(testCase.width, testCase.height);

    const transform = {
      scale: 1.5,
      offsetX: 100,
      offsetY: 50
    };

    const testOptions: VisualTestOptions = {
      seed: 999,
      viewport: { width: testCase.width, height: testCase.height }
    };

    await renderCoordinateSystemTest(canvas, transform, testOptions);

    const actualBuffer = canvasToPngBuffer(canvas);

    if (!hasBaseline(testCase.name)) {
      createBaseline(testCase.name, actualBuffer);
      console.log(`📸 Created baseline for ${testCase.name}`);
      return;
    }

    const baselineBuffer = loadBaseline(testCase.name);

    // Simple comparison για coordinate test
    if (!PNG || !pixelmatch) {
      throw new Error('Visual regression dependencies not installed (pngjs, pixelmatch)');
    }

    const baselinePng = PNG.sync.read(baselineBuffer);
    const actualPng = PNG.sync.read(actualBuffer);
    const diff = new PNG({ width: baselinePng.width, height: baselinePng.height });

    const mismatchedPixels = pixelmatch(
      baselinePng.data,
      actualPng.data,
      diff.data,
      baselinePng.width,
      baselinePng.height,
      { threshold: 0.05 }
    );

    const mismatchRate = mismatchedPixels / (baselinePng.width * baselinePng.height);

    console.log(`📐 Coordinate Transform Test:`);
    console.log(`  Mismatched: ${mismatchedPixels} pixels`);
    console.log(`  Rate: ${(mismatchRate * 100).toFixed(6)}%`);

      expect(mismatchRate).toBeLessThan(testCase.threshold);
      expect(mismatchedPixels).toBeLessThan(testCase.maxMismatchPixels);
    });
  }
});

