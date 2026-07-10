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
// ADR-363 — SSoT reader for wrapped-variant geometry (slab/slab-opening/opening/stair
// nest it under a sub-entity field in the converted DxfScene; direct variants keep it flat).
import { unwrapDxfSubEntity } from '../../canvas-v2/dxf-canvas/dxf-types';

/** Minimal geometry-bearing shape both scene forms expose after unwrap. */
interface BimGeometryCarrier {
  readonly geometry?: {
    readonly bbox?: {
      readonly min: { readonly x: number; readonly y: number };
      readonly max: { readonly x: number; readonly y: number };
    };
  };
}

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
    // ADR-437 — space separator (IfcVirtualElement) segment bbox projects to 2D (same).
    case 'space-separator':
    // ADR-407 — standalone path-based railing (IfcRailing); geometry.bbox from computeRailingGeometry().
    // ADR-587 Φ9 Slice 1: was falling to default → null → NOT marquee-selectable though click-selectable.
    case 'railing':
    // ADR-511 — wall-covering face strip (cached bbox). ADR-587 Φ9 Slice 1: Twin B ROUTED it here but
    // this delegate had no case → null (hidden behind the coverage test's optimistic B_HANDLED); now real.
    case 'wall-covering':
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
    case 'mep-underfloor':
    // ADR-436 — foundation (pad/strip/tie-beam) projects geometry.bbox to 2D (same).
    // Without this case window/crossing marquee silently skipped foundations even
    // though click hit-test (Bounds.ts) and Ctrl+A already selected them.
    case 'foundation':
    // ADR-358 — stair projects its pre-computed geometry.bbox to 2D (same fall-through;
    // merged with the shared block in ADR-587 Φ9 Slice 1 — the bodies were byte-identical).
    case 'stair': {
      // ADR-619 Bug #7 — read geometry via the SSoT unwrap: in the converted
      // DxfScene the wrapped variants (opening/slab/slab-opening/stair) nest
      // `geometry` under a sub-entity field, so the old flat `entity.geometry`
      // was `undefined` → null bounds → Home/zoom-extents silently dropped the
      // stair (it sat outside the walls' extent and never framed). Direct
      // variants (wall/beam/column/foundation/roof) unwrap to themselves.
      const bbox = unwrapDxfSubEntity<BimGeometryCarrier>(entity).geometry?.bbox;
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
