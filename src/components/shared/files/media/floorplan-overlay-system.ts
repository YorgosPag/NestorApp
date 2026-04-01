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
import { getStatusColors } from '@/subapps/dxf-viewer/config/color-mapping';
import { UI_COLORS, withOpacity, OVERLAY_OPACITY } from '@/subapps/dxf-viewer/config/color-config';
import { isPointInPolygon } from '@core/polygon-system/utils/polygon-utils';
import type { UniversalPolygon } from '@core/polygon-system/types';

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

/** Coordinate bounds for DXF scene */
interface SceneBounds {
  min: { x: number; y: number };
  max: { x: number; y: number };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Fallback colors when no status / unlinked — ADR-258 SSoT opacity */
export const OVERLAY_FALLBACK = {
  stroke: UI_COLORS.DARK_GRAY,
  fill: withOpacity(UI_COLORS.DARK_GRAY, OVERLAY_OPACITY.MUTED),
} as const;

// ============================================================================
// OVERLAY RENDERING (SPEC-237B)
// ============================================================================

/**
 * Draw polygon overlays on top of a DXF canvas.
 * Uses the SAME coordinate transform as renderDxfToCanvas (Y-flip, scale, offset).
 * Only for DXF floorplans — PDF/Image require calibration data (SPEC-237D).
 */
export function drawOverlayPolygons(
  canvas: HTMLCanvasElement,
  overlays: ReadonlyArray<FloorOverlayItem>,
  bounds: SceneBounds,
  zoom: number,
  panOffset: PanOffset,
  highlightedUnitId?: string | null,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || overlays.length === 0) return;

  const drawingWidth = bounds.max.x - bounds.min.x;
  const drawingHeight = bounds.max.y - bounds.min.y;
  const baseScale = Math.min(canvas.width / drawingWidth, canvas.height / drawingHeight);
  const scale = baseScale * zoom;
  const offsetX = (canvas.width - drawingWidth * scale) / 2 + panOffset.x;
  const offsetY = (canvas.height - drawingHeight * scale) / 2 + panOffset.y;

  ctx.save();

  for (const overlay of overlays) {
    if (overlay.polygon.length < 3) continue;

    // ADR-258D: Dynamic coloring via resolvedStatus (entity.commercialStatus → PropertyStatus)
    const colors = getStatusColors(overlay.resolvedStatus) ?? OVERLAY_FALLBACK;
    const isHighlighted = !!(highlightedUnitId && overlay.linked?.propertyId === highlightedUnitId);

    // ADR-258D: No fill on normal, fill on hover only (stroke-only base)
    ctx.fillStyle = isHighlighted
      ? withOpacity(colors.stroke, OVERLAY_OPACITY.GALLERY_FILL)
      : 'transparent';
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = isHighlighted ? 4 : 3;

    // Draw polygon
    ctx.beginPath();
    overlay.polygon.forEach((vertex, i) => {
      const sx = (vertex.x - bounds.min.x) * scale + offsetX;
      const sy = (bounds.max.y - vertex.y) * scale + offsetY;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Label intentionally NOT rendered in FloorplanGallery (ADR-258D)
    // Labels like "Overlay 1174..." are internal IDs — not useful for end users
  }

  ctx.restore();
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
  const drawingWidth = bounds.max.x - bounds.min.x;
  const drawingHeight = bounds.max.y - bounds.min.y;
  const baseScale = Math.min(canvas.width / drawingWidth, canvas.height / drawingHeight);
  const scale = baseScale * zoom;
  const offsetX = (canvas.width - drawingWidth * scale) / 2 + panOffset.x;
  const offsetY = (canvas.height - drawingHeight * scale) / 2 + panOffset.y;

  const worldX = (screenX - offsetX) / scale + bounds.min.x;
  const worldY = bounds.max.y - (screenY - offsetY) / scale;
  return { x: worldX, y: worldY };
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
