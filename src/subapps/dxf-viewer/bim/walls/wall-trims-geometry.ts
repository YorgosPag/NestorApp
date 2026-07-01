/**
 * ADR-363 Phase 1D-C — Pure geometry primitives for wall junction cleanup.
 *
 * Extracted from `wall-trims.ts` (N.7.1 file-size split). Holds the stateless
 * line-intersection / angle / corner-miter math; `wall-trims.ts` owns the
 * pairwise classification + cluster resolution that drives these helpers.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1D-C
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum bevel / miter-extension as fraction of axis length; prevents inversion. */
export const MAX_BEVEL_FRACTION = 0.40;

/**
 * ADR-363 Phase 1M — big-player miter-limit (SVG / Figma / Cinema4D).
 *
 * The miter spike at a corner has length `width · (1 / sin(α/2))` where α is the
 * INTERIOR angle between the two members. As α → 0 the spike → ∞, so every major
 * tool clamps it: above this ratio the join falls back to a square-off (bevel)
 * instead of an unbounded acute sliver. SVG `stroke-miterlimit` and Figma both
 * default to **4** (⇒ cut-over interior angle ≈ 28.96°). Below ~29° corners square
 * off — matching Revit's automatic Butt/Square behaviour at sharp wall joins.
 *
 * This is an ANGLE-based limit, independent of wall length — unlike the secondary
 * `MAX_BEVEL_FRACTION` overflow guard (length-coupled), which stays as a backstop.
 *
 * @see https://www.w3.org/TR/SVG2/painting.html#StrokeMiterlimitProperty
 */
export const MITER_LIMIT_RATIO = 4;

/**
 * Miter ratio = miterLength / half-thickness = `1 / sin(α/2)` for a corner whose
 * two members extend AWAY from the junction along the unit vectors (oax,oay) and
 * (obx,oby) — i.e. α is the interior corner angle (`cos α = oa · ob`). Returns
 * `Infinity` for a degenerate zero-angle corner (members fully overlapping).
 *
 * Big-player miter-limit test: `cornerMiterRatio(...) > MITER_LIMIT_RATIO` ⇒ the
 * miter would spike too far → fall back to square-off. The inputs MUST be unit
 * vectors (the caller's axis directions / `outwardDir` already are).
 */
export function cornerMiterRatio(oax: number, oay: number, obx: number, oby: number): number {
  const cosAlpha = Math.max(-1, Math.min(1, oax * obx + oay * oby));
  const sinHalf = Math.sqrt((1 - cosAlpha) / 2); // half-angle identity, α ∈ [0, π]
  if (sinHalf < 1e-9) return Infinity;
  return 1 / sinHalf;
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** 2-point miter corner: outer face intersection and inner face intersection. */
export interface MiterPt {
  readonly outer: { readonly x: number; readonly y: number };
  readonly inner: { readonly x: number; readonly y: number };
}

// ─── Geometry primitives ───────────────────────────────────────────────────────

/**
 * Parametric intersection of two infinite 2D lines.
 * Returns { t, u } such that:
 *   A(t) = a1 + t*(a2-a1) = B(u) = b1 + u*(b2-b1)
 * Returns null when lines are parallel (cross product ≈ 0).
 */
export function lineLineIntersect(
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
export function sinAngleBetween(dax: number, day: number, dbx: number, dby: number): number {
  const lenA = Math.hypot(dax, day);
  const lenB = Math.hypot(dbx, dby);
  if (lenA < 1e-9 || lenB < 1e-9) return 0;
  return Math.abs(dax * dby - day * dbx) / (lenA * lenB);
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
export function cornerMiter(
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
