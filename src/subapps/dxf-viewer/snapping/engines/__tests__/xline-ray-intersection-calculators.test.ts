/**
 * Unit tests for Ray intersection calculators — Phase 6.5.a (ADR-359).
 * Ray: P(t) = basePoint + t * direction, t >= 0 only.
 */

import { rayLineIntersection, rayCircleIntersection, rayArcIntersection } from '../intersection-calculators';
import type { RayEntity, LineEntity, CircleEntity, ArcEntity } from '../../../types/entities';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRay(bx: number, by: number, dx: number, dy: number): RayEntity {
  return { id: 'r1', type: 'ray', basePoint: { x: bx, y: by }, direction: { x: dx, y: dy } } as RayEntity;
}

function makeLine(sx: number, sy: number, ex: number, ey: number): LineEntity {
  return { id: 'l1', type: 'line', start: { x: sx, y: sy }, end: { x: ex, y: ey } } as LineEntity;
}

function makeCircle(cx: number, cy: number, r: number): CircleEntity {
  return { id: 'c1', type: 'circle', center: { x: cx, y: cy }, radius: r } as CircleEntity;
}

function makeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): ArcEntity {
  return { id: 'a1', type: 'arc', center: { x: cx, y: cy }, radius: r, startAngle, endAngle } as ArcEntity;
}

const EPS = 1e-9;

function approxEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

// ─── rayLineIntersection ──────────────────────────────────────────────────────

describe('rayLineIntersection', () => {
  test('ray from (0,0) dir (1,0) × vertical segment (2,-1)→(2,1) → hit at (2,0)', () => {
    const ray = makeRay(0, 0, 1, 0);
    const line = makeLine(2, -1, 2, 1);
    const result = rayLineIntersection(ray, line);
    expect(result).toHaveLength(1);
    expect(approxEq(result[0].point.x, 2)).toBe(true);
    expect(approxEq(result[0].point.y, 0)).toBe(true);
    expect(result[0].type).toBe('Ray-Line');
  });

  test('segment BEHIND ray (x=-2) → [] (t < 0)', () => {
    const ray = makeRay(0, 0, 1, 0);
    const line = makeLine(-2, -1, -2, 1);
    expect(rayLineIntersection(ray, line)).toHaveLength(0);
  });

  test('ray × parallel segment → []', () => {
    const ray = makeRay(0, 0, 1, 0);
    const line = makeLine(0, 1, 3, 1);
    expect(rayLineIntersection(ray, line)).toHaveLength(0);
  });

  test('ray × diagonal segment, intersection in front → 1 point', () => {
    // ray from (0,0) dir (1,1), segment from (0,2) to (2,0) → intersection at (1,1)
    const ray = makeRay(0, 0, 1, 1);
    const line = makeLine(0, 2, 2, 0);
    const result = rayLineIntersection(ray, line);
    expect(result).toHaveLength(1);
    expect(approxEq(result[0].point.x, 1)).toBe(true);
    expect(approxEq(result[0].point.y, 1)).toBe(true);
  });

  test('ray base point exactly on segment (t=0, s in [0,1]) → 1 point', () => {
    // ray from (1,0) dir (1,0), segment from (0,0) to (2,0) — collinear, parallel → []
    // Use crossing case: ray base (1,0), segment (1,-1)→(1,1)
    const ray = makeRay(1, 0, 1, 0);
    const line = makeLine(1, -1, 1, 1);
    const result = rayLineIntersection(ray, line);
    expect(result).toHaveLength(1);
    expect(approxEq(result[0].point.x, 1)).toBe(true);
    expect(approxEq(result[0].point.y, 0)).toBe(true);
  });
});

// ─── rayCircleIntersection ────────────────────────────────────────────────────

describe('rayCircleIntersection', () => {
  test('ray through circle center → 2 points (both t >= 0)', () => {
    // ray from (-3,0) dir (1,0), circle at (0,0) r=1 → hits at (-1,0) and (1,0)
    const ray = makeRay(-3, 0, 1, 0);
    const circle = makeCircle(0, 0, 1);
    const result = rayCircleIntersection(ray, circle);
    expect(result).toHaveLength(2);
    result.forEach(r => expect(r.type).toBe('Ray-Circle'));
    const xs = result.map(r => r.point.x).sort((a, b) => a - b);
    expect(approxEq(xs[0], -1)).toBe(true);
    expect(approxEq(xs[1], 1)).toBe(true);
  });

  test('ray origin inside circle → 1 point (1 positive t, 1 negative filtered)', () => {
    // ray from (0,0) dir (1,0), circle at (0,0) r=2 → t=-2 filtered, t=2 kept
    const ray = makeRay(0, 0, 1, 0);
    const circle = makeCircle(0, 0, 2);
    const result = rayCircleIntersection(ray, circle);
    expect(result).toHaveLength(1);
    expect(approxEq(result[0].point.x, 2)).toBe(true);
  });

  test('ray tangent to circle → 1 point (t > 0)', () => {
    // ray from (-3,1) dir (1,0), circle at (0,0) r=1 → tangent at (0,1)
    const ray = makeRay(-3, 1, 1, 0);
    const circle = makeCircle(0, 0, 1);
    const result = rayCircleIntersection(ray, circle);
    expect(result).toHaveLength(1);
    expect(approxEq(result[0].point.x, 0)).toBe(true);
    expect(approxEq(result[0].point.y, 1)).toBe(true);
  });

  test('ray pointing away from circle → [] (both t < 0)', () => {
    // ray from (5,0) dir (1,0), circle at (0,0) r=1 → both t < 0
    const ray = makeRay(5, 0, 1, 0);
    const circle = makeCircle(0, 0, 1);
    expect(rayCircleIntersection(ray, circle)).toHaveLength(0);
  });

  test('ray from outside, 2 intersections both in front → 2 points', () => {
    // ray from (0,-5) dir (0,1), circle at (0,0) r=2 → hits at (0,-2) and (0,2)
    const ray = makeRay(0, -5, 0, 1);
    const circle = makeCircle(0, 0, 2);
    const result = rayCircleIntersection(ray, circle);
    expect(result).toHaveLength(2);
    const ys = result.map(r => r.point.y).sort((a, b) => a - b);
    expect(approxEq(ys[0], -2)).toBe(true);
    expect(approxEq(ys[1], 2)).toBe(true);
  });
});

// ─── rayArcIntersection ───────────────────────────────────────────────────────

describe('rayArcIntersection', () => {
  test('ray × arc covering both intersections (160→20 wrap-around) → 2 points', () => {
    // ray from (-3,0) dir (1,0) hits at (-1,0)=180° and (1,0)=0°
    // arc 160→20 (wrap-around) contains both 180° and 0°
    const ray = makeRay(-3, 0, 1, 0);
    const arc = makeArc(0, 0, 1, 160, 20);
    const result = rayArcIntersection(ray, arc);
    expect(result).toHaveLength(2);
    result.forEach(r => expect(r.type).toBe('Ray-Arc'));
  });

  test('ray × arc, 1 intersection in angle range → 1 point', () => {
    // arc from 270→90 (right half: contains 0°), ray hits at (-1,0) [180°] and (1,0) [0°]
    // Only 0° is in [270,90] wrap range — 1 result
    const ray = makeRay(-3, 0, 1, 0);
    const arc = makeArc(0, 0, 1, 270, 90);
    const result = rayArcIntersection(ray, arc);
    expect(result).toHaveLength(1);
    expect(approxEq(result[0].point.x, 1)).toBe(true);
    expect(approxEq(result[0].point.y, 0)).toBe(true);
  });

  test('ray × arc, both intersections out of angle range → []', () => {
    // arc from 45→135 (top quarter), ray from (-3,0) dir (1,0) → hits at y=0, not in [45,135]
    const ray = makeRay(-3, 0, 1, 0);
    const arc = makeArc(0, 0, 1, 45, 135);
    expect(rayArcIntersection(ray, arc)).toHaveLength(0);
  });

  test('ray pointing away from arc → [] (t<0 filtered before arc check)', () => {
    // ray from (5,0) dir (1,0) pointing away from circle at (0,0)
    const ray = makeRay(5, 0, 1, 0);
    const arc = makeArc(0, 0, 1, 0, 360);
    expect(rayArcIntersection(ray, arc)).toHaveLength(0);
  });

  test('wrap-around arc (350→10), intersection at 0° in wrapped range → 1 point', () => {
    // arc from 350→10, ray from (-3,0) dir (1,0)
    // Hits at (-1,0)=180° [out of range] and (1,0)=0° [in 350→10 wrap range]
    const ray = makeRay(-3, 0, 1, 0);
    const arc = makeArc(0, 0, 1, 350, 10);
    const result = rayArcIntersection(ray, arc);
    expect(result).toHaveLength(1);
    expect(approxEq(result[0].point.x, 1)).toBe(true);
  });
});
