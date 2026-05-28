/**
 * ADR-363 Phase 1C — Wall grip shared math primitives.
 *
 * Pure geometry helpers shared by `wall-grips.ts` (position computation) and
 * `wall-grip-transforms.ts` (drag transforms). Zero React / DOM / Firestore /
 * canvas deps. Mirrors `bim/stairs/stair-grip-math.ts` (ADR-393 3-file split).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3 §6 Phase 1C / 1C-bis
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../types/bim-base';
import type { WallParams } from '../types/wall-types';

export const DEGENERATE_EPS = 0.001;

/** Unit axis vector from `params.start → params.end`. Returns null when degenerate. */
export function unitAxis(params: WallParams): { x: number; y: number } | null {
  const dx = params.end.x - params.start.x;
  const dy = params.end.y - params.start.y;
  const len = Math.hypot(dx, dy);
  if (len < DEGENERATE_EPS) return null;
  return { x: dx / len, y: dy / len };
}

/** CCW 90° rotation: (x,y) → (-y,x). Mirrors `wall-geometry` segment normal sign. */
export function perpUnit(u: { x: number; y: number }): { x: number; y: number } {
  return { x: -u.y, y: u.x };
}

export function project2D(p: Point3D): Point2D {
  return { x: p.x, y: p.y };
}
