/**
 * =============================================================================
 * ENTERPRISE: FloorplanGallery Overlay System
 * =============================================================================
 *
 * Overlay rendering, hit-testing, and coordinate transforms for DXF floorplans.
 * Implements SPEC-237B (Overlay Bridge Core) and SPEC-237C (Interactive Overlays).
 * Extracted from FloorplanGallery.tsx for SRP compliance (ADR-033).
 *
 * @module components/shared/files/media/floorplan-overlay-system
 */

import type { PanOffset } from '@/hooks/useZoomPan';
import type { FloorOverlayItem } from '@/hooks/useFloorOverlays';
import { isPointInPolygon } from '@core/polygon-system/utils/polygon-utils';
import type { UniversalPolygon } from '@core/polygon-system/types';
import {
  computeFitTransform,
  renderOverlayPolygons,
  screenToWorld as ssotScreenToWorld,
  type SceneBounds,
  type OverlayLabel,
} from './overlay-polygon-renderer';

export { OVERLAY_FALLBACK } from './overlay-polygon-renderer';
export type { OverlayLabel } from './overlay-polygon-renderer';

// ============================================================================
// TYPES
// ============================================================================

/** AABB (Axis-Aligned Bounding Box) for fast pre-filtering */
export interface OverlayAABB {
  overlayIndex: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  propertyId: string | undefined;
}

// ============================================================================
// OVERLAY RENDERING (SPEC-237B)
// ============================================================================

/**
 * Draw polygon overlays on top of a DXF or PDF canvas.
 * Uses the same fit-and-center transform (Y-flip, scale, offset) as
 * renderDxfToCanvas / renderPdfImageToCanvas. For PDF, callers pass synthetic
 * CAD bounds {min:{0,0}, max:{pdfWidth, pdfHeight}} — overlay polygons are
 * stored in DXF world coords matching the editor's default pdfTransform.
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
// HIT-TESTING UTILITIES (SPEC-237C)
// ============================================================================

/** Compute AABBs for all overlays (memoized externally) */
export function computeOverlayAABBs(overlays: ReadonlyArray<FloorOverlayItem>): OverlayAABB[] {
  return overlays.map((overlay, index) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of overlay.polygon) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
    return { overlayIndex: index, minX, minY, maxX, maxY, propertyId: overlay.linked?.propertyId };
  });
}

/**
 * Inverse coordinate transform: screen (canvas) pixels → DXF world coordinates.
 * Reverses the math in renderDxfToCanvas:
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
 * Hit-test overlays at a world-space point.
 * Uses AABB pre-filter + centralized isPointInPolygon (ray casting).
 * Returns the first overlay with a linked propertyId, or null.
 */
export function hitTestOverlays(
  worldPoint: { x: number; y: number },
  overlays: ReadonlyArray<FloorOverlayItem>,
  aabbs: OverlayAABB[],
): FloorOverlayItem | null {
  for (const aabb of aabbs) {
    // AABB pre-filter
    if (worldPoint.x < aabb.minX || worldPoint.x > aabb.maxX ||
        worldPoint.y < aabb.minY || worldPoint.y > aabb.maxY) {
      continue;
    }

    const overlay = overlays[aabb.overlayIndex];
    // Wrap in UniversalPolygon for isPointInPolygon (ZERO `as any`)
    const universalPolygon: UniversalPolygon = {
      id: overlay.id,
      type: 'simple',
      points: overlay.polygon,
      isClosed: true,
      style: { strokeColor: '', fillColor: '', strokeWidth: 0, fillOpacity: 0, strokeOpacity: 0 },
    };

    if (isPointInPolygon(worldPoint, universalPolygon)) {
      return overlay;
    }
  }
  return null;
}
