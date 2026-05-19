/**
 * BIM Bounds — 2D AABB extraction from BIM entity geometry.bbox (SSoT)
 *
 * ADR-363 Phase 7A — Multi-Element Selection.
 *
 * Marquee selection (`UnifiedEntitySelection.findEntitiesInMarquee` via
 * `selection-duplicate-utils.calculateEntityBounds`) needs `{min,max}` 2D
 * bounds. Single source of truth for projecting `BimEntity.geometry.bbox`
 * (BoundingBox3D) to 2D. Mirrors `BoundsCalculator.calculateBimEntityBounds`
 * in `rendering/hitTesting/Bounds.ts` (spatial-index path), but returns the
 * marquee-side shape (`{min: Point2D, max: Point2D}`).
 *
 * Covers: wall, opening, slab, slab-opening, column, beam, stair.
 */
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';

/**
 * Returns 2D AABB `{min,max}` from a BIM entity's pre-computed
 * `geometry.bbox` (BoundingBox3D), projected to XY plan view.
 *
 * Returns null if:
 * - Entity is not a BIM type (caller falls through to non-BIM handling).
 * - Entity has no geometry yet (e.g. stair pre-compute, legacy partial data).
 */
export function calculateBimEntity2DBounds(entity: Entity): { min: Point2D; max: Point2D } | null {
  switch (entity.type) {
    case 'wall':
    case 'opening':
    case 'slab':
    case 'slab-opening':
    case 'column':
    case 'beam': {
      const bbox = entity.geometry?.bbox;
      if (!bbox) return null;
      return {
        min: { x: bbox.min.x, y: bbox.min.y },
        max: { x: bbox.max.x, y: bbox.max.y },
      };
    }
    case 'stair': {
      const bbox = entity.geometry?.bbox;
      if (!bbox) return null;
      return {
        min: { x: bbox.min.x, y: bbox.min.y },
        max: { x: bbox.max.x, y: bbox.max.y },
      };
    }
    default:
      return null;
  }
}
