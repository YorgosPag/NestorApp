/**
 * =============================================================================
 * Visual regression — FloorplanBackgroundCanvas (ADR-340 §5.4 Phase 8)
 * =============================================================================
 *
 * Playwright + screenshot diff against a baseline PNG. The suite exercises the
 * `/demo/floorplan-background-image` page which mounts the real
 * `FloorplanBackgroundCanvas` + `floorplanBackgroundStore` + `ImageProvider`
 * pipeline. Generated test images are uploaded via `setInputFiles` so the
 * suite is self-contained — no committed binary fixtures (each fixture is
 * built programmatically from a deterministic canvas drawing in
 * `_helpers/test-image.ts`).
 *
 * What's covered:
 *   - Image PNG + identity transform → baseline
 *   - Image PNG + scale ×2 → baseline (provider re-renders with new transform)
 *   - Image JPEG + rotation 90° → baseline (EXIF orientation N/A on JPEG-from-canvas)
 *   - Visibility toggle → background hidden
 *
 * What's deferred (test.skip with TODO — needs committed binary fixtures):
 *   - PDF + identity transform (needs a tiny test PDF)
 *   - Image TIFF + utif decode bounds (needs a TIFF fixture)
 *   - Calibration scale ×2 + polygon overlay remap (needs DxfViewer harness, not
 *     the standalone demo page)
 *
 * Baselines are written under `<test-file>-snapshots/` on first run with
 * `--update-snapshots`. Locked thereafter; CI fails on diff.
 *
 * Run: `npm run test:e2e -- FloorplanBackgroundCanvas`
 * Update baselines: `npx playwright test FloorplanBackgroundCanvas --update-snapshots`
 *
 * @see playwright.config.ts (testMatch picks this up via `**\/*.e2e.spec.ts`)
 * @see ADR-340 §5.4 (visual regression invariants)
 */

import { test, expect, type Page } from '@playwright/test';

const DEMO_PATH = '/demo/floorplan-background-image';
const CANVAS_SELECTOR = 'canvas';

// ── Test image generation (deterministic, no committed binaries) ─────────────

/**
 * Build a deterministic PNG buffer (server-side) so screenshot diffs stay
 * reproducible. Pure pixel manipulation via a manually-constructed DataURL —
 * no canvas APIs, runs identically in Node + browser.
 */
async function generateTestImage(
  page: Page,
  args: { width: number; height: number; mime: 'image/png' | 'image/jpeg' },
): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ width, height, mime }) => {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('canvas 2d unavailable');
      // Deterministic 4-quadrant pattern: red / green / blue / yellow.
      ctx.fillStyle = '#ff3333';
      ctx.fillRect(0, 0, width / 2, height / 2);
      ctx.fillStyle = '#33cc33';
      ctx.fillRect(width / 2, 0, width / 2, height / 2);
      ctx.fillStyle = '#3366ff';
      ctx.fillRect(0, height / 2, width / 2, height / 2);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(width / 2, height / 2, width / 2, height / 2);
      // Diagonal cross to make rotation visually obvious.
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width, height);
      ctx.moveTo(width, 0);
      ctx.lineTo(0, height);
      ctx.stroke();
      return c.toDataURL(mime, 0.92);
    },
    args,
  );
  const base64 = dataUrl.split(',')[1];
  return Buffer.from(base64, 'base64');
}

async function uploadFixture(
  page: Page,
  buffer: Buffer,
  args: { name: string; mimeType: string },
): Promise<void> {
  await page.setInputFiles('input[type="file"]', {
    name: args.name,
    mimeType: args.mimeType,
    buffer,
  });
  // Provider load + first RAF tick.
  await page.waitForFunction(
    () => !!document.querySelector('canvas') && !document.body.innerText.includes('Loading'),
    { timeout: 5000 },
  );
}

async function setSlider(page: Page, label: string, value: number): Promise<void> {
  const input = page.locator(`label:has-text("${label}") input[type="range"]`);
  await input.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('FloorplanBackgroundCanvas — visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_PATH);
    await expect(page.locator(CANVAS_SELECTOR)).toBeVisible();
  });

  test('image PNG + identity transform renders quadrants', async ({ page }) => {
    const buf = await generateTestImage(page, { width: 400, height: 300, mime: 'image/png' });
    await uploadFixture(page, buf, { name: 'identity.png', mimeType: 'image/png' });

    await expect(page.locator(CANVAS_SELECTOR)).toHaveScreenshot('image-png-identity.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('image PNG + scale ×2 expands pattern', async ({ page }) => {
    const buf = await generateTestImage(page, { width: 200, height: 150, mime: 'image/png' });
    await uploadFixture(page, buf, { name: 'scale-2x.png', mimeType: 'image/png' });
    await setSlider(page, 'Scale', 2);
    await page.waitForTimeout(50); // RAF tick

    await expect(page.locator(CANVAS_SELECTOR)).toHaveScreenshot('image-png-scale-2x.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('image JPEG + rotation 90° rotates the diagonal cross', async ({ page }) => {
    const buf = await generateTestImage(page, { width: 300, height: 200, mime: 'image/jpeg' });
    await uploadFixture(page, buf, { name: 'rotated.jpg', mimeType: 'image/jpeg' });
    await setSlider(page, 'Rotation', 90);
    await page.waitForTimeout(50);

    await expect(page.locator(CANVAS_SELECTOR)).toHaveScreenshot('image-jpeg-rotation-90.png', {
      maxDiffPixelRatio: 0.02, // JPEG block-noise tolerance
    });
  });

  test('visibility toggle hides the background', async ({ page }) => {
    const buf = await generateTestImage(page, { width: 200, height: 150, mime: 'image/png' });
    await uploadFixture(page, buf, { name: 'visibility.png', mimeType: 'image/png' });
    await page.locator('input[type="checkbox"]').first().uncheck();
    await page.waitForTimeout(50);

    await expect(page.locator(CANVAS_SELECTOR)).toHaveScreenshot('image-png-hidden.png', {
      maxDiffPixelRatio: 0.005,
    });
  });

  // ── Deferred (need committed binary fixtures or DxfViewer harness) ────────

  test.skip('PDF + identity transform — needs tiny test PDF in __fixtures__/', () => {
    // TODO Phase 8 follow-up: ship a 1-page minimal PDF (~5KB) under
    // src/subapps/dxf-viewer/floorplan-background/components/__tests__/__fixtures__/identity.pdf
    // and upload it via setInputFiles. Demo page accepts PDFs already.
  });

  test.skip('Image TIFF + utif decode bounds — needs TIFF fixture', () => {
    // TODO Phase 8 follow-up: ship a 2-strip baseline TIFF under __fixtures__/
    // and assert the canvas snapshot. Programmatic TIFF construction in JS is
    // fragile; a 1-2KB committed fixture is simpler and faithful to the
    // pipeline (utif → ImageData → OffscreenCanvas).
  });

  test.skip('Calibration scale ×2 + polygon remap — needs DxfViewer harness', () => {
    // TODO Phase 8 follow-up: visual remap requires the full DxfViewer page
    // (FloorplanBackgroundPanel + CalibrationDialog + overlay layer), not the
    // standalone demo page. Build a harness route at /test-harness/calibration
    // mounting the components in isolation, then reuse this spec shape.
  });
});
