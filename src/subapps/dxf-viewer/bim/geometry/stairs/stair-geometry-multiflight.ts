/**
 * Multi-flight stair geometry (ADR-633).
 *
 * Generalizes gamma (fixed 3 flights / 2×90° turns) to an ARBITRARY number of
 * flights joined by user-authored turn points at ARBITRARY plan-view angles.
 * Each `StairTurnNode` rotates the run direction by `±turnAngleDeg` (sign from
 * the clicked parieta: left = ccw, right = cw) and inserts a landing at the
 * corner. Winder corners (`cornerStyle: 'winders'`) arrive in Phase 2.
 *
 * ADR-611 reuse — every flight is a rectilinear flight from its centreline
 * start (`buildRectilinearFlight`); the `StairGeometry` assembly tail
 * (stringers/cut-line/labels/handrails/bbox) comes from `assembleMultiFlight`.
 * The landing is the mitered corridor quad between consecutive flights — the
 * same region the stringer offset spans, so treads/landings/stringers agree at
 * any turn angle.
 *
 * z-model (matches gamma): landing at `zStart_k + rise·n_k`, next flight's first
 * tread at `zStart_k + rise·(n_k+1)` — each landing consumes one rise.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-633-multi-flight-turn-points.md
 * @see docs/centralized-systems/reference/adrs/ADR-611-stair-geometry-generators-ssot.md
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polygon3D,
  RestLandingHandle,
  Segment3D,
  StairGeometry,
  StairParams,
  StairRestLanding,
  StairVariantMultiFlight,
} from '../../../bim/types/stair-types';
import {
  type Vec2,
  perp,
  point,
  directionToUnitVector,
  arrowSymbol,
} from './stair-geometry-shared';
import {
  assembleMultiFlight,
  buildCornerLanding,
  buildRectilinearFlight,
} from './stair-geometry-generators';
import {
  advanceMultiFlightTurn,
  walkMultiFlight,
} from '../../stairs/stair-multiflight-centerline';
import { buildRectilinearRun } from './stair-flight-run-builder';
import { partitionRestLandingsByFlight } from './stair-run-landings';

export function computeMultiFlight(
  params: Readonly<StairParams>,
  variant: StairVariantMultiFlight,
): StairGeometry {
  assertMultiFlightBuildable(variant);
  // ADR-637 Phase 2 — rest landings re-route each flight through `buildRectilinearRun`.
  // No rest landings → the byte-identical `walkMultiFlight` path below.
  if (params.restLandings && params.restLandings.length > 0) {
    return computeMultiFlightWithLandings(params, variant);
  }
  const { rise, tread, nosing, width, upDirection } = params;

  const treads: Polygon3D[] = [];
  const risers: Segment3D[] = [];
  const landings: Polygon3D[] = [];
  const cutDirs: Vec2[] = [];
  // Per-flight centreline frames from the SSoT walk (shared with the parieta pick).
  const steps = walkMultiFlight(params, variant);
  const walkline: Point3D[] = [steps[0].start];

  for (const step of steps) {
    const flight = buildRectilinearFlight(step.start, step.dir, rise, tread, nosing, width, step.stepCount);
    treads.push(...flight.treads);
    risers.push(...flight.risers);
    cutDirs.push(step.dir);
    walkline.push(step.end);
    if (step.next) {
      // Quarter-turn landing = clean `depth × width` square aligned to the
      // incoming flight (gamma SSoT). Replaces the old skewed centreline-to-
      // centreline quad that degenerated to a triangle at 90° (ADR-633).
      landings.push(
        buildCornerLanding(
          { x: step.end.x, y: step.end.y },
          step.dir,
          perp(step.dir),
          width,
          step.next.landingDepth,
          step.end.z,
          /* centered = */ true,
        ),
      );
      walkline.push(step.next.start);
    }
  }

  return assembleMultiFlight(params, {
    treads,
    risers,
    walkline,
    cutDirs,
    flightSplit: variant.flights,
    arrowSymbol: arrowSymbol(walkline[0], walkline[1], upDirection),
    landings,
  });
}

/**
 * ADR-637 Phase 2 — multi-flight run carrying rest landings. Walks the flights
 * manually (rather than `walkMultiFlight`, whose flight starts assume no plan
 * shift), routing each flight through `buildRectilinearRun` with its partitioned
 * landings. Turn landings + the quarter-turn advance reuse the SSoT
 * `advanceMultiFlightTurn` so the turn math never diverges from `walkMultiFlight`.
 */
function computeMultiFlightWithLandings(
  params: Readonly<StairParams>,
  variant: StairVariantMultiFlight,
): StairGeometry {
  const { basePoint, rise, tread, nosing, width, direction, upDirection } = params;
  const perFlight = partitionRestLandingsByFlight(variant.flights, params.restLandings);
  const acc: MultiFlightAccum = {
    treads: [], risers: [], landings: [], landingHandles: [], flightSplit: [], cutDirs: [], walkline: [],
  };
  const state: MultiFlightWalkState = {
    dirDeg: direction, u: directionToUnitVector(direction), cx: basePoint.x, cy: basePoint.y, levelBase: 0,
  };

  for (let k = 0; k < variant.flights.length; k++) {
    appendFlightRun(acc, state, params, variant.flights[k], perFlight[k], k === 0);
    if (k < variant.turns.length) appendTurn(acc, state, params, variant.turns[k], variant.flights[k]);
  }

  const geometry = assembleMultiFlight(params, {
    treads: acc.treads,
    risers: acc.risers,
    walkline: acc.walkline,
    cutDirs: acc.cutDirs,
    flightSplit: acc.flightSplit,
    arrowSymbol: arrowSymbol(acc.walkline[0], acc.walkline[1], upDirection),
    landings: acc.landings,
  });
  // ADR-637 Phase 4-A — per-landing grip handles across all flights (each in its
  // own flight's world travel dir). Absent when no flight carries a rest landing.
  return acc.landingHandles.length > 0
    ? { ...geometry, restLandingHandles: acc.landingHandles }
    : geometry;
}

interface MultiFlightAccum {
  treads: Polygon3D[];
  risers: Segment3D[];
  landings: Polygon3D[];
  landingHandles: RestLandingHandle[];
  flightSplit: number[];
  cutDirs: Vec2[];
  walkline: Point3D[];
}

interface MultiFlightWalkState {
  dirDeg: number;
  u: Vec2;
  cx: number;
  cy: number;
  /** Cumulative level of the current flight's first tread (z + turn bookkeeping). */
  levelBase: number;
}

/** Build one flight's run at the current cursor and fold it into the accumulator. */
function appendFlightRun(
  acc: MultiFlightAccum,
  state: MultiFlightWalkState,
  params: Readonly<StairParams>,
  treadCount: number,
  restLandings: readonly StairRestLanding[],
  isFirst: boolean,
): void {
  const { basePoint, rise, tread, nosing, width } = params;
  const run = buildRectilinearRun({
    originXY: { x: state.cx, y: state.cy },
    u: state.u,
    startLevel: state.levelBase,
    baseZ: basePoint.z,
    rise, tread, nosing, width,
    treadCount,
    restLandings,
  });
  acc.treads.push(...run.treads);
  acc.risers.push(...run.risers);
  acc.landings.push(...run.landings);
  acc.landingHandles.push(...run.landingHandles);
  acc.flightSplit.push(...run.flightSplit);
  acc.cutDirs.push(...run.cutDirs);
  // First flight includes its origin vertex; later flights' origin == the prior
  // turn's `nextStart` already pushed, so drop the duplicate leading vertex.
  acc.walkline.push(...(isFirst ? run.walklinePts : run.walklinePts.slice(1)));
  state.cx = run.endXY.x;
  state.cy = run.endXY.y;
}

/** Append the turn landing + quarter-turn advance after the flight of `treadCount` levels. */
function appendTurn(
  acc: MultiFlightAccum,
  state: MultiFlightWalkState,
  params: Readonly<StairParams>,
  turn: StairVariantMultiFlight['turns'][number],
  treadCount: number,
): void {
  const { basePoint, rise, width } = params;
  const endZ = basePoint.z + rise * (state.levelBase + treadCount);
  const end = point(state.cx, state.cy, endZ);
  const adv = advanceMultiFlightTurn(end, state.u, state.dirDeg, turn, width, rise);
  acc.landings.push(
    buildCornerLanding({ x: state.cx, y: state.cy }, state.u, perp(state.u), width, adv.landingDepth, endZ, true),
  );
  acc.walkline.push(adv.nextStart);
  state.dirDeg = adv.nextDirDeg;
  state.u = adv.dir;
  state.cx = adv.nextStart.x;
  state.cy = adv.nextStart.y;
  state.levelBase += treadCount + 1;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function assertMultiFlightBuildable(variant: StairVariantMultiFlight): void {
  if (variant.flights.length < 1) {
    throw new Error('computeMultiFlight: needs ≥1 flight');
  }
  if (variant.turns.length !== variant.flights.length - 1) {
    throw new Error(
      `computeMultiFlight: turns.length (${variant.turns.length}) must equal flights.length−1 (${variant.flights.length - 1})`,
    );
  }
  for (const n of variant.flights) {
    if (!Number.isFinite(n) || n < 1) {
      throw new Error(`computeMultiFlight: each flight needs ≥1 tread (got ${n})`);
    }
  }
  for (const t of variant.turns) {
    if (t.cornerStyle === 'winders') {
      throw new Error("computeMultiFlight: cornerStyle 'winders' requires Phase 2 (ADR-633)");
    }
  }
}
