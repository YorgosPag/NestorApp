/**
 * Helical (open-well circular) stair geometry — ADR-358 Phase 4a.
 *
 * Annular wedge treads at `R ∈ [innerRadius, outerRadius]`; walkline sampled at
 * `R = (innerRadius + outerRadius) / 2`. Risers radial, stringers = constant-
 * radius arcs at the inner/outer edges.
 *
 * ADR-611 — helical is a radial stair run in annular mode (`apex = false`); all
 * geometry comes from the unified `computeRadialStair` (SSoT for spiral /
 * helical / triangular-fan). This file only maps the variant to a config.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2 §6.3
 */

import type {
  StairGeometry,
  StairParams,
  StairVariantHelical,
} from '../../../bim/types/stair-types';
import { computeRadialStair } from './stair-geometry-runs';

export function computeHelical(
  params: Readonly<StairParams>,
  variant: StairVariantHelical,
): StairGeometry {
  return computeRadialStair(params, {
    center: variant.centerPoint,
    innerRadius: variant.innerRadius,
    outerRadius: variant.outerRadius,
    sweepAngleDeg: variant.sweepAngle,
    turnDirection: variant.turnDirection,
    apex: false,
  });
}
