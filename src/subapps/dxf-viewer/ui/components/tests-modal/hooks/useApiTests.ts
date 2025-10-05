/**
 * 🧪 useApiTests Hook
 * Handles API-based test execution (Vitest, Jest, Playwright)
 */

import type { NotificationFn, TestState, ApiTestHandlers } from '../types/tests.types';

export function useApiTests(
  showNotification: NotificationFn,
  state: TestState
): ApiTestHandlers {

  const handleRunVitest = async () => {
    const testId = 'run-vitest';
    state.startTest(testId);

    try {
      showNotification('Running Vitest tests... Please wait.', 'info');

      const response = await fetch('/api/run-vitest', { method: 'POST' });
      const results = await response.json();

      if (results.success) {
        showNotification(
          `Vitest Complete: ${results.numPassedTests}✅ / ${results.numFailedTests}❌ (${results.numTotalTests} total)\n\nDuration: ${results.duration}ms`,
          'success'
        );
        state.completeTest(testId);
      } else {
        showNotification(
          `Vitest Failed: ${results.error || 'Unknown error'}`,
          'error'
        );
        state.failTest(testId);
      }
    } catch (error) {
      console.error('Failed to run Vitest:', error);
      showNotification('Failed to run Vitest tests', 'error');
      state.failTest(testId);
    }
  };

  const handleRunJest = async () => {
    const testId = 'run-jest';
    state.startTest(testId);

    try {
      showNotification('Running Jest tests... Please wait.', 'info');

      const response = await fetch('/api/run-jest', { method: 'POST' });
      const results = await response.json();

      if (results.success) {
        showNotification(
          `Jest Complete: ${results.numPassedTests}✅ / ${results.numFailedTests}❌ (${results.numTotalTests} total)\n\nDuration: ${results.duration}ms`,
          'success'
        );
        state.completeTest(testId);
      } else {
        showNotification(
          `Jest Failed: ${results.error || 'Unknown error'}`,
          'error'
        );
        state.failTest(testId);
      }
    } catch (error) {
      console.error('Failed to run Jest:', error);
      showNotification('Failed to run Jest tests', 'error');
      state.failTest(testId);
    }
  };

  const handleRunPlaywright = async () => {
    const testId = 'run-playwright';
    state.startTest(testId);

    try {
      showNotification('Running Playwright E2E tests... Please wait (this may take 2-3 minutes).', 'info');

      const response = await fetch('/api/run-playwright', { method: 'POST' });
      const results = await response.json();

      if (results.success) {
        showNotification(
          `Playwright Complete: ${results.numPassedTests}✅ / ${results.numFailedTests}❌ (${results.numTotalTests} total)\n\nDuration: ${(results.duration / 1000).toFixed(1)}s`,
          'success'
        );
        state.completeTest(testId);
      } else {
        showNotification(
          `Playwright Failed: ${results.error || 'Unknown error'}`,
          'error'
        );
        state.failTest(testId);
      }
    } catch (error) {
      console.error('Failed to run Playwright:', error);
      showNotification('Failed to run Playwright E2E tests', 'error');
      state.failTest(testId);
    }
  };

  return {
    handleRunVitest,
    handleRunJest,
    handleRunPlaywright
  };
}
