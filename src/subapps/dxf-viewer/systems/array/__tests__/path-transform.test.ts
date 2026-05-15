import { computePathTransforms } from '../path-transform';
import type { PathParams, SourceBbox } from '../types';
import type { Entity, LineEntity, CircleEntity } from '../../../types/entities';

// ── Helpers ───────────────────────────────────────────────────────────────────

function line(x1: number, y1: number, x2: number, y2: number): LineEntity {
  return { id: 'l', type: 'line', name: 'l', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } } as LineEntity;
}

function circle(cx: number, cy: number, r: number): CircleEntity {
  return { id: 'c', type: 'circle', name: 'c', center: { x: cx, y: cy }, radius: r } as CircleEntity;
}

const ZERO_BBOX: SourceBbox = {
  minX: -5, minY: -5, maxX: 5, maxY: 5,
  width: 10, height: 10,
  center: { x: 0, y: 0 },
};

function pathParams(overrides: Partial<PathParams> = {}): PathParams {
  return {
    kind: 'path',
    count: 3,
    method: 'divide',
    alignItems: false,
    pathEntityId: 'l',
    reversed: false,
    ...overrides,
  };
}

const PI = Math.PI;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computePathTransforms — divide, open path', () => {
  const pathLine = line(0, 0, 100, 0);

  it('count=5: produces 5 transforms equidistant on [0,1]', () => {
    const result = computePathTransforms(pathParams({ count: 5 }), ZERO_BBOX, pathLine as Entity);
    expect(result).toHaveLength(5);
    expect(result[0].translateX).toBeCloseTo(0);
    expect(result[1].translateX).toBeCloseTo(25);
    expect(result[2].translateX).toBeCloseTo(50);
    expect(result[3].translateX).toBeCloseTo(75);
    expect(result[4].translateX).toBeCloseTo(100);
  });

  it('count=1: single transform at start', () => {
    const result = computePathTransforms(pathParams({ count: 1 }), ZERO_BBOX, pathLine as Entity);
    expect(result).toHaveLength(1);
    expect(result[0].translateX).toBeCloseTo(0);
  });

  it('count=2: transforms at 0 and end', () => {
    const result = computePathTransforms(pathParams({ count: 2 }), ZERO_BBOX, pathLine as Entity);
    expect(result).toHaveLength(2);
    expect(result[0].translateX).toBeCloseTo(0);
    expect(result[1].translateX).toBeCloseTo(100);
  });
});

describe('computePathTransforms — divide, closed path (circle)', () => {
  const pathCircle = circle(0, 0, 1);

  it('count=4: 4 transforms, no endpoint duplicate', () => {
    const result = computePathTransforms(pathParams({ count: 4 }), ZERO_BBOX, pathCircle as Entity);
    expect(result).toHaveLength(4);
  });

  it('count=4: items ~90° apart on circle r=1', () => {
    const result = computePathTransforms(pathParams({ count: 4 }), ZERO_BBOX, pathCircle as Entity);
    // u=0 → (1,0), u=0.25 → (0,1), u=0.5 → (-1,0), u=0.75 → (0,-1)
    expect(result[0].translateX).toBeCloseTo(1, 1);
    expect(result[0].translateY).toBeCloseTo(0, 1);
    expect(result[1].translateX).toBeCloseTo(0, 1);
    expect(result[1].translateY).toBeCloseTo(1, 1);
    expect(result[2].translateX).toBeCloseTo(-1, 1);
    expect(result[2].translateY).toBeCloseTo(0, 1);
  });
});

describe('computePathTransforms — measure', () => {
  const pathLine = line(0, 0, 20, 0);

  it('spacing=5, line=20: 4 items at 0,5,10,15 (omit 20)', () => {
    const result = computePathTransforms(
      pathParams({ method: 'measure', spacing: 5, count: 99 }),
      ZERO_BBOX,
      pathLine as Entity,
    );
    expect(result).toHaveLength(4);
    expect(result[0].translateX).toBeCloseTo(0);
    expect(result[1].translateX).toBeCloseTo(5);
    expect(result[2].translateX).toBeCloseTo(10);
    expect(result[3].translateX).toBeCloseTo(15);
  });

  it('spacing > totalLength: only 1 item at start', () => {
    const result = computePathTransforms(
      pathParams({ method: 'measure', spacing: 25, count: 99 }),
      ZERO_BBOX,
      pathLine as Entity,
    );
    expect(result).toHaveLength(1);
    expect(result[0].translateX).toBeCloseTo(0);
  });
});

describe('computePathTransforms — alignItems', () => {
  const pathLine = line(0, 0, 100, 0);

  it('alignItems=false: all rotateDeg = 0', () => {
    const result = computePathTransforms(pathParams({ count: 3, alignItems: false }), ZERO_BBOX, pathLine as Entity);
    for (const t of result) expect(t.rotateDeg).toBe(0);
  });

  it('alignItems=true: rotateDeg follows tangent (0° for horizontal line)', () => {
    const result = computePathTransforms(pathParams({ count: 3, alignItems: true }), ZERO_BBOX, pathLine as Entity);
    for (const t of result) expect(t.rotateDeg).toBeCloseTo(0, 5);
  });

  it('alignItems=true on 45° diagonal: rotateDeg ≈ 45°', () => {
    const diagLine = line(0, 0, 100, 100) as Entity;
    const result = computePathTransforms(pathParams({ count: 3, alignItems: true }), ZERO_BBOX, diagLine);
    for (const t of result) expect(t.rotateDeg).toBeCloseTo(45, 1);
  });
});

describe('computePathTransforms — reversed', () => {
  const pathLine = line(0, 0, 100, 0);

  it('reversed=true: items ordered end→start', () => {
    const fwd = computePathTransforms(pathParams({ count: 3 }), ZERO_BBOX, pathLine as Entity);
    const rev = computePathTransforms(pathParams({ count: 3, reversed: true }), ZERO_BBOX, pathLine as Entity);
    expect(fwd[0].translateX).toBeCloseTo(rev[2].translateX, 1);
    expect(fwd[2].translateX).toBeCloseTo(rev[0].translateX, 1);
  });
});

describe('computePathTransforms — edge cases', () => {
  it('count=0: empty result', () => {
    const result = computePathTransforms(
      pathParams({ count: 0 }),
      ZERO_BBOX,
      line(0, 0, 100, 0) as Entity,
    );
    expect(result).toHaveLength(0);
  });

  it('unsupported path entity type: empty result', () => {
    const text = { id: 't', type: 'text', name: 't' } as unknown as Entity;
    const result = computePathTransforms(pathParams({ count: 3 }), ZERO_BBOX, text);
    expect(result).toHaveLength(0);
  });

  it('degenerate line (length=0): empty result', () => {
    const result = computePathTransforms(
      pathParams({ count: 3 }),
      ZERO_BBOX,
      line(5, 5, 5, 5) as Entity,
    );
    expect(result).toHaveLength(0);
  });

  it('translateX/Y offset by sourceBbox.center', () => {
    const bbox: SourceBbox = { ...ZERO_BBOX, center: { x: 10, y: 20 } };
    const result = computePathTransforms(
      pathParams({ count: 2 }),
      bbox,
      line(0, 0, 100, 0) as Entity,
    );
    // First item: pos=(0,0), center=(10,20) → translateX=-10, translateY=-20
    expect(result[0].translateX).toBeCloseTo(-10);
    expect(result[0].translateY).toBeCloseTo(-20);
    // Last item: pos=(100,0), center=(10,20) → translateX=90, translateY=-20
    expect(result[1].translateX).toBeCloseTo(90);
    expect(result[1].translateY).toBeCloseTo(-20);
  });

  it('vertical line: tangent ≈ 90° when alignItems=true', () => {
    const vLine = line(0, 0, 0, 100) as Entity;
    const result = computePathTransforms(
      pathParams({ count: 3, alignItems: true }),
      ZERO_BBOX,
      vLine,
    );
    for (const t of result) expect(t.rotateDeg).toBeCloseTo(90, 1);
  });
});

// ── π ────────────────────────────────────────────────────────────────────────
void PI; // keep import
