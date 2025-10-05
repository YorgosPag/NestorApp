/**
 * ⚡ useTestExecution Hook
 * Handles test execution logic for automated tests
 */

import type { NotificationFn, TestState, TestExecutionHandlers } from '../types/tests.types';

export function useTestExecution(
  showNotification: NotificationFn,
  state: TestState
): TestExecutionHandlers {

  const handleRunTest = async (testId: string, testFunction: () => Promise<void>) => {
    state.startTest(testId);
    try {
      await testFunction();
      state.completeTest(testId);
    } catch (error) {
      console.error(`Test ${testId} failed:`, error);
      state.failTest(testId);
    }
  };

  const handleRunAllTests = async () => {
    const testId = 'run-all-tests';
    state.startTest(testId);

    try {
      showNotification('Running all tests... Please wait.', 'info');

      const { runAllTests, formatReportForCopy } = await import('../../../debug/unified-test-runner');
      const report = await runAllTests();
      const formatted = formatReportForCopy(report);

      const passRate = ((report.passed / report.totalTests) * 100).toFixed(0);
      const timestamp = Date.now();
      const message = `Tests Complete: ${report.passed}✅ / ${report.failed}❌ (${passRate}% pass rate)\n\n${formatted}\n\n[Completed at: ${timestamp}]`;

      showNotification(
        message,
        report.failed === 0 ? 'success' : 'warning'
      );

      state.completeTest(testId);
    } catch (error) {
      console.error('Failed to run all tests:', error);
      showNotification('Failed to run all tests', 'error');
      state.failTest(testId);
    }
  };

  return {
    handleRunTest,
    handleRunAllTests
  };
}
