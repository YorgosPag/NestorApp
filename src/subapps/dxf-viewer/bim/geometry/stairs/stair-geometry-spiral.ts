/**
 * Spiral stair geometry — ADR-358 Phase 4a.
 *
 * Apex-at-center degenerate helical: `innerRadius` is fixed at 0 by the
 * `StairVariantSpiral` type, so each tread is a triangular wedge with its apex
 * at the central column point. Outer radius = `params.width` (industry default
 * for central-column spiral stairs); walkline radius = width/2.
 *
 * ADR-611 — spiral is a radial stair run in apex mode (`innerRadius = 0`); all
 * geometry comes from the unified `computeRadialStair` (SSoT for spiral /
 * helical / triangular-fan). This file only maps the variant to a config.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2 §6.3
 */

import type {
  StairGeometry,
  StairParams,
  StairVariantSpiral,
} from '../../../bim/types/stair-types';
import { computeRadialStair } from './stair-geometry-runs';

export function computeSpiral(
  params: Readonly<StairParams>,
  variant: StairVariantSpiral,
): StairGeometry {
  return computeRadialStair(params, {
    center: variant.centerPoint,
    innerRadius: 0,
    outerRadius: params.width,
    sweepAngleDeg: variant.sweepAngle,
    turnDirection: variant.turnDirection,
    apex: true,
  });
}
