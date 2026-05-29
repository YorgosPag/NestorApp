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

/** Below this length a direction vector is treated as degenerate (no axis). */
export const DEGENERATE_EPS = 0.001;

/** Drop the Z component — BIM plan grips operate in the 2D footprint plane. */
export function project2D(p: Point3D): Point2D {
  return { x: p.x, y: p.y };
}

/** CCW 90° rotation: (x,y) → (-y,x). Matches `wall-geometry` segment-normal sign. */
export function perpUnit(u: { x: number; y: number }): { x: number; y: number } {
  return { x: -u.y, y: u.x };
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

