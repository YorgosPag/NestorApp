/**
 * grip-3d-reshape-grips.ts — PURE filter: which `GripInfo`s are 3D reshape grips
 * (ADR-535 Φ1 slab pilot → Φ3 footprint generalisation).
 *
 * `computeDxfEntityGrips` returns the full 2D grip set for an entity. In the 3D
 * viewport we surface ONLY the per-vertex / edge-midpoint reshape grips (the
 * footprint sketch) — never whole-entity / center grips (the gizmo owns whole-entity
 * move/rotate). Φ1 keyed on `slabGripKind`; Φ3 widens to ANY footprint discriminator
 * (slab / roof / floor-finish / slab-opening) — all four already carry a parametric
 * vertex+midpoint `*GripKind` from `getXxxGrips`, and the commit path
 * (`commitDxfGripDragModeAware`) is already type-agnostic, so the filter is the only
 * place that needs to know the family.
 *
 * Pure — no THREE, no React, no store. Jest-friendly.
 */

import type { GripInfo } from '../../hooks/grip-types';

/** True when the grip carries a footprint (vertex / edge-midpoint) reshape discriminator. */
function hasFootprintGripKind(g: GripInfo): boolean {
  return (
    g.slabGripKind !== undefined ||
    g.roofGripKind !== undefined ||
    g.floorFinishGripKind !== undefined ||
    g.slabOpeningGripKind !== undefined
  );
}

/**
 * Keep only the footprint reshape grips: a parametric vertex-translate / edge-midpoint
 * insert (`slab` / `roof` / `floor-finish` / `slab-opening` *GripKind`) that does NOT
 * move the whole entity. Returns a fresh array; input order preserved (stable grip
 * indices).
 */
export function reshapeGripsForFootprint(grips: readonly GripInfo[]): GripInfo[] {
  return grips.filter((g) => !g.movesEntity && hasFootprintGripKind(g));
}
