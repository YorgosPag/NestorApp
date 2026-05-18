/**
 * ADR-363 Phase 3.5 — Slab parametric grip handlers.
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Mirrors the
 * pattern of `bim/walls/opening-grips.ts` (ADR-363 Phase 2.5) and exposes one
 * grip family described in ADR-363 §6 Phase 3.5:
 *
 *   - `slab-vertex-N` → translate polygon outline vertex N (XY only,
 *     z preserved). Edge-midpoint vertex insertion is deferred to Phase 3.6.
 *
 * SSoT:
 *   - Geometry math via `computeSlabGeometry()` (called by
 *     `UpdateSlabParamsCommand` at commit time — this module returns ONLY
 *     new `SlabParams`).
 *   - Grip wire-up via the unified grip system (`SlabRenderer.getGrips`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5 §6 Phase 3.5
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, SlabGripKind } from '../../hooks/useGripMovement';
import type { Point3D } from '../types/bim-base';
import type { SlabEntity, SlabParams } from '../types/slab-types';

// ─── Grip position computation (ADR-363 §6 Phase 3.5) ────────────────────────

/**
 * Compute the parametric grip positions for a `SlabEntity`. One vertex grip
 * per polygon outline vertex, in stable index order so `gripIndex` is a
 * deterministic identifier across drags.
 *
 * Returns an empty array when the polygon is degenerate (<3 vertices).
 */
export function getSlabGrips(entity: Readonly<SlabEntity>): GripInfo[] {
  const verts = entity.params.outline.vertices;
  if (verts.length < 3) return [];
  const grips: GripInfo[] = [];
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    grips.push({
      entityId: entity.id,
      gripIndex: i,
      type: 'vertex',
      position: { x: v.x, y: v.y },
      movesEntity: false,
      slabGripKind: `slab-vertex-${i}`,
    });
  }
  return grips;
}

// ─── Drag transforms ─────────────────────────────────────────────────────────

export interface SlabGripDragInput {
  /** Original params at drag start (preserves outline / kind / thickness). */
  readonly originalParams: SlabParams;
  /** World-space delta from drag anchor to current cursor position. */
  readonly delta: Point2D;
}

/**
 * Pure transform: slab grip kind + drag input → new `SlabParams`. Geometry is
 * NOT recomputed here — the caller (`UpdateSlabParamsCommand.execute`) calls
 * `computeSlabGeometry()` so the math SSoT stays in one place and command
 * merging preserves the original delta semantics.
 *
 * For `slab-vertex-N` the numeric index `N` is parsed from the discriminator
 * suffix; an out-of-range index yields `originalParams` unchanged so the
 * caller can short-circuit the commit (no-op).
 */
export function applySlabGripDrag(
  gripKind: SlabGripKind,
  input: Readonly<SlabGripDragInput>,
): SlabParams {
  if (!gripKind.startsWith('slab-vertex-')) return input.originalParams;
  const idx = parseInt(gripKind.slice('slab-vertex-'.length), 10);
  if (!Number.isFinite(idx) || idx < 0) return input.originalParams;
  return moveOutlineVertex(input, idx);
}

function moveOutlineVertex(
  input: Readonly<SlabGripDragInput>,
  index: number,
): SlabParams {
  const { originalParams, delta } = input;
  const verts = originalParams.outline.vertices;
  if (index >= verts.length) return originalParams;
  if (delta.x === 0 && delta.y === 0) return originalParams;
  const next: Point3D[] = verts.map((v, i) =>
    i === index
      ? { x: v.x + delta.x, y: v.y + delta.y, ...(v.z !== undefined ? { z: v.z } : {}) }
      : v.z !== undefined
        ? { x: v.x, y: v.y, z: v.z }
        : { x: v.x, y: v.y },
  );
  return {
    ...originalParams,
    outline: { vertices: next },
  };
}
