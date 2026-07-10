/**
 * Multi-flight stair CENTERLINE walk (ADR-633) — SSoT for the per-flight frames.
 *
 * Walks a `'multi-flight'` variant once and yields, per flight, its centreline
 * start/end + travel direction + (for non-final flights) the next flight's
 * start/direction and the landing depth. This is the single place the turn
 * advance (rotate direction by `±turnAngleDeg`, step up one rise onto the
 * landing, advance `landingDepth` into the next flight) is computed.
 *
 * Consumed by BOTH:
 *   - `stair-geometry-multiflight.ts` (`computeMultiFlight`) — treads/landings/walkline
 *   - `stair-flight-axes.ts` (`stairFlightAxes`) — the 2D side segments the parieta
 *     pick + turn tool hit-test.
 * Keeping it here means the geometry and the hit-test can never disagree about
 * where a flight sits (N.0.2 SSoT — no duplicated turn math).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-633-multi-flight-turn-points.md
 */

import type { Point3D } from '../../rendering/types/Types';
import type {
  StairParams,
  StairTurnNode,
  StairVariantMultiFlight,
} from '../types/stair-types';
import {
  directionToUnitVector,
  point,
  type Vec2,
} from '../geometry/stairs/stair-geometry-shared';

export interface MultiFlightStep {
  readonly flightIndex: number;
  /** Centreline start of this flight (z = first tread elevation). */
  readonly start: Point3D;
  /** Centreline end of this flight (z = landing elevation = start.z + rise·stepCount). */
  readonly end: Point3D;
  /** Unit travel direction of this flight. */
  readonly dir: Vec2;
  readonly stepCount: number;
  /** Next flight frame + landing depth — `undefined` for the final flight. */
  readonly next?: {
    readonly start: Point3D;
    readonly dir: Vec2;
    readonly landingDepth: number;
  };
}

/** Resolve a turn's landing depth: `'auto'` → `width`. */
export function resolveTurnLandingDepth(turn: StairTurnNode, width: number): number {
  const d = turn.landingDepth ?? 'auto';
  return d === 'auto' ? width : d;
}

/**
 * Per-flight centreline frames for a multi-flight stair. Tolerant of a malformed
 * `turns` length (extra flights simply get no `next`); `computeMultiFlight`
 * validates strictly before calling this.
 */
export function walkMultiFlight(
  params: Readonly<StairParams>,
  variant: StairVariantMultiFlight,
): MultiFlightStep[] {
  const { basePoint, tread, rise, width, direction } = params;
  const steps: MultiFlightStep[] = [];
  let dirDeg = direction;
  let u = directionToUnitVector(dirDeg);
  let start: Point3D = point(basePoint.x, basePoint.y, basePoint.z);

  for (let k = 0; k < variant.flights.length; k++) {
    const n = variant.flights[k];
    const flightStart = start;
    const flightDir = u;
    const along = tread * n;
    const end = point(
      flightStart.x + flightDir.x * along,
      flightStart.y + flightDir.y * along,
      flightStart.z + rise * n,
    );

    let next: MultiFlightStep['next'];
    if (k < variant.turns.length) {
      const turn = variant.turns[k];
      dirDeg += (turn.turnDirection === 'left' ? 1 : -1) * turn.turnAngleDeg;
      const uNext = directionToUnitVector(dirDeg);
      const depth = resolveTurnLandingDepth(turn, width);
      // Next-flight CENTRELINE start = quarter-turn corner construction (matches
      // gamma flight-2 exactly, ADR-611): advance halfW along the INCOMING dir to
      // the landing centre, then halfW along the OUTGOING dir to the exit edge.
      // (The prior `end + uNext·width` slid the flight sideways by a full width
      // without advancing → it overlapped the incoming flight's tail, ADR-633.)
      const halfW = width * 0.5;
      const nextStart = point(
        end.x + flightDir.x * halfW + uNext.x * halfW,
        end.y + flightDir.y * halfW + uNext.y * halfW,
        end.z + rise,
      );
      next = { start: nextStart, dir: uNext, landingDepth: depth };
      u = uNext;
      start = nextStart;
    }
    steps.push({ flightIndex: k, start: flightStart, end, dir: flightDir, stepCount: n, next });
  }
  return steps;
}
