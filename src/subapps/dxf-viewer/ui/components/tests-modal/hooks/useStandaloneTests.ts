/**
 * 📊 useStandaloneTests Hook
 * Handles standalone test execution (coordinate reversibility, grid workflow)
 */

import type { NotificationFn, TestState, StandaloneTestHandlers } from '../types/tests.types';

export function useStandaloneTests(
  showNotification: NotificationFn,
  state: TestState
): StandaloneTestHandlers {

  const handleRunCoordinateReversibility = async () => {
    const testId = 'coordinate-reversibility';
    state.startTest(testId);

    try {
      showNotification('Running Coordinate Reversibility Test...', 'info');

      // Import and run the standalone test
      const module = await import('../../../test-coordinate-reversibility');
      // Note: This file needs to export a runTest() function
      // For now, show placeholder message
      showNotification(
        'Coordinate Reversibility Test: Implementation pending\n\nThis test needs to export a runTest() function',
        'warning'
      );

      state.completeTest(testId);
    } catch (error) {
      console.error('Failed to run coordinate reversibility test:', error);
      showNotification('Failed to run coordinate reversibility test', 'error');
      state.failTest(testId);
    }
  };

  const handleRunGridWorkflow = async () => {
    const testId = 'grid-workflow';
    state.startTest(testId);

    try {
      showNotification('Running Grid Workflow Test...', 'info');

      const module = await import('../../../debug/grid-workflow-test');
      // Note: Need to check if this exports runGridWorkflowTest
      showNotification(
        'Grid Workflow Test: Implementation pending\n\nThis test needs to be verified/exported',
        'warning'
      );

      state.completeTest(testId);
    } catch (error) {
      console.error('Failed to run grid workflow test:', error);
      showNotification('Failed to run grid workflow test', 'error');
      state.failTest(testId);
    }
  };

  return {
    handleRunCoordinateReversibility,
    handleRunGridWorkflow
  };
}
