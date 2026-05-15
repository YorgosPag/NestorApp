import { computeSourceGroupBbox, defaultRectSpacing } from '../array-bbox';
import type { Entity } from '../../../types/entities';

function makeLine(x1: number, y1: number, x2: number, y2: number): Entity {
  return { id: 'l1', type: 'line', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } as Entity;
}

function makeCircle(cx: number, cy: number, r: number): Entity {
  return { id: 'c1', type: 'circle', center: { x: cx, y: cy }, radius: r } as Entity;
}

describe('computeSourceGroupBbox', () => {
  it('empty list returns zero bbox at origin', () => {
    const b = computeSourceGroupBbox([]);
    expect(b.width).toBe(0);
    expect(b.height).toBe(0);
    expect(b.center).toEqual({ x: 0, y: 0 });
  });

  it('single line: correct bounds', () => {
    const b = computeSourceGroupBbox([makeLine(0, 0, 10, 5)]);
    expect(b.minX).toBe(0);
    expect(b.minY).toBe(0);
    expect(b.maxX).toBe(10);
    expect(b.maxY).toBe(5);
    expect(b.width).toBe(10);
    expect(b.height).toBe(5);
    expect(b.center).toEqual({ x: 5, y: 2.5 });
  });

  it('single circle: correct bounds', () => {
    const b = computeSourceGroupBbox([makeCircle(0, 0, 5)]);
    expect(b.minX).toBe(-5);
    expect(b.maxX).toBe(5);
    expect(b.center).toEqual({ x: 0, y: 0 });
  });

  it('multi-source: union of all entity bounds', () => {
    const entities = [
      makeLine(0, 0, 10, 0),   // minX=0, maxX=10, minY=0, maxY=0
      makeCircle(20, 5, 3),    // minX=17, maxX=23, minY=2, maxY=8
    ];
    const b = computeSourceGroupBbox(entities);
    expect(b.minX).toBe(0);
    expect(b.maxX).toBe(23);
    expect(b.minY).toBe(0);
    expect(b.maxY).toBe(8);
    expect(b.width).toBe(23);
    expect(b.height).toBe(8);
    expect(b.center).toEqual({ x: 11.5, y: 4 });
  });

  it('two separate lines: union covers both', () => {
    const entities = [
      makeLine(-10, -5, 0, 0),
      makeLine(5, 5, 15, 10),
    ];
    const b = computeSourceGroupBbox(entities);
    expect(b.minX).toBe(-10);
    expect(b.minY).toBe(-5);
    expect(b.maxX).toBe(15);
    expect(b.maxY).toBe(10);
  });
});

describe('defaultRectSpacing', () => {
  it('returns width×1.5 and height×1.5', () => {
    const bbox = computeSourceGroupBbox([makeLine(0, 0, 10, 20)]);
    const { colSpacing, rowSpacing } = defaultRectSpacing(bbox);
    expect(colSpacing).toBeCloseTo(10 * 1.5);
    expect(rowSpacing).toBeCloseTo(20 * 1.5);
  });

  it('degenerate bbox (0×0): clamps to minimum 1', () => {
    const { colSpacing, rowSpacing } = defaultRectSpacing(computeSourceGroupBbox([]));
    expect(colSpacing).toBeGreaterThanOrEqual(1);
    expect(rowSpacing).toBeGreaterThanOrEqual(1);
  });
});
