/**
 * Mouse Handler Types — ADR-065 SRP split
 * Extracted from useCentralizedMouseHandlers.ts
 */

import type React from 'react';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';

// Debug flag (2026-02-01): Enable for tracing coordinate flow
export const DEBUG_MOUSE_HANDLERS = false;

export interface SnapResultItem {
  point: Point2D;
  type: string;
  entityId: string | null;
  distance: number;
  priority: number;
}

export interface ZoomConstraints {
  minScale?: number;
  maxScale?: number;
  stepSize?: number;
}

export interface CentralizedMouseHandlersProps {
  scene: DxfScene | null;
  transform: ViewTransform;
  viewport: Viewport;
  activeTool?: string;
  overlayMode?: 'select' | 'draw' | 'edit';
  onTransformChange?: (transform: ViewTransform) => void;
  onEntitySelect?: (entityId: string | null) => void;
  onMouseMove?: (screenPos: Point2D, worldPos: Point2D) => void;
  onWheelZoom?: (wheelDelta: number, center: Point2D, constraints?: ZoomConstraints, modifiers?: { ctrlKey?: boolean; shiftKey?: boolean }) => void;
  hitTestCallback?: (scene: DxfScene | null, screenPos: Point2D, transform: ViewTransform, viewport: Viewport) => string | null;
  colorLayers?: ColorLayer[];
  onLayerSelected?: (layerId: string, position: Point2D) => void;
  onMultiLayerSelected?: (layerIds: string[]) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  onCanvasClick?: (point: Point2D, shiftKey?: boolean) => void;
  isGripDragging?: boolean;
  onDrawingHover?: (worldPos: Point2D) => void;
  onEntitiesSelected?: (entityIds: string[]) => void;
  onUnifiedMarqueeResult?: (result: { layerIds: string[]; entityIds: string[] }) => void;
  onHoverEntity?: (entityId: string | null) => void;
  onHoverOverlay?: (overlayId: string | null) => void;
  onGripMouseDown?: (worldPos: Point2D) => boolean;
  onGripMouseUp?: (worldPos: Point2D) => boolean;
  entityPickingActive?: boolean;
}

/** Shared mutable refs used by all handler factories */
export interface MouseHandlerRefs {
  panStateRef: React.MutableRefObject<{
    isPanning: boolean;
    lastMousePos: Point2D | null;
    pendingTransform: ViewTransform | null;
    animationId: number | null;
  }>;
  snapThrottleRef: React.MutableRefObject<{
    lastSnapTime: number;
    pendingWorldPos: Point2D | null;
    rafId: number | null;
    lastSnapFound: boolean;
    lastSnapX: number;
    lastSnapY: number;
  }>;
  cursorThrottleRef: React.MutableRefObject<{ lastUpdateTime: number }>;
  hoverThrottleRef: React.MutableRefObject<number>;
}

/** Snap manager API subset needed by handlers */
export interface SnapManagerAPI {
  snapEnabled: boolean;
  findSnapPoint: ((x: number, y: number) => {
    found: boolean;
    snappedPoint?: Point2D;
    activeMode?: string;
    snapPoint?: { entityId?: string; distance?: number };
  }) | undefined;
}
