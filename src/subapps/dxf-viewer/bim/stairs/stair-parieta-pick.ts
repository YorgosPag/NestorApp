/**
 * Stair parieta (side) pick (ADR-633) — pure hit-test for the turn-point tool.
 *
 * Today the stair hit-test is bbox-only (`hit-test-entity-tests.ts` has no
 * `'stair'` branch). This closes that gap for the turn tool: for a world click,
 * find the nearest flight centreline (within `halfW + tol`) and report WHICH
 * flight, WHICH side (parieta) the click fell on, and the parameter `t ∈ [0,1]`
 * along the flight — everything `insertTurnAtParieta` needs.
 *
 * Side convention matches the geometry frame: `perp(dir)` is +90° ccw = the
 * LEFT of travel, so a click on the +perp half is `'left'`, −perp is `'right'`
 * — i.e. left parieta → left turn, right parieta → right turn (the user's ask).
 *
 * Pure: reuses the guides SSoT `pointToSegmentDistance` (same primitive the
 * finish-face pick uses) — zero React / scene deps, 100% testable.
 *
 * @see ./stair-flight-axes.ts — the flight centreline segments
 * @see ./stair-turn-insert.ts — the consumer that builds the new variant
 * @see bim/finishes/finish-face-pick-2d.ts — the sibling element+edge pick pattern
 */

import type { Point2D } from '../../rendering/types/Types';
import type { StairParams } from '../types/stair-types';
import { perp } from '../geometry/stairs/stair-geometry-shared';
import { pointToSegmentDistance } from '../../systems/guides';
import { stairFlightAxes } from './stair-flight-axes';

export interface StairParietaPick {
  readonly flightIndex: number;
  /** Which parieta the click fell on → the turn direction. */
  readonly side: 'left' | 'right';
  /** Parameter along the flight centreline, `0` = flight start, `1` = flight end. */
  readonly param: number;
  /** Projected point on the flight centreline (2D). */
  readonly point: Point2D;
}

/**
 * Nearest flight parieta to `point` (scene units), or `null` when the click is
 * outside every flight's `halfW + tolWorld` band. `tolWorld` is an extra click
 * margin in scene units.
 */
export function pickStairParieta(
  point: Readonly<Point2D>,
  params: Readonly<StairParams>,
  tolWorld = 0,
): StairParietaPick | null {
  const band = params.width * 0.5 + tolWorld;
  let best: StairParietaPick | null = null;
  let bestDist = Infinity;
  for (const ax of stairFlightAxes(params)) {
    const d = pointToSegmentDistance(point, ax.start, ax.end);
    if (d > band || d >= bestDist) continue;
    const proj = projectOnSegment(point, ax.start, ax.end);
    const n = perp(ax.dir);
    const signed = (point.x - proj.point.x) * n.x + (point.y - proj.point.y) * n.y;
    bestDist = d;
    best = {
      flightIndex: ax.flightIndex,
      side: signed >= 0 ? 'left' : 'right',
      param: proj.t,
      point: proj.point,
    };
  }
  return best;
}

/** Clamped projection of `p` onto segment `a→b`: parameter `t ∈ [0,1]` + point. */
function projectOnSegment(
  p: Readonly<Point2D>,
  a: Readonly<Point2D>,
  b: Readonly<Point2D>,
): { t: number; point: Point2D } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return { t: 0, point: { x: a.x, y: a.y } };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { t, point: { x: a.x + t * dx, y: a.y + t * dy } };
}
