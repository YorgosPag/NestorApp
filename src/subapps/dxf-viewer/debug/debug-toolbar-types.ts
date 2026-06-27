/**
 * debug-toolbar-types — shared type definitions for the Debug Toolbar (ADR-compliant, NO any).
 *
 * Extracted from DebugToolbar.tsx (CHECK 4 file-size SRP split). Consumed by the
 * toolbar component AND the useDebugToolbarShortcuts hook.
 */

import type { WorkflowResult } from './layering-workflow-test';

/** Workflow test step result */
export type WorkflowTestStep = WorkflowResult['steps'][number];

/** Layering workflow test result */
export type LayeringWorkflowResult = WorkflowResult;

/** Enterprise cursor test results */
export interface EnterpriseCursorTestResults {
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  passedScenarios: number;
  totalScenarios: number;
  avgPerformance: number;
  maxError: number;
  minPassRate: number;
}

/** Enterprise cursor test module */
export interface EnterpriseCursorTestModule {
  runEnterpriseMouseCrosshairTests: () => EnterpriseCursorTestResults;
  startEnterpriseInteractiveTest: () => void;
}

/** DOM inspection result */
export interface DOMInspectionResult {
  floatingPanels: Array<{ selector: string; found: boolean; element?: HTMLElement }>;
  tabs: Array<{ text: string; element: HTMLElement; className: string }>;
  cards: Array<{ text: string; element: HTMLElement; className: string }>;
  canvases: Array<{ type: string; element: HTMLCanvasElement; rect: DOMRect }>;
  overlayContainers: Array<{ selector: string; found: boolean; element?: HTMLElement }>;
}

/** Notification callback shared by the toolbar buttons + keyboard shortcuts. */
export type ShowCopyableNotification = (
  message: string,
  type?: 'success' | 'info' | 'warning' | 'error',
) => void;
