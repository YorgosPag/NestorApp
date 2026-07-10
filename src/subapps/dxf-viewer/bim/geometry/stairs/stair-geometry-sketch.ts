/**
 * Sketch stair geometry — ADR-358 Phase 4c.
 *
 * Free-form stair following a user-drawn walkline polyline. The
 * `variant.walklinePath` length MUST equal `params.stepCount + 1`; otherwise
 * throws. z values in the input path are overridden by `z_i = i·rise` to
 * enforce a uniform riser progression (a free-form sketch supplies the plan-
 * view curve, the stair tool supplies the vertical model).
 *
 * ADR-611 — sketch is a walkline-following stair run (`sign = +1`); this file
 * validates the path, enforces the linear rise, then delegates all geometry to
 * the unified `computeWalklineStair` (SSoT shared with elliptical).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.2 §6.3
 */

import type { Point3D } from '../../../rendering/types/Types';
import type {
  Polyline3D,
  StairGeometry,
  StairParams,
  StairVariantSketch,
} from '../../../bim/types/stair-types';
import { point } from './stair-geometry-shared';
import { computeWalklineStair } from './stair-geometry-runs';

export function computeSketch(
  params: Readonly<StairParams>,
  variant: StairVariantSketch,
): StairGeometry {
  assertWalklineLength(params.stepCount, variant.walklinePath.length);
  // ADR-619 — multi-flight «από περιοχή»: το path φέρει ήδη μεικτά z (πατήματα +
  // επίπεδα πλατύσκαλα)· ΜΗΝ επιβάλλεις uniform rise. Αλλιώς κλασικό ενιαίο riser.
  const walkline = variant.preserveZ
    ? variant.walklinePath.map((p) => point(p.x, p.y, p.z))
    : enforceLinearRise(variant.walklinePath, params);
  return computeWalklineStair(params, walkline, 1);
}

// ─── SKETCH private helpers ───────────────────────────────────────────────────

function assertWalklineLength(stepCount: number, pathLength: number): void {
  if (pathLength !== stepCount + 1) {
    throw new Error(
      `StairGeometryService: sketch walklinePath length must equal stepCount+1 ` +
        `(got walklinePath.length=${pathLength}, stepCount+1=${stepCount + 1})`,
    );
  }
}

function enforceLinearRise(
  walklinePath: readonly Point3D[],
  params: Readonly<StairParams>,
): Polyline3D {
  const out: Point3D[] = new Array(walklinePath.length);
  for (let i = 0; i < walklinePath.length; i++) {
    out[i] = point(
      walklinePath[i].x,
      walklinePath[i].y,
      params.basePoint.z + params.rise * i,
    );
  }
  return out;
}
