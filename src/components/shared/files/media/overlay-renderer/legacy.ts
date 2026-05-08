/**
 * Overlay renderer — legacy polygon-only API (back-compat).
 *
 * Existing consumers (`floorplan-overlay-system.ts`, PDF renderer,
 * `useFloorplanCanvasRender`, FloorplanGallery) call `renderOverlayPolygon`
 * / `renderOverlayPolygons` with the legacy `FloorOverlayItem` shape (which
 * exposes `polygon: Point2D[]` directly, no `geometry` field). This module
 * preserves that surface while delegating draws to the SSoT polygon helper.
 *
 * Once `useFloorOverlays` migrates to the `FloorplanOverlay` shape (STEP F),
 * consumers can switch to `renderOverlay` from `dispatch.ts` and this file
 * can be removed.
 *
 * @module components/shared/files/media/overlay-renderer/legacy
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

import type { FloorOverlayItem } from '@/hooks/useFloorOverlays';
import { drawPolygon } from './polygon';
import { renderOverlayLabel } from './label';
import { resolvePolygonColors } from './colors';
import type { SceneBounds, FitTransform, OverlayLabel } from './types';

const DEFAULT_STROKE_WIDTH = 3;
const DEFAULT_STROKE_WIDTH_HIGHLIGHTED = 4;

export interface RenderOptions {
  highlightedUnitId?: string | null;
  strokeWidth?: number;
  strokeWidthHighlighted?: number;
  getLabel?: (overlay: FloorOverlayItem) => OverlayLabel | null | undefined;
}

/**
 * Render one legacy `FloorOverlayItem` polygon. Skips polygons with < 3
 * vertices. Caller wraps `ctx.save()/restore()` if needed.
 */
export function renderOverlayPolygon(
  ctx: CanvasRenderingContext2D,
  overlay: FloorOverlayItem,
  bounds: SceneBounds,
  fit: FitTransform,
  isHighlighted: boolean,
  strokeWidth: number = DEFAULT_STROKE_WIDTH,
  strokeWidthHighlighted: number = DEFAULT_STROKE_WIDTH_HIGHLIGHTED,
): void {
  if (overlay.polygon.length < 3) return;
  const colors = resolvePolygonColors(overlay.resolvedStatus, isHighlighted);
  drawPolygon(ctx, overlay.polygon, true, bounds, fit, {
    stroke: colors.stroke,
    fill: colors.fill,
    lineWidth: isHighlighted ? strokeWidthHighlighted : strokeWidth,
  });
}

/**
 * Render a list of overlay polygons. Two passes: pass 1 fill+stroke,
 * pass 2 hover label on the highlighted overlay (if `getLabel` set).
 */
export function renderOverlayPolygons(
  ctx: CanvasRenderingContext2D,
  overlays: ReadonlyArray<FloorOverlayItem>,
  bounds: SceneBounds,
  fit: FitTransform,
  options: RenderOptions = {},
): void {
  if (overlays.length === 0) return;
  const {
    highlightedUnitId,
    strokeWidth = DEFAULT_STROKE_WIDTH,
    strokeWidthHighlighted = DEFAULT_STROKE_WIDTH_HIGHLIGHTED,
    getLabel,
  } = options;

  ctx.save();

  for (const overlay of overlays) {
    const isHighlighted = isOverlayHighlighted(overlay, highlightedUnitId);
    renderOverlayPolygon(ctx, overlay, bounds, fit, isHighlighted, strokeWidth, strokeWidthHighlighted);
  }

  if (getLabel) {
    for (const overlay of overlays) {
      const isHighlighted = isOverlayHighlighted(overlay, highlightedUnitId);
      if (!isHighlighted) continue;
      const label = getLabel(overlay);
      if (!label) continue;
      renderOverlayLabel(ctx, overlay.polygon, bounds, fit, label);
    }
  }

  ctx.restore();
}

function isOverlayHighlighted(
  overlay: FloorOverlayItem,
  highlightedUnitId: string | null | undefined,
): boolean {
  return !!(highlightedUnitId && overlay.linked?.propertyId === highlightedUnitId);
}
