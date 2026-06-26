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

/**
 * True when the grip carries a footprint / cross-section reshape discriminator.
 * ADR-535 Φ7/Φ8/Φ9 — `columnGripKind` + `wallGripKind` + `beamGripKind` join the four footprint
 * kinds: a column's / wall's / beam's plan cross-section IS a footprint, so its corner/edge/width/
 * length/endpoint/poly-vertex resize grips surface in 3D exactly like a slab vertex (the whole-entity
 * `*-center` / `*-midpoint` move is filtered out below by `movesEntity`, and `column-rotation` /
 * `wall-rotation` / `beam-rotation` are excluded explicitly — all belong to the gizmo, not the
 * reshape grips).
 */
function hasFootprintGripKind(g: GripInfo): boolean {
  return (
    g.slabGripKind !== undefined ||
    g.roofGripKind !== undefined ||
    g.floorFinishGripKind !== undefined ||
    g.slabOpeningGripKind !== undefined ||
    g.columnGripKind !== undefined ||
    g.wallGripKind !== undefined ||
    g.beamGripKind !== undefined
  );
}

/**
 * Keep only the footprint / cross-section reshape grips: a parametric vertex-translate /
 * edge-midpoint insert / parametric face resize (`slab` / `roof` / `floor-finish` /
 * `slab-opening` / `column` / `wall` / `beam` *GripKind`) that does NOT move OR rotate the whole
 * entity. `movesEntity` drops the move glyphs (slab/.../column center, `wall-midpoint`,
 * `beam-midpoint`); `column-rotation` / `wall-rotation` / `beam-rotation` are whole-entity rotates
 * (`movesEntity: false` but not a reshape) so they are excluded too — the 3D gizmo owns move +
 * rotate. Returns a fresh array; input order preserved (stable grip indices).
 */
export function reshapeGripsForFootprint(grips: readonly GripInfo[]): GripInfo[] {
  return grips.filter(
    (g) =>
      !g.movesEntity &&
      hasFootprintGripKind(g) &&
      g.columnGripKind !== 'column-rotation' &&
      g.wallGripKind !== 'wall-rotation' &&
      g.beamGripKind !== 'beam-rotation',
  );
}
