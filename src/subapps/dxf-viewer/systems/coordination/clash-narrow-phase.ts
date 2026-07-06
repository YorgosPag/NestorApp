/**
 * ADR-435 — narrow-phase exact tests (Slice 0).
 *
 * Two analytic primitives, both pure & deterministic:
 *   1. `closestDistanceBetweenSegments` — capsule↔capsule (MEP segment vs segment).
 *      Ericson, *Real-Time Collision Detection* §5.1.9.
 *   2. `segmentAabbHit` — capsule↔box (MEP segment vs structural element, treated
 *      as its AABB inflated by the pipe radius — Smits' slab clip clamped to [0,1]).
 *
 * Structural-as-AABB is a deliberate, documented v1 simplification (true swept-solid
 * clip = Phase 2); it is conservative, never missing a real penetration.
 */

import type { Aabb3, Vec3 } from './clash-types';
// SSoT sweep — canonical 3D component-wise sum (ADR-090).
import { addPoint3D } from '../../rendering/entities/shared/geometry-vector-utils';

const EPS = 1e-9;

function sub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function add(a: Vec3, b: Vec3): Vec3 { return addPoint3D(a, b); }
function scale(a: Vec3, s: number): Vec3 { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }

/** Midpoint of two points. */
function mid(a: Vec3, b: Vec3): Vec3 { return scale(add(a, b), 0.5); }

/** Closest distance + representative point between two finite 3D segments. */
export function closestDistanceBetweenSegments(
  p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3,
): { distM: number; point: Vec3 } {
  const d1 = sub(q1, p1); // direction of segment 1
  const d2 = sub(q2, p2); // direction of segment 2
  const r = sub(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);

  let s: number;
  let t: number;
  if (a <= EPS && e <= EPS) {
    s = 0; t = 0; // both segments are points
  } else if (a <= EPS) {
    s = 0; t = clamp01(f / e); // first segment is a point
  } else {
    const c = dot(d1, r);
    if (e <= EPS) {
      t = 0; s = clamp01(-c / a); // second segment is a point
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom > EPS ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  const c1 = add(p1, scale(d1, s));
  const c2 = add(p2, scale(d2, t));
  const diff = sub(c1, c2);
  return { distM: Math.sqrt(dot(diff, diff)), point: mid(c1, c2) };
}

/**
 * Does the segment p→q reach within `radiusM` of the box? Tests the centreline
 * against the box inflated by `radiusM` (Minkowski sum) via the slab method.
 * Returns the first contact point on hit, else `null`.
 */
export function segmentAabbHit(
  p: Vec3, q: Vec3, box: Aabb3, radiusM: number,
): { point: Vec3 } | null {
  const min = { x: box.min.x - radiusM, y: box.min.y - radiusM, z: box.min.z - radiusM };
  const max = { x: box.max.x + radiusM, y: box.max.y + radiusM, z: box.max.z + radiusM };
  const d = sub(q, p);
  let tMin = 0;
  let tMax = 1;
  const axes: ReadonlyArray<['x' | 'y' | 'z']> = [['x'], ['y'], ['z']];
  for (const [ax] of axes) {
    const o = p[ax];
    const dir = d[ax];
    const lo = min[ax];
    const hi = max[ax];
    if (Math.abs(dir) < EPS) {
      if (o < lo || o > hi) return null; // parallel & outside this slab
    } else {
      let t1 = (lo - o) / dir;
      let t2 = (hi - o) / dir;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tMin) tMin = t1;
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return null;
    }
  }
  return { point: add(p, scale(d, tMin)) };
}
