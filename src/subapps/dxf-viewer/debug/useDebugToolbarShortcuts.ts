'use client';

import React from 'react';
// ⌨️ ENTERPRISE: Centralized keyboard shortcuts - Single source of truth
import { matchesShortcut } from '../config/keyboard-shortcuts';
import type {
  WorkflowTestStep,
  LayeringWorkflowResult,
  EnterpriseCursorTestModule,
  ShowCopyableNotification,
} from './debug-toolbar-types';

/**
 * useDebugToolbarShortcuts — keyboard shortcuts for the Debug Toolbar.
 *
 * Extracted from DebugToolbar.tsx (CHECK 4 file-size SRP split). Wires:
 *   - Ctrl+F2 / Ctrl+Shift+T → Layering Workflow Test
 *   - F3                      → Enterprise Cursor-Crosshair Alignment Test
 *
 * Uses the centralized keyboard-shortcuts.ts matcher (single source of truth).
 */
export function useDebugToolbarShortcuts(
  showCopyableNotification: ShowCopyableNotification,
): void {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ⌨️ Ctrl+F2 or Ctrl+Shift+T: Layering Workflow Test
      if (matchesShortcut(event, 'debugLayeringTest') || matchesShortcut(event, 'debugLayeringTestAlt')) {
        event.preventDefault();
        event.stopPropagation();

        // Direct call to global window function (typed as Promise<unknown> in window.d.ts)
        if (window.runLayeringWorkflowTest) {
          window.runLayeringWorkflowTest().then((rawResult: unknown) => {
            const result = rawResult as LayeringWorkflowResult;
            const successSteps = result.steps.filter((s: WorkflowTestStep) => s.status === 'success').length;
            const totalSteps = result.steps.length;
            const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
            showCopyableNotification(summary, result.success ? 'success' : 'error');
          });
        } else {
          // Fallback to import
          import('./layering-workflow-test').then(module => {
            const runLayeringWorkflowTest = module.runLayeringWorkflowTest;
            runLayeringWorkflowTest().then((result: LayeringWorkflowResult) => {
              const successSteps = result.steps.filter((s: WorkflowTestStep) => s.status === 'success').length;
              const totalSteps = result.steps.length;
              const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
              showCopyableNotification(summary, result.success ? 'success' : 'error');
            });
          });
        }
        return;
      }

      // ⌨️ F3: Cursor-Crosshair Alignment Test
      if (matchesShortcut(event, 'debugCursorTest')) {
        event.preventDefault();
        event.stopPropagation();

        import('./enterprise-cursor-crosshair-test').then(module => {
          const defaultExport = module.default as EnterpriseCursorTestModule;
          const { runEnterpriseMouseCrosshairTests, startEnterpriseInteractiveTest } = defaultExport;

          const results = runEnterpriseMouseCrosshairTests();

          const summary = `Enterprise Test: ${results.overallStatus}
Scenarios: ${results.passedScenarios}/${results.totalScenarios} passed
Avg Performance: ${results.avgPerformance.toFixed(1)}ms
Max Error: ${results.maxError.toFixed(3)}px
Min Pass Rate: ${(results.minPassRate * 100).toFixed(1)}%

Check console for detailed metrics`;

          startEnterpriseInteractiveTest();

          showCopyableNotification(summary, results.overallStatus === 'PASS' ? 'success' : 'warning');
        }).catch(error => {
          console.error('Failed to load enterprise cursor-crosshair test:', error);
          showCopyableNotification('Failed to load enterprise cursor-crosshair test module', 'error');
        });
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [showCopyableNotification]);
}
