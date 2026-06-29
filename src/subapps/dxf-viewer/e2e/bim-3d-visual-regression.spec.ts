import { test, expect, type Page } from '@playwright/test';

/**
 * BIM 3D Visual Regression (ADR-550 Φ2 golden-image verification).
 *
 * Big-player practice (Autodesk/Maxon): render a deterministic scene off-screen
 * and pixel-diff vs a golden baseline. Mirrors the 2D `dxf-visual-regression`
 * harness. Drives the REAL `BimViewport3D` (WebGL) mounted at `/test-harness/bim-3d`
 * with the 11-family fixture, then compares the GL framebuffer capture.
 *
 * The capture proves the ADR-550 Φ2 auto-wiring (POINT_ENTITY_CONTRACTS loop)
 * renders all 11 point-entity families: foundation, electrical-panel, mep-manifold,
 * mep-radiator, mep-boiler, mep-water-heater, railing, roof, floor-finish,
 * mep-underfloor, furniture.
 *
 * We compare the GL framebuffer (forced render + readPixels via
 * `captureFrameDataURL`), not a page screenshot — the WebGL canvas uses
 * `preserveDrawingBuffer: false`, so a DOM screenshot can capture an empty
 * compositor frame. The GL capture is deterministic under swiftshader.
 */

declare global {
  interface Window {
    __bim3dTest: {
      isReady: () => boolean;
      frame: () => void;
      capture: () => string;
    };
  }
}

const BASE_URL = '/test-harness/bim-3d';
const READY = '[data-testid="bim-3d-ready"]';
const PNG_PREFIX = 'data:image/png;base64,';

async function loadHarness(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator(READY).waitFor({ timeout: 120000 });
  // Re-frame after ready (entities guaranteed synced) + settle the camera
  // animation (frameBounds animates over ~FRAME_SCENE_DURATION_MS).
  await page.evaluate(() => window.__bim3dTest.frame());
  await page.waitForTimeout(2000);
}

test.describe('BIM 3D Point-Entity Rendering (ADR-550 Φ2)', () => {
  test('point-entities — 11 families render in 3D', async ({ page }) => {
    await loadHarness(page);
    const dataUrl = await page.evaluate(() => window.__bim3dTest.capture());
    expect(dataUrl.startsWith(PNG_PREFIX)).toBe(true);
    const png = Buffer.from(dataUrl.slice(PNG_PREFIX.length), 'base64');
    expect(png).toMatchSnapshot('point-entities-3d.png');
  });
});
