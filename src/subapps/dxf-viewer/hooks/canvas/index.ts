/**
 * 🏢 ENTERPRISE: Canvas Hooks Index
 *
 * @description Centralized exports for all canvas-related hooks
 * @see ADR-XXX: CanvasSection Decomposition
 */

// === useCanvasMouse ===
export { useCanvasMouse } from './useCanvasMouse';
export type {
  UseCanvasMouseProps,
  UseCanvasMouseReturn,
  VertexHoverInfo,
  EdgeHoverInfo,
  SelectedGrip,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
} from './useCanvasMouse';

// === useCanvasSettings ===
export { useCanvasSettings } from './useCanvasSettings';
export type {
  UseCanvasSettingsProps,
  UseCanvasSettingsReturn,
  GridContextSettings,
  RulerContextSettings,
} from './useCanvasSettings';
