import { expandArrayEntity } from '../array-expander';
import type { ArrayEntity, Entity } from '../../../types/entities';
import type { RectParams, PolarParams } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLine(id: string, x1: number, y1: number, x2: number, y2: number): Entity {
  return { id, type: 'line', layer: '0', visible: true, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } as Entity;
}

function makeRectArray(
  id: string,
  rows: number,
  cols: number,
  rowSpacing: number,
  colSpacing: number,
  sources: Entity[],
): ArrayEntity {
  const params: RectParams = { kind: 'rect', rows, cols, rowSpacing, colSpacing, angle: 0 };
  return {
    id,
    type: 'array',
    layer: '0',
    visible: true,
    arrayKind: 'rect',
    hiddenSources: sources,
    params,
  } as ArrayEntity;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('expandArrayEntity', () => {
  it('single source, 2×3 rect → 6 items', () => {
    const src = makeLine('src1', 0, 0, 10, 0);
    const arr = makeRectArray('arr1', 2, 3, 20, 15, [src]);
    const items = expandArrayEntity(arr);
    expect(items).toHaveLength(6); // 2×3 × 1 source
  });

  it('two sources, 2×3 rect → 12 items', () => {
    const s1 = makeLine('s1', 0, 0, 10, 0);
    const s2 = makeLine('s2', 0, 5, 10, 5);
    const arr = makeRectArray('arr1', 2, 3, 20, 15, [s1, s2]);
    const items = expandArrayEntity(arr);
    expect(items).toHaveLength(12); // 2×3 × 2 sources
  });

  it('all items carry parent arrayId as id', () => {
    const src = makeLine('src1', 0, 0, 10, 0);
    const arr = makeRectArray('arr1', 2, 2, 20, 15, [src]);
    const items = expandArrayEntity(arr);
    for (const item of items) {
      expect(item.id).toBe('arr1');
    }
  });

  it('first item (cell 0,0) is at source position', () => {
    // source: line (0,0)→(10,0), bbox center at (5,0)
    // transform[0] = {translateX:0, translateY:0, rotateDeg:0} (identity for cell 0,0)
    const src = makeLine('src1', 0, 0, 10, 0);
    const arr = makeRectArray('arr1', 2, 3, 20, 15, [src]);
    const items = expandArrayEntity(arr);
    const first = items[0] as Entity & { start: { x: number; y: number }; end: { x: number; y: number } };
    expect(first.start).toEqual({ x: 0, y: 0 });
    expect(first.end).toEqual({ x: 10, y: 0 });
  });

  it('second column item (cell 0,1) is offset by colSpacing along x-axis (angle=0)', () => {
    // colDir = (1,0) when angle=0, colSpacing=15 → tx=15
    const src = makeLine('src1', 0, 0, 10, 0);
    const arr = makeRectArray('arr1', 1, 2, 20, 15, [src]);
    const items = expandArrayEntity(arr);
    // items[0]=cell(0,0), items[1]=cell(0,1)
    const second = items[1] as Entity & { start: { x: number; y: number }; end: { x: number; y: number } };
    expect(second.start.x).toBeCloseTo(15);
    expect(second.start.y).toBeCloseTo(0);
    expect(second.end.x).toBeCloseTo(25);
    expect(second.end.y).toBeCloseTo(0);
  });

  it('second row item (cell 1,0) is offset by rowSpacing along y-axis (angle=0)', () => {
    // rowDir = (0,1) when angle=0, rowSpacing=20 → ty=20
    const src = makeLine('src1', 0, 0, 10, 0);
    const arr = makeRectArray('arr1', 2, 1, 20, 15, [src]);
    const items = expandArrayEntity(arr);
    // items[0]=cell(0,0), items[1]=cell(1,0)
    const second = items[1] as Entity & { start: { x: number; y: number }; end: { x: number; y: number } };
    expect(second.start.x).toBeCloseTo(0);
    expect(second.start.y).toBeCloseTo(20);
    expect(second.end.x).toBeCloseTo(10);
    expect(second.end.y).toBeCloseTo(20);
  });

  it('polar array kind returns empty array', () => {
    const src = makeLine('src1', 0, 0, 10, 0);
    const polarArr: ArrayEntity = {
      id: 'arr1',
      type: 'array',
      layer: '0',
      visible: true,
      arrayKind: 'polar',
      hiddenSources: [src],
      params: { kind: 'polar', count: 6, fillAngle: 360, startAngle: 0, rotateItems: true, center: { x: 0, y: 0 }, radius: 50 } as PolarParams,
    } as ArrayEntity;
    expect(expandArrayEntity(polarArr)).toHaveLength(0);
  });

  it('empty hiddenSources → no items', () => {
    const arr = makeRectArray('arr1', 3, 3, 20, 15, []);
    const items = expandArrayEntity(arr);
    expect(items).toHaveLength(0);
  });

  it('1×1 rect → 1 item (identity transform)', () => {
    const src = makeLine('src1', 5, 5, 15, 5);
    const arr = makeRectArray('arr1', 1, 1, 20, 15, [src]);
    const items = expandArrayEntity(arr);
    expect(items).toHaveLength(1);
    const item = items[0] as Entity & { start: { x: number; y: number }; end: { x: number; y: number } };
    expect(item.start).toEqual({ x: 5, y: 5 });
    expect(item.end).toEqual({ x: 15, y: 5 });
  });

  it('item type matches source type', () => {
    const src = makeLine('src1', 0, 0, 10, 0);
    const arr = makeRectArray('arr1', 2, 2, 20, 15, [src]);
    const items = expandArrayEntity(arr);
    for (const item of items) {
      expect(item.type).toBe('line');
    }
  });
});
