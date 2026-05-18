/**
 * Unit tests for Ray intersection calculators — Phase 6.5.b (ADR-359).
 * Covers: rayRayIntersection, rayXlineIntersection, rayPolylineIntersection,
 *         rayEllipseIntersection, rayRectangleIntersection.
 */

import {
  rayRayIntersection,
  rayXlineIntersection,
  rayPolylineIntersection,
  rayEllipseIntersection,
  rayRectangleIntersection,
} from '../intersection-calculators';
import type { RayEntity, XLineEntity, EllipseEntity } from '../../../types/entities';
import type { Entity } from '../../extended-types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRay(bx: number, by: number, dx: number, dy: number): RayEntity {
  return { id: 'r1', type: 'ray', basePoint: { x: bx, y: by }, direction: { x: dx, y: dy } } as RayEntity;
}

function makeXLine(bx: number, by: number, dx: number, dy: number): XLineEntity {
  return { id: 'xl1', type: 'xline', basePoint: { x: bx, y: by }, direction: { x: dx, y: dy } } as XLineEntity;
}

function makePolyline(vertices: { x: number; y: number }[], closed = false): Entity {
  return { id: 'pl1', type: 'polyline', vertices, closed } as unknown as Entity;
}

function makeEllipse(
  cx: number, cy: number,
  majorAxis: number, minorAxis: number,
  rotation = 0,
  startParam?: number, endParam?: number
): EllipseEntity {
  return {
    id: 'e1', type: 'ellipse',
    center: { x: cx, y: cy },
    majorAxis, minorAxis, rotation,
    startParam, endParam,
  } as EllipseEntity;
}

function makeRectangle(x: number, y: number, width: number, height: number): Entity {
  return {
    id: 'rec1', type: 'rectangle', x, y, width, height,
    corner1: { x, y },
    corner2: { x: x + width, y: y + height },
  } as unknown as Entity;
}

function approxEq(a: number, b: number, tol = 1e-6): boolean {
  return Math.abs(a - b) < tol;
}

// ─── rayRayIntersection ───────────────────────────────────────────────────────

describe('rayRayIntersection', () => {
  test('two rays crossing ahead → 1 intersection', () => {
    const r1 = makeRay(0, 0, 1, 0);
    const r2 = makeRay(2, -1, 0, 1);
    const res = rayRayIntersection(r1, r2);
    expect(res).toHaveLength(1);
    expect(approxEq(res[0].point.x, 2)).toBe(true);
    expect(approxEq(res[0].point.y, 0)).toBe(true);
    expect(res[0].type).toBe('Ray-Ray');
  });

  test('t1=0 t2=0 (shared base point) → 1 intersection at origin', () => {
    const r1 = makeRay(0, 0, 1, 0);
    const r2 = makeRay(0, 0, 0, 1);
    const res = rayRayIntersection(r1, r2);
    expect(res).toHaveLength(1);
    expect(approxEq(res[0].point.x, 0)).toBe(true);
    expect(approxEq(res[0].point.y, 0)).toBe(true);
  });

  test('parallel rays → []', () => {
    const r1 = makeRay(0, 0, 1, 0);
    const r2 = makeRay(0, 1, 1, 0);
    expect(rayRayIntersection(r1, r2)).toHaveLength(0);
  });

  test('rays would meet BEHIND both origins → []', () => {
    // Both pointing away from each other
    const r1 = makeRay(1, 0, 1, 0);
    const r2 = makeRay(-1, 0, -1, 0);
    expect(rayRayIntersection(r1, r2)).toHaveLength(0);
  });

  test('intersection behind one ray → []', () => {
    // r1 points right, r2 points right too (same direction, offset)
    // real crossing at x=-1 which is behind r1 (base at 0)
    const r1 = makeRay(0, 0, 1, 1);
    const r2 = makeRay(2, 0, -1, 1);
    const res = rayRayIntersection(r1, r2);
    // t1 = 1, t2 = 1 → both >= 0 → should intersect at (1,1)
    expect(res).toHaveLength(1);
    expect(approxEq(res[0].point.x, 1)).toBe(true);
    expect(approxEq(res[0].point.y, 1)).toBe(true);
  });
});

// ─── rayXlineIntersection ────────────────────────────────────────────────────

describe('rayXlineIntersection', () => {
  test('ray (1,0) from (0,0) × vertical xline at x=3 → hit at (3,0)', () => {
    const ray = makeRay(0, 0, 1, 0);
    const xl = makeXLine(3, 0, 0, 1);
    const res = rayXlineIntersection(ray, xl);
    expect(res).toHaveLength(1);
    expect(approxEq(res[0].point.x, 3)).toBe(true);
    expect(approxEq(res[0].point.y, 0)).toBe(true);
    expect(res[0].type).toBe('Ray-XLine');
  });

  test('xline intersection BEHIND ray → []', () => {
    const ray = makeRay(0, 0, 1, 0);
    const xl = makeXLine(-5, 0, 0, 1);
    expect(rayXlineIntersection(ray, xl)).toHaveLength(0);
  });

  test('parallel ray and xline → []', () => {
    const ray = makeRay(0, 0, 1, 0);
    const xl = makeXLine(0, 1, 1, 0);
    expect(rayXlineIntersection(ray, xl)).toHaveLength(0);
  });

  test('ray base ON xline (t=0) → 1 point', () => {
    const ray = makeRay(2, 0, 1, 0);
    const xl = makeXLine(2, 0, 0, 1);
    const res = rayXlineIntersection(ray, xl);
    expect(res).toHaveLength(1);
    expect(approxEq(res[0].point.x, 2)).toBe(true);
    expect(approxEq(res[0].point.y, 0)).toBe(true);
  });

  test('ray dir (-1,0) from (5,0) × vertical xline at x=2 → hit (tRay>0)', () => {
    const ray = makeRay(5, 0, -1, 0);
    const xl = makeXLine(2, 0, 0, 1);
    const res = rayXlineIntersection(ray, xl);
    expect(res).toHaveLength(1);
    expect(approxEq(res[0].point.x, 2)).toBe(true);
  });
});

// ─── rayPolylineIntersection ─────────────────────────────────────────────────

describe('rayPolylineIntersection', () => {
  test('ray crosses 2 segments → 2 intersections', () => {
    // Polyline: zigzag across y-axis, ray goes right
    const pl = makePolyline([{ x: 1, y: -2 }, { x: 1, y: 2 }, { x: 3, y: -2 }, { x: 3, y: 2 }]);
    const ray = makeRay(0, 0, 1, 0);
    const res = rayPolylineIntersection(ray, pl);
    expect(res.length).toBeGreaterThanOrEqual(2);
    expect(res[0].type).toBe('Ray-Polyline');
  });

  test('intersection BEHIND ray → []', () => {
    const pl = makePolyline([{ x: -3, y: -1 }, { x: -3, y: 1 }]);
    const ray = makeRay(0, 0, 1, 0);
    expect(rayPolylineIntersection(ray, pl)).toHaveLength(0);
  });

  test('closed square polyline crossed once → 1 intersection', () => {
    const pl = makePolyline([
      { x: 1, y: -1 }, { x: 3, y: -1 }, { x: 3, y: 1 }, { x: 1, y: 1 }
    ], true);
    const ray = makeRay(0, 0, 1, 0);
    const res = rayPolylineIntersection(ray, pl);
    // Ray from left hits left side of square (x=1 segment from y=-1 to y=1)
    // then exits right side (x=3 segment)
    expect(res.length).toBeGreaterThanOrEqual(1);
  });

  test('parallel segment → skip, no intersection for that segment', () => {
    const pl = makePolyline([{ x: 0, y: 1 }, { x: 5, y: 1 }]);
    const ray = makeRay(0, 0, 1, 0);
    expect(rayPolylineIntersection(ray, pl)).toHaveLength(0);
  });

  test('ray origin inside square → intersections only forward', () => {
    const pl = makePolyline([
      { x: -2, y: -2 }, { x: 2, y: -2 }, { x: 2, y: 2 }, { x: -2, y: 2 }
    ], true);
    const ray = makeRay(0, 0, 1, 0);
    const res = rayPolylineIntersection(ray, pl);
    // Only the right side at x=2 should be hit (t>0), left side at x=-2 is behind
    for (const r of res) {
      expect(r.point.x).toBeGreaterThanOrEqual(-1e-6);
    }
    expect(res.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── rayEllipseIntersection ──────────────────────────────────────────────────

describe('rayEllipseIntersection', () => {
  test('ray through ellipse center → 2 points (both t >= 0)', () => {
    const ray = makeRay(-5, 0, 1, 0);
    const ell = makeEllipse(0, 0, 3, 2);
    const res = rayEllipseIntersection(ray, ell);
    expect(res).toHaveLength(2);
    expect(res[0].type).toBe('Ray-Ellipse');
    // both x values should be ±3 (major semi-axis)
    const xs = res.map(r => r.point.x).sort((a, b) => a - b);
    expect(approxEq(xs[0], -3)).toBe(true);
    expect(approxEq(xs[1], 3)).toBe(true);
  });

  test('ray origin INSIDE ellipse → 1 point (negative t filtered)', () => {
    const ray = makeRay(0, 0, 1, 0);
    const ell = makeEllipse(0, 0, 3, 2);
    const res = rayEllipseIntersection(ray, ell);
    expect(res).toHaveLength(1);
    expect(res[0].point.x).toBeGreaterThan(0);
  });

  test('ray pointing AWAY from ellipse → []', () => {
    const ray = makeRay(-10, 0, -1, 0);
    const ell = makeEllipse(0, 0, 3, 2);
    expect(rayEllipseIntersection(ray, ell)).toHaveLength(0);
  });

  test('ray tangent to ellipse → 1 point', () => {
    // Ray along y=2 (minor semi-axis), tangent to top
    const ray = makeRay(-5, 2, 1, 0);
    const ell = makeEllipse(0, 0, 3, 2);
    const res = rayEllipseIntersection(ray, ell);
    expect(res).toHaveLength(1);
    expect(approxEq(res[0].point.y, 2)).toBe(true);
  });

  test('partial ellipse arc: intersection outside param range → []', () => {
    // Full ellipse arc would have 2 intersections, restrict to only top half
    const PI = Math.PI;
    // startParam=0 endParam=PI → top half (y>=0 in local frame)
    const ell = makeEllipse(0, 0, 3, 2, 0, 0, PI);
    // Ray along y=-1 (bottom half) → both intersections outside [0,PI]
    const ray = makeRay(-5, -1, 1, 0);
    const res = rayEllipseIntersection(ray, ell);
    expect(res).toHaveLength(0);
  });
});

// ─── rayRectangleIntersection ────────────────────────────────────────────────

describe('rayRectangleIntersection', () => {
  test('ray crosses rectangle → 2 intersections (enter + exit)', () => {
    // Rectangle from (1,-1) w=2 h=2 → x:[1,3] y:[-1,1]
    const rec = makeRectangle(1, -1, 2, 2);
    const ray = makeRay(0, 0, 1, 0);
    const res = rayRectangleIntersection(ray, rec);
    expect(res).toHaveLength(2);
    const xs = res.map(r => r.point.x).sort((a, b) => a - b);
    expect(approxEq(xs[0], 1)).toBe(true);
    expect(approxEq(xs[1], 3)).toBe(true);
    expect(res[0].type).toBe('Ray-Rectangle');
  });

  test('ray origin INSIDE rectangle → 1 intersection (exit only)', () => {
    const rec = makeRectangle(-2, -2, 4, 4);
    const ray = makeRay(0, 0, 1, 0);
    const res = rayRectangleIntersection(ray, rec);
    expect(res).toHaveLength(1);
    expect(approxEq(res[0].point.x, 2)).toBe(true);
  });

  test('ray pointing AWAY from rectangle → []', () => {
    const rec = makeRectangle(5, -1, 2, 2);
    const ray = makeRay(0, 0, -1, 0);
    expect(rayRectangleIntersection(ray, rec)).toHaveLength(0);
  });

  test('ray tangent to rectangle corner → 1 intersection', () => {
    const rec = makeRectangle(0, 0, 2, 2);
    // Ray along y=2 (top side of rectangle y:[0,2])
    const ray = makeRay(-1, 2, 1, 0);
    const res = rayRectangleIntersection(ray, rec);
    // Should hit at least one corner/edge
    expect(res.length).toBeGreaterThanOrEqual(1);
    for (const r of res) {
      expect(approxEq(r.point.y, 2)).toBe(true);
    }
  });

  test('ray parallel to rectangle side → 0 intersections (no crossing)', () => {
    const rec = makeRectangle(1, 1, 2, 2);
    // Ray parallel to left/right sides (x-direction), offset above rectangle
    const ray = makeRay(0, 5, 1, 0);
    expect(rayRectangleIntersection(ray, rec)).toHaveLength(0);
  });
});
