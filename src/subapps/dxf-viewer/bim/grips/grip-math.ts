/**
 * ADR-397 — Shared BIM grip math primitives (FULL SSoT).
 *
 * Pure 2D-plan helpers shared by every BIM entity's grip position + transform
 * modules. Before ADR-397 `project2D` / `perpUnit` / axis-unit math was
 * copy-pasted across `wall-grip-math.ts`, `stair-grip-math.ts` and inline in
 * `beam-grips.ts` (flagged ADR-393 §8.2 pending-ratchet). This module is the
 * single home; entity math files re-export from here.
 *
 * NOTE — point rotation is NOT here: the canonical rotate-around-pivot SSoT is
 * `rotatePoint` in `utils/rotation-math.ts` (ADR-188), used by RotateEntityCommand,
 * bim-rotate-geometry, the array/guide rotate tools and the column rotation grip.
 * Do not re-implement cos/sin rotation — import `rotatePoint`.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-397-bim-grip-glyph-behavior-ssot.md §12 D3
 * @see utils/rotation-math.ts — rotatePoint SSoT (ADR-188)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../types/bim-base';
import { rotatePoint } from '../../utils/rotation-math';

/** Below this length a direction vector is treated as degenerate (no axis). */
export const DEGENERATE_EPS = 0.001;

/** Reused zero-vector for local-frame rotations (rotate about the origin). */
const ORIGIN: Point2D = { x: 0, y: 0 };

/**
 * ADR-397 §D3 — rotate a vector about the ORIGIN by `angleDeg` (CCW). The
 * local-frame → world primitive for centre-anchored grips (column / mep-fixture
 * footprint offsets, rotation/corner handle positions). Delegates to the
 * canonical `rotatePoint` SSoT (ADR-188) so there is exactly one cos/sin
 * implementation in the codebase — never re-implement the rotation matrix.
 */
export function rotateVector(v: Point2D, angleDeg: number): Point2D {
  return rotatePoint(v, ORIGIN, angleDeg);
}

/**
 * ADR-397 §D3 — project a world-space vector onto an entity's local axes rotated
 * by `angleDeg` (the inverse rotation). Returns the components along the local
 * +X / +Y axes. Equivalent to `rotateVector(v, -angleDeg)`.
 */
export function projectToLocalFrame(v: Point2D, angleDeg: number): Point2D {
  return rotateVector(v, -angleDeg);
}

/** Drop the Z component — BIM plan grips operate in the 2D footprint plane. */
export function project2D(p: Point3D): Point2D {
  return { x: p.x, y: p.y };
}

/** CCW 90° rotation: (x,y) → (-y,x). Matches `wall-geometry` segment-normal sign. */
export function perpUnit(u: { x: number; y: number }): { x: number; y: number } {
  return { x: -u.y, y: u.x };
}

/**
 * ADR-363 — far-edge face sign for a centre-anchored box handle. Given a local
 * anchor-offset component (`dx`/`dy` from the entity's `ANCHOR_OFFSETS`), returns
 * the sign of the FAR face along that axis: `+1` for `offset <= 0`, `-1` otherwise.
 * Guarantees a non-zero coefficient even when the anchor sits on that edge. Single
 * SSoT for column + foundation-pad grip placement (was duplicated as identical
 * `farEdgeSignX`/`farEdgeSignY` in both — one axis-agnostic helper).
 */
export function farEdgeSign(offsetComponent: number): number {
  return offsetComponent <= 0 ? 1 : -1;
}

/** Unit vector `from → to`. Returns null when the two points coincide (degenerate). */
export function unitVector(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < DEGENERATE_EPS) return null;
  return { x: dx / len, y: dy / len };
}

/**
 * ADR-397 §D3 — anchor-relative swept angle (degrees, CCW) about `pivot`, from
 * `anchor` to `current`. SSoT for the 6-click ROTATE→Reference grip math shared
 * by wall / column / mep-fixture: the rotation handle sits OFF the rotation axis,
 * so the cursor's absolute bearing would snap the entity the instant the handle
 * is grabbed. Instead we measure the angle SWEPT since mousedown — callers pass
 * `anchor = current − dragDelta` (the grip world position at mousedown).
 *
 * Returns `null` when either pivot→point vector is degenerate (cursor on the
 * pivot) so callers no-op instead of producing a NaN/garbage rotation. Pair with
 * the canonical `rotatePoint` (utils/rotation-math.ts, ADR-188) to apply it — do
 * NOT re-implement cos/sin.
 */
export function sweptAngleDegAboutPivot(
  pivot: Point2D,
  anchor: Point2D,
  current: Point2D,
): number | null {
  const curDx = current.x - pivot.x;
  const curDy = current.y - pivot.y;
  const anDx = anchor.x - pivot.x;
  const anDy = anchor.y - pivot.y;
  if (Math.hypot(curDx, curDy) < DEGENERATE_EPS || Math.hypot(anDx, anDy) < DEGENERATE_EPS) {
    return null;
  }
  return (Math.atan2(curDy, curDx) - Math.atan2(anDy, anDx)) * (180 / Math.PI);
}

/**
 * ADR-397 §D3 — rotate a set of axis points about `pivot` by the anchor-relative
 * swept angle (`anchor → currentPos`). The single SSoT for every axis-based
 * rotation grip (wall start/end, beam start/end/curveControl, future stair
 * direction): callers pass the entity's defining points + the picked rotation
 * centre, anchor (= grip world position at mousedown = `currentPos − dragDelta`)
 * and the live cursor; the helper measures the swept angle via
 * `sweptAngleDegAboutPivot` and rotates each point with the canonical
 * `rotatePoint` (ADR-188) — there is no re-implemented cos/sin anywhere.
 *
 * Returns `null` (so callers can no-op and keep referential identity of the
 * original params) when the swept angle is degenerate (cursor on the pivot).
 * Z is intentionally NOT handled here: these are plan-footprint points; callers
 * graft the original z back onto each rotated coordinate.
 *
 * @see wall-grip-transforms.ts `rotateWall` — consumer
 * @see bim/beams/beam-grips.ts `rotateBeam` — consumer
 */
export function rotateAxisPointsAboutPivot(
  points: readonly Point2D[],
  opts: { pivot: Point2D; anchor: Point2D; currentPos: Point2D },
): Point2D[] | null {
  const sweptDeg = sweptAngleDegAboutPivot(opts.pivot, opts.anchor, opts.currentPos);
  if (sweptDeg === null) return null;
  return points.map((p) => rotatePoint(p, opts.pivot, sweptDeg));
}

