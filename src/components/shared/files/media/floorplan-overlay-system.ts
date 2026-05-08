/**
 * =============================================================================
 * ENTERPRISE: FloorplanGallery Overlay System (Multi-Kind)
 * =============================================================================
 *
 * Overlay rendering, hit-testing, and coordinate transforms for floorplans
 * (DXF / PDF / Image). Implements SPEC-237B (Overlay Bridge Core) and
 * SPEC-237C (Interactive Overlays). Phase 9 STEP F (ADR-340) extends
 * `computeOverlayAABBs` and `hitTestOverlays` to dispatch on `geometry.type`
 * via the SSoT helpers in `overlay-hit-test.ts`.
 *
 * Polygon-only inputs still flow through the legacy renderer in
 * `overlay-polygon-renderer` (compat shim → `overlay-renderer/legacy`).
 *
 * @module components/shared/files/media/floorplan-overlay-system
 */

import type { PanOffset } from '@/hooks/useZoomPan';
import type { FloorOverlayItem } from '@/hooks/useFloorOverlays';
import {
  computeFitTransform,
  renderOverlayPolygons,
  screenToWorld as ssotScreenToWorld,
  type SceneBounds,
  type OverlayLabel,
} from './overlay-polygon-renderer';
import {
  computeGeometryAABB,
  hitTestGeometry,
  DEFAULT_HIT_TOLERANCE,
  type GeometryAABB,
} from './overlay-hit-test';

export { OVERLAY_FALLBACK } from './overlay-polygon-renderer';
export type { OverlayLabel } from './overlay-polygon-renderer';

// ============================================================================
// TYPES
// ============================================================================

/** AABB (world-space) plus indexing metadata for fast hit-test pre-filter. */
export interface OverlayAABB extends GeometryAABB {
  overlayIndex: number;
  propertyId: string | undefined;
}

// ============================================================================
// OVERLAY RENDERING (SPEC-237B)
// ============================================================================

/**
 * Draw polygon overlays on top of a DXF or PDF canvas. Same fit-and-center
 * transform (Y-flip, scale, offset) as `renderDxfToCanvas` /
 * `renderPdfImageToCanvas`. For PDF, callers pass synthetic CAD bounds
 * `{min:{0,0}, max:{pdfWidth, pdfHeight}}` — overlay polygons are stored in
 * world coords matching the editor's default `pdfTransform`.
 */
export function drawOverlayPolygons(
  canvas: HTMLCanvasElement,
  overlays: ReadonlyArray<FloorOverlayItem>,
  bounds: SceneBounds,
  zoom: number,
  panOffset: PanOffset,
  highlightedUnitId?: string | null,
  getLabel?: (overlay: FloorOverlayItem) => OverlayLabel | null | undefined,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || overlays.length === 0) return;
  const fit = computeFitTransform(canvas.width, canvas.height, bounds, zoom, panOffset);
  renderOverlayPolygons(ctx, overlays, bounds, fit, { highlightedUnitId, getLabel });
}

// ============================================================================
// HIT-TESTING UTILITIES (SPEC-237C — multi-kind, Phase 9 STEP F)
// ============================================================================

/** Compute world-space AABBs for all overlays — dispatches on geometry kind. */
export function computeOverlayAABBs(overlays: ReadonlyArray<FloorOverlayItem>): OverlayAABB[] {
  return overlays.map((overlay, index) => {
    const aabb = computeGeometryAABB(overlay.geometry);
    return {
      overlayIndex: index,
      minX: aabb.minX,
      minY: aabb.minY,
      maxX: aabb.maxX,
      maxY: aabb.maxY,
      propertyId: overlay.linked?.propertyId,
    };
  });
}

/**
 * Inverse coordinate transform: screen (canvas) pixels → world coordinates.
 * Reverses `worldToScreen`:
 *   screenX = (worldX - bounds.min.x) * scale + offsetX
 *   screenY = (bounds.max.y - worldY) * scale + offsetY
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  canvas: HTMLCanvasElement,
  bounds: SceneBounds,
  zoom: number,
  panOffset: PanOffset,
): { x: number; y: number } {
  const fit = computeFitTransform(canvas.width, canvas.height, bounds, zoom, panOffset);
  return ssotScreenToWorld(screenX, screenY, bounds, fit);
}

/**
 * Hit-test overlays at a world-space point. AABB pre-filter then per-geometry
 * dispatch via `hitTestGeometry`. Returns the first matching overlay or null.
 *
 * `tolerance` (world units) controls non-polygon dispatch (line/circle/arc/
 * dimension/measurement). Polygon ray-cast ignores it. Default 1 world unit.
 */
export function hitTestOverlays(
  worldPoint: { x: number; y: number },
  overlays: ReadonlyArray<FloorOverlayItem>,
  aabbs: OverlayAABB[],
  tolerance: number = DEFAULT_HIT_TOLERANCE,
): FloorOverlayItem | null {
  for (const aabb of aabbs) {
    if (worldPoint.x < aabb.minX - tolerance || worldPoint.x > aabb.maxX + tolerance ||
        worldPoint.y < aabb.minY - tolerance || worldPoint.y > aabb.maxY + tolerance) {
      continue;
    }

    const overlay = overlays[aabb.overlayIndex];
    if (hitTestGeometry(worldPoint, overlay.geometry, overlay.id, tolerance)) {
      return overlay;
    }
  }
  return null;
}
