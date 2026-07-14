import { expandArrayEntity } from '../array-expander';
import type { ArrayEntity, Entity } from '../../../types/entities';
import type { RectParams, PolarParams, PathParams } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLine(id: string, x1: number, y1: number, x2: number, y2: number): Entity {
  return { id, type: 'line', layer: '0', layerId: 'lyr_test_default', visible: true, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } as Entity;
}

function makeCircle(id: string, cx: number, cy: number, r: number): Entity {
  return { id, type: 'circle', layer: '0', layerId: 'lyr_test_default', visible: true, center: { x: cx, y: cy }, radius: r } as Entity;
}

function makePathArray(id: string, sources: Entity[], overrides: Partial<PathParams> = {}): ArrayEntity {
  const params: PathParams = {
    kind: 'path', count: 3, method: 'divide', alignItems: false, pathEntityId: 'path', reversed: false,
    ...overrides,
  };
  return {
    id, type: 'array', layer: '0', layerId: 'lyr_test_default', visible: true,
    arrayKind: 'path', hiddenSources: sources, params,
  } as ArrayEntity;
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
    layerId: 'lyr_test_default',
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

  it('polar array: 6 items / 360° → 6 items expanded', () => {
    const src = makeLine('src1', 0, 0, 10, 0);
    // source bbox center=(5,0), polar center=(0,0), explicit radius=50
    const polarArr: ArrayEntity = {
      id: 'arr1',
      type: 'array',
      layer: '0',
      layerId: 'lyr_test_default',
      visible: true,
      arrayKind: 'polar',
      hiddenSources: [src],
      params: { kind: 'polar', count: 6, fillAngle: 360, startAngle: 0, rotateItems: false, center: { x: 0, y: 0 }, radius: 50 } as PolarParams,
    } as ArrayEntity;
    expect(expandArrayEntity(polarArr)).toHaveLength(6);
  });

  it('polar array: all items carry parent arrayId', () => {
    const src = makeLine('src1', 0, 0, 10, 0);
    const polarArr: ArrayEntity = {
      id: 'polar-arr',
      type: 'array',
      layer: '0',
      layerId: 'lyr_test_default',
      visible: true,
      arrayKind: 'polar',
      hiddenSources: [src],
      params: { kind: 'polar', count: 4, fillAngle: 360, startAngle: 0, rotateItems: false, center: { x: 0, y: 0 }, radius: 20 } as PolarParams,
    } as ArrayEntity;
    const items = expandArrayEntity(polarArr);
    for (const item of items) {
      expect(item.id).toBe('polar-arr');
    }
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

// ── ADR-353 M1 — path source distribution (group / sequential / random) ─────────

describe('expandArrayEntity — path source distribution', () => {
  const pathLine = makeLine('path', 0, 0, 100, 0);

  it("default ('group'): whole source group stamped at every point (N points × M sources)", () => {
    const s1 = makeLine('s1', 0, 0, 10, 0);
    const s2 = makeCircle('s2', 5, 0, 3);
    const arr = makePathArray('arr', [s1, s2], { count: 3 }); // no sourceDistribution
    const items = expandArrayEntity(arr, pathLine);
    expect(items).toHaveLength(6); // 3 × 2
  });

  it("'sequential': ONE source per point, cycling in order (N items)", () => {
    const s1 = makeLine('s1', 0, 0, 10, 0);
    const s2 = makeCircle('s2', 5, 0, 3);
    const arr = makePathArray('arr', [s1, s2], { count: 4, sourceDistribution: 'sequential' });
    const items = expandArrayEntity(arr, pathLine);
    expect(items).toHaveLength(4);
    // cycle order: s1, s2, s1, s2 → line, circle, line, circle
    expect(items.map(i => i.type)).toEqual(['line', 'circle', 'line', 'circle']);
    for (const item of items) expect(item.id).toBe('arr');
  });

  it("'sequential': picked source's OWN center lands on the sample point", () => {
    // two sources with different centers; group center differs from each → rebase must correct it.
    const s1 = makeLine('s1', 0, 0, 10, 0);   // center (5,0)
    const s2 = makeLine('s2', 0, 10, 10, 10); // center (5,10)
    const arr = makePathArray('arr', [s1, s2], { count: 1, sourceDistribution: 'sequential' });
    const items = expandArrayEntity(arr, pathLine); // single sample at (0,0), picks s1
    expect(items).toHaveLength(1);
    const it = items[0] as Entity & { start: { x: number; y: number }; end: { x: number; y: number } };
    const cx = (it.start.x + it.end.x) / 2;
    const cy = (it.start.y + it.end.y) / 2;
    expect(cx).toBeCloseTo(0, 6); // s1 center placed exactly on sample point (0,0)
    expect(cy).toBeCloseTo(0, 6);
  });

  it("'random': ONE source per point (N items), deterministic for a fixed seed", () => {
    const s1 = makeLine('s1', 0, 0, 10, 0);
    const s2 = makeCircle('s2', 5, 0, 3);
    const mk = () => expandArrayEntity(
      makePathArray('arr', [s1, s2], { count: 6, sourceDistribution: 'random', seed: 55 }),
      pathLine,
    );
    const a = mk();
    const b = mk();
    expect(a).toHaveLength(6);
    expect(a.map(i => i.type)).toEqual(b.map(i => i.type)); // same seed → same picks
  });

  it("'random': different seeds can produce different pick sequences", () => {
    const s1 = makeLine('s1', 0, 0, 10, 0);
    const s2 = makeCircle('s2', 5, 0, 3);
    const pick = (seed: number) => expandArrayEntity(
      makePathArray('arr', [s1, s2], { count: 12, sourceDistribution: 'random', seed }),
      pathLine,
    ).map(i => i.type).join('');
    expect(pick(1)).not.toEqual(pick(999));
  });
});
