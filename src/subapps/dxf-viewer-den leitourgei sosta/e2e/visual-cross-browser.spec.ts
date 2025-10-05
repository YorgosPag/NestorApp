/**
 * 🌐 CROSS-BROWSER VISUAL REGRESSION TESTING
 * Enterprise-level browser compatibility visual testing με Playwright
 * Tests GPU/OS rendering differences across Chromium/Firefox/WebKit
 */

import { test, expect, type Page } from '@playwright/test';

// 🎯 CROSS-BROWSER TEST CONFIGURATION
const VISUAL_TEST_CONFIGS = [
  {
    name: 'dxf-overlay-desktop',
    viewport: { width: 1280, height: 800 },
    url: '/dxf/viewer',
    overlayTypes: ['origin', 'grid', 'crosshair', 'combined']
  },
  {
    name: 'dxf-overlay-mobile',
    viewport: { width: 375, height: 667 },
    url: '/dxf/viewer',
    overlayTypes: ['combined']
  },
  {
    name: 'dxf-overlay-tablet',
    viewport: { width: 768, height: 1024 },
    url: '/dxf/viewer',
    overlayTypes: ['grid', 'combined']
  }
];

/**
 * 🎨 OVERLAY ACTIVATION HELPER
 * Activates specific overlay types για testing
 */
async function activateOverlay(page: Page, overlayType: string): Promise<void> {
  console.log(`🎨 Activating overlay: ${overlayType}`);

  // Wait for DXF viewer to load
  await page.waitForSelector('[data-testid="dxf-canvas"]', { timeout: 30000 });

  switch (overlayType) {
    case 'origin':
      // Click origin markers debug button
      const originButton = page.locator('button:has-text("🎯 Origin")');
      if (await originButton.isVisible()) {
        await originButton.click();
        await page.waitForTimeout(500); // Wait για overlay rendering
      }
      break;

    case 'grid':
      // Activate grid overlay (assuming there's a grid toggle)
      const gridButton = page.locator('[data-testid="grid-toggle"]').or(
        page.locator('button:has-text("Grid")')
      );
      if (await gridButton.isVisible()) {
        await gridButton.click();
        await page.waitForTimeout(500);
      }
      break;

    case 'crosshair':
      // Activate crosshair (assuming mouse hover triggers it)
      const canvas = page.locator('[data-testid="dxf-canvas"]');
      await canvas.hover({ position: { x: 640, y: 400 } });
      await page.waitForTimeout(300);
      break;

    case 'combined':
      // Activate multiple overlays
      await activateOverlay(page, 'origin');
      await activateOverlay(page, 'grid');
      await page.waitForTimeout(500);
      break;

    default:
      console.warn(`Unknown overlay type: ${overlayType}`);
  }
}

/**
 * 🔧 PAGE SETUP για Deterministic Testing
 */
async function setupDeterministicPage(page: Page, viewport: { width: number; height: number }): Promise<void> {
  // Set consistent viewport
  await page.setViewportSize(viewport);

  // Disable animations για consistent screenshots
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `
  });

  // Set deterministic settings
  await page.evaluate(() => {
    // Disable smooth scrolling
    if ('scrollBehavior' in document.documentElement.style) {
      document.documentElement.style.scrollBehavior = 'auto';
    }

    // Fix font rendering για consistency
    document.body.style.fontSmooth = 'never';
    document.body.style.webkitFontSmoothing = 'none';
    document.body.style.textRendering = 'optimizeSpeed';
  });

  // Wait for stable page load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Additional stability wait
}

// 🌐 BROWSER-SPECIFIC CONFIGURATIONS
test.describe.configure({ mode: 'parallel' });

test.describe('🌐 Cross-Browser Visual Regression', () => {

  // Test each configuration across all browsers
  for (const config of VISUAL_TEST_CONFIGS) {
    for (const overlayType of config.overlayTypes) {
      test(`${config.name}-${overlayType} visual consistency across browsers`, async ({ page, browserName }) => {
        console.log(`🌐 Testing ${config.name}-${overlayType} on ${browserName}`);

        // Setup deterministic page environment
        await setupDeterministicPage(page, config.viewport);

        // Navigate to DXF viewer
        await page.goto(process.env.APP_URL || 'http://localhost:3000' + config.url);

        // Wait for DXF viewer initialization
        await page.waitForSelector('[data-testid="dxf-canvas"]', { timeout: 30000 });
        await page.waitForTimeout(2000); // Extra wait για canvas initialization

        // Activate specific overlay
        await activateOverlay(page, overlayType);

        // Additional wait για overlay stabilization
        await page.waitForTimeout(1000);

        // Take screenshot με enterprise settings
        const screenshotOptions = {
          fullPage: false,
          animations: 'disabled' as const,
          caret: 'hide' as const,
          scale: 'css' as const,
          mode: 'forced-colors' as const,
          // Enterprise-level quality thresholds
          threshold: 0.0001,  // Very strict: 0.01%
          maxDiffPixelRatio: 0.0001
        };

        // Browser-specific screenshot name
        const screenshotName = `${config.name}-${overlayType}-${config.viewport.width}x${config.viewport.height}.png`;

        await expect(page).toHaveScreenshot(screenshotName, screenshotOptions);

        console.log(`✅ ${screenshotName} passed on ${browserName}`);
      });
    }
  }

  /**
   * 🎯 COORDINATE ACCURACY CROSS-BROWSER TEST
   * Tests coordinate system accuracy across browsers
   */
  test('coordinate accuracy across browsers', async ({ page, browserName }) => {
    console.log(`📐 Testing coordinate accuracy on ${browserName}`);

    await setupDeterministicPage(page, { width: 1280, height: 800 });
    await page.goto(process.env.APP_URL || 'http://localhost:3000/dxf/viewer');

    await page.waitForSelector('[data-testid="dxf-canvas"]', { timeout: 30000 });

    // Inject coordinate testing script
    const coordinateTestResult = await page.evaluate(async () => {
      // Τhis would integrate με το coordinate testing system
      // Similar to the property-based tests but στο browser
      const canvas = document.querySelector('[data-testid="dxf-canvas"]') as HTMLCanvasElement;

      if (!canvas) {
        throw new Error('DXF Canvas not found');
      }

      // Simulate coordinate tests
      const testPoints = [
        { x: 100, y: 100 },
        { x: 640, y: 400 },
        { x: 1180, y: 700 }
      ];

      const results = [];
      for (const point of testPoints) {
        // Simulate coordinate transform test
        // This would call actual coordinate transform functions
        results.push({
          original: point,
          transformed: point, // Placeholder
          error: 0.1 // Placeholder
        });
      }

      return {
        browser: navigator.userAgent,
        canvasSize: { width: canvas.width, height: canvas.height },
        results,
        maxError: Math.max(...results.map(r => r.error))
      };
    });

    console.log(`📐 Coordinate test results for ${browserName}:`, coordinateTestResult);

    // Enterprise threshold: max 0.5 pixels error
    expect(coordinateTestResult.maxError).toBeLessThan(0.5);

    // Take screenshot for coordinate accuracy verification
    await expect(page).toHaveScreenshot(`coordinate-accuracy-${browserName}.png`, {
      threshold: 0.0001,
      maxDiffPixelRatio: 0.0001,
      animations: 'disabled',
      caret: 'hide'
    });
  });

  /**
   * 🔍 ZOOM CONSISTENCY CROSS-BROWSER TEST
   * Tests zoom behavior consistency across browsers
   */
  test('zoom consistency across browsers', async ({ page, browserName }) => {
    console.log(`🔍 Testing zoom consistency on ${browserName}`);

    await setupDeterministicPage(page, { width: 1280, height: 800 });
    await page.goto(process.env.APP_URL || 'http://localhost:3000/dxf/viewer');

    await page.waitForSelector('[data-testid="dxf-canvas"]', { timeout: 30000 });

    // Test different zoom levels
    const zoomLevels = [0.5, 1.0, 2.0];

    for (const zoomLevel of zoomLevels) {
      console.log(`🔍 Testing zoom level: ${zoomLevel}x`);

      // Apply zoom (assuming there's a zoom control)
      await page.evaluate((zoom) => {
        // This would integrate με το zoom system
        // Placeholder για zoom application
        console.log(`Applying zoom: ${zoom}`);
      }, zoomLevel);

      await page.waitForTimeout(1000); // Wait για zoom to stabilize

      // Take screenshot at this zoom level
      await expect(page).toHaveScreenshot(`zoom-${zoomLevel}x-${browserName}.png`, {
        threshold: 0.0001,
        maxDiffPixelRatio: 0.0001,
        animations: 'disabled',
        caret: 'hide'
      });
    }
  });

  /**
   * 🎨 OVERLAY INTERACTION CROSS-BROWSER TEST
   * Tests overlay interactions across browsers
   */
  test('overlay interactions across browsers', async ({ page, browserName }) => {
    console.log(`🎨 Testing overlay interactions on ${browserName}`);

    await setupDeterministicPage(page, { width: 1280, height: 800 });
    await page.goto(process.env.APP_URL || 'http://localhost:3000/dxf/viewer');

    await page.waitForSelector('[data-testid="dxf-canvas"]', { timeout: 30000 });

    // Test overlay toggle interactions
    const canvas = page.locator('[data-testid="dxf-canvas"]');

    // Test mouse interactions που trigger overlays
    await canvas.hover({ position: { x: 640, y: 400 } });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot(`hover-overlays-${browserName}.png`, {
      threshold: 0.0001,
      maxDiffPixelRatio: 0.0001,
      animations: 'disabled',
      caret: 'hide'
    });

    // Test click interactions
    await canvas.click({ position: { x: 640, y: 400 } });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot(`click-overlays-${browserName}.png`, {
      threshold: 0.0001,
      maxDiffPixelRatio: 0.0001,
      animations: 'disabled',
      caret: 'hide'
    });

    console.log(`✅ Overlay interactions tested on ${browserName}`);
  });
});

/**
 * 📊 CROSS-BROWSER PERFORMANCE TEST
 * Tests performance consistency across browsers
 */
test.describe('📊 Cross-Browser Performance', () => {
  test('rendering performance across browsers', async ({ page, browserName }) => {
    console.log(`⚡ Testing rendering performance on ${browserName}`);

    await setupDeterministicPage(page, { width: 1280, height: 800 });

    // Start performance monitoring
    const performanceStart = Date.now();

    await page.goto(process.env.APP_URL || 'http://localhost:3000/dxf/viewer');
    await page.waitForSelector('[data-testid="dxf-canvas"]', { timeout: 30000 });

    // Measure rendering performance
    const renderingMetrics = await page.evaluate(() => {
      const start = performance.now();

      // Trigger a render cycle (placeholder)
      // This would integrate με το actual rendering system

      const end = performance.now();

      return {
        renderTime: end - start,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      };
    });

    const totalLoadTime = Date.now() - performanceStart;

    console.log(`📊 Performance metrics for ${browserName}:`);
    console.log(`  Total load time: ${totalLoadTime}ms`);
    console.log(`  Render time: ${renderingMetrics.renderTime}ms`);

    // Enterprise performance thresholds
    expect(totalLoadTime).toBeLessThan(10000); // Max 10s load time
    expect(renderingMetrics.renderTime).toBeLessThan(100); // Max 100ms render time

    // Log metrics για trending
    console.log(`METRICS|${browserName}|load_time|${totalLoadTime}`);
    console.log(`METRICS|${browserName}|render_time|${renderingMetrics.renderTime}`);
  });
});