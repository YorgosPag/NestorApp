/**
 * Bounds Utilities - Union operations για DXF + Overlays
 * Υποστηρίζει fitToView με unified bounds calculation
 */

// ✅ ENTERPRISE FIX: Correct Point2D import path
import type { Point2D } from '../rendering/types/Types';

export interface Bounds {
  min: Point2D;
  max: Point2D;
}

/**
 * Υπολογίζει union δύο bounds objects
 */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    min: {
      x: Math.min(a.min.x, b.min.x),
      y: Math.min(a.min.y, b.min.y)
    },
    max: {
      x: Math.max(a.max.x, b.max.x),
      y: Math.max(a.max.y, b.max.y)
    }
  };
}

/**
 * Υπολογίζει bounds από overlay regions
 */
export function getOverlayBounds(overlayEntities: any[]): Bounds | null {
  if (!overlayEntities?.length) return null;

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const entity of overlayEntities) {
    if (entity.vertices) {
      // Polygon/Region entity
      for (const vertex of entity.vertices) {
        minX = Math.min(minX, vertex.x);
        minY = Math.min(minY, vertex.y);
        maxX = Math.max(maxX, vertex.x);
        maxY = Math.max(maxY, vertex.y);
      }
    } else if (entity.bounds) {
      // Entity με ήδη υπολογισμένα bounds
      minX = Math.min(minX, entity.bounds.min.x);
      minY = Math.min(minY, entity.bounds.min.y);
      maxX = Math.max(maxX, entity.bounds.max.x);
      maxY = Math.max(maxY, entity.bounds.max.y);
    }
  }

  if (minX === Infinity) return null;

  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY }
  };
}

/**
 * Υπολογίζει unified bounds από DXF scene + overlays
 */
export function calculateUnifiedBounds(
  sceneBounds: Bounds | null,
  overlayEntities: any[] = []
): Bounds | null {
  const overlayBounds = getOverlayBounds(overlayEntities);

  if (!sceneBounds && !overlayBounds) return null;
  if (!sceneBounds) return overlayBounds;
  if (!overlayBounds) return sceneBounds;

  return unionBounds(sceneBounds, overlayBounds);
}