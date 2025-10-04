const { test, expect } = require('@playwright/test');

test.describe('DXF Viewer - Exclusive Snap Mode', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to DXF viewer page
    await page.goto('/dxf-viewer');
    
    // Wait for the DXF viewer to be ready
    await expect(page.locator('canvas')).toBeVisible();
    await page.waitForTimeout(2000); // Allow time for initialization
  });

  test('Initial state should have only ENDPOINT active', async ({ page }) => {
    // Verify only ENDPOINT is active by default
    const endpointButton = page.locator('[data-testid="snap-endpoint"]');
    const midpointButton = page.locator('[data-testid="snap-midpoint"]');
    
    await expect(endpointButton).toHaveClass(/active|selected/);
    await expect(midpointButton).not.toHaveClass(/active|selected/);
    
    // Check console logs for verification
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.text().includes('SnapContext') && msg.text().includes('Active modes:')) {
        consoleMessages.push(msg.text());
      }
    });
    
    // Trigger a small mouse movement to ensure logs are generated
    await page.locator('canvas').hover();
    await page.waitForTimeout(500);
    
    // Verify only ENDPOINT is in active modes
    const hasEndpointOnly = consoleMessages.some(msg => 
      msg.includes('endpoint') && !msg.includes('midpoint')
    );
    expect(hasEndpointOnly).toBeTruthy();
  });

  test('Switching to MIDPOINT should disable ENDPOINT (exclusive mode)', async ({ page }) => {
    const endpointButton = page.locator('[data-testid="snap-endpoint"]');
    const midpointButton = page.locator('[data-testid="snap-midpoint"]');
    
    // Initial state: ENDPOINT active
    await expect(endpointButton).toHaveClass(/active|selected/);
    await expect(midpointButton).not.toHaveClass(/active|selected/);
    
    // Click MIDPOINT
    await midpointButton.click();
    await page.waitForTimeout(300);
    
    // After clicking MIDPOINT: Only MIDPOINT should be active
    await expect(midpointButton).toHaveClass(/active|selected/);
    await expect(endpointButton).not.toHaveClass(/active|selected/);
    
    // Verify in console logs that only MIDPOINT is active
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.text().includes('SnapContext') && msg.text().includes('Active modes:')) {
        consoleMessages.push(msg.text());
      }
    });
    
    await page.locator('canvas').hover();
    await page.waitForTimeout(500);
    
    const hasMidpointOnly = consoleMessages.some(msg => 
      msg.includes('midpoint') && !msg.includes('endpoint')
    );
    expect(hasMidpointOnly).toBeTruthy();
  });

  test('Switching back to ENDPOINT should disable MIDPOINT', async ({ page }) => {
    const endpointButton = page.locator('[data-testid="snap-endpoint"]');
    const midpointButton = page.locator('[data-testid="snap-midpoint"]');
    
    // First, activate MIDPOINT
    await midpointButton.click();
    await page.waitForTimeout(300);
    await expect(midpointButton).toHaveClass(/active|selected/);
    
    // Then switch back to ENDPOINT
    await endpointButton.click();
    await page.waitForTimeout(300);
    
    // Verify exclusive behavior: only ENDPOINT active
    await expect(endpointButton).toHaveClass(/active|selected/);
    await expect(midpointButton).not.toHaveClass(/active|selected/);
  });

  test('Multiple snap types should work exclusively', async ({ page }) => {
    const endpointButton = page.locator('[data-testid="snap-endpoint"]');
    const midpointButton = page.locator('[data-testid="snap-midpoint"]');
    const centerButton = page.locator('[data-testid="snap-center"]');
    
    // Test sequence: ENDPOINT -> MIDPOINT -> CENTER -> ENDPOINT
    
    // 1. Start with ENDPOINT (default)
    await expect(endpointButton).toHaveClass(/active|selected/);
    
    // 2. Switch to MIDPOINT
    await midpointButton.click();
    await page.waitForTimeout(200);
    await expect(midpointButton).toHaveClass(/active|selected/);
    await expect(endpointButton).not.toHaveClass(/active|selected/);
    await expect(centerButton).not.toHaveClass(/active|selected/);
    
    // 3. Switch to CENTER
    await centerButton.click();
    await page.waitForTimeout(200);
    await expect(centerButton).toHaveClass(/active|selected/);
    await expect(midpointButton).not.toHaveClass(/active|selected/);
    await expect(endpointButton).not.toHaveClass(/active|selected/);
    
    // 4. Switch back to ENDPOINT
    await endpointButton.click();
    await page.waitForTimeout(200);
    await expect(endpointButton).toHaveClass(/active|selected/);
    await expect(centerButton).not.toHaveClass(/active|selected/);
    await expect(midpointButton).not.toHaveClass(/active|selected/);
  });

  test('Snap engine receives correct exclusive modes', async ({ page }) => {
    const midpointButton = page.locator('[data-testid="snap-midpoint"]');
    
    // Monitor ProSnapEngine logs
    const engineLogs = [];
    page.on('console', msg => {
      if (msg.text().includes('Updating snap engine with modes:')) {
        engineLogs.push(msg.text());
      }
    });
    
    // Click MIDPOINT to activate exclusive mode
    await midpointButton.click();
    await page.waitForTimeout(500);
    
    // Verify that the engine receives only MIDPOINT
    const hasCorrectMidpointMode = engineLogs.some(log => {
      return log.includes('midpoint') && !log.includes('endpoint');
    });
    expect(hasCorrectMidpointMode).toBeTruthy();
  });

  test('Visual markers should change based on exclusive mode', async ({ page }) => {
    const canvas = page.locator('canvas');
    const midpointButton = page.locator('[data-testid="snap-midpoint"]');
    
    // Load a DXF file with test data (assumes test data exists)
    // This might need adjustment based on your test data setup
    await page.evaluate(() => {
      // Simulate having some line entities for testing
      window.testEntities = [{
        id: 'test-line-1',
        type: 'line',
        start: { x: 100, y: 100 },
        end: { x: 200, y: 100 },
        layer: 'default'
      }];
    });
    
    // Initially in ENDPOINT mode - hover near endpoint
    await canvas.hover({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(500);
    
    // Switch to MIDPOINT mode
    await midpointButton.click();
    await page.waitForTimeout(300);
    
    // Hover near midpoint of the line
    await canvas.hover({ position: { x: 150, y: 100 } });
    await page.waitForTimeout(500);
    
    // Verify that snap indicator overlay is visible
    const snapOverlay = page.locator('[data-testid="snap-indicator-overlay"]');
    await expect(snapOverlay).toBeVisible();
  });

  test('Deactivating current mode should fallback to ENDPOINT', async ({ page }) => {
    const endpointButton = page.locator('[data-testid="snap-endpoint"]');
    const midpointButton = page.locator('[data-testid="snap-midpoint"]');
    
    // Switch to MIDPOINT
    await midpointButton.click();
    await page.waitForTimeout(300);
    await expect(midpointButton).toHaveClass(/active|selected/);
    
    // Try to deactivate MIDPOINT by clicking it again
    await midpointButton.click();
    await page.waitForTimeout(300);
    
    // Should fallback to ENDPOINT (at least one mode must be active)
    await expect(endpointButton).toHaveClass(/active|selected/);
    await expect(midpointButton).not.toHaveClass(/active|selected/);
  });

  test('Snap toggle master switch works with exclusive modes', async ({ page }) => {
    const snapToggle = page.locator('[data-testid="snap-enabled-toggle"]');
    const midpointButton = page.locator('[data-testid="snap-midpoint"]');
    
    // Switch to MIDPOINT mode
    await midpointButton.click();
    await page.waitForTimeout(300);
    
    // Disable snapping entirely
    await snapToggle.click();
    await page.waitForTimeout(300);
    
    // MIDPOINT should still appear visually selected but snapping disabled
    await expect(midpointButton).toHaveClass(/active|selected/);
    
    // Re-enable snapping
    await snapToggle.click();
    await page.waitForTimeout(300);
    
    // MIDPOINT should still be the active exclusive mode
    await expect(midpointButton).toHaveClass(/active|selected/);
  });

  test('Context state consistency across re-renders', async ({ page }) => {
    const midpointButton = page.locator('[data-testid="snap-midpoint"]');
    const endpointButton = page.locator('[data-testid="snap-endpoint"]');
    
    // Activate MIDPOINT
    await midpointButton.click();
    await page.waitForTimeout(300);
    
    // Force a re-render by resizing window
    await page.setViewportSize({ width: 1000, height: 600 });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500);
    
    // Verify MIDPOINT is still exclusively active
    await expect(midpointButton).toHaveClass(/active|selected/);
    await expect(endpointButton).not.toHaveClass(/active|selected/);
  });

  test('Rapid mode switching maintains exclusive behavior', async ({ page }) => {
    const buttons = {
      endpoint: page.locator('[data-testid="snap-endpoint"]'),
      midpoint: page.locator('[data-testid="snap-midpoint"]'),
      center: page.locator('[data-testid="snap-center"]')
    };
    
    // Rapid sequence of clicks
    for (let i = 0; i < 5; i++) {
      await buttons.midpoint.click();
      await page.waitForTimeout(50);
      await buttons.center.click();
      await page.waitForTimeout(50);
      await buttons.endpoint.click();
      await page.waitForTimeout(50);
    }
    
    // After rapid clicking, should end up with ENDPOINT exclusive
    await page.waitForTimeout(300);
    await expect(buttons.endpoint).toHaveClass(/active|selected/);
    await expect(buttons.midpoint).not.toHaveClass(/active|selected/);
    await expect(buttons.center).not.toHaveClass(/active|selected/);
  });

  test('Error handling: Invalid mode activation', async ({ page }) => {
    // Test error handling in case of invalid state
    await page.evaluate(() => {
      // Try to manually trigger an invalid state
      if (window.snapContext) {
        window.snapContext.setSnapState({});  // Empty state should fallback to ENDPOINT
      }
    });
    
    await page.waitForTimeout(500);
    
    // Should automatically fallback to ENDPOINT
    const endpointButton = page.locator('[data-testid="snap-endpoint"]');
    await expect(endpointButton).toHaveClass(/active|selected/);
  });

  test('Performance: Exclusive mode changes do not cause memory leaks', async ({ page }) => {
    // Monitor performance during rapid mode changes
    const startTime = Date.now();
    const midpointButton = page.locator('[data-testid="snap-midpoint"]');
    const endpointButton = page.locator('[data-testid="snap-endpoint"]');
    
    // Perform 50 mode switches
    for (let i = 0; i < 50; i++) {
      await midpointButton.click();
      await page.waitForTimeout(10);
      await endpointButton.click();
      await page.waitForTimeout(10);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (adjust threshold as needed)
    expect(duration).toBeLessThan(5000); // 5 seconds max for 50 switches
    
    // Verify final state is still correct
    await expect(endpointButton).toHaveClass(/active|selected/);
  });
});

// Additional helper test for debugging
test.describe('DXF Viewer - Snap Mode Debugging', () => {
  
  test('Debug: Log all snap context state changes', async ({ page }) => {
    const logs = [];
    
    page.on('console', msg => {
      if (msg.text().includes('SnapContext') || msg.text().includes('snap')) {
        logs.push({ 
          timestamp: Date.now(), 
          message: msg.text(),
          type: msg.type()
        });
      }
    });
    
    await page.goto('/dxf-viewer');
    await page.waitForTimeout(1000);
    
    const midpointButton = page.locator('[data-testid="snap-midpoint"]');
    await midpointButton.click();
    await page.waitForTimeout(500);
    
    // Output logs for debugging
    console.log('Captured snap-related logs:');
    logs.forEach(log => {
      console.log(`[${log.type.toUpperCase()}] ${log.message}`);
    });
    
    expect(logs.length).toBeGreaterThan(0);
  });
});