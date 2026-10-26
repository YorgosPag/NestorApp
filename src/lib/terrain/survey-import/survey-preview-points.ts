/**
 * ADR-920 Β4.8 5γ — **survey points ⇄ one flat buffer**, for the trip to the preview Worker.
 *
 * `[x0, y0, z0, x1, y1, z1, …]` in a `Float64Array`: its buffer is TRANSFERRED (zero-copy) instead of cloning tens of
 * thousands of objects. A point measured for position only travels as `z = NaN` and comes back WITHOUT `z` — never
 * `z = 0` (ADR-720). Lossless for the preparation: the door reads x, y, z and nothing else (`sourcePointOf`).
 * WORLD canonical mm are integers far below 2⁵³ — a float64 holds them exactly.
 *
 * @module lib/terrain/survey-import/survey-preview-points
 */

import type { TopoPoint } from '../terrain-types';

const STRIDE = 3;

/** Points → a fresh buffer (a new one per call: the transfer empties it on the sending side). */
export function packSurveyPoints(points: readonly TopoPoint[]): Float64Array {
  const packed = new Float64Array(points.length * STRIDE);
  points.forEach((point, i) => {
    packed[i * STRIDE] = point.x;
    packed[i * STRIDE + 1] = point.y;
    packed[i * STRIDE + 2] = point.z ?? Number.NaN;
  });
  return packed;
}

/** The buffer → points, in the same order; `NaN` z ⇒ no elevation. */
export function unpackSurveyPoints(packed: Float64Array): TopoPoint[] {
  const points: TopoPoint[] = [];
  for (let i = 0; i + STRIDE <= packed.length; i += STRIDE) {
    const z = packed[i + 2]!;
    points.push(Number.isNaN(z) ? { x: packed[i]!, y: packed[i + 1]! } : { x: packed[i]!, y: packed[i + 1]!, z });
  }
  return points;
}
