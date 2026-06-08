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
    case 'beam':
    // ADR-406 — MEP fixture projects geometry.bbox to 2D for marquee selection.
    case 'mep-fixture':
    // ADR-408 Φ3 — electrical panel projects geometry.bbox to 2D (same).
    case 'electrical-panel':
    // ADR-410 — furniture projects geometry.bbox to 2D (same).
    case 'furniture':
    // ADR-408 Φ8 — MEP segment projects geometry.bbox to 2D (same).
    case 'mep-segment':
    // ADR-408 Φ11 — MEP fitting projects geometry.bbox to 2D (same).
    case 'mep-fitting':
    // ADR-415 — floorplan symbol projects geometry.bbox to 2D (same).
    case 'floorplan-symbol':
    // ADR-417 — roof projects geometry.bbox to 2D (same).
    case 'roof':
    // ADR-419 — floor-finish covering polygon projects geometry.bbox to 2D (same).
    case 'floor-finish':
    // ADR-422 — thermal space (IfcSpace) footprint bbox projects to 2D (same).
    case 'thermal-space':
    // ADR-408 Φ12 — plumbing manifold projects geometry.bbox to 2D (same).
    case 'mep-manifold':
    // ADR-408 Εύρος Β — heating radiator projects geometry.bbox to 2D (same).
    case 'mep-radiator':
    // ADR-408 Εύρος Β #2 — heating boiler projects geometry.bbox to 2D (same).
    case 'mep-boiler':
    // ADR-408 DHW — domestic hot water heater projects geometry.bbox to 2D (same).
    case 'mep-water-heater':
    // ADR-408 Εύρος Β #3 — underfloor heating loop: footprint bbox projects to 2D (area entity,
    // same fallthrough as floor-finish — the footprint polygon bbox is the geometry.bbox SSoT).
    case 'mep-underfloor': {
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
