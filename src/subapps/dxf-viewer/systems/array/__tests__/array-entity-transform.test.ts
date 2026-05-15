import { applyTransformToEntity } from '../array-entity-transform';
import type { Entity } from '../../../types/entities';
import type { ItemTransform } from '../types';
import type { Point2D } from '../../../rendering/types/Types';

const PIVOT: Point2D = { x: 0, y: 0 };
const NO_ROTATE: ItemTransform = { translateX: 0, translateY: 0, rotateDeg: 0 };
const TRANSLATE_10: ItemTransform = { translateX: 10, translateY: 5, rotateDeg: 0 };
const ROTATE_90: ItemTransform = { translateX: 0, translateY: 0, rotateDeg: 90 };

function translate(t: ItemTransform): Entity {
  return t as unknown as Entity; // cast just for test helpers
}

// ── LINE ─────────────────────────────────────────────────────────────────────

describe('line', () => {
  const line: Entity = { id: 'l1', type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } as Entity;

  it('translation only: shifts start+end', () => {
    const result = applyTransformToEntity(line, TRANSLATE_10, PIVOT) as Extract<Entity, { type: 'line' }>;
    expect(result.type).toBe('line');
    expect(result.start).toEqual({ x: 10, y: 5 });
    expect(result.end).toEqual({ x: 20, y: 5 });
  });

  it('preserves other fields (id, layer)', () => {
    const withLayer = { ...line, layer: 'Layer0' } as Entity;
    const result = applyTransformToEntity(withLayer, NO_ROTATE, PIVOT);
    expect((result as Extract<Entity, { type: 'line' }>).layer).toBe('Layer0');
    expect(result.id).toBe('l1');
  });

  it('zero transform = identity clone', () => {
    const result = applyTransformToEntity(line, NO_ROTATE, PIVOT) as Extract<Entity, { type: 'line' }>;
    expect(result.start).toEqual(line.start);
    expect(result.end).toEqual(line.end);
  });
});

// ── CIRCLE ────────────────────────────────────────────────────────────────────

describe('circle', () => {
  const circle: Entity = { id: 'c1', type: 'circle', center: { x: 5, y: 5 }, radius: 3 } as Entity;

  it('translation moves center, preserves radius', () => {
    const result = applyTransformToEntity(circle, TRANSLATE_10, PIVOT) as Extract<Entity, { type: 'circle' }>;
    expect(result.center).toEqual({ x: 15, y: 10 });
    expect(result.radius).toBe(3);
  });
});

// ── ARC ───────────────────────────────────────────────────────────────────────

describe('arc', () => {
  const arc: Entity = {
    id: 'a1', type: 'arc',
    center: { x: 0, y: 0 }, radius: 5,
    startAngle: 0, endAngle: 90,
  } as Entity;

  it('translation moves center', () => {
    const result = applyTransformToEntity(arc, TRANSLATE_10, PIVOT) as Extract<Entity, { type: 'arc' }>;
    expect(result.center).toEqual({ x: 10, y: 5 });
  });

  it('rotation shifts startAngle and endAngle', () => {
    const result = applyTransformToEntity(arc, ROTATE_90, PIVOT) as Extract<Entity, { type: 'arc' }>;
    expect(result.startAngle).toBeCloseTo(90);
    expect(result.endAngle).toBeCloseTo(180);
  });
});

// ── POLYLINE ──────────────────────────────────────────────────────────────────

describe('polyline', () => {
  const poly: Entity = {
    id: 'p1', type: 'polyline',
    vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
  } as Entity;

  it('translates all vertices', () => {
    const result = applyTransformToEntity(poly, TRANSLATE_10, PIVOT) as Extract<Entity, { type: 'polyline' }>;
    expect(result.vertices[0]).toEqual({ x: 10, y: 5 });
    expect(result.vertices[1]).toEqual({ x: 20, y: 5 });
    expect(result.vertices[2]).toEqual({ x: 20, y: 15 });
  });
});

// ── TEXT ──────────────────────────────────────────────────────────────────────

describe('text', () => {
  const text: Entity = {
    id: 't1', type: 'text',
    position: { x: 0, y: 0 }, text: 'Hello', fontSize: 12,
  } as Entity;

  it('translates position', () => {
    const result = applyTransformToEntity(text, TRANSLATE_10, PIVOT) as Extract<Entity, { type: 'text' }>;
    expect(result.position).toEqual({ x: 10, y: 5 });
    expect(result.text).toBe('Hello');
  });

  it('accumulates rotation', () => {
    const result = applyTransformToEntity(text, ROTATE_90, PIVOT) as Extract<Entity, { type: 'text' }>;
    expect(result.rotation).toBeCloseTo(90);
  });
});

// ── HATCH ─────────────────────────────────────────────────────────────────────

describe('hatch', () => {
  const hatch: Entity = {
    id: 'h1', type: 'hatch',
    boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
  } as Entity;

  it('translates all boundary paths', () => {
    const result = applyTransformToEntity(hatch, TRANSLATE_10, PIVOT) as Extract<Entity, { type: 'hatch' }>;
    expect(result.boundaryPaths[0][0]).toEqual({ x: 10, y: 5 });
    expect(result.boundaryPaths[0][2]).toEqual({ x: 20, y: 15 });
  });
});

// ── ELLIPSE ───────────────────────────────────────────────────────────────────

describe('ellipse', () => {
  const ellipse: Entity = {
    id: 'e1', type: 'ellipse',
    center: { x: 5, y: 5 }, majorAxis: 8, minorAxis: 4, rotation: 0,
  } as Entity;

  it('translates center', () => {
    const result = applyTransformToEntity(ellipse, TRANSLATE_10, PIVOT) as Extract<Entity, { type: 'ellipse' }>;
    expect(result.center).toEqual({ x: 15, y: 10 });
    expect(result.majorAxis).toBe(8);
  });
});

// ── SPLINE ────────────────────────────────────────────────────────────────────

describe('spline', () => {
  const spline: Entity = {
    id: 's1', type: 'spline',
    controlPoints: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 }],
  } as Entity;

  it('translates control points', () => {
    const result = applyTransformToEntity(spline, TRANSLATE_10, PIVOT) as Extract<Entity, { type: 'spline' }>;
    expect(result.controlPoints[0]).toEqual({ x: 10, y: 5 });
    expect(result.controlPoints[2]).toEqual({ x: 20, y: 5 });
  });
});

// ── DIMENSION ────────────────────────────────────────────────────────────────

describe('dimension', () => {
  const dim: Entity = {
    id: 'd1', type: 'dimension',
    startPoint: { x: 0, y: 0 }, endPoint: { x: 10, y: 0 }, textPosition: { x: 5, y: 2 }, value: 10,
  } as Entity;

  it('translates all three points', () => {
    const result = applyTransformToEntity(dim, TRANSLATE_10, PIVOT) as Extract<Entity, { type: 'dimension' }>;
    expect(result.startPoint).toEqual({ x: 10, y: 5 });
    expect(result.endPoint).toEqual({ x: 20, y: 5 });
    expect(result.textPosition).toEqual({ x: 15, y: 7 });
  });
});

// ── LEADER ────────────────────────────────────────────────────────────────────

describe('leader', () => {
  const leader: Entity = {
    id: 'ld1', type: 'leader',
    vertices: [{ x: 0, y: 0 }, { x: 5, y: 5 }],
  } as Entity;

  it('translates vertices', () => {
    const result = applyTransformToEntity(leader, TRANSLATE_10, PIVOT) as Extract<Entity, { type: 'leader' }>;
    expect(result.vertices[0]).toEqual({ x: 10, y: 5 });
    expect(result.vertices[1]).toEqual({ x: 15, y: 10 });
  });
});
