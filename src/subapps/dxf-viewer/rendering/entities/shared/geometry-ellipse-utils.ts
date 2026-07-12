/**
 * GEOMETRY ELLIPSE UTILITIES (ADR-646 Φ3)
 *
 * SSoT for elliptical-arc point sampling. Convention (identical to the snap
 * `intersection-calculators` ellipse test AND the array `EllipseStrategy`):
 *
 *   point(t) = center + R(rotationDeg) · (majorAxis·cos t, minorAxis·sin t)
 *
 * where `rotation` is in DEGREES, the parameter `t` is in RADIANS measured CCW
 * from the +majorAxis direction, and `majorAxis`/`minorAxis` are SEMI-axes.
 *
 * Rendering an elliptical arc through this sampler + `worldToScreen` is Y-flip
 * correct (unlike `ctx.ellipse`'s start/end angles under the screen Y-flip) and
 * guarantees the drawn arc matches exactly what snapping / arrays compute.
 */

import type { Point2D } from '../../types/Types';
import { degToRad } from './geometry-angle-utils';

const TWO_PI = Math.PI * 2;

export interface EllipseArcSpec {
  center: Point2D;
  majorAxis: number;       // semi-axis
  minorAxis: number;       // semi-axis
  rotation?: number;       // degrees
  startParam?: number;     // radians (CCW from +majorAxis)
  endParam?: number;       // radians
}

/** World point on the ellipse at parameter `t` (radians). */
export function ellipsePointAt(
  center: Point2D,
  majorAxis: number,
  minorAxis: number,
  rotationDeg: number,
  t: number,
): Point2D {
  const rot = degToRad(rotationDeg);
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  const lx = majorAxis * Math.cos(t);
  const ly = minorAxis * Math.sin(t);
  return {
    x: center.x + lx * cosR - ly * sinR,
    y: center.y + lx * sinR + ly * cosR,
  };
}

/**
 * Number of straight segments to tessellate an elliptical arc of the given CCW
 * sweep into — full ellipse ≈ 96 (smooth), scaled down proportionally, floored
 * at 8 so tiny arcs still read as curves.
 */
export function ellipseArcSegments(startParam: number, endParam: number): number {
  const sweep = Math.abs(endParam - startParam);
  return Math.max(8, Math.ceil((sweep / TWO_PI) * 96));
}

/**
 * Tessellate the CCW sweep `[startParam → endParam]` into `segments + 1` world
 * points. Missing params default to a full ellipse `[0, 2π]`.
 */
export function tessellateEllipseArc(spec: EllipseArcSpec, segments: number): Point2D[] {
  const start = spec.startParam ?? 0;
  const end = spec.endParam ?? TWO_PI;
  const rot = spec.rotation ?? 0;
  const n = Math.max(2, Math.floor(segments));
  const pts: Point2D[] = [];
  for (let i = 0; i <= n; i++) {
    const t = start + ((end - start) * i) / n;
    pts.push(ellipsePointAt(spec.center, spec.majorAxis, spec.minorAxis, rot, t));
  }
  return pts;
}
