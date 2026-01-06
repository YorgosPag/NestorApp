/**
 * 📊 useStandaloneTests Hook
 * Handles standalone test execution (coordinate reversibility, grid workflow)
 *
 * @module tests-modal/hooks/useStandaloneTests
 * @category Testing
 *
 * ✅ ENTERPRISE: Connected to grid-workflow-test.ts (centralized test system)
 */

import type { NotificationFn, TestState, StandaloneTestHandlers } from '../types/tests.types';

// ✅ ENTERPRISE: Inline conditional logging (production-safe, NO any)
const isDev = process.env.NODE_ENV !== 'production';
const dlog = (...args: unknown[]) => { if (isDev) console.log(...args); };
const dwarn = (...args: unknown[]) => { if (isDev) console.warn(...args); };

export function useStandaloneTests(
  showNotification: NotificationFn,
  state: TestState
): StandaloneTestHandlers {

  const handleRunCoordinateReversibility = async () => {
    const testId = 'coordinate-reversibility';
    state.startTest(testId);

    try {
      showNotification('Εκτέλεση Coordinate Reversibility Test...', 'info');
      dlog('🧪 Starting Coordinate Reversibility Test...');

      // ✅ ENTERPRISE: Coordinate Reversibility test εκτελείται μέσω του Unified Test Runner
      // που περιλαμβάνει το enterprise-cursor-crosshair-test.ts με coordinate precision tests
      const infoMessage = `ℹ️ Coordinate Reversibility Test\n\n` +
                         `Αυτό το test εκτελείται ως μέρος του Unified Test Runner.\n` +
                         `Χρησιμοποιήστε "Run All Tests" για πλήρη έλεγχο coordinate precision.\n\n` +
                         `Το Enterprise Cursor-Crosshair Test περιλαμβάνει:\n` +
                         `• Coordinate transformation accuracy\n` +
                         `• Canvas-to-world reversibility\n` +
                         `• Millimeter-level precision validation`;

      showNotification(infoMessage, 'info');
      dlog('🧪 Coordinate Reversibility info displayed');

      state.completeTest(testId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to run coordinate reversibility test:', error);
      dwarn('🧪 Coordinate test failed:', errorMessage);
      showNotification(`Αποτυχία: ${errorMessage}`, 'error');
      state.failTest(testId);
    }
  };

  const handleRunGridWorkflow = async () => {
    const testId = 'grid-workflow';
    state.startTest(testId);

    try {
      showNotification('Εκτέλεση Grid Workflow Test...', 'info');
      dlog('🧪 Starting Grid Workflow Test...');

      // ✅ ENTERPRISE: Dynamic import του centralized grid workflow test
      const { runGridWorkflowTest } = await import('../../../../debug/grid-workflow-test');

      // Εκτέλεση του test
      const result = await runGridWorkflowTest();

      // Format αποτελεσμάτων
      const passedSteps = result.steps.filter(s => s.status === 'success').length;
      const totalSteps = result.steps.length;

      const summaryMessage = `🎯 Grid Workflow Test: ${passedSteps}/${totalSteps} βήματα\n` +
                            `Grid: ${result.gridDisplayed ? '✅ Visible' : '❌ Hidden'}\n` +
                            `DXF Canvas: ${result.canvasInfo.dxfCanvasFound ? '✅' : '❌'}\n` +
                            `Layer Canvas: ${result.canvasInfo.layerCanvasFound ? '✅' : '❌'}`;

      // Log full result
      console.log('🧪 Grid Workflow Test Results:', result);
      dlog('🧪 Grid test completed:', result.success ? 'SUCCESS' : 'FAILED');

      const notificationType = result.success ? 'success' : 'warning';
      showNotification(summaryMessage, notificationType);

      state.completeTest(testId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to run grid workflow test:', error);
      dwarn('🧪 Grid test failed:', errorMessage);
      showNotification(`Αποτυχία Grid Test: ${errorMessage}`, 'error');
      state.failTest(testId);
    }
  };

  return {
    handleRunCoordinateReversibility,
    handleRunGridWorkflow
  };
}
