/**
 * ADAPTIVE DISTANCE SNAP — ADR-357 ambient extension (Revit-style "magic" snap)
 *
 * Pure helpers that round the distance the cursor travels along a tracking
 * alignment line to a "nice" round value whose on-screen spacing stays roughly
 * constant. As you zoom IN the step shrinks (…/5/10mm); as you zoom OUT it grows
 * (50/100/500mm…). Mirrors AutoCAD PolarSnap / Revit temporary-dimension snap.
 *
 * Always-on (Giorgio 2026-06-21: «μαγικό adaptive, μηδέν ρύθμιση»). Applied only
 * to projection tracking (a single sliding alignment line) — intersection snaps
 * are already fully constrained.
 *
 * Pure — zero React/DOM/store.
 *
 * @see ./tracking-resolver.ts — produces the projection path this rounds along.
 */

import type { Point2D } from '../../rendering/types/Types';

/** Target on-screen spacing (px) between consecutive snap stops. */
const TARGET_PX_PER_STEP = 25;

/** Nice-round a positive magnitude to the 1 / 2 / 5 / 10 × 10^k sequence. */
function niceRound(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 0;
  const exp = Math.floor(Math.log10(x));
  const base = Math.pow(10, exp);
  const frac = x / base; // [1, 10)
  const niceFrac = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10;
  return niceFrac * base;
}

/**
 * Adaptive snap step (world units) for the current zoom. `worldPerPixel = 1/scale`.
 * Larger when zoomed out, smaller when zoomed in. Returns 0 when undefined (caller
 * then skips quantization).
 */
export function adaptiveDistanceStep(worldPerPixel: number): number {
  if (!(worldPerPixel > 0) || !Number.isFinite(worldPerPixel)) return 0;
  return niceRound(worldPerPixel * TARGET_PX_PER_STEP);
}

/**
 * Quantize a point lying on the ray `anchor + t·dir` so its distance from
 * `anchor` is a multiple of `step`. `dir` must be a unit vector; the sign of the
 * travel is preserved (snap works on both sides of the anchor). Returns the input
 * point unchanged when `step` is not positive.
 */
export function quantizeAlongPath(
  point: Point2D,
  anchor: Point2D,
  dirX: number,
  dirY: number,
  step: number,
): Point2D {
  if (!(step > 0)) return point;
  const t = (point.x - anchor.x) * dirX + (point.y - anchor.y) * dirY;
  const tq = Math.round(t / step) * step;
  return { x: anchor.x + dirX * tq, y: anchor.y + dirY * tq };
}
