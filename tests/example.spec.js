const { test, expect } = require('@playwright/test');

test('Playwright functionality test', async ({ page }) => {
  // Test with a simple site to verify Playwright works
  await page.goto('https://example.com');
  
  // Wait for page to load
  await expect(page).toHaveTitle('Example Domain');
  
  // Check that the page content is accessible
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('h1')).toContainText('Example Domain');
  
  // Verify page structure
  await expect(page.locator('body')).toBeVisible();
});