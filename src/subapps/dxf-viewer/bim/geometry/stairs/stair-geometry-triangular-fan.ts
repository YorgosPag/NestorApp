/**
 * Triangular-fan stair geometry — ADR-358 Phase 4c.
 *
 * Polygonal/wedge "fan" stair: apex coincides with `variant.apexPoint`, the
 * full sweep is `variant.openingAngle`, treads are triangular wedges sharing
 * the apex (3-vertex like spiral). Outer radius = `params.width`.
 *
 * Phase 4c constraint: `params.stepCount === variant.stepCountPerArc` (single
 * arc). Multi-arc polygonal spiral is deferred — throws on mismatch.
 *
 * ADR-611 — triangular-fan is a radial stair run in apex mode (`innerRadius =
 * 0`, center = `apexPoint`, sweep = `openingAngle`); all geometry comes from
 * the unified `computeRadialStair` (SSoT for spiral / helical / triangular-fan).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2 §6.3
 */

import type {
  StairGeometry,
  StairParams,
  StairVariantTriangularFan,
} from '../../../bim/types/stair-types';
import { computeRadialStair } from './stair-geometry-runs';

export function computeTriangularFan(
  params: Readonly<StairParams>,
  variant: StairVariantTriangularFan,
): StairGeometry {
  assertStepCountMatchesArc(params.stepCount, variant.stepCountPerArc);
  return computeRadialStair(params, {
    center: variant.apexPoint,
    innerRadius: 0,
    outerRadius: params.width,
    sweepAngleDeg: variant.openingAngle,
    turnDirection: variant.turnDirection,
    apex: true,
  });
}

function assertStepCountMatchesArc(stepCount: number, stepCountPerArc: number): void {
  if (stepCount !== stepCountPerArc) {
    throw new Error(
      `StairGeometryService: triangular-fan requires stepCount === stepCountPerArc ` +
        `(got stepCount=${stepCount}, stepCountPerArc=${stepCountPerArc}; multi-arc polygonal spiral deferred)`,
    );
  }
}
