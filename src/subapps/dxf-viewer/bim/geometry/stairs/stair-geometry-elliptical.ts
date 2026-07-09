/**
 * Elliptical helical stair geometry — ADR-358 Phase 4b.
 *
 * Walkline sits ON the (rotated, translated) ellipse perimeter, sampled by
 * arc-length via Phase 2b `ellipseSample`. Treads extend ±`width/2` to either
 * side of the walkline along the local chord-perpendicular — industry-standard
 * approach for stair on curved walkline (Revit/ArchiCAD/Vectorworks).
 *
 * ADR-611 — elliptical is a walkline-following stair run; this file samples the
 * ellipse walkline and delegates all geometry to the unified
 * `computeWalklineStair` (SSoT shared with sketch).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2 §6.3
 */

import { ellipseSample } from '../../../rendering/entities/shared/geometry-curve-utils';
import type {
  Polyline3D,
  StairGeometry,
  StairParams,
  StairVariantElliptical,
} from '../../../bim/types/stair-types';
import { computeWalklineStair } from './stair-geometry-runs';

export function computeElliptical(
  params: Readonly<StairParams>,
  variant: StairVariantElliptical,
): StairGeometry {
  const sign: 1 | -1 = variant.turnDirection === 'ccw' ? 1 : -1;
  const walkline = ellipseSample(
    variant.centerPoint,
    variant.semiMajor,
    variant.semiMinor,
    variant.sweepAngle,
    variant.turnDirection,
    variant.rotation,
    params.stepCount,
    params.rise * params.stepCount,
  );
  return computeWalklineStair(params, walkline, sign);
}

// Walkline type re-exported indirectly via StairGeometry.walkline.
export type { Polyline3D };
