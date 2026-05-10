import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __dxfTest: {
      fitToView: () => void;
      zoomIn: () => void;
      zoomOut: () => void;
      getRef: () => unknown;
      isReady: () => boolean;
    };
  }
}

const BASE_URL = '/test-harness/dxf-canvas';
const CANVAS_READY = '[data-testid="dxf-canvas-ready"]';
const SCREENSHOT_OPTIONS = { threshold: 0.01, maxDiffPixelRatio: 0.001 };

async function loadHarness(page: Page, path = BASE_URL): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator(CANVAS_READY).waitFor({ timeout: 60000 });
  await page.waitForTimeout(300);
}

async function fitAndWait(page: Page): Promise<void> {
  await page.evaluate(() => window.__dxfTest.fitToView());
  await page.waitForTimeout(200);
}

test.describe('DXF Canvas Visual Regression', () => {
  test('idle — DXF loaded, default transform', async ({ page }) => {
    await loadHarness(page);
    await expect(page).toHaveScreenshot('idle.png', SCREENSHOT_OPTIONS);
  });

  test('fit-to-view — scene fitted to viewport', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await expect(page).toHaveScreenshot('fit-to-view.png', SCREENSHOT_OPTIONS);
  });

  test('zoom-2x — 1.5× zoom in from fit', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.zoomIn());
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('zoom-2x.png', SCREENSHOT_OPTIONS);
  });

  test('zoom-0.5x — 0.67× zoom out from fit', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.zoomOut());
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('zoom-0.5x.png', SCREENSHOT_OPTIONS);
  });

  test('hover-entity — crosshair over scene center', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.mouse.move(640, 400);
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('hover-entity.png', SCREENSHOT_OPTIONS);
  });

  test('selection-box — drag marquee over scene', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.mouse.move(300, 250);
    await page.mouse.down();
    await page.mouse.move(700, 500, { steps: 5 });
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('selection-box.png', SCREENSHOT_OPTIONS);
    await page.mouse.up();
  });

  test('ruler-grid — rulers and grid active', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?rulers=1&grid=1`);
    await fitAndWait(page);
    await expect(page).toHaveScreenshot('ruler-grid.png', SCREENSHOT_OPTIONS);
  });
});

test.describe('Phase 2 — Entity Rendering', () => {
  test('entity-line — horizontal + diagonal + vertical lines', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?fixture=entity-line`);
    await fitAndWait(page);
    await expect(page).toHaveScreenshot('entity-line.png', SCREENSHOT_OPTIONS);
  });

  test('entity-circle — large + small concentric circles', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?fixture=entity-circle`);
    await fitAndWait(page);
    await expect(page).toHaveScreenshot('entity-circle.png', SCREENSHOT_OPTIONS);
  });

  test('entity-arc — semicircle + quarter arc (CCW flag)', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?fixture=entity-arc`);
    await fitAndWait(page);
    await expect(page).toHaveScreenshot('entity-arc.png', SCREENSHOT_OPTIONS);
  });

  test('entity-polyline — closed polygon + open path', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?fixture=entity-polyline`);
    await fitAndWait(page);
    await expect(page).toHaveScreenshot('entity-polyline.png', SCREENSHOT_OPTIONS);
  });

  test('entity-text — normal label + 45° rotated text', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?fixture=entity-text`);
    await fitAndWait(page);
    await expect(page).toHaveScreenshot('entity-text.png', SCREENSHOT_OPTIONS);
  });

  test('entity-angle — 90° + 45° angle measurements', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?fixture=entity-angle`);
    await fitAndWait(page);
    await expect(page).toHaveScreenshot('entity-angle.png', SCREENSHOT_OPTIONS);
  });
});
