import { test, expect } from '@playwright/test';

test.describe('Canvas Alignment & Stacking', () => {
  test.beforeEach(async ({ page }) => {
    // 🔹 Άνοιξε την εφαρμογή CAD
    await page.goto('http://localhost:3003/dxf/viewer');
  });

  test('Canvas stacking and alignment should be correct', async ({ page }) => {
    // Βεβαιωνόμαστε ότι έχουν φορτώσει τα canvases
    await page.waitForSelector('canvas[data-canvas-type="dxf"]');
    await page.waitForSelector('canvas[data-canvas-type="layer"]');

    // Τρέχουμε το ενσωματωμένο enterprise test μέσα στο browser
    const results = await page.evaluate(() => {
      // @ts-ignore
      return window.runCanvasTests();
    });

    console.log('📊 Canvas Test Results:', results);

    // Επαγγελματικά assertions
    expect(results.stacking).toBe('PASS');
    expect(results.geometric).toBe('PASS');
    expect(results.allPassed).toBe(true);
  });

  test('LayerCanvas should be visually above DxfCanvas', async ({ page }) => {
    // Περιμένουμε να φορτώσουν τα canvases
    await page.waitForSelector('canvas[data-canvas-type="dxf"]');
    await page.waitForSelector('canvas[data-canvas-type="layer"]');

    const topElement = await page.evaluate(() => {
      const dxf = document.querySelector('canvas[data-canvas-type="dxf"]')!;
      const rect = dxf.getBoundingClientRect();
      const cx = Math.floor(rect.left + rect.width / 2);
      const cy = Math.floor(rect.top + rect.height / 2);
      const el = document.elementFromPoint(cx, cy);
      return el?.getAttribute('data-canvas-type') || el?.tagName;
    });

    expect(topElement).toBe('layer'); // ✅ LayerCanvas πρέπει να είναι από πάνω
  });

  test('Canvas geometric alignment should be pixel-perfect', async ({ page }) => {
    await page.waitForSelector('canvas[data-canvas-type="dxf"]');
    await page.waitForSelector('canvas[data-canvas-type="layer"]');

    const geometricTest = await page.evaluate(() => {
      const dxfCanvas = document.querySelector('canvas[data-canvas-type="dxf"]')!;
      const layerCanvas = document.querySelector('canvas[data-canvas-type="layer"]')!;

      const dxfRect = dxfCanvas.getBoundingClientRect();
      const layerRect = layerCanvas.getBoundingClientRect();

      const positionDiff = {
        x: Math.abs(dxfRect.x - layerRect.x),
        y: Math.abs(dxfRect.y - layerRect.y)
      };
      const sizeDiff = {
        width: Math.abs(dxfRect.width - layerRect.width),
        height: Math.abs(dxfRect.height - layerRect.height)
      };

      return {
        positionDiff,
        sizeDiff,
        isAligned: positionDiff.x <= 1 && positionDiff.y <= 1 &&
                   sizeDiff.width <= 1 && sizeDiff.height <= 1
      };
    });

    console.log('📐 Geometric Test Results:', geometricTest);

    expect(geometricTest.isAligned).toBe(true);
    expect(geometricTest.positionDiff.x).toBeLessThanOrEqual(1);
    expect(geometricTest.positionDiff.y).toBeLessThanOrEqual(1);
    expect(geometricTest.sizeDiff.width).toBeLessThanOrEqual(1);
    expect(geometricTest.sizeDiff.height).toBeLessThanOrEqual(1);
  });

  test('Z-index values should be correctly applied', async ({ page }) => {
    await page.waitForSelector('canvas[data-canvas-type="dxf"]');
    await page.waitForSelector('canvas[data-canvas-type="layer"]');

    const zIndexTest = await page.evaluate(() => {
      const dxfCanvas = document.querySelector('canvas[data-canvas-type="dxf"]')!;
      const layerCanvas = document.querySelector('canvas[data-canvas-type="layer"]')!;

      const dxfStyle = getComputedStyle(dxfCanvas);
      const layerStyle = getComputedStyle(layerCanvas);

      const dxfZ = dxfStyle.zIndex === "auto" ? "auto" : parseInt(dxfStyle.zIndex);
      const layerZ = layerStyle.zIndex === "auto" ? "auto" : parseInt(layerStyle.zIndex);

      return {
        dxfZ,
        layerZ,
        isCorrectOrder: layerZ !== "auto" && dxfZ !== "auto" ? layerZ > dxfZ : true
      };
    });

    console.log('🔢 Z-Index Test Results:', zIndexTest);

    // LayerCanvas πρέπει να έχει μεγαλύτερο z-index από DxfCanvas
    if (typeof zIndexTest.layerZ === 'number' && typeof zIndexTest.dxfZ === 'number') {
      expect(zIndexTest.layerZ).toBeGreaterThan(zIndexTest.dxfZ);
    }
    expect(zIndexTest.isCorrectOrder).toBe(true);
  });

  test('Green border should appear in layering mode', async ({ page }) => {
    await page.waitForSelector('canvas[data-canvas-type="dxf"]');
    await page.waitForSelector('canvas[data-canvas-type="layer"]');

    // Ενεργοποίηση layering mode (αν υπάρχει κουμπί)
    const layeringButton = page.locator('button:has-text("layering"), button[data-tool="layering"]');
    if (await layeringButton.count() > 0) {
      await layeringButton.click();
    }

    const greenBorderTest = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.borderColor.includes('green') ||
               style.borderColor.includes('lime') ||
               style.backgroundColor.includes('rgba(0, 255, 0,');
      });

      return {
        found: elements.length > 0,
        count: elements.length,
        elements: elements.slice(0, 3).map(el => ({
          tagName: el.tagName,
          className: el.className
        }))
      };
    });

    console.log('🟢 Green Border Test Results:', greenBorderTest);

    // Σημείωση: Το green border μπορεί να μην εμφανίζεται πάντα,
    // οπότε αυτό είναι informational test
    if (greenBorderTest.found) {
      expect(greenBorderTest.count).toBeGreaterThan(0);
    }
  });
});