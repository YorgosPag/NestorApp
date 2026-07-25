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
import { computeFitTransform, type SceneBounds } from '@/lib/dxf-scene/scene-fit-transform';
import { COORDINATE_LAYOUT } from '@/subapps/dxf-viewer/rendering/core/CoordinateTransforms';
import type { ViewTransform, Viewport } from '@/subapps/dxf-viewer/rendering/types/Types';

type ViewTransformLocal = ViewTransform;

/** Re-exported from the fit-transform SSoT — this module must not own a second shape. */
export type { SceneBounds };

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
  // Same fit the DXF geometry pass uses (SSoT) — the two must agree to the pixel.
  const fit = computeFitTransform(canvasWidth, canvasHeight, bounds, zoom, panOffset);
  const { scale, offsetX: dxfOffsetX, offsetY: dxfOffsetY } = fit;

  const { left: marginLeft, top: marginTop } = COORDINATE_LAYOUT.MARGINS;

  const transform: ViewTransformLocal = {
    scale,
    offsetX: dxfOffsetX - bounds.min.x * scale - marginLeft,
    offsetY: canvasHeight - marginTop - bounds.max.y * scale - dxfOffsetY,
  };

  const viewport: Viewport = { width: canvasWidth, height: canvasHeight };

  return { transform, viewport, scale };
}
