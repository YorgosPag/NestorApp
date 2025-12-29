/**
 * CANVAS V2 - MAIN EXPORTS
 * Clean canvas system exports
 */

// ✅ ENTERPRISE: Import required types
import type { Point2D } from '../rendering/types/Types';

// === MAIN COMPONENTS ===
// Conditional exports για αποφυγή compilation errors
export { DxfCanvas } from './dxf-canvas/DxfCanvas';
export { LayerCanvas } from './layer-canvas/LayerCanvas';

// === RENDERERS ===
export { DxfRenderer } from './dxf-canvas/DxfRenderer';
export { LayerRenderer } from './layer-canvas/LayerRenderer';
// CrosshairRenderer μεταφέρθηκε στο rendering/ui/crosshair/ - ΦΑΣΗ 6 κεντρικοποίηση
// export { CrosshairRenderer } from './layer-canvas/crosshair/CrosshairRenderer';
// CursorRenderer μεταφέρθηκε στο rendering/ui/cursor/ - ΦΑΣΗ 6 κεντρικοποίηση
// export { CursorRenderer } from './layer-canvas/cursor/CursorRenderer';
// SnapRenderer μεταφέρθηκε στο rendering/ui/snap/ - ΦΑΣΗ 6 κεντρικοποίηση
// export { SnapRenderer } from './layer-canvas/snap-indicators/SnapRenderer';
export { SelectionRenderer } from './layer-canvas/selection/SelectionRenderer';

// === SHARED UTILITIES ===
export { CoordinateTransforms } from '../rendering/core/CoordinateTransforms';
// ✅ ΦΑΣΗ 7: CanvasUtils αφαιρέθηκε - χρήση direct import από rendering/canvas/utils/CanvasUtils
// ✅ ΦΑΣΗ 7: Event system κεντρικοποιημένο στο rendering/canvas/core/CanvasEventSystem
export { canvasEventBus, CANVAS_EVENTS } from '../rendering/canvas/core/CanvasEventSystem';

// === TYPES ===
// ✅ ΦΑΣΗ 7: Direct imports από κεντρικό rendering/types/Types.ts
export type {
  Point2D,
  Viewport,
  ViewTransform,
  CanvasConfig
} from '../rendering/types/Types';

// ✅ ΦΑΣΗ 7: Canvas-specific types από κεντρικό event system
export type {
  CanvasEvent,
  TransformChangeEvent
} from '../rendering/canvas/core/CanvasEventSystem';

// Canvas-v2 specific types
export interface CanvasMouseState {
  position: Point2D | null;
  worldPosition: Point2D | null;
  isDown: boolean;
  button: number;
}

export interface RenderStats {
  frameTime: number;
  entitiesRendered: number;
  layersRendered: number;
}

export type {
  DxfEntity,
  DxfLine,
  DxfCircle,
  DxfPolyline,
  DxfArc,
  DxfText,
  DxfEntityUnion,
  DxfScene,
  DxfRenderOptions,
  DxfSelectionResult
} from './dxf-canvas/dxf-types';

export type {
  ColorLayer,
  LayerPolygon,
  // CrosshairSettings μεταφέρθηκε στο rendering/ui/crosshair/ - ΦΑΣΗ 6 κεντρικοποίηση
  SnapSettings,
  SnapType,
  SnapResult,
  GridSettings,
  RulerSettings,
  SelectionSettings,
  SelectionBox,
  LayerRenderOptions
} from './layer-canvas/layer-types';

// ✅ CURSOR SETTINGS: Χρησιμοποιούμε το κεντρικό CursorSettings
export type { CursorSettings } from '../systems/cursor/config';