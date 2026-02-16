/**
 * Window interface extensions for DXF Viewer debug utilities.
 *
 * These properties are attached at runtime by debug modules so they
 * can be invoked from the browser console during development.
 *
 * Function signatures use generic callable types to avoid name
 * collisions with the local interfaces exported by each debug module.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Window {
  // --- debug/dom-inspector.ts ---
  inspectDOMElements?: (...args: any[]) => any;
  findFloatingPanelAdvanced?: (...args: any[]) => any;
  showDetailedDOMInfo?: (...args: any[]) => any;

  // --- app/DxfViewerContent.tsx ---
  showCopyableNotification?: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

  // --- debug/layering-workflow-test.ts ---
  runLayeringWorkflowTest?: (...args: any[]) => any;
  runLayeringWorkflowTestAdvanced?: (...args: any[]) => any;

  // --- debug/enterprise-cursor-crosshair-test.ts ---
  runEnterpriseMouseCrosshairTests?: (...args: any[]) => any;
  startEnterpriseInteractiveTest?: (...args: any[]) => any;

  // --- debug/CursorSnapAlignmentDebugOverlay.ts + LayerRenderer.ts ---
  __debugSnapResults?: Array<{ point?: { x: number; y: number }; type?: string; [key: string]: unknown }>;
  __cursorSnapAlignmentDebug?: Record<string, unknown>;

  // --- debug/OriginMarkersDebugOverlay.ts ---
  originMarkersDebug?: Record<string, unknown>;

  // --- debug/RulerDebugOverlay.ts ---
  rulerDebugOverlay?: Record<string, unknown>;

  // --- test-coordinate-reversibility.ts ---
  testCoordinateReversibility?: () => boolean;
}
