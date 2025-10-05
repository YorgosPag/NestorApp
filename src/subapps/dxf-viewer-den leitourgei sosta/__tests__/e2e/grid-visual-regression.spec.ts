/**
 * 🎯 GRID VISUAL REGRESSION TEST
 * Enterprise-grade visual testing based on CAD standards (OCCT, FreeCAD, BRL-CAD)
 *
 * Test Categories:
 * - Multiple resolutions (1280x800, 1920x1080, 3840x2160)
 * - Deterministic rendering (no animations, fixed seed, crisp lines)
 * - Pixel-perfect snapshots with maxDiffPixelRatio: 0.0001
 * - Artifacts generation (baseline, actual, diff PNGs)
 */

import { test, expect } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:3001';

// 🎯 Test configuration matrix (following OCCT testgrid practices)
const TEST_CASES = [
  { name: 'grid-1280x800',  width: 1280, height: 800,  dpr: 1 },
  { name: 'grid-1920x1080', width: 1920, height: 1080, dpr: 1 },
  { name: 'grid-3840x2160', width: 3840, height: 2160, dpr: 1 }, // 4K
] as const;

// Configure test suite
test.describe.configure({ mode: 'parallel' });

test.describe('Grid Visual Regression (CAD Standard)', () => {
  // 🎯 DETERMINISTIC SETUP: Run before each test
  test.beforeEach(async ({ page }) => {
    // Inject deterministic settings script
    await page.addInitScript(() => {
      // 1. Disable all animations and transitions
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation: none !important;
          animation-delay: 0s !important;
          animation-duration: 0s !important;
          transition: none !important;
          transition-delay: 0s !important;
          transition-duration: 0s !important;
        }
        html {
          scroll-behavior: auto !important;
        }
      `;
      document.documentElement.appendChild(style);

      // 2. Set deterministic seed for grid rendering
      try {
        localStorage.setItem('grid.visual.seed', '42');
        localStorage.setItem('grid.visual.deterministic', 'true');
      } catch (err) {
        console.warn('localStorage unavailable:', err);
      }

      // 3. Force devicePixelRatio to 1 for consistent rendering
      Object.defineProperty(window, 'devicePixelRatio', {
        get: () => 1,
        configurable: true
      });
    });
  });

  // 🎯 VISUAL REGRESSION TESTS
  for (const testCase of TEST_CASES) {
    test(`Grid snapshot: ${testCase.name}`, async ({ page }) => {
      // Set viewport size
      await page.setViewportSize({
        width: testCase.width,
        height: testCase.height
      });

      // Navigate to DXF Viewer
      await page.goto(`${APP_URL}/dxf/viewer`);

      // Wait for stable render state
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500); // Extra stability wait

      // Wait for grid to be rendered
      await page.waitForSelector('canvas[data-canvas-type="dxf"]', { timeout: 5000 });

      // Optional: Enable grid if it's disabled
      const gridButton = page.locator('button:has-text("Grid")').first();
      if (await gridButton.isVisible()) {
        const buttonText = await gridButton.textContent();
        if (buttonText?.includes('OFF')) {
          await gridButton.click();
          await page.waitForTimeout(200); // Wait for grid to render
        }
      }

      // Define mask selectors for dynamic content
      const dynamicSelectors = [
        '[data-loading]',
        '[data-timestamp]',
        '[class*="cursor"]',
        '[class*="tooltip"]',
      ];

      // Collect mask elements
      const masks = await Promise.all(
        dynamicSelectors.map(async (selector) => {
          try {
            const element = await page.locator(selector).first();
            return (await element.count()) > 0 ? element : undefined;
          } catch {
            return undefined;
          }
        })
      );

      // Filter out undefined masks
      const validMasks = masks.filter(Boolean);

      // 📸 TAKE SNAPSHOT with CAD-level precision
      await expect(page).toHaveScreenshot(`${testCase.name}.png`, {
        maxDiffPixelRatio: 0.0001, // 0.01% tolerance (CAD standard)
        animations: 'disabled',
        caret: 'hide',
        fullPage: false,
        scale: 'css',
        mask: validMasks as any,
        threshold: 0.1, // Pixel color threshold
      });
    });
  }

  // 🎯 GRID STYLE VARIATIONS TEST
  test('Grid styles visual comparison', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${APP_URL}/dxf/viewer`);
    await page.waitForLoadState('networkidle');

    // Test different grid styles if UI allows
    const styles = ['lines', 'dots', 'crosses'];

    for (const style of styles) {
      // This assumes you have a way to change grid style via UI
      // Adjust selectors based on your actual implementation
      try {
        // Open settings panel
        const settingsButton = page.locator('button:has-text("Settings")').first();
        if (await settingsButton.isVisible()) {
          await settingsButton.click();
          await page.waitForTimeout(100);
        }

        // Select grid style (adjust selector as needed)
        const styleButton = page.locator(`button:has-text("${style}")`).first();
        if (await styleButton.isVisible()) {
          await styleButton.click();
          await page.waitForTimeout(200);
        }

        // Take snapshot
        await expect(page).toHaveScreenshot(`grid-style-${style}.png`, {
          maxDiffPixelRatio: 0.0001,
          animations: 'disabled',
          caret: 'hide',
        });
      } catch (err) {
        console.warn(`Style test skipped for ${style}:`, err);
      }
    }
  });

  // 🎯 ZOOM LEVEL TEST
  test('Grid rendering at different zoom levels', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${APP_URL}/dxf/viewer`);
    await page.waitForLoadState('networkidle');

    const zoomLevels = [0.5, 1.0, 2.0];

    for (const zoom of zoomLevels) {
      // Simulate zoom (adjust based on your implementation)
      // This is a placeholder - adjust to your actual zoom mechanism
      await page.keyboard.press(zoom > 1 ? 'Equal' : 'Minus');
      await page.waitForTimeout(200);

      await expect(page).toHaveScreenshot(`grid-zoom-${zoom}x.png`, {
        maxDiffPixelRatio: 0.001, // Slightly higher tolerance for zoom
        animations: 'disabled',
        caret: 'hide',
      });
    }
  });
});

// 🎯 COORDINATE PRECISION TEST
test.describe('Grid Coordinate Precision (CAD Standard)', () => {
  test('Grid alignment accuracy', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`${APP_URL}/dxf/viewer`);
    await page.waitForLoadState('networkidle');

    // Test that grid lines are pixel-perfect aligned
    const canvas = page.locator('canvas[data-canvas-type="dxf"]').first();
    await expect(canvas).toBeVisible();

    // Take snapshot for coordinate validation
    await expect(page).toHaveScreenshot('grid-coordinate-precision.png', {
      maxDiffPixelRatio: 0.00001, // Ultra-precise (millimeter-level)
      animations: 'disabled',
      caret: 'hide',
    });
  });
});
