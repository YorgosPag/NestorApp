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

// === useSmartDelete === (CanvasSection decomposition — context-aware deletion)
export { useSmartDelete } from './useSmartDelete';
export type {
  UseSmartDeleteParams,
  UseSmartDeleteReturn,
} from './useSmartDelete';

// === useDrawingUIHandlers === (CanvasSection decomposition — drawing action handlers)
export { useDrawingUIHandlers } from './useDrawingUIHandlers';
export type {
  UseDrawingUIHandlersParams,
  UseDrawingUIHandlersReturn,
} from './useDrawingUIHandlers';

// === useCanvasClickHandler === (CanvasSection decomposition — priority-based click routing)
export { useCanvasClickHandler } from './useCanvasClickHandler';
export type {
  UseCanvasClickHandlerParams,
  UseCanvasClickHandlerReturn,
} from './useCanvasClickHandler';

// === useLayerCanvasMouseMove === (CanvasSection decomposition — LayerCanvas grip hover + mouse move)
export { useLayerCanvasMouseMove } from './useLayerCanvasMouseMove';
export type {
  UseLayerCanvasMouseMoveParams,
  UseLayerCanvasMouseMoveReturn,
} from './useLayerCanvasMouseMove';

// === useFitToView === (CanvasSection decomposition #8 — fit-to-view zoom functionality)
export { useFitToView } from './useFitToView';
export type {
  UseFitToViewParams,
  UseFitToViewReturn,
} from './useFitToView';

// === usePolygonCompletion === (CanvasSection decomposition #9 — polygon draft state + completion)
export { usePolygonCompletion } from './usePolygonCompletion';
export type {
  UsePolygonCompletionParams,
  UsePolygonCompletionReturn,
} from './usePolygonCompletion';

// === useCanvasKeyboardShortcuts === (CanvasSection decomposition #10 — keyboard shortcuts)
export { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts';
export type {
  UseCanvasKeyboardShortcutsParams,
} from './useCanvasKeyboardShortcuts';

// === useCanvasEffects === (CanvasSection decomposition #11 — effects + drawing system init)
export { useCanvasEffects } from './useCanvasEffects';
export type {
  UseCanvasEffectsParams,
  UseCanvasEffectsReturn,
} from './useCanvasEffects';
