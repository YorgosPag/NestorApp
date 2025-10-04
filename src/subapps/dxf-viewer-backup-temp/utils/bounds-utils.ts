/**
 * Bounds Utilities - Union operations για DXF + Overlays
 * Υποστηρίζει fitToView με unified bounds calculation
 */

import type { Point2D } from '../rendering/types/Types';

export interface Bounds {
  min: Point2D;
  max: Point2D;
}

/**
 * Υπολογίζει union δύο bounds objects με validation για NaN
 */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  // ✅ Validation για NaN values που μπορούν να κάνουν το fitToView να crashάρει
  const safeA = {
    min: {
      x: Number.isFinite(a.min.x) ? a.min.x : 0,
      y: Number.isFinite(a.min.y) ? a.min.y : 0
    },
    max: {
      x: Number.isFinite(a.max.x) ? a.max.x : 0,
      y: Number.isFinite(a.max.y) ? a.max.y : 0
    }
  };

  const safeB = {
    min: {
      x: Number.isFinite(b.min.x) ? b.min.x : 0,
      y: Number.isFinite(b.min.y) ? b.min.y : 0
    },
    max: {
      x: Number.isFinite(b.max.x) ? b.max.x : 0,
      y: Number.isFinite(b.max.y) ? b.max.y : 0
    }
  };

  return {
    min: {
      x: Math.min(safeA.min.x, safeB.min.x),
      y: Math.min(safeA.min.y, safeB.min.y)
    },
    max: {
      x: Math.max(safeA.max.x, safeB.max.x),
      y: Math.max(safeA.max.y, safeB.max.y)
    }
  };
}

/**
 * Υπολογίζει bounds από overlay regions με validation για NaN
 */
export function getOverlayBounds(overlayEntities: any[]): Bounds | null {
  if (!overlayEntities?.length) return null;

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const entity of overlayEntities) {
    if (entity.vertices) {
      // Polygon/Region entity
      for (const vertex of entity.vertices) {
        // ✅ Skip invalid coordinates που μπορούν να δημιουργήσουν NaN bounds
        if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
          console.warn('🚨 [getOverlayBounds] Invalid vertex coordinates detected, skipping:', vertex);
          continue;
        }
        minX = Math.min(minX, vertex.x);
        minY = Math.min(minY, vertex.y);
        maxX = Math.max(maxX, vertex.x);
        maxY = Math.max(maxY, vertex.y);
      }
    } else if (entity.bounds) {
      // Entity με ήδη υπολογισμένα bounds - validate them
      const bounds = entity.bounds;
      if (bounds.min && bounds.max &&
          Number.isFinite(bounds.min.x) && Number.isFinite(bounds.min.y) &&
          Number.isFinite(bounds.max.x) && Number.isFinite(bounds.max.y)) {
        minX = Math.min(minX, bounds.min.x);
        minY = Math.min(minY, bounds.min.y);
        maxX = Math.max(maxX, bounds.max.x);
        maxY = Math.max(maxY, bounds.max.y);
      } else {
        console.warn('🚨 [getOverlayBounds] Invalid entity bounds detected, skipping:', bounds);
      }
    }
  }

  // ✅ Final validation - αν δεν βρήκαμε έγκυρα bounds, return null
  if (minX === Infinity || !Number.isFinite(minX) || !Number.isFinite(minY) ||
      !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    console.warn('🚨 [getOverlayBounds] No valid overlay bounds found, returning null');
    return null;
  }

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