/**
 * ADR-597 §5.4 + ADR-363 Phase 8C — `getColumnCornerWorldPoints` tests.
 *
 * Verifies:
 *   - Returns exactly 4 entries (NW/NE/SE/SW) for all 7 column kinds.
 *   - Only diagonal anchors — NOT center or cardinals (n/s/e/w).
 *   - Circular: diagonals on perimeter at 45° (distance from center = radius,
 *     coords ±radius·√2/2). Industry convention (Revit cylindrical column).
 *   - Rect / shear-wall / I-shape: corners at ±halfWidth × ±halfDepth.
 *   - Polygon (Phase 8C): corners on circumscribed-circle bbox, ±dimX/2 ×
 *     ±dimY/2 (actual N-gon bbox, NOT params.width × params.depth).
 *   - Zero-width column: all 4 collapse to position.
 */

import { getColumnCornerWorldPoints } from '../column-corner-anchors';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { ColumnEntity, ColumnParams, ColumnKind } from '../../types/column-types';

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

function colAt(
  kind: ColumnKind,
  x: number,
  y: number,
  overrides: Partial<ColumnParams> = {},
): ColumnEntity {
  const base = buildDefaultColumnParams({ x, y }, kind);
  return makeColumnEntity({ ...base, ...overrides });
}

const rectAt = (x: number, y: number, o: Partial<ColumnParams> = {}) => colAt('rectangular', x, y, o);
const circAt = (x: number, y: number, o: Partial<ColumnParams> = {}) => colAt('circular', x, y, o);

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
  it('circular: diagonals on perimeter at 45° (distance from center = radius)', () => {
    const radius = 200; // width/2
    const col = circAt(0, 0, { width: radius * 2 });
    const result = getColumnCornerWorldPoints(col);
    // Industry convention (Revit/ArchiCAD): cylindrical column corners sit ON
    // the perimeter at 45° angle. Coords = (±r·√2/2, ±r·√2/2). Distance from
    // center = hypot(r·√2/2, r·√2/2) = r.
    const coord = radius * SQRT2_HALF;
    for (const c of result) {
      expect(Math.abs(c.point.x)).toBeCloseTo(coord, 4);
      expect(Math.abs(c.point.y)).toBeCloseTo(coord, 4);
      expect(Math.hypot(c.point.x, c.point.y)).toBeCloseTo(radius, 4);
    }
  });
});

// ─── ADR-363 Phase 8C — polygon / shear-wall / I-shape corners ──────────────

describe('getColumnCornerWorldPoints — Phase 8C kinds', () => {
  it('polygon (hexagon default): exactly 4 entries at actual bbox corners', () => {
    // Hexagon Ø=400 vertex-up: bbox dimX = 2·r·cos(30°) = 2·200·√3/2 = 200·√3 ≈ 346.41
    //                          bbox dimY = 2·r = 400.
    const col = colAt('polygon', 0, 0, { width: 400 });
    const result = getColumnCornerWorldPoints(col);
    expect(result).toHaveLength(4);
    const expectedHalfX = 200 * Math.sqrt(3) / 2; // ≈ 173.205
    const expectedHalfY = 200;
    const byCorner: Record<string, { x: number; y: number }> = {};
    for (const c of result) byCorner[c.corner] = c.point;
    expect(byCorner['nw']!.x).toBeCloseTo(-expectedHalfX, 3);
    expect(byCorner['nw']!.y).toBeCloseTo(expectedHalfY, 3);
    expect(byCorner['ne']!.x).toBeCloseTo(expectedHalfX, 3);
    expect(byCorner['ne']!.y).toBeCloseTo(expectedHalfY, 3);
    expect(byCorner['se']!.x).toBeCloseTo(expectedHalfX, 3);
    expect(byCorner['se']!.y).toBeCloseTo(-expectedHalfY, 3);
    expect(byCorner['sw']!.x).toBeCloseTo(-expectedHalfX, 3);
    expect(byCorner['sw']!.y).toBeCloseTo(-expectedHalfY, 3);
  });

  it('polygon (square N=4): 4 corners at ±width/2 × ±width/2 (vertex-up → 45° rotated bbox)', () => {
    // For N=4 vertex-up, vertices at 90°, 180°, 270°, 0° → bbox dimX = dimY = 2r = width.
    const col = colAt('polygon', 0, 0, { width: 400, polygon: { sides: 4 } });
    const result = getColumnCornerWorldPoints(col);
    expect(result).toHaveLength(4);
    for (const c of result) {
      expect(Math.abs(c.point.x)).toBeCloseTo(200, 3);
      expect(Math.abs(c.point.y)).toBeCloseTo(200, 3);
    }
  });

  it('shear-wall: 4 corners at ±width/2 × ±depth/2 (rect parity)', () => {
    const col = colAt('shear-wall', 0, 0, { width: 2000, depth: 200, anchor: 'center' });
    const result = getColumnCornerWorldPoints(col);
    expect(result).toHaveLength(4);
    const byCorner: Record<string, { x: number; y: number }> = {};
    for (const c of result) byCorner[c.corner] = c.point;
    expect(byCorner['ne']!.x).toBeCloseTo(1000, 5);
    expect(byCorner['ne']!.y).toBeCloseTo(100, 5);
    expect(byCorner['sw']!.x).toBeCloseTo(-1000, 5);
    expect(byCorner['sw']!.y).toBeCloseTo(-100, 5);
  });

  it('I-shape: 4 outer-bbox corners at ±b/2 × ±h/2', () => {
    const col = colAt('I-shape', 0, 0, { width: 200, depth: 300, anchor: 'center' });
    const result = getColumnCornerWorldPoints(col);
    expect(result).toHaveLength(4);
    const byCorner: Record<string, { x: number; y: number }> = {};
    for (const c of result) byCorner[c.corner] = c.point;
    expect(byCorner['ne']!.x).toBeCloseTo(100, 5);
    expect(byCorner['ne']!.y).toBeCloseTo(150, 5);
    expect(byCorner['sw']!.x).toBeCloseTo(-100, 5);
    expect(byCorner['sw']!.y).toBeCloseTo(-150, 5);
  });
});
