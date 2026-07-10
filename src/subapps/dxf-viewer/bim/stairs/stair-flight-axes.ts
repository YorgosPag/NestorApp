/**
 * Stair flight axes (ADR-633) — the 2D centreline segments of each flight.
 *
 * The parieta pick + turn tool need, per flight, its centreline segment (so the
 * two side edges are `centre ± perp·halfW`) plus its travel direction and tread
 * count. For `'straight'` that is a single segment; for `'multi-flight'` it
 * reuses the SSoT `walkMultiFlight` so the hit-test sits exactly where the
 * geometry drew the flights. Other kinds (curved/L/U/Γ) return `[]` — the turn
 * tool operates only on straight / multi-flight runs.
 *
 * Zero React / DOM deps.
 *
 * @see ./stair-multiflight-centerline.ts — the shared centreline walk
 * @see ./stair-parieta-pick.ts — the consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { StairParams } from '../types/stair-types';
import { directionToUnitVector, type Vec2 } from '../geometry/stairs/stair-geometry-shared';
import { walkMultiFlight } from './stair-multiflight-centerline';

export interface StairFlightAxis {
  readonly flightIndex: number;
  /** Centreline start (2D). */
  readonly start: Point2D;
  /** Centreline end (2D). */
  readonly end: Point2D;
  /** Unit travel direction. */
  readonly dir: Vec2;
  readonly stepCount: number;
}

export function stairFlightAxes(params: Readonly<StairParams>): StairFlightAxis[] {
  const v = params.variant;
  if (v.kind === 'multi-flight') {
    return walkMultiFlight(params, v).map((s) => ({
      flightIndex: s.flightIndex,
      start: { x: s.start.x, y: s.start.y },
      end: { x: s.end.x, y: s.end.y },
      dir: s.dir,
      stepCount: s.stepCount,
    }));
  }
  if (v.kind === 'straight') {
    const u = directionToUnitVector(params.direction);
    const b = params.basePoint;
    const run = params.tread * (params.stepCount - 1);
    return [
      {
        flightIndex: 0,
        start: { x: b.x, y: b.y },
        end: { x: b.x + u.x * run, y: b.y + u.y * run },
        dir: u,
        stepCount: params.stepCount,
      },
    ];
  }
  return [];
}
