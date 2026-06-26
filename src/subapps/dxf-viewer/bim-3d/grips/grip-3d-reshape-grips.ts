/**
 * grip-3d-reshape-grips.ts — PURE filter: which `GripInfo`s are 3D reshape grips
 * (ADR-535 Φ1).
 *
 * `computeDxfEntityGrips` returns the full 2D grip set for an entity. In the 3D
 * viewport we surface ONLY the per-vertex / edge-midpoint reshape grips (the
 * footprint sketch) — never whole-entity / center grips (the gizmo owns whole-entity
 * move/rotate). Φ1 pilot = slab, so the filter keys on `slabGripKind`; Φ3 widens it
 * to roof / floor-finish / slab-opening (which already carry their own *GripKind).
 *
 * Pure — no THREE, no React, no store. Jest-friendly.
 */

import type { GripInfo } from '../../hooks/grip-types';

/**
 * Keep only the slab footprint reshape grips: a parametric `slabGripKind`
 * (vertex translate / edge-midpoint insert) that does NOT move the whole entity.
 * Returns a fresh array; input order preserved (stable grip indices).
 */
export function reshapeGripsForSlab(grips: readonly GripInfo[]): GripInfo[] {
  return grips.filter((g) => !g.movesEntity && g.slabGripKind !== undefined);
}
