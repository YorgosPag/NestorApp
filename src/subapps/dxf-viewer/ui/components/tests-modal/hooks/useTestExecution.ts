/**
 * ⚡ useTestExecution Hook
 * Handles test execution logic for automated tests
 *
 * @module tests-modal/hooks/useTestExecution
 * @category Testing
 *
 * ✅ ENTERPRISE: Connected to unified-test-runner.ts (centralized test system)
 */

import type { NotificationFn, TestState, TestExecutionHandlers } from '../types/tests.types';

// ✅ ENTERPRISE: Inline conditional logging (production-safe, NO any)
const isDev = process.env.NODE_ENV !== 'production';
const dlog = (...args: unknown[]) => { if (isDev) console.log(...args); };
const dwarn = (...args: unknown[]) => { if (isDev) console.warn(...args); };

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
      showNotification('Εκτέλεση όλων των tests... Παρακαλώ περιμένετε.', 'info');
      dlog('🧪 Starting Unified Test Runner...');

      // ✅ ENTERPRISE: Dynamic import του centralized test runner
      const { runAllTests, formatReportForCopy } = await import('../../../../debug/unified-test-runner');

      // Εκτέλεση όλων των tests
      const report = await runAllTests();

      // Format αποτελεσμάτων για notification
      const summaryMessage = `🧪 Unified Test Runner: ${report.passed}✅ / ${report.failed}❌ / ${report.warnings}⚠️\n` +
                            `Συνολικά: ${report.totalTests} tests σε ${report.totalDuration.toFixed(0)}ms`;

      // Log full report στο console
      const formattedReport = formatReportForCopy(report);
      console.log(formattedReport);
      dlog('🧪 Full report logged to console');

      // Notification με summary
      const notificationType = report.failed > 0 ? 'error' : report.warnings > 0 ? 'warning' : 'success';
      showNotification(summaryMessage, notificationType);

      state.completeTest(testId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to run all tests:', error);
      dwarn('🧪 Test execution failed:', errorMessage);
      showNotification(`Αποτυχία εκτέλεσης tests: ${errorMessage}`, 'error');
      state.failTest(testId);
    }
  };

  return {
    handleRunTest,
    handleRunAllTests
  };
}
