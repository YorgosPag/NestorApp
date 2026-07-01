/**
 * ADR-510 Φ4 — Line geometry read/edit pure helpers (AutoCAD «Geometry» section).
 *
 * Editable geometry surface for the selected-line contextual ribbon tab. A DXF
 * `line` stores only `start`/`end` (Point2D); Length, Angle and the Δ values are
 * DERIVED — never stored. Read mirrors AutoCAD's Properties palette (Start X/Y,
 * End X/Y, Delta X/Y, Length, Angle); each setter returns the NEW endpoint so the
 * caller can build a `{ start }` / `{ end }` patch for `UpdateEntityCommand`.
 *
 * Unit-agnostic: operates on raw stored coordinates (scene mm, ADR-462). The
 * ribbon bridge converts display-unit ↔ mm at its boundary (`toDisplay` /
 * `fromDisplay`), exactly as the Φ3d width field already does.
 *
 * Zero React / DOM / Firestore deps. Reuses the geometry SSoT
 * (`geometry-vector-utils`) — no duplicated distance/angle/segment math.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-510-line-creation-system.md §Φ4
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  calculateDistance,
  calculateAngle,
  resizeSegmentToLength,
  pointOnCircle,
} from '../../rendering/entities/shared/geometry-vector-utils';

export type LineAxis = 'x' | 'y';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
/** Below this the axis is degenerate (start ≈ end) — angle/length edits no-op. */
const MIN_AXIS_LEN = 1e-9;

/** Geometric length of the segment (raw stored units). */
export function lineLength(start: Point2D, end: Point2D): number {
  return calculateDistance(start, end);
}

/**
 * Segment bearing in degrees, range (-180, 180], measured CCW from +X (AutoCAD
 * «Angle»). A degenerate segment reports 0.
 */
export function lineAngleDeg(start: Point2D, end: Point2D): number {
  if (calculateDistance(start, end) < MIN_AXIS_LEN) return 0;
  const deg = calculateAngle(start, end) * RAD_TO_DEG;
  // Normalise -180 → 180 so the readout never flips sign on a flat line.
  return deg <= -180 ? deg + 360 : deg;
}

/**
 * New `end` that sets the axis length to `length` (raw units), keeping `start`
 * and the current bearing. Returns `null` for non-finite / non-positive input so
 * the caller can skip the dispatch (no undo pollution).
 */
export function endForLength(
  start: Point2D,
  end: Point2D,
  length: number,
): Point2D | null {
  if (!Number.isFinite(length) || length <= 0) return null;
  return resizeSegmentToLength(start, end, length);
}

/**
 * New `end` that sets the bearing to `deg` (CCW from +X), keeping `start` and the
 * current length. Returns `null` for a degenerate segment (no length to rotate)
 * or non-finite input.
 */
export function endForAngleDeg(
  start: Point2D,
  end: Point2D,
  deg: number,
): Point2D | null {
  if (!Number.isFinite(deg)) return null;
  const len = calculateDistance(start, end);
  if (len < MIN_AXIS_LEN) return null;
  return pointOnCircle(start, len, deg * DEG_TO_RAD);
}

/** New point with one axis replaced by an absolute value. */
export function withCoord(point: Point2D, axis: LineAxis, value: number): Point2D | null {
  if (!Number.isFinite(value)) return null;
  return { ...point, [axis]: value };
}

/**
 * New `end` whose signed delta from `start` along `axis` equals `delta`
 * (AutoCAD «Delta X/Y»). `end[axis] = start[axis] + delta`.
 */
export function endForDelta(
  start: Point2D,
  end: Point2D,
  axis: LineAxis,
  delta: number,
): Point2D | null {
  if (!Number.isFinite(delta)) return null;
  return { ...end, [axis]: start[axis] + delta };
}
