import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './src',
  testMatch: [
    '**/e2e/**/*.spec.ts',
    '**/__tests__/e2e/**/*.spec.ts',
    '**/*.e2e.spec.ts',
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html'],
    ['junit', { outputFile: 'reports/junit/playwright.xml' }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'visual-dxf',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        navigationTimeout: 90000,
        actionTimeout: 30000,
      },
      snapshotPathTemplate: 'src/subapps/dxf-viewer/e2e/__snapshots__/{testFilePath}/{arg}{ext}',
      testMatch: ['**/dxf-viewer/e2e/dxf-visual-regression.spec.ts'],
      timeout: 120000,
    },
  ],
  webServer: {
    command: 'npm run dev:fast',
    url: `${baseURL}/test-harness/dxf-canvas`,
    reuseExistingServer: true,
    timeout: 600 * 1000,
    stderr: 'pipe',
    stdout: 'pipe',
  },
});

