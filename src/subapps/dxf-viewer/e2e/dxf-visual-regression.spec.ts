import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __dxfTest: {
      fitToView: () => void;
      zoomIn: () => void;
      zoomOut: () => void;
      getRef: () => unknown;
      isReady: () => boolean;
      selectEntities: (ids: string[]) => void;
      clearSelection: () => void;
      getSelectedEntityIds: () => string[];
      worldToScreen: (wx: number, wy: number) => { x: number; y: number };
      drawPreview: (entity: Record<string, unknown>) => void;
      clearPreview: () => void;
      setActiveTool: (tool: string) => void;
      updateSceneEntity: (id: string, patch: Record<string, unknown>) => void;
      addSceneEntity: (entity: Record<string, unknown>) => void;
      removeSceneEntity: (id: string) => void;
      showSnap: (type: string, wx: number, wy: number) => void;
      hideSnap: () => void;
    };
  }
}

const BASE_URL = '/test-harness/dxf-canvas';
const CANVAS_READY = '[data-testid="dxf-canvas-ready"]';
const SCREENSHOT_OPTIONS = { threshold: 0.01, maxDiffPixelRatio: 0.001 };

async function loadHarness(page: Page, path = BASE_URL): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator(CANVAS_READY).waitFor({ timeout: 120000 });
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

test.describe('Phase 3 — Selection', () => {
  test('click-to-select — click on circle entity selects it', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    const pos = await page.evaluate(() => window.__dxfTest.worldToScreen(250, 200));
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('click-to-select.png', SCREENSHOT_OPTIONS);
  });

  test('multi-select — two entities selected programmatically', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.selectEntities(['line-bottom', 'circle-1']));
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('multi-select.png', SCREENSHOT_OPTIONS);
  });

  test('select-all — Ctrl+A selects every entity', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('select-all.png', SCREENSHOT_OPTIONS);
  });

  test('deselect — clearSelection returns to unselected state', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.selectEntities(['circle-1']));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__dxfTest.clearSelection());
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('deselect.png', SCREENSHOT_OPTIONS);
  });

  test('select-then-delete — Delete key removes selected entity', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.selectEntities(['circle-1']));
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('select-then-delete.png', SCREENSHOT_OPTIONS);
  });
});

test.describe('Phase 4 — Drawing Tool Previews', () => {
  test('draw-line-preview — in-progress line ghost', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.setActiveTool('line'));
    await page.evaluate(() => window.__dxfTest.drawPreview({
      id: 'preview-line', type: 'line', layer: '0', color: '#00ff00',
      lineWidth: 2, visible: true,
      start: { x: 150, y: 150 }, end: { x: 350, y: 220 },
    }));
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('draw-line-preview.png', SCREENSHOT_OPTIONS);
  });

  test('draw-circle-preview — circle with radius arm cursor', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.setActiveTool('circle'));
    await page.evaluate(() => window.__dxfTest.drawPreview({
      id: 'preview-circle', type: 'circle', layer: '0', color: '#00ff00',
      lineWidth: 2, visible: true,
      center: { x: 250, y: 200 }, radius: 70,
      previewCursorPoint: { x: 320, y: 200 },
      showPreviewMeasurements: true,
    }));
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('draw-circle-preview.png', SCREENSHOT_OPTIONS);
  });

  test('draw-arc-preview — 3-point arc with construction lines', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.setActiveTool('arc-3p'));
    await page.evaluate(() => window.__dxfTest.drawPreview({
      id: 'preview-arc', type: 'arc', layer: '0', color: '#00ff00',
      lineWidth: 2, visible: true,
      center: { x: 250, y: 200 }, radius: 80,
      startAngle: 0, endAngle: 120, counterclockwise: false,
      constructionVertices: [{ x: 330, y: 200 }, { x: 210, y: 269 }, { x: 210, y: 269 }],
      showConstructionLines: true,
      constructionLineMode: 'polyline',
    }));
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('draw-arc-preview.png', SCREENSHOT_OPTIONS);
  });

  test('draw-polyline-preview — open polyline in progress', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.setActiveTool('polyline'));
    await page.evaluate(() => window.__dxfTest.drawPreview({
      id: 'preview-poly', type: 'polyline', layer: '0', color: '#00ff00',
      lineWidth: 2, visible: true,
      vertices: [
        { x: 130, y: 150 }, { x: 200, y: 250 },
        { x: 300, y: 250 }, { x: 360, y: 150 },
      ],
      closed: false,
    }));
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('draw-polyline-preview.png', SCREENSHOT_OPTIONS);
  });

  test('draw-rectangle-preview — closed polyline rectangle', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.setActiveTool('rectangle'));
    await page.evaluate(() => window.__dxfTest.drawPreview({
      id: 'preview-rect', type: 'polyline', layer: '0', color: '#00ff00',
      lineWidth: 2, visible: true,
      vertices: [
        { x: 150, y: 150 }, { x: 350, y: 150 },
        { x: 350, y: 260 }, { x: 150, y: 260 },
      ],
      closed: true,
    }));
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('draw-rectangle-preview.png', SCREENSHOT_OPTIONS);
  });
});

test.describe('Phase 5 — Entity Operations', () => {
  test('entity-moved — circle translated to new position', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.updateSceneEntity('circle-1', {
      center: { x: 340, y: 260 },
    }));
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('entity-moved.png', SCREENSHOT_OPTIONS);
  });

  test('entity-copied — line duplicated with offset', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.addSceneEntity({
      id: 'line-bottom-copy', type: 'line', layer: '0',
      color: '#ffff00', lineWidth: 2, visible: true,
      start: { x: 100, y: 130 }, end: { x: 400, y: 130 },
    }));
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('entity-copied.png', SCREENSHOT_OPTIONS);
  });

  test('entity-multi-removed — arc and text removed from scene', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => {
      window.__dxfTest.removeSceneEntity('arc-1');
      window.__dxfTest.removeSceneEntity('text-1');
    });
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('entity-multi-removed.png', SCREENSHOT_OPTIONS);
  });

  test('entity-color-changed — circle color updated to cyan', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.updateSceneEntity('circle-1', {
      color: '#00ffff', lineWidth: 3,
    }));
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('entity-color-changed.png', SCREENSHOT_OPTIONS);
  });

  test('entity-added — new large circle added to scene', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.addSceneEntity({
      id: 'circle-new', type: 'circle', layer: '0',
      color: '#ff6600', lineWidth: 2, visible: true,
      center: { x: 250, y: 200 }, radius: 120,
    }));
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('entity-added.png', SCREENSHOT_OPTIONS);
  });
});

test.describe('Phase 6 — Snap Indicators', () => {
  test('snap-endpoint — square marker at line corner', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.showSnap('endpoint', 100, 100));
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('snap-endpoint.png', SCREENSHOT_OPTIONS);
  });

  test('snap-midpoint — triangle marker at line midpoint', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.showSnap('midpoint', 250, 100));
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('snap-midpoint.png', SCREENSHOT_OPTIONS);
  });

  test('snap-center — circle marker at entity center', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.showSnap('center', 250, 200));
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('snap-center.png', SCREENSHOT_OPTIONS);
  });

  test('snap-intersection — X marker at corner intersection', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.showSnap('intersection', 400, 300));
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('snap-intersection.png', SCREENSHOT_OPTIONS);
  });

  test('snap-perpendicular — right-angle marker on line', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.showSnap('perpendicular', 100, 200));
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('snap-perpendicular.png', SCREENSHOT_OPTIONS);
  });

  test('snap-grid — dot marker at grid point', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    await page.evaluate(() => window.__dxfTest.showSnap('grid', 200, 150));
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('snap-grid.png', SCREENSHOT_OPTIONS);
  });
});

test.describe('Phase 7 — Edge Cases', () => {
  test('empty-scene — canvas renders with no entities', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?fixture=empty-scene`);
    await expect(page).toHaveScreenshot('empty-scene.png', SCREENSHOT_OPTIONS);
  });

  test('extreme-zoom-in — 16× zoom shows sub-entity detail', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.__dxfTest.zoomIn());
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('extreme-zoom-in.png', SCREENSHOT_OPTIONS);
  });

  test('extreme-zoom-out — 0.06× zoom shows scene as small cluster', async ({ page }) => {
    await loadHarness(page);
    await fitAndWait(page);
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.__dxfTest.zoomOut());
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot('extreme-zoom-out.png', SCREENSHOT_OPTIONS);
  });

  test('dense-scene — 34 overlapping entities render without corruption', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?fixture=dense-scene`);
    await fitAndWait(page);
    await expect(page).toHaveScreenshot('dense-scene.png', SCREENSHOT_OPTIONS);
  });

  test('loading-state — blank canvas before fixture resolves', async ({ page }) => {
    await page.route('**/test-fixtures/dxf/regression-scene.json', async route => {
      await new Promise<void>(resolve => setTimeout(resolve, 10000));
      await route.continue();
    });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('[data-testid="loading"]').waitFor({ timeout: 15000 });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('loading-state.png', SCREENSHOT_OPTIONS);
  });
});

test.describe('Phase 8 — Text Rendering', () => {
  test('text-entity-normal — plain text entity with height + color', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?fixture=entity-text`);
    await fitAndWait(page);
    await expect(page).toHaveScreenshot('text-entity-normal.png', SCREENSHOT_OPTIONS);
  });

  test('text-entity-rotated — text rotated 45 degrees', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?fixture=entity-text`);
    await fitAndWait(page);
    await expect(page).toHaveScreenshot('text-entity-rotated.png', SCREENSHOT_OPTIONS);
  });

  test('text-mtext-multiline — mtext block + colored text + small label', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?fixture=text-mtext-multiline`);
    await fitAndWait(page);
    await expect(page).toHaveScreenshot('text-mtext-multiline.png', SCREENSHOT_OPTIONS);
  });

  test('text-layer-hidden — text on hidden layer not rendered', async ({ page }) => {
    await loadHarness(page, `${BASE_URL}?fixture=text-mtext-multiline`);
    await fitAndWait(page);
    await page.evaluate(() =>
      window.__dxfTest.updateSceneEntity('text-small', { visible: false }),
    );
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot('text-layer-hidden.png', SCREENSHOT_OPTIONS);
  });
});
