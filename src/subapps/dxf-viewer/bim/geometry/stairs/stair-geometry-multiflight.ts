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
  Segment3D,
  StairGeometry,
  StairParams,
  StairVariantMultiFlight,
} from '../../../bim/types/stair-types';
import {
  type Vec2,
  perp,
  arrowSymbol,
} from './stair-geometry-shared';
import {
  assembleMultiFlight,
  buildCornerLanding,
  buildRectilinearFlight,
} from './stair-geometry-generators';
import { walkMultiFlight } from '../../stairs/stair-multiflight-centerline';

export function computeMultiFlight(
  params: Readonly<StairParams>,
  variant: StairVariantMultiFlight,
): StairGeometry {
  assertMultiFlightBuildable(variant);
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
