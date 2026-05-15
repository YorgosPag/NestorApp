/**
 * Tests for trim-edge-extender (ADR-350 §Test Plan G10).
 *
 * Verifies that extendEdge() produces the correct virtual geometry for each
 * source entity type and preserves the source entity id in all cases.
 */

import { extendEdge } from '../trim-edge-extender';
import type { ArcEntity, EllipseEntity, LineEntity, RayEntity } from '../../../types/entities';

// ── LINE → XLINE ──────────────────────────────────────────────────────────────

describe('extendEdge — LINE', () => {
  const line: LineEntity = { id: 'l1', type: 'line', start: { x: 0, y: 0 }, end: { x: 3, y: 4 }, layer: '0' };

  it('converts LINE to XLINE', () => {
    const result = extendEdge(line);
    expect(result.type).toBe('xline');
  });

  it('preserves source id', () => {
    expect(extendEdge(line).id).toBe('l1');
  });

  it('sets direction equal to line vector', () => {
    const result = extendEdge(line) as { direction: { x: number; y: number } };
    expect(result.direction.x).toBeCloseTo(3);
    expect(result.direction.y).toBeCloseTo(4);
  });

  it('sets basePoint to line start', () => {
    const result = extendEdge(line) as { basePoint: { x: number; y: number } };
    expect(result.basePoint.x).toBeCloseTo(0);
    expect(result.basePoint.y).toBeCloseTo(0);
  });
});

// ── ARC → CIRCLE ─────────────────────────────────────────────────────────────

describe('extendEdge — ARC', () => {
  const arc: ArcEntity = {
    id: 'a1', type: 'arc',
    center: { x: 2, y: 3 }, radius: 5,
    startAngle: 0, endAngle: Math.PI,
    layer: '0',
  };

  it('converts ARC to CIRCLE', () => {
    expect(extendEdge(arc).type).toBe('circle');
  });

  it('preserves id', () => {
    expect(extendEdge(arc).id).toBe('a1');
  });

  it('preserves center and radius', () => {
    const result = extendEdge(arc) as { center: { x: number; y: number }; radius: number };
    expect(result.center.x).toBeCloseTo(2);
    expect(result.center.y).toBeCloseTo(3);
    expect(result.radius).toBeCloseTo(5);
  });
});

// ── ELLIPSE (arc) → full ELLIPSE ──────────────────────────────────────────────

describe('extendEdge — ELLIPSE arc', () => {
  const ellArc: EllipseEntity = {
    id: 'e1', type: 'ellipse',
    center: { x: 0, y: 0 }, majorAxis: 6, minorAxis: 3,
    startParam: 0, endParam: Math.PI,
    layer: '0',
  };

  it('strips startParam/endParam to create full ellipse', () => {
    const result = extendEdge(ellArc) as EllipseEntity;
    expect(result.startParam).toBeUndefined();
    expect(result.endParam).toBeUndefined();
  });

  it('preserves id and geometry', () => {
    const result = extendEdge(ellArc) as EllipseEntity;
    expect(result.id).toBe('e1');
    expect(result.majorAxis).toBeCloseTo(6);
    expect(result.minorAxis).toBeCloseTo(3);
  });
});

// ── ELLIPSE (full) → unchanged ────────────────────────────────────────────────

describe('extendEdge — full ELLIPSE (no arc params)', () => {
  const ell: EllipseEntity = {
    id: 'e2', type: 'ellipse',
    center: { x: 0, y: 0 }, majorAxis: 4, minorAxis: 2,
    layer: '0',
  };

  it('returns the same entity when already full ellipse', () => {
    expect(extendEdge(ell)).toBe(ell);
  });
});

// ── RAY → XLINE ───────────────────────────────────────────────────────────────

describe('extendEdge — RAY', () => {
  const ray: RayEntity = {
    id: 'r1', type: 'ray',
    basePoint: { x: 1, y: 2 }, direction: { x: 1, y: 0 },
    layer: '0',
  };

  it('converts RAY to XLINE', () => {
    expect(extendEdge(ray).type).toBe('xline');
  });

  it('preserves id, basePoint and direction', () => {
    const result = extendEdge(ray) as { id: string; basePoint: { x: number }; direction: { x: number } };
    expect(result.id).toBe('r1');
    expect(result.basePoint.x).toBeCloseTo(1);
    expect(result.direction.x).toBeCloseTo(1);
  });
});

// ── CIRCLE / POLYLINE → unchanged ────────────────────────────────────────────

describe('extendEdge — passthrough types', () => {
  it('CIRCLE passes through unchanged', () => {
    const circle = { id: 'c1', type: 'circle' as const, center: { x: 0, y: 0 }, radius: 3, layer: '0' };
    expect(extendEdge(circle)).toBe(circle);
  });

  it('POLYLINE passes through unchanged', () => {
    const poly = { id: 'p1', type: 'polyline' as const, vertices: [], closed: false, layer: '0' };
    expect(extendEdge(poly)).toBe(poly);
  });
});
