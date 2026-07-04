/**
 * ADR-563 Φ4-Α — cut-axis bbox projection SSoT.
 *
 * Extracted from `auto-dimension-cutline-planner.ts` so BOTH the planner (initial
 * chain planning) and `dim-association-service.ts` (follow-on-move recompute) share
 * ONE projection of a BIM host's 2D bbox onto an arbitrary cut-line direction — no
 * duplicated axis math (N.0.2).
 *
 * Reuses the polygon-axis SSoT (`projectPolygonOnAxis` / `projectPointOnAxis`).
 */

import type { Point2D } from '../../../rendering/types/Types';
import {
  projectPointOnAxis,
  projectPolygonOnAxis,
} from '../../../bim/geometry/shared/polygon-axis-projection';
import type { AxisProjection } from './auto-dimension-reference-extraction';
import type { Bounds2D } from './auto-dimension-types';

/** The four corners of an axis-aligned bbox (for skew-axis face projection). */
export function bboxCorners(b: Bounds2D): readonly Point2D[] {
  return [
    { x: b.min.x, y: b.min.y },
    { x: b.max.x, y: b.min.y },
    { x: b.max.x, y: b.max.y },
    { x: b.min.x, y: b.max.y },
  ];
}

/**
 * Project one bbox onto the cut-line axis → `{lo, hi, center}` in along-axis
 * scalars (measured from `start` along the unit direction `u`), so both the
 * planner and the recompute pick the exact same centers/faces.
 */
export function projectBoundsOntoCutAxis(
  bounds: Bounds2D,
  start: Point2D,
  u: Point2D,
): AxisProjection {
  const poly = projectPolygonOnAxis(bboxCorners(bounds), start.x, start.y, u.x, u.y);
  const cx = (bounds.min.x + bounds.max.x) / 2;
  const cy = (bounds.min.y + bounds.max.y) / 2;
  const center = projectPointOnAxis(cx, cy, start.x, start.y, u.x, u.y).along;
  return { lo: poly.alongMin, hi: poly.alongMax, center };
}
