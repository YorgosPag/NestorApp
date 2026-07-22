/**
 * BIM Bounds — 2D AABB from a BIM entity's pre-computed `geometry.bbox` (SSoT).
 *
 * ADR-363 Phase 7A — Multi-Element Selection.
 * ADR-587 Φ9 (2026-07-22) — CONVERGENCE: type-agnostic reader (big-player idiom).
 *
 * Big-player bounding-box model — Revit `Element.get_BoundingBox()` / AutoCAD
 * `getGeomExtents()` / Cinema 4D `BaseObject.GetRad()` / Figma
 * `node.absoluteBoundingBox`: ONE query that reads a pre-computed box,
 * dispatched polymorphically — NEVER a hand-maintained per-type whitelist.
 *
 * The previous body was a `switch (entity.type)` with ~30 explicit `case`s and a
 * `default: return null`. That was a silent-gap trap: every NEW BIM entity type
 * that someone forgot to add (`imported-mesh` ADR-683, `generic-solid` ADR-684)
 * fell to `default` → null → rendered + click-selectable but **NOT**
 * window/crossing-marquee selectable. The CLICK path never had this bug because
 * its delegate (`calculateBimEntityBounds`, `rendering/hitTesting/bounds-primitives.ts`)
 * was already type-agnostic (`entity.geometry?.bbox`). The two delegates were a
 * "mirror" (admitted duplication); this closes the asymmetry — both now read the
 * box, neither maintains a list.
 *
 * SEPARATION OF CONCERNS (SSoT): the DECISION of "which entity types are BIM"
 * lives in the ONE bounds registry `ENTITY_BOUNDS_PROVIDERS` (entity-bounds-ssot.ts),
 * which routes BIM keys here. This delegate owns ONLY the MECHANISM — read the
 * pre-computed box — not the type list.
 *
 * Returns null when the entity has no `geometry.bbox` (non-BIM primitives like
 * line/arc/circle have no such field → callers that fall through with
 * `?? primitiveBounds` keep working; legacy/partial BIM data; stair pre-compute).
 *
 * Wrapped variants (slab/slab-opening/opening/stair nest `geometry` under a
 * sub-entity field in the converted DxfScene) resolve via the unwrap SSoT
 * (ADR-619 Bug #7); direct variants (wall/beam/column/imported-mesh/generic-solid)
 * unwrap to themselves.
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
 * Returns 2D AABB `{min,max}` from a BIM entity's pre-computed `geometry.bbox`
 * (BoundingBox3D), projected to XY plan view. Type-agnostic: any entity that
 * carries a pre-computed box resolves; anything else → null.
 */
export function calculateBimEntity2DBounds(entity: Entity): { min: Point2D; max: Point2D } | null {
  const bbox = unwrapDxfSubEntity<BimGeometryCarrier>(entity).geometry?.bbox;
  if (!bbox) return null;
  return {
    min: { x: bbox.min.x, y: bbox.min.y },
    max: { x: bbox.max.x, y: bbox.max.y },
  };
}
