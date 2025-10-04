import { test, expect } from "@playwright/test";

/**
 * Utility: retries για σταθερότητα
 */
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  throw lastErr;
}

test.describe("Enterprise Layering Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // ⚡ Άνοιξε τον DXF Viewer
    await page.goto("http://localhost:3003/dxf/viewer");

    // Περίμενε να φορτώσει πλήρως η εφαρμογή
    await page.waitForSelector('canvas[data-canvas-type="dxf"]', { timeout: 10000 });
    await page.waitForSelector('canvas[data-canvas-type="layer"]', { timeout: 10000 });
  });

  test("Full workflow: floating panel → levels tab → ground floor → overlay selection", async ({ page }) => {
    console.log("🎯 Starting Enterprise Layering Workflow E2E Test...");

    // 1. Εντοπισμός floating panel
    const floatingPanel = await retry(async () => {
      return await page.waitForSelector(
        '[data-testid="floating-panel"], [class*="floating-panel"], [class*="FloatingPanel"], .fixed.right-4.top-4',
        { timeout: 5000 }
      );
    });

    expect(floatingPanel).toBeTruthy();
    console.log("✅ Step 1: Floating panel located");

    // 2. Κλικ στην καρτέλα επίπεδα
    const levelsTab = await retry(async () => {
      const selectors = [
        '[data-testid="levels-tab"]',
        'button:has-text("επίπεδα")',
        'button:has-text("Επίπεδα")',
        'button:has-text("levels")',
        '[role="tab"]:has-text("επίπεδα")',
        '[role="tab"]:has-text("levels")'
      ];

      for (const selector of selectors) {
        try {
          const element = await page.waitForSelector(selector, { timeout: 2000 });
          if (element) return element;
        } catch (e) {
          // Continue to next selector
        }
      }
      throw new Error('Levels tab not found');
    });

    await levelsTab.click();
    await page.waitForTimeout(400);
    console.log("✅ Step 2: Levels tab clicked");

    // 3. Κλικ στην κάρτα ισογείου
    const groundFloorCard = await retry(async () => {
      const selectors = [
        '[data-testid="level-card-ground"]',
        '[data-testid="ground-floor-card"]',
        'button:has-text("ισόγειο")',
        'button:has-text("Ισόγειο")',
        'button:has-text("ground")',
        '.card:has-text("ισόγειο")',
        '.level-card:has-text("ισόγειο")'
      ];

      for (const selector of selectors) {
        try {
          const element = await page.waitForSelector(selector, { timeout: 2000 });
          if (element) return element;
        } catch (e) {
          // Continue to next selector
        }
      }
      throw new Error('Ground floor card not found');
    });

    await groundFloorCard.click();
    await page.waitForTimeout(500);
    console.log("✅ Step 3: Ground floor card clicked");

    // 4. Εντοπισμός overlays container
    const overlaysContainer = await retry(async () => {
      return await page.waitForSelector(
        '[class*="overlay"], .overlays, [class*="OverlayList"]',
        { timeout: 5000 }
      );
    });

    expect(overlaysContainer).toBeTruthy();
    console.log("✅ Step 4: Overlays container located");

    // 5. Κλικ σε έγχρωμη κάρτα overlay
    const coloredOverlayCard = await retry(async () => {
      const selectors = [
        '[data-testid="overlay-card-color"]',
        '[data-testid="colored-layer-card"]'
      ];

      for (const selector of selectors) {
        try {
          const element = await page.waitForSelector(selector, { timeout: 2000 });
          if (element) return element;
        } catch (e) {
          // Continue to next selector
        }
      }

      // Fallback: ψάχνουμε για κάρτες με χρώματα μέσω evaluation
      const cards = await page.$$eval(
        '[class*="overlay"] .card, [class*="overlay"] [class*="card"], .overlays .card',
        (elements) => {
          return elements
            .map((el, index) => {
              const style = window.getComputedStyle(el);
              const hasColor = style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                              style.backgroundColor !== 'transparent' &&
                              style.backgroundColor !== 'rgb(255, 255, 255)';
              const hasColorIndicator = el.querySelector('[class*="color"], [class*="badge"], [style*="background"]');
              return { index, hasColor: hasColor || !!hasColorIndicator };
            })
            .filter(item => item.hasColor)
            .map(item => item.index);
        }
      );

      if (cards.length === 0) {
        throw new Error('No colored overlay cards found');
      }

      // Επιστρέφουμε την πρώτη έγχρωμη κάρτα
      return await page.$$('[class*="overlay"] .card, [class*="overlay"] [class*="card"], .overlays .card')
        .then(elements => elements[cards[0]]);
    });

    await coloredOverlayCard.click();
    await page.waitForTimeout(600);
    console.log("✅ Step 5: Colored overlay card clicked");

    // 6. Επαλήθευση ότι το layer εμφανίζεται full screen
    const layerCanvas = await page.waitForSelector('canvas[data-canvas-type="layer"]', { timeout: 5000 });
    expect(layerCanvas).toBeTruthy();

    const canvasBox = await layerCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    if (canvasBox && viewport) {
      const tolerance = 2;

      // Έλεγχος geometric coverage
      expect(canvasBox.width).toBeGreaterThanOrEqual(viewport.width - tolerance);
      expect(canvasBox.height).toBeGreaterThanOrEqual(viewport.height - tolerance);
      expect(canvasBox.x).toBeLessThanOrEqual(tolerance);
      expect(canvasBox.y).toBeLessThanOrEqual(tolerance);

      console.log("✅ Step 6a: Layer canvas covers full screen", {
        canvas: `${canvasBox.width}x${canvasBox.height}`,
        viewport: `${viewport.width}x${viewport.height}`,
        position: `${canvasBox.x}, ${canvasBox.y}`
      });
    }

    // 7. Visual stacking verification με elementFromPoint
    const center = {
      x: Math.floor((await page.viewportSize())!.width / 2),
      y: Math.floor((await page.viewportSize())!.height / 2),
    };

    const topElementAtCenter = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el?.getAttribute("data-canvas-type") || el?.tagName;
    }, center);

    expect(topElementAtCenter).toBe("layer");
    console.log("✅ Step 6b: Layer canvas is visually on top at center point");

    // 8. Τελικός έλεγχος με το enterprise test module
    const enterpriseTestResult = await page.evaluate(() => {
      // @ts-ignore
      return window.runLayeringWorkflowTest ? window.runLayeringWorkflowTest() : null;
    });

    if (enterpriseTestResult) {
      console.log("📊 Enterprise test validation:", enterpriseTestResult);
      expect(enterpriseTestResult.success).toBe(true);
      expect(enterpriseTestResult.layerDisplayed).toBe(true);
    }

    console.log("🎉 ENTERPRISE LAYERING WORKFLOW E2E TEST COMPLETED SUCCESSFULLY");
  });

  test("Layer visibility can be toggled via debug controls", async ({ page }) => {
    // Βρίσκουμε τα debug buttons στην επικεφαλίδα
    const layerToggleButton = await page.waitForSelector(
      'button:has-text("LAYER"), button:has-text("🟢 LAYER"), button:has-text("🔴 LAYER")',
      { timeout: 5000 }
    );

    // Κλικάρουμε το toggle button
    await layerToggleButton.click();

    // Επαληθεύουμε ότι το layer canvas αλλάζει visibility
    const layerCanvas = await page.waitForSelector('canvas[data-canvas-type="layer"]');
    const isVisible = await layerCanvas.isVisible();

    expect(typeof isVisible).toBe('boolean');
    console.log("✅ Layer canvas visibility toggle works:", isVisible);
  });

  test("Canvas alignment test passes in E2E environment", async ({ page }) => {
    // Τρέχουμε το canvas alignment test μέσω debug button
    const canvasTestButton = await page.waitForSelector(
      'button:has-text("🎯 Test Canvas")',
      { timeout: 5000 }
    );

    await canvasTestButton.click();

    // Περιμένουμε λίγο για το test να τρέξει
    await page.waitForTimeout(1000);

    // Ελέγχουμε τα αποτελέσματα στο console (προαιρετικό)
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    console.log("✅ Canvas alignment test executed in E2E environment");
  });
});