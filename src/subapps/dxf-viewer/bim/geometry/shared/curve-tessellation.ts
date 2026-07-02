/**
 * SHARED CURVE TESSELLATION — SSoT for member-axis curve subdivision.
 *
 * Consolidates the curve→polyline tessellation used by curved structural members
 * (walls, beams, and — from ADR-565 — arc walls/beams/columns). Two curve kinds:
 *
 *  1. Quadratic Bézier (legacy `curveControl`): {@link subdivideQuadraticBezier}.
 *     Previously duplicated verbatim in `wall-geometry.ts` and `beam-geometry.ts`
 *     (Boy-Scout centralization, ADR-565).
 *  2. True circular arc (canonical DXF `bulge`, ADR-565): {@link tessellateArcAxis},
 *     built on the bulge SSoT (`geometry-bulge-utils`, ADR-510) with an adaptive,
 *     chord-deviation-driven segment count ({@link adaptiveArcSegDeg}).
 *
 * All arc math is REUSED from `geometry-bulge-utils` — no bulge↔arc math here.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Point3D } from '../../types/bim-base';
import {
  bulgeToArc,
  bulgeToPolyline,
  BULGE_STRAIGHT_EPS,
} from '../../../rendering/entities/shared/geometry-bulge-utils';
import { ADAPTIVE_ARC_TESSELLATION } from '../../../config/tolerance-config';
import { mmToSceneUnits, type SceneUnits } from '../../../utils/scene-units';

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Quadratic Bezier subdivision: `P(t) = (1-t)² P0 + 2(1-t)t P1 + t² P2`.
 * Returns N+1 vertices including endpoints. Z is interpolated linearly between
 * start/end (control point Z is ignored — members are 2D-extruded in plan).
 */
export function subdivideQuadraticBezier(
  start: Point3D,
  control: Point3D,
  end: Point3D,
  segments: number,
): Point3D[] {
  const pts: Point3D[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const oneMinusT = 1 - t;
    const w0 = oneMinusT * oneMinusT;
    const w1 = 2 * oneMinusT * t;
    const w2 = t * t;
    pts.push({
      x: w0 * start.x + w1 * control.x + w2 * end.x,
      y: w0 * start.y + w1 * control.y + w2 * end.y,
      z: oneMinusT * (start.z ?? 0) + t * (end.z ?? 0),
    });
  }
  return pts;
}

/**
 * Chord-deviation-driven max segment angle (degrees) for tessellating an arc of
 * `radiusWorld` and signed `sweepDeg`, keeping the chord→arc sagitta under
 * `worldTol` (same world units as the radius). The result is clamped so the
 * resulting segment count stays within [MIN, MAX] segments.
 *
 * Geometry: sagitta(dθ) = R·(1 − cos(dθ/2)) = tol ⇒ dθ = 2·acos(1 − tol/R).
 * Larger radius ⇒ smaller dθ ⇒ MORE segments for a fixed absolute tolerance
 * (a longer physical arc), matching the industry deviation model.
 */
export function adaptiveArcSegDeg(
  radiusWorld: number,
  worldTol: number,
  sweepDeg: number,
  cap: number = ADAPTIVE_ARC_TESSELLATION.MAX_SEGMENTS,
  floor: number = ADAPTIVE_ARC_TESSELLATION.MIN_SEGMENTS,
): number {
  const sweep = Math.max(1e-6, Math.abs(sweepDeg));
  const minSegDeg = sweep / Math.max(1, cap); // segDeg ≥ this ⇒ segments ≤ cap
  const maxSegDeg = sweep / Math.max(1, floor); // segDeg ≤ this ⇒ segments ≥ floor
  if (!(radiusWorld > 0) || !(worldTol > 0) || radiusWorld <= worldTol) {
    return maxSegDeg; // degenerate/tiny arc → floor segments
  }
  const ratio = Math.min(1, worldTol / radiusWorld);
  const dThetaDeg = 2 * Math.acos(1 - ratio) * RAD_TO_DEG;
  return Math.min(Math.max(dThetaDeg, minSegDeg), maxSegDeg);
}

/**
 * Tessellate a true circular-arc member axis from its canonical `bulge`
 * descriptor (DXF bulge = tan(sweep/4) between `start` and `end`). Returns
 * `[start, end]` when the bulge is (near-)zero. Endpoints are pinned to the exact
 * `start`/`end` (via `bulgeToPolyline`); Z is interpolated linearly by index.
 *
 * Segment count is deviation-adaptive at the commit-time world tolerance
 * (`CHORD_DEVIATION_MM`, zoom-independent) — this is the STORED geometry that
 * feeds BOQ / 3D / snap / hit-test.
 */
export function tessellateArcAxis(
  start: Point3D,
  end: Point3D,
  bulge: number,
  sceneUnits: SceneUnits = 'mm',
): Point3D[] {
  if (Math.abs(bulge) < BULGE_STRAIGHT_EPS) {
    return [{ ...start }, { ...end }];
  }
  const s = mmToSceneUnits(sceneUnits);
  const p0: Point2D = { x: start.x, y: start.y };
  const p1: Point2D = { x: end.x, y: end.y };
  const arc = bulgeToArc(p0, p1, bulge);
  if (!arc) return [{ ...start }, { ...end }];
  const worldTol = ADAPTIVE_ARC_TESSELLATION.CHORD_DEVIATION_MM * s;
  const sweepDeg = Math.abs(arc.sweep) * RAD_TO_DEG;
  const segDeg = adaptiveArcSegDeg(arc.radius, worldTol, sweepDeg);
  const flat = bulgeToPolyline(p0, p1, bulge, segDeg);
  const z0 = start.z ?? 0;
  const z1 = end.z ?? 0;
  const last = flat.length - 1;
  return flat.map((p, i) => ({ x: p.x, y: p.y, z: z0 + ((z1 - z0) * i) / Math.max(1, last) }));
}
