/**
 * ADR-370 — Synthetic ViewTransform bridge for BIM read-only render in Properties.
 *
 * Aligns `CoordinateTransforms.worldToScreen` (BIM renderers) with the pixel
 * space produced by `renderDxfToCanvas` (FloorplanGallery), so the BIM façade
 * draws on the same canvas with zero misalignment.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-370-bim-readonly-visualization.md
 */

import type { PanOffset } from '@/hooks/useZoomPan';
import {
  COORDINATE_LAYOUT,
  type ViewTransform,
  type Viewport,
} from '@/subapps/dxf-viewer/rendering/core/CoordinateTransforms';

type ViewTransformLocal = ViewTransform;

export interface SceneBounds {
  readonly min: { x: number; y: number };
  readonly max: { x: number; y: number };
}

export interface BimCanvasTransform {
  readonly transform: ViewTransformLocal;
  readonly viewport: Viewport;
  readonly scale: number;
}

export function buildBimViewTransform(
  bounds: SceneBounds,
  canvasWidth: number,
  canvasHeight: number,
  zoom: number,
  panOffset: PanOffset,
): BimCanvasTransform {
  const drawingWidth = Math.max(1e-9, bounds.max.x - bounds.min.x);
  const drawingHeight = Math.max(1e-9, bounds.max.y - bounds.min.y);

  const baseScale = Math.min(canvasWidth / drawingWidth, canvasHeight / drawingHeight);
  const scale = baseScale * zoom;

  const dxfOffsetX = (canvasWidth - drawingWidth * scale) / 2 + panOffset.x;
  const dxfOffsetY = (canvasHeight - drawingHeight * scale) / 2 + panOffset.y;

  const { left: marginLeft, top: marginTop } = COORDINATE_LAYOUT.MARGINS;

  const transform: ViewTransformLocal = {
    scale,
    offsetX: dxfOffsetX - bounds.min.x * scale - marginLeft,
    offsetY: canvasHeight - marginTop - bounds.max.y * scale - dxfOffsetY,
  };

  const viewport: Viewport = { width: canvasWidth, height: canvasHeight };

  return { transform, viewport, scale };
}
