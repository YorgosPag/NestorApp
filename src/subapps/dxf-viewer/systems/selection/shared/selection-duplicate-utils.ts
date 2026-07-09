/**
 * Selection duplicate patterns utilities
 * Consolidates the most common duplicate patterns in selection system
 */

import type { Entity, LineEntity, CircleEntity, RectangleEntity } from '../../../types/entities';
// 🏢 ADR-102: Centralized Entity Type Guards
import { isLineEntity, isCircleEntity, isRectangleEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type { AnySceneEntity } from '../../../types/scene';
// 🏢 ADR-089: Centralized Point-In-Bounds
import { SpatialUtils } from '../../../core/spatial/SpatialUtils';
// 🏢 ADR-158: Centralized Infinity Bounds Initialization
// 🏢 ADR-034: Centralized Empty Spatial Bounds
import { createInfinityBounds, EMPTY_SPATIAL_BOUNDS } from '../../../config/geometry-constants';
// ADR-587 Φ9 Slice 1 — the per-type bounds math now lives in the canonical SSoT
// resolver (`entity-bounds-ssot.ts`, big-player polymorphic `getGeomExtents`).
// `calculateEntityBounds` is a thin `{min,max}` shape-adapter over it (was a big
// per-type switch; each type's math is byte-identical, moved to a provider). This
// slice ALSO fixes 6 types that returned null here → real marquee bounds.
import { resolveEntityBounds } from '../../../rendering/hitTesting/entity-bounds-ssot';
// `createRectangleVertices` moved to the neutral geometry module (ADR-587 Φ9
// Slice 1, cycle avoidance — the bounds SSoT reuses it). Re-exported so existing
// importers (explode / RectangleDragMeasurement / selection utils) keep this path.
export { createRectangleVertices } from '../../../rendering/entities/shared/geometry-utils';

/**
 * Calculate bounding box for entities
 * ✅ ENTERPRISE FIX: Uses proper Entity type with type narrowing for type safety
 */
export function calculateBoundingBox(entities: Entity[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (entities.length === 0) {
    // 🏢 ADR-034: Centralized Empty Spatial Bounds
    return EMPTY_SPATIAL_BOUNDS;
  }

  // 🏢 ADR-158: Centralized Infinity Bounds Initialization
  const bounds = createInfinityBounds();

  entities.forEach(entity => {
    // Extract bounds from different entity types using type narrowing
    // 🏢 ADR-102: Use centralized type guards
    if (isLineEntity(entity)) {
      const lineEntity = entity as LineEntity;
      const { start, end } = lineEntity;
      if (start && end) {
        bounds.minX = Math.min(bounds.minX, start.x, end.x);
        bounds.minY = Math.min(bounds.minY, start.y, end.y);
        bounds.maxX = Math.max(bounds.maxX, start.x, end.x);
        bounds.maxY = Math.max(bounds.maxY, start.y, end.y);
      }
    } else if (isCircleEntity(entity)) {
      const circleEntity = entity as CircleEntity;
      const { center, radius } = circleEntity;
      if (center && radius !== undefined) {
        bounds.minX = Math.min(bounds.minX, center.x - radius);
        bounds.minY = Math.min(bounds.minY, center.y - radius);
        bounds.maxX = Math.max(bounds.maxX, center.x + radius);
        bounds.maxY = Math.max(bounds.maxY, center.y + radius);
      }
    } else if (isRectangleEntity(entity)) {
      const rectEntity = entity as RectangleEntity;
      const { x, y, width, height } = rectEntity;
      if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxX = Math.max(bounds.maxX, x + width);
        bounds.maxY = Math.max(bounds.maxY, y + height);
      }
    }
  });

  return {
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY
  };
}

/**
 * Check if point is inside bounding rectangle
 * 🏢 ADR-089: Wrapper για SpatialUtils.pointInBounds() - Single Source of Truth
 * @deprecated Prefer using SpatialUtils.pointInBounds() directly for new code
 */
export function isPointInBounds(
  point: Point2D,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return SpatialUtils.pointInBounds(point, bounds);
}

/**
 * Filter entities by visibility and layer status
 * ✅ ENTERPRISE FIX: Uses proper Entity type for type safety
 */
export function filterVisibleEntities(entities: Entity[]): Entity[] {
  return entities.filter(entity => {
    // Check if entity itself is visible
    if (entity.visible === false) return false;

    // Additional layer checks can be added here
    return true;
  });
}

/**
 * Standard entity selection validation pattern
 * ✅ ENTERPRISE FIX: Uses proper Entity type for type safety
 */
export function isEntitySelectable(
  entity: Entity,
  selectionCriteria?: {
    types?: string[];
    excludeIds?: string[];
    visibleOnly?: boolean;
  }
): boolean {
  const criteria = selectionCriteria || {};
  
  // Check type filter
  if (criteria.types && !criteria.types.includes(entity.type)) {
    return false;
  }
  
  // Check exclusion list
  if (criteria.excludeIds && criteria.excludeIds.includes(entity.id)) {
    return false;
  }
  
  // Check visibility
  if (criteria.visibleOnly !== false && entity.visible === false) {
    return false;
  }
  
  return true;
}

// 🗑️ REMOVED: calculateVerticesBounds method - now using centralized version from GeometryUtils
// Import: import { calculateVerticesBounds } from '../../../utils/geometry/GeometryUtils';

/**
 * Unified entity bounds calculation (Twin B) — thin `{min,max}` shape-adapter over
 * the canonical per-type bounds SSoT `resolveEntityBounds` (`entity-bounds-ssot.ts`,
 * ADR-587 Φ9 Slice 1). The per-type math (byte-identical to the previous switch)
 * now lives in the SSoT providers; this preserves the marquee's `{min,max}|null`
 * contract. As of Slice 1, annotation-symbol / railing / thermal-space /
 * space-separator / wall-covering — which used to return null here — resolve to
 * real bounds, so they are finally window/crossing-marquee selectable.
 */
export function calculateEntityBounds(entity: AnySceneEntity): { min: Point2D, max: Point2D } | null {
  const bb = resolveEntityBounds(entity as unknown as Entity);
  return bb ? { min: { x: bb.minX, y: bb.minY }, max: { x: bb.maxX, y: bb.maxY } } : null;
}

/**
 * ADR-394 — Combined AABB for a list of mixed entities (DXF + BIM).
 *
 * Merges each entity's bounds via `calculateEntityBounds` (the SSoT that already
 * covers wall/column/slab/beam/stair/opening). Entities that yield no bounds are
 * skipped. Returns null when none produce bounds (e.g. empty selection).
 */
export function calculateCombinedEntityBounds(
  entities: AnySceneEntity[],
): { min: Point2D, max: Point2D } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;
  for (const entity of entities) {
    const b = calculateEntityBounds(entity);
    if (!b) continue;
    found = true;
    if (b.min.x < minX) minX = b.min.x;
    if (b.min.y < minY) minY = b.min.y;
    if (b.max.x > maxX) maxX = b.max.x;
    if (b.max.y > maxY) maxY = b.max.y;
  }
  return found ? { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } } : null;
}