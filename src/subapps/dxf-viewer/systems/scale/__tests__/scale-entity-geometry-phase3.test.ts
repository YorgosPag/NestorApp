/**
 * Unit tests — ADR-646 Φ3 geometric correctness of the scale transform:
 *   #4 arc → elliptical arc on non-uniform scale (EllipseEntity + startParam/endParam)
 *   #5 rotated rectangle → parallelogram polyline on non-uniform scale
 * All exercised through the `scaleEntity` SSoT dispatch.
 */
import { scaleEntity } from '../scale-entity-transform';
import type { Entity } from '../../../types/entities';

const BASE = { x: 0, y: 0 };
const asEntity = (o: object): Entity => o as unknown as Entity;
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;

describe('scaleEntity #4 — arc → elliptical arc (ADR-646 Φ3)', () => {
  it('uniform scale keeps a circular ARC (radius · |s|, no type change)', () => {
    const r = scaleEntity(
      asEntity({ type: 'arc', center: { x: 2, y: 2 }, radius: 10, startAngle: 0, endAngle: 90 }),
      BASE, 2, 2,
    ) as { center: { x: number; y: number }; radius: number; type?: string };
    expect(r.type).toBeUndefined();
    expect(r.center).toEqual({ x: 4, y: 4 });
    expect(r.radius).toBe(20);
  });

  it('non-uniform (sx>sy, no swap) → axis-aligned ellipse, params = angles', () => {
    const r = scaleEntity(
      asEntity({ type: 'arc', center: { x: 0, y: 0 }, radius: 10, startAngle: 0, endAngle: 90 }),
      BASE, 2, 1,
    ) as { type: string; majorAxis: number; minorAxis: number; rotation: number; startParam: number; endParam: number };
    expect(r.type).toBe('ellipse');
    expect(r.majorAxis).toBe(20); // r·|sx|
    expect(r.minorAxis).toBe(10); // r·|sy|
    expect(r.rotation).toBe(0);
    expect(r.startParam).toBeCloseTo(0, 6);
    expect(r.endParam).toBeCloseTo(HALF_PI, 6);
  });

  it('non-uniform (sy>sx → swap, rotation 90) → params shift so the visible sweep is preserved', () => {
    const r = scaleEntity(
      asEntity({ type: 'arc', center: { x: 0, y: 0 }, radius: 10, startAngle: 0, endAngle: 90 }),
      BASE, 1, 3,
    ) as { type: string; majorAxis: number; minorAxis: number; rotation: number; startParam: number; endParam: number };
    expect(r.type).toBe('ellipse');
    expect(r.majorAxis).toBe(30); // r·|sy| (longer axis)
    expect(r.minorAxis).toBe(10); // r·|sx|
    expect(r.rotation).toBe(90);
    // Scaled quarter-arc (r,0)→(0,3r): on the rotation-90 ellipse that is param 3π/2 → 2π.
    expect(r.startParam).toBeCloseTo(3 * HALF_PI, 6);
    expect(r.endParam).toBeCloseTo(TWO_PI, 6);
  });

  it('the emitted endpoints land on the true scaled arc endpoints', () => {
    // Arc from (10,0) to (0,10); scale ×(2,1) → endpoints (20,0) and (0,10).
    const r = scaleEntity(
      asEntity({ type: 'arc', center: { x: 0, y: 0 }, radius: 10, startAngle: 0, endAngle: 90 }),
      BASE, 2, 1,
    ) as { center: { x: number; y: number }; majorAxis: number; minorAxis: number; rotation: number; startParam: number; endParam: number };
    // point(t) = center + R(rot)·(major cos t, minor sin t); rotation 0 here.
    const pt = (t: number) => ({ x: r.center.x + r.majorAxis * Math.cos(t), y: r.center.y + r.minorAxis * Math.sin(t) });
    const start = pt(r.startParam);
    const end = pt(r.endParam);
    expect(start.x).toBeCloseTo(20, 6);
    expect(start.y).toBeCloseTo(0, 6);
    expect(end.x).toBeCloseTo(0, 6);
    expect(end.y).toBeCloseTo(10, 6);
  });
});

describe('scaleEntity #5 — rotated rectangle → parallelogram polyline (ADR-646 Φ3)', () => {
  it('unrotated non-uniform → stays a rect (w·|sx|, h·|sy|)', () => {
    const r = scaleEntity(
      asEntity({ type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }),
      BASE, 2, 3,
    ) as { x: number; y: number; width: number; height: number; type?: string };
    expect(r.type).toBeUndefined();
    expect(r.width).toBe(20);
    expect(r.height).toBe(30);
  });

  it('rotated + non-uniform → closed polyline of 4 scaled corners', () => {
    const r = scaleEntity(
      asEntity({ type: 'rectangle', x: 0, y: 0, width: 10, height: 10, rotation: 90 }),
      BASE, 2, 1,
    ) as { type: string; closed: boolean; vertices: Array<{ x: number; y: number }> };
    expect(r.type).toBe('polyline');
    expect(r.closed).toBe(true);
    expect(r.vertices).toHaveLength(4);
    // 90°-rotated unit square corners [{0,0},{0,10},{-10,10},{-10,0}] scaled ×(2,1).
    expect(r.vertices[0].x).toBeCloseTo(0, 6);
    expect(r.vertices[0].y).toBeCloseTo(0, 6);
    expect(r.vertices[1].x).toBeCloseTo(0, 6);
    expect(r.vertices[1].y).toBeCloseTo(10, 6);
    expect(r.vertices[2].x).toBeCloseTo(-20, 6);
    expect(r.vertices[2].y).toBeCloseTo(10, 6);
    expect(r.vertices[3].x).toBeCloseTo(-20, 6);
    expect(r.vertices[3].y).toBeCloseTo(0, 6);
  });

  it('rotated + UNIFORM → stays a rect (uniform scale preserves the rectangle)', () => {
    const r = scaleEntity(
      asEntity({ type: 'rectangle', x: 0, y: 0, width: 10, height: 10, rotation: 90 }),
      BASE, 2, 2,
    ) as { width: number; height: number; type?: string; vertices?: unknown };
    expect(r.type).toBeUndefined();
    expect(r.vertices).toBeUndefined();
    expect(r.width).toBe(20);
    expect(r.height).toBe(20);
  });
});
