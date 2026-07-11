/**
 * stair-winder-band-geometry — pure 2-D geometry helpers for the balanced winder
 * band (extracted from `stair-winder-balanced-band.ts` for file-size SRP, N.7.1).
 *
 * These are winding-agnostic vector / polygon primitives (offset, ray↔circle and
 * ray↔line intersection, coincident-vertex dedupe, CCW lift to `Polygon3D`) plus
 * the shared coincidence epsilon. The band builder consumes them; keeping them in
 * their own module leaves the builder focused on the zone/step logic.
 */

import type { Polygon3D } from '../../../bim/types/stair-types';
import { type Vec2, point } from './stair-geometry-shared';

/** Shared epsilon for winder-band geometry (coincidence / degeneracy tests). */
export const BAND_EPS = 1e-6;

/** Offset point `p` by `s` along unit direction `dir`. */
export function add(p: Vec2, dir: Vec2, s: number): Vec2 {
  return { x: p.x + dir.x * s, y: p.y + dir.y * s };
}

/** Drop consecutive coincident vertices (winder wedges collapse to triangles). */
export function dedupe(pts: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > BAND_EPS) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first && last && Math.hypot(first.x - last.x, first.y - last.y) <= BAND_EPS) {
    out.pop();
  }
  return out;
}

/** Lift 2-D vertices to a `Polygon3D` at fixed `z`, forcing CCW winding. */
export function liftCCW(pts: readonly Vec2[], z: number): Polygon3D {
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  const ordered = area2 < 0 ? [...pts].reverse() : pts;
  return ordered.map((p) => point(p.x, p.y, z));
}

/**
 * Point on the ray `a → b` at distance `radius` from `centre` (outward root) —
 * extends a rotated riser to the outer circle so it still passes through its mark.
 */
export function extendToCircle(a: Vec2, b: Vec2, centre: Vec2, radius: number): Vec2 {
  const dx = b.x - a.x, dy = b.y - a.y;
  const fx = a.x - centre.x, fy = a.y - centre.y;
  const qa = dx * dx + dy * dy;
  const qb = 2 * (fx * dx + fy * dy);
  const qc = fx * fx + fy * fy - radius * radius;
  const disc = qb * qb - 4 * qa * qc;
  if (qa < BAND_EPS || disc < 0) return b;
  const t = (-qb + Math.sqrt(disc)) / (2 * qa);
  return { x: a.x + dx * t, y: a.y + dy * t };
}

/** Intersection of the ray `a → b` with the line through `p` in direction `d`. */
export function extendToLine(a: Vec2, b: Vec2, p: Vec2, d: Vec2): Vec2 {
  const rx = b.x - a.x, ry = b.y - a.y;
  const denom = rx * d.y - ry * d.x;
  if (Math.abs(denom) < BAND_EPS) return b;
  const t = ((p.x - a.x) * d.y - (p.y - a.y) * d.x) / denom;
  return { x: a.x + rx * t, y: a.y + ry * t };
}
