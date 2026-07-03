/**
 * WALL ARC DESCRIPTOR — normalization SSoT for the circular-arc wall (ADR-565).
 *
 * A curved (circular-arc) wall stores ONE canonical scalar: the DXF `bulge`
 * (= tan(sweep/4) between `start` and `end`). This module normalizes every
 * supported INPUT method into that single bulge, and inverts it back to
 * center/radius/angles for readout + IFC export:
 *
 *   3-point (start, on-arc, end) → {@link bulgeFrom3Points}
 *   radius + side               → {@link bulgeFromRadius}
 *   bulge → arc (readout/IFC)    → {@link arcCurveFromBulge}
 *
 * Circle construction is REUSED from `geometry-circle-utils` and the bulge↔arc
 * math from `geometry-bulge-utils` (ADR-510) — no arc math is duplicated here;
 * this file only owns the sweep-sign / radius-side normalization glue.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../types/bim-base';
import { circleFrom3Points } from '../../rendering/entities/shared/geometry-circle-utils';
import { bulgeToArc, type BulgeArc } from '../../rendering/entities/shared/geometry-bulge-utils';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

const TWO_PI = Math.PI * 2;

/** CCW angular distance (radians) from `from` to `to`, in [0, 2π). */
function ccwDistance(from: number, to: number): number {
  let d = to - from;
  while (d < 0) d += TWO_PI;
  while (d >= TWO_PI) d -= TWO_PI;
  return d;
}

/**
 * Signed DXF bulge for a circular arc `start → end` that passes through `mid`.
 * Returns `null` when the three points are collinear/degenerate (caller should
 * fall back to a straight/Bézier wall).
 *
 * The signed sweep is derived directly from raw `atan2` angles in the SAME point
 * space `bulgeToArc` consumes — NOT from `arcFrom3Points`' `counterclockwise`
 * flag, which is expressed in the renderer's y-flipped screen convention and
 * would invert the bulge sign here.
 */
export function bulgeFrom3Points(start: Point2D, mid: Point2D, end: Point2D): number | null {
  const circle = circleFrom3Points(start, mid, end);
  if (!circle) return null;
  const { center } = circle;
  const a0 = Math.atan2(start.y - center.y, start.x - center.x);
  const am = Math.atan2(mid.y - center.y, mid.x - center.x);
  const a1 = Math.atan2(end.y - center.y, end.x - center.x);
  const midCCW = ccwDistance(a0, am);
  const endCCW = ccwDistance(a0, a1);
  // mid on the CCW path from start→end ⇒ CCW (positive) sweep, else CW (negative).
  const sweep = midCCW <= endCCW ? endCCW : endCCW - TWO_PI;
  if (Math.abs(sweep) < 1e-9 || Math.abs(sweep) >= TWO_PI - 1e-9) return null;
  return Math.tan(sweep / 4);
}

/**
 * Signed DXF bulge from a radius (mm) for the arc `start → end`. `side` picks the
 * bulge orientation ('ccw' → positive, 'cw' → negative); `major` selects the
 * major (reflex) arc instead of the minor one. Returns `null` when the radius is
 * too small to span the chord (`R < chord/2`). Phase-1.5 input path (dynamic
 * radius entry) — present now so the canonical store shape is proven.
 */
export function bulgeFromRadius(
  start: Point2D,
  end: Point2D,
  radiusMm: number,
  side: 'ccw' | 'cw',
  major = false,
  sceneUnits: SceneUnits = 'mm',
): number | null {
  const radiusWorld = mmToSceneUnits(sceneUnits) * radiusMm;
  const halfChord = Math.hypot(end.x - start.x, end.y - start.y) / 2;
  if (!(radiusWorld > 0) || halfChord < 1e-9 || radiusWorld < halfChord) return null;
  const minorSweep = 2 * Math.asin(Math.min(1, halfChord / radiusWorld));
  const sweepMag = major ? TWO_PI - minorSweep : minorSweep;
  const signed = side === 'ccw' ? sweepMag : -sweepMag;
  return Math.tan(signed / 4);
}

/**
 * ADR-565 Φ1.x «κέντρο–άκρα» — signed DXF bulge for the arc that starts at `start` (on a circle
 * of centre `center`) and sweeps to the angle of `cursor` (projected back onto the same circle).
 * Returns the bulge AND the resolved `endPoint` (the cursor angle projected onto the circle, i.e.
 * the wall's `end`). The signed sweep follows the cursor side in `(-π, π]` (minor arc) in the SAME
 * atan2 world-space `bulgeToArc` consumes (positive = CCW = positive bulge) — NOT the renderer's
 * y-flipped `counterclockwise` flag. Returns `null` for a degenerate radius / zero sweep.
 *
 * NOTE (MVP limitation): the minor-arc convention caps the sweep at ±180°; crossing the antipode
 * flips the arc side. Continuous >180° sweeps land in a later phase.
 */
export function bulgeFromCenterStartEnd(
  center: Point2D,
  start: Point2D,
  cursor: Point2D,
): { bulge: number; endPoint: Point2D } | null {
  const rx = start.x - center.x;
  const ry = start.y - center.y;
  const radius = Math.hypot(rx, ry);
  if (radius < 1e-9) return null;
  const a0 = Math.atan2(ry, rx);
  const a1 = Math.atan2(cursor.y - center.y, cursor.x - center.x);
  let sweep = a1 - a0;
  while (sweep <= -Math.PI) sweep += TWO_PI;
  while (sweep > Math.PI) sweep -= TWO_PI;
  if (Math.abs(sweep) < 1e-9) return null;
  const endPoint: Point2D = { x: center.x + radius * Math.cos(a1), y: center.y + radius * Math.sin(a1) };
  return { bulge: Math.tan(sweep / 4), endPoint };
}

/**
 * ADR-565 Φ1.x «εφαπτομενικό» — signed DXF bulge for the arc `start → end` whose tangent at `start`
 * has direction `tangentDirRad` (world radians). Uses the tangent-chord angle theorem: the angle δ
 * between the tangent and the chord equals HALF the central sweep, so `bulge = tan(sweep/4) =
 * tan(δ/2)`. Sign follows the chord side of the tangent (CCW → positive). Returns `null` for a
 * collapsed chord; a (near-)collinear chord yields a (near-)zero bulge (caller may treat as straight).
 */
export function bulgeFromTangent(start: Point2D, end: Point2D, tangentDirRad: number): number | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.hypot(dx, dy) < 1e-9) return null;
  const chordDir = Math.atan2(dy, dx);
  let delta = chordDir - tangentDirRad;
  while (delta <= -Math.PI) delta += TWO_PI;
  while (delta > Math.PI) delta -= TWO_PI;
  return Math.tan(delta / 2);
}

/**
 * Invert a wall's canonical `arc` bulge back to center/radius/angles/sweep for
 * radius readout and IFC export (bulge → `IfcCircle` + `IfcTrimmedCurve`
 * directrix → `IfcRevolvedAreaSolid`). Thin wrapper over `bulgeToArc`; returns
 * `null` for a (near-)straight segment.
 */
export function arcCurveFromBulge(start: Point3D, end: Point3D, bulge: number): BulgeArc | null {
  return bulgeToArc({ x: start.x, y: start.y }, { x: end.x, y: end.y }, bulge);
}
