/**
 * ADR-363 Phase 1D-B/C — Wall↔wall junction cleanup.
 *
 * Phase 1D-B (axis-bevel, T-junctions):
 *   Computes `startBevel`/`endBevel` patches so axis endpoints are shortened
 *   enough to eliminate rectangular overlaps at T-junctions and 90° corners.
 *
 * Phase 1D-C (geometric miter, corner junctions):
 *   For corner junctions (both endpoints meet) computes the exact outer/inner
 *   miter points by intersecting the two walls' edge lines. The miter points
 *   replace the end-cap vertices of each wall's outerEdge/innerEdge, eliminating
 *   the triangular gap that the axis-bevel approach leaves at oblique angles.
 *
 *   Revit/AutoCAD Architecture parity: "Miter" join type — exterior faces and
 *   interior faces converge at their geometric intersection, zero gap.
 *
 * Algorithm (per pair):
 *   1. Parametric axis-axis infinite-line intersection (t, u).
 *   2. Classify: corner (both endpoints near) → miter; T-junction (one interior)
 *      → bevel stem; cross (both interior) → skip.
 *   3. Corner miter: intersect outer edge lines → outer miter pt; intersect inner
 *      edge lines → inner miter pt. Fall back to bevel if either extension exceeds
 *      MAX_BEVEL_FRACTION (wall too short/thick for clean miter).
 *   4. Accumulate: corners → miter map (last wins per endpoint); T-junctions →
 *      max bevel per endpoint.
 *
 * Only `kind === 'straight'` walls processed; curved/polyline land later.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1D-C
 */

import type { WallEntity, WallParams } from '../types/wall-types';
import type { AnySceneEntity } from '../../types/entities';
import { computeWallGeometry } from '../geometry/wall-geometry';
import { mmToSceneUnits } from '../../utils/scene-units';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Physical distance (mm) within which an axis endpoint is "touching" the intersection. */
const JOIN_THRESHOLD_MM = 200;

/** Angle below which axes are treated as parallel → no trim. */
const MIN_ANGLE_RAD = Math.PI / 12; // 15°

/** Maximum bevel / miter-extension as fraction of axis length; prevents inversion. */
const MAX_BEVEL_FRACTION = 0.40;

// ─── Types ────────────────────────────────────────────────────────────────────

/** 2-point miter corner: outer face intersection and inner face intersection. */
export interface MiterPt {
  readonly outer: { readonly x: number; readonly y: number };
  readonly inner: { readonly x: number; readonly y: number };
}

/**
 * Per-wall trim patch returned by `computeWallTrims`.
 *
 * `startMiter`/`endMiter` (Phase 1D-C) — corner junctions.
 *   When present, `computeWallGeometry` replaces the first/last edge points of
 *   outerEdge/innerEdge with the exact miter intersection points. Supersedes the
 *   bevel approach for corners.
 *
 * `startBevel`/`endBevel` (Phase 1D-B) — T-junction stem endpoints only.
 *   Canvas world units (same space as params.start/end).
 */
export interface WallTrimPatch {
  readonly startMiter?: MiterPt;
  readonly endMiter?: MiterPt;
  readonly startBevel?: number;
  readonly endBevel?: number;
}

// ─── Accumulator (mutable, scoped to computeWallTrims call) ──────────────────

type MutablePatch = {
  startMiter?: MiterPt;
  endMiter?: MiterPt;
  startBevel?: number;
  endBevel?: number;
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute junction cleanup patches for all wall pairs in `walls`.
 *
 * Idempotent: calling with the same input always returns the same patches.
 * Returns a Map keyed by wallId; walls with no trim are NOT included.
 */
export function computeWallTrims(walls: readonly WallEntity[]): Map<string, WallTrimPatch> {
  const acc = new Map<string, MutablePatch>();

  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      processPair(walls[i], walls[j], acc);
    }
  }

  const result = new Map<string, WallTrimPatch>();
  for (const [id, patch] of acc) {
    if (
      patch.startMiter !== undefined || patch.endMiter !== undefined ||
      patch.startBevel !== undefined || patch.endBevel !== undefined
    ) {
      result.set(id, patch);
    }
  }
  return result;
}

/**
 * Apply trim patches to an entity array: returns a new array with patched wall
 * `params` and recomputed `geometry`. Non-wall entities pass through unchanged.
 * Idempotent — applying twice yields the same result.
 */
export function applyTrimPatches(
  entities: readonly AnySceneEntity[],
  trims: Map<string, WallTrimPatch>,
): AnySceneEntity[] {
  if (trims.size === 0) return [...entities];

  return entities.map((entity): AnySceneEntity => {
    if (entity.type !== 'wall') return entity;
    const patch = trims.get(entity.id);
    if (!patch) return entity;

    const wall = entity as WallEntity;
    const newParams: WallParams = {
      ...wall.params,
      ...(patch.startMiter !== undefined ? { startMiter: patch.startMiter } : {}),
      ...(patch.endMiter   !== undefined ? { endMiter:   patch.endMiter   } : {}),
      ...(patch.startBevel !== undefined ? { startBevel: patch.startBevel } : {}),
      ...(patch.endBevel   !== undefined ? { endBevel:   patch.endBevel   } : {}),
    };

    return {
      ...wall,
      params: newParams,
      geometry: computeWallGeometry(newParams, wall.kind),
    } as WallEntity;
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Parametric intersection of two infinite 2D lines.
 * Returns { t, u } such that:
 *   A(t) = a1 + t*(a2-a1) = B(u) = b1 + u*(b2-b1)
 * Returns null when lines are parallel (cross product ≈ 0).
 */
function lineLineIntersect(
  a1x: number, a1y: number,
  a2x: number, a2y: number,
  b1x: number, b1y: number,
  b2x: number, b2y: number,
): { t: number; u: number } | null {
  const dax = a2x - a1x;
  const day = a2y - a1y;
  const dbx = b2x - b1x;
  const dby = b2y - b1y;

  const cross = dax * dby - day * dbx;
  if (Math.abs(cross) < 1e-9) return null;

  const wx = b1x - a1x;
  const wy = b1y - a1y;

  return {
    t: (wx * dby - wy * dbx) / cross,
    u: (wx * day - wy * dax) / cross,
  };
}

/** |sin| of angle between two direction vectors (always in [0, 1]). */
function sinAngleBetween(dax: number, day: number, dbx: number, dby: number): number {
  const lenA = Math.hypot(dax, day);
  const lenB = Math.hypot(dbx, dby);
  if (lenA < 1e-9 || lenB < 1e-9) return 0;
  return Math.abs(dax * dby - day * dbx) / (lenA * lenB);
}

function accumMax(map: Map<string, number>, id: string, value: number): void {
  const prev = map.get(id);
  if (prev === undefined || value > prev) map.set(id, value);
}

function setPatchField(acc: Map<string, MutablePatch>, id: string, field: keyof MutablePatch, value: number | MiterPt): void {
  const prev = acc.get(id) ?? {};
  acc.set(id, { ...prev, [field]: value });
}

/**
 * Compute geometric miter points for a corner junction between two walls.
 *
 * Each wall's `outer` edge is the +sign (CCW-perpendicular) side of its own axis.
 * Whether wall A's outer side faces the SAME physical side as wall B's outer side
 * depends on how the two walls meet at the corner:
 *
 *   - "Consistent traversal" (A.end ↔ B.start, or A.start ↔ B.end): the walls form
 *     a continuous path through the corner. A's outer and B's outer face the same
 *     side → pair A_outer with B_outer. Both walls share an identical MiterPt.
 *
 *   - "Inconsistent" (A.end ↔ B.end, or A.start ↔ B.start): the walls meet
 *     head-to-head / tail-to-tail. A's outer faces the concave side while B's outer
 *     faces the convex side (or vice-versa) → pair A_outer with B_INNER. Wall B then
 *     receives a SWAPPED MiterPt so its own outer/inner endpoints land on the right
 *     physical corners. Pairing outer-with-outer here would produce a phantom vertex
 *     outside the wall outline (the triangular-gap / wrong-corner bug).
 *
 * `swap` (computed by the caller from the start/end parity XOR the walls' flip
 * difference) selects the inconsistent pairing.
 *
 * Returns null if either edge pair is parallel (shouldn't happen when sinAngle
 * already passed MIN_ANGLE check) or if the miter extension exceeds
 * MAX_BEVEL_FRACTION for either wall (fall back to axis-bevel in that case).
 *
 * @param aPt  - Corner axis point of wall A (its start or end, canvas units)
 * @param aUx  - A's axis unit vector x (from a.params.start → a.params.end)
 * @param aUy  - A's axis unit vector y
 * @param aHalfSigned - halfThickness * sign, canvas units  (sign = flip ? -1 : 1)
 * @param aLen - Full axis length of A (canvas units) — for overflow guard
 * @param bPt  - Corner axis point of wall B
 * @param bUx, bUy, bHalfSigned, bLen — same for wall B
 * @param swap - true → inconsistent corner (pair A_outer with B_inner, swap B's MiterPt)
 * @returns `{ miterA, miterB }` — per-wall miter points (identical when !swap,
 *          mirror-swapped when swap) — or null when the miter is degenerate/overflows.
 */
function cornerMiter(
  aPt: { x: number; y: number },
  aUx: number, aUy: number,
  aHalfSigned: number,
  aLen: number,
  bPt: { x: number; y: number },
  bUx: number, bUy: number,
  bHalfSigned: number,
  bLen: number,
  swap: boolean,
): { miterA: MiterPt; miterB: MiterPt } | null {
  // Outer and inner edge start points at the corner, perpendicular offset:
  //   CCW 90° of (ux, uy) = (-uy, ux) scaled by halfSigned.
  const aOuterX = aPt.x + (-aUy) * aHalfSigned;
  const aOuterY = aPt.y + ( aUx) * aHalfSigned;
  const aInnerX = aPt.x - (-aUy) * aHalfSigned;
  const aInnerY = aPt.y - ( aUx) * aHalfSigned;

  const bOuterX = bPt.x + (-bUy) * bHalfSigned;
  const bOuterY = bPt.y + ( bUx) * bHalfSigned;
  const bInnerX = bPt.x - (-bUy) * bHalfSigned;
  const bInnerY = bPt.y - ( bUx) * bHalfSigned;

  // Select which of B's edges pairs with A's outer/inner. Consistent corner →
  // outer↔outer, inner↔inner. Inconsistent corner (swap) → outer↔inner.
  const bForOuterX = swap ? bInnerX : bOuterX;
  const bForOuterY = swap ? bInnerY : bOuterY;
  const bForInnerX = swap ? bOuterX : bInnerX;
  const bForInnerY = swap ? bOuterY : bInnerY;

  // A_outer ∩ (B's outer-side edge) — both parallel to their axis, so pass a
  // second point 1 unit along the axis direction.
  const outerIsect = lineLineIntersect(
    aOuterX, aOuterY, aOuterX + aUx, aOuterY + aUy,
    bForOuterX, bForOuterY, bForOuterX + bUx, bForOuterY + bUy,
  );
  if (!outerIsect) return null;

  // A_inner ∩ (B's inner-side edge).
  const innerIsect = lineLineIntersect(
    aInnerX, aInnerY, aInnerX + aUx, aInnerY + aUy,
    bForInnerX, bForInnerY, bForInnerX + bUx, bForInnerY + bUy,
  );
  if (!innerIsect) return null;

  // Overflow guard: if the miter would extend more than MAX_BEVEL_FRACTION of
  // either wall, the wall is too short/thick for a clean miter — caller falls back
  // to axis-bevel. |t| is the extension along A's axis from its corner endpoint;
  // |u| is the same for B.
  const maxExtA = MAX_BEVEL_FRACTION * aLen;
  const maxExtB = MAX_BEVEL_FRACTION * bLen;
  if (
    Math.abs(outerIsect.t) > maxExtA || Math.abs(innerIsect.t) > maxExtA ||
    Math.abs(outerIsect.u) > maxExtB || Math.abs(innerIsect.u) > maxExtB
  ) {
    return null;
  }

  // A's corners lie on A's own outer/inner edge lines (parametrised by t along A).
  const outerA = {
    x: aOuterX + outerIsect.t * aUx,
    y: aOuterY + outerIsect.t * aUy,
  };
  const innerA = {
    x: aInnerX + innerIsect.t * aUx,
    y: aInnerY + innerIsect.t * aUy,
  };

  const miterA: MiterPt = { outer: outerA, inner: innerA };
  // Inconsistent corner → B's outer edge is the one paired with A's inner, so B's
  // own MiterPt is the mirror of A's. Consistent corner → identical.
  const miterB: MiterPt = swap
    ? { outer: innerA, inner: outerA }
    : { outer: outerA, inner: innerA };

  return { miterA, miterB };
}

/**
 * Classify and accumulate trim patches for one wall pair (A, B).
 * Only handles `kind === 'straight'` walls.
 */
function processPair(
  a: WallEntity,
  b: WallEntity,
  acc: Map<string, MutablePatch>,
): void {
  if (a.kind !== 'straight' || b.kind !== 'straight') return;

  const a1x = a.params.start.x, a1y = a.params.start.y;
  const a2x = a.params.end.x,   a2y = a.params.end.y;
  const b1x = b.params.start.x, b1y = b.params.start.y;
  const b2x = b.params.end.x,   b2y = b.params.end.y;

  const lenA = Math.hypot(a2x - a1x, a2y - a1y);
  const lenB = Math.hypot(b2x - b1x, b2y - b1y);
  if (lenA < 1 || lenB < 1) return;

  const isect = lineLineIntersect(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y);
  if (!isect) return;

  const { t, u } = isect;

  const dax = a2x - a1x, day = a2y - a1y;
  const dbx = b2x - b1x, dby = b2y - b1y;
  const sinA = sinAngleBetween(dax, day, dbx, dby);
  if (sinA < Math.sin(MIN_ANGLE_RAD)) return;

  // Canvas world unit scalars
  const sA = mmToSceneUnits(a.params.sceneUnits ?? 'mm');
  const sB = mmToSceneUnits(b.params.sceneUnits ?? 'mm');
  const halfA = (a.params.thickness / 2) * sA;
  const halfB = (b.params.thickness / 2) * sB;
  const joinThreshold = JOIN_THRESHOLD_MM * sA; // uniform scale assumed
  const epsA = joinThreshold / lenA;
  const epsB = joinThreshold / lenB;

  const tNearStart = t >= -epsA && t <= epsA;
  const tNearEnd   = t >= 1 - epsA && t <= 1 + epsA;
  const tInterior  = t > epsA && t < 1 - epsA;

  const uNearStart = u >= -epsB && u <= epsB;
  const uNearEnd   = u >= 1 - epsB && u <= 1 + epsB;
  const uInterior  = u > epsB && u < 1 - epsB;

  if ((tNearStart || tNearEnd) && (uNearStart || uNearEnd)) {
    // ── Corner junction: try geometric miter ──────────────────────────────────
    const aPt = tNearStart
      ? { x: a1x, y: a1y }
      : { x: a2x, y: a2y };
    const bPt = uNearStart
      ? { x: b1x, y: b1y }
      : { x: b2x, y: b2y };

    // Axis unit vectors (start→end normalized)
    const aUx = dax / lenA, aUy = day / lenA;
    const bUx = dbx / lenB, bUy = dby / lenB;

    // Signed half-thickness: CCW perpendicular direction is determined by flip.
    const aHalfSigned = (a.params.flip ? -1 : 1) * halfA;
    const bHalfSigned = (b.params.flip ? -1 : 1) * halfB;

    // Corner orientation. When both endpoints are the same type (start+start or
    // end+end) the walls meet head-to-head / tail-to-tail, so A's outer side and
    // B's outer side face opposite physical sides → swap. Each wall's `flip`
    // inverts which physical side its outer edge is on, so an odd number of flips
    // toggles the swap back. (XOR of the two booleans.)
    const baseSwap = tNearStart === uNearStart;
    const flipsDiffer = (!!a.params.flip) !== (!!b.params.flip);
    const swap = baseSwap !== flipsDiffer;

    const miter = cornerMiter(
      aPt, aUx, aUy, aHalfSigned, lenA,
      bPt, bUx, bUy, bHalfSigned, lenB,
      swap,
    );

    if (miter) {
      // Geometric miter available — store each wall's own (possibly swapped) MiterPt.
      setPatchField(acc, a.id, tNearStart ? 'startMiter' : 'endMiter', miter.miterA);
      setPatchField(acc, b.id, uNearStart ? 'startMiter' : 'endMiter', miter.miterB);
    } else {
      // Miter overflows wall bounds → fall back to axis-bevel (Phase 1D-B logic).
      const bevelA = Math.min(halfB / sinA, MAX_BEVEL_FRACTION * lenA);
      const bevelB = Math.min(halfA / sinA, MAX_BEVEL_FRACTION * lenB);
      const patchA = acc.get(a.id) ?? {};
      const patchB = acc.get(b.id) ?? {};
      if (tNearStart) {
        acc.set(a.id, { ...patchA, startBevel: Math.max(patchA.startBevel ?? 0, bevelA) });
      } else {
        acc.set(a.id, { ...patchA, endBevel: Math.max(patchA.endBevel ?? 0, bevelA) });
      }
      if (uNearStart) {
        acc.set(b.id, { ...patchB, startBevel: Math.max(patchB.startBevel ?? 0, bevelB) });
      } else {
        acc.set(b.id, { ...patchB, endBevel: Math.max(patchB.endBevel ?? 0, bevelB) });
      }
    }
  } else if (tInterior && (uNearStart || uNearEnd)) {
    // ── T-junction: A continues; trim only B's stem endpoint ─────────────────
    const bevelB = Math.min(halfA / sinA, MAX_BEVEL_FRACTION * lenB);
    const patchB = acc.get(b.id) ?? {};
    if (uNearStart) {
      acc.set(b.id, { ...patchB, startBevel: Math.max(patchB.startBevel ?? 0, bevelB) });
    } else {
      acc.set(b.id, { ...patchB, endBevel: Math.max(patchB.endBevel ?? 0, bevelB) });
    }
  } else if (uInterior && (tNearStart || tNearEnd)) {
    // ── T-junction: B continues; trim only A's stem endpoint ─────────────────
    const bevelA = Math.min(halfB / sinA, MAX_BEVEL_FRACTION * lenA);
    const patchA = acc.get(a.id) ?? {};
    if (tNearStart) {
      acc.set(a.id, { ...patchA, startBevel: Math.max(patchA.startBevel ?? 0, bevelA) });
    } else {
      acc.set(a.id, { ...patchA, endBevel: Math.max(patchA.endBevel ?? 0, bevelA) });
    }
  }
  // Cross (both interior): skip Phase 1D-B/C.
}
