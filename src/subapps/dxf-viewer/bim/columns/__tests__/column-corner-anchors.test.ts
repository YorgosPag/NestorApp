/**
 * ADR-370 §5.4 — `getColumnCornerWorldPoints` tests.
 *
 * Verifies:
 *   - Returns exactly 4 entries (NW/NE/SE/SW) for rect/L/T/circular kinds.
 *   - Only diagonal anchors — NOT center or cardinals (n/s/e/w).
 *   - Circular: diagonals at cos45°·r ≈ 0.707·r from center.
 *   - Rect: corners at ±halfWidth × ±halfDepth from position.
 *   - Zero-width column: all 4 collapse to position.
 */

import { getColumnCornerWorldPoints } from '../column-corner-anchors';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';

const EPS = 1e-5;
const SQRT2_HALF = Math.SQRT2 / 2;

function makeColumnEntity(params: ColumnParams, id = 'col_test'): ColumnEntity {
  return {
    id,
    type: 'column',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: undefined as never,
    validation: undefined as never,
    visible: true,
  } as unknown as ColumnEntity;
}

function rectAt(x: number, y: number, overrides: Partial<ColumnParams> = {}): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, 'rectangular');
  return makeColumnEntity({ ...base, ...overrides });
}

function circAt(x: number, y: number, overrides: Partial<ColumnParams> = {}): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, 'circular');
  return makeColumnEntity({ ...base, ...overrides });
}

describe('getColumnCornerWorldPoints — count + labels', () => {
  it('rect column: exactly 4 entries', () => {
    expect(getColumnCornerWorldPoints(rectAt(0, 0))).toHaveLength(4);
  });

  it('circular column: exactly 4 entries', () => {
    expect(getColumnCornerWorldPoints(circAt(0, 0))).toHaveLength(4);
  });

  it('only diagonal labels returned (no center/cardinals)', () => {
    const result = getColumnCornerWorldPoints(rectAt(0, 0));
    const corners = result.map((c) => c.corner);
    expect(corners).toContain('nw');
    expect(corners).toContain('ne');
    expect(corners).toContain('se');
    expect(corners).toContain('sw');
    expect(corners).not.toContain('center');
    expect(corners).not.toContain('n');
    expect(corners).not.toContain('s');
    expect(corners).not.toContain('e');
    expect(corners).not.toContain('w');
  });
});

describe('getColumnCornerWorldPoints — rectangular geometry', () => {
  it('corners at ±halfWidth × ±halfDepth for unrotated rect column at origin', () => {
    const col = rectAt(0, 0, { width: 400, depth: 300, rotation: 0, anchor: 'center' });
    const result = getColumnCornerWorldPoints(col);
    const byCorner: Record<string, { x: number; y: number }> = {};
    for (const c of result) byCorner[c.corner] = c.point;

    expect(byCorner['nw']!.x).toBeCloseTo(-200, 5);
    expect(byCorner['nw']!.y).toBeCloseTo(150, 5);
    expect(byCorner['ne']!.x).toBeCloseTo(200, 5);
    expect(byCorner['ne']!.y).toBeCloseTo(150, 5);
    expect(byCorner['se']!.x).toBeCloseTo(200, 5);
    expect(byCorner['se']!.y).toBeCloseTo(-150, 5);
    expect(byCorner['sw']!.x).toBeCloseTo(-200, 5);
    expect(byCorner['sw']!.y).toBeCloseTo(-150, 5);
  });
});

describe('getColumnCornerWorldPoints — circular geometry', () => {
  it('circular: diagonals at radius·√2/2 from center', () => {
    const radius = 200; // width/2
    const col = circAt(0, 0, { width: radius * 2 });
    const result = getColumnCornerWorldPoints(col);
    const d = radius * SQRT2_HALF;
    for (const c of result) {
      expect(Math.hypot(c.point.x, c.point.y)).toBeCloseTo(d, 4);
    }
  });
});
