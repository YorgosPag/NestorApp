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
  GripHoverThrottle, // 🏢 ENTERPRISE: Shared type with useGripSystem
} from './useCanvasMouse';

// === useCanvasSettings ===
export { useCanvasSettings } from './useCanvasSettings';
export type {
  UseCanvasSettingsProps,
  UseCanvasSettingsReturn,
  GridContextSettings,
  RulerContextSettings,
} from './useCanvasSettings';

// === useCanvasResize === (ADR-118)
export { useCanvasResize } from './useCanvasResize';
export type {
  UseCanvasResizeOptions,
  UseCanvasResizeResult,
} from './useCanvasResize';

// === useCanvasSizeObserver === (ADR-146)
export { useCanvasSizeObserver } from './useCanvasSizeObserver';
export type { UseCanvasSizeObserverOptions } from './useCanvasSizeObserver';

// === useViewportManager === (CanvasSection decomposition — viewport lifecycle)
export { useViewportManager } from './useViewportManager';
export type {
  UseViewportManagerParams,
  UseViewportManagerReturn,
} from './useViewportManager';

// === useDxfSceneConversion === (CanvasSection decomposition — scene→DxfScene conversion)
export { useDxfSceneConversion } from './useDxfSceneConversion';
export type {
  UseDxfSceneConversionParams,
  UseDxfSceneConversionReturn,
} from './useDxfSceneConversion';

// === useCanvasContextMenu === (CanvasSection decomposition — right-click context menu)
export { useCanvasContextMenu } from './useCanvasContextMenu';
export type {
  UseCanvasContextMenuParams,
  UseCanvasContextMenuReturn,
} from './useCanvasContextMenu';
