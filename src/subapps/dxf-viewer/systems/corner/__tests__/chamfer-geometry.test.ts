/**
 * Tests for the CHAMFER geometry (ADR-510 Φ4f) — bevel connector, distance & angle
 * modes, two-lines trim, and the polyline bevel-every-corner variant.
 */

import { resolveCornerAnchors } from '../corner-math';
import {
  resolveChamferDistances,
  computeChamferTwoLines,
  computeChamferPolyline,
  computeChamferPolylineCorner,
} from '../chamfer-geometry';
import type { LineEntity, PolylineEntity } from '../../../types/entities';

function line(id: string, sx: number, sy: number, ex: number, ey: number): LineEntity {
  return { id, type: 'line', layerId: 'lyr_test', start: { x: sx, y: sy }, end: { x: ex, y: ey } };
}

function polyline(vertices: Array<[number, number]>, closed: boolean, bulges?: number[]): PolylineEntity {
  return {
    id: 'p1', type: 'polyline', layerId: 'lyr_test',
    vertices: vertices.map(([x, y]) => ({ x, y })), closed, ...(bulges ? { bulges } : {}),
  };
}

const rightAngle = () =>
  resolveCornerAnchors(
    line('l1', 0, 0, 100, 0), { x: 50, y: 0 },
    line('l2', 0, 0, 0, 100), { x: 0, y: 50 },
  )!;

describe('resolveChamferDistances', () => {
  it('returns the two distances unchanged in distance mode', () => {
    expect(resolveChamferDistances(rightAngle(), 30, 10, 0, 'distance')).toEqual({ d1: 30, d2: 10 });
  });

  it('angle mode: 45° on a 90° corner is symmetric (d2 = d1)', () => {
    const r = resolveChamferDistances(rightAngle(), 20, 0, 45, 'angle');
    expect(r).not.toBeNull();
    expect(r!.d1).toBe(20);
    expect(r!.d2).toBeCloseTo(20);
  });

  it('angle mode: d2 = d1·sin(α)/sin(θ+α)', () => {
    const r = resolveChamferDistances(rightAngle(), 20, 0, 30, 'angle');
    expect(r).not.toBeNull();
    expect(r!.d2).toBeCloseTo((20 * Math.sin(Math.PI / 6)) / Math.sin(Math.PI / 2 + Math.PI / 6));
  });
});

describe('computeChamferTwoLines', () => {
  const l1 = line('l1', 0, 0, 100, 0);
  const l2 = line('l2', 0, 0, 0, 100);

  it('symmetric distance chamfer → bevel + two trims', () => {
    const res = computeChamferTwoLines(l1, { x: 50, y: 0 }, l2, { x: 0, y: 50 }, 20, 20, 0, 'distance', true, 'bev');
    expect(res).not.toBeNull();
    expect(res!.bevel.type).toBe('line');
    expect(res!.bevel.id).toBe('bev');
    expect(res!.bevel.layerId).toBe('lyr_test');
    expect(res!.bevel.start.x).toBeCloseTo(20);
    expect(res!.bevel.start.y).toBeCloseTo(0);
    expect(res!.bevel.end.x).toBeCloseTo(0);
    expect(res!.bevel.end.y).toBeCloseTo(20);
    expect(res!.trims).toHaveLength(2);
  });

  it('asymmetric distances (d1≠d2)', () => {
    const res = computeChamferTwoLines(l1, { x: 50, y: 0 }, l2, { x: 0, y: 50 }, 30, 10, 0, 'distance', true, 'bev');
    expect(res).not.toBeNull();
    expect(res!.bevel.start.x).toBeCloseTo(30);
    expect(res!.bevel.end.y).toBeCloseTo(10);
  });

  it('angle mode (d1=20, α=45° on 90°) → symmetric bevel', () => {
    const res = computeChamferTwoLines(l1, { x: 50, y: 0 }, l2, { x: 0, y: 50 }, 20, 0, 45, 'angle', true, 'bev');
    expect(res).not.toBeNull();
    expect(res!.bevel.start.x).toBeCloseTo(20);
    expect(res!.bevel.end.y).toBeCloseTo(20);
  });

  it('No-trim → bevel only, no trims', () => {
    const res = computeChamferTwoLines(l1, { x: 50, y: 0 }, l2, { x: 0, y: 50 }, 20, 20, 0, 'distance', false, 'bev');
    expect(res).not.toBeNull();
    expect(res!.trims).toHaveLength(0);
  });

  it('returns null when a distance does not fit the segment', () => {
    const s1 = line('l1', 0, 0, 10, 0);
    const s2 = line('l2', 0, 0, 0, 10);
    expect(computeChamferTwoLines(s1, { x: 5, y: 0 }, s2, { x: 0, y: 5 }, 50, 50, 0, 'distance', true, 'bev')).toBeNull();
  });

  it('returns null for parallel lines', () => {
    const p1 = line('l1', 0, 0, 100, 0);
    const p2 = line('l2', 0, 10, 100, 10);
    expect(computeChamferTwoLines(p1, { x: 50, y: 0 }, p2, { x: 50, y: 10 }, 20, 20, 0, 'distance', true, 'bev')).toBeNull();
  });
});

describe('computeChamferPolyline', () => {
  it('bevels every corner of a closed square (all straight segments)', () => {
    const square = polyline([[0, 0], [100, 0], [100, 100], [0, 100]], true);
    const res = computeChamferPolyline(square, 20, 20);
    expect(res).not.toBeNull();
    expect(res!.chamfered).toBe(4);
    expect(res!.skipped).toBe(0);
    expect(res!.entity.vertices).toHaveLength(8);
    // Every segment stays straight (chamfer inserts no bulges).
    expect((res!.entity.bulges ?? []).every((b) => b === 0)).toBe(true);
  });

  it('skips corners whose neighbouring segment is an arc (and counts them)', () => {
    const open = polyline([[0, 0], [100, 0], [100, 100], [200, 100], [200, 0]], false, [0, 0.3, 0, 0]);
    const res = computeChamferPolyline(open, 20, 20);
    expect(res).not.toBeNull();
    expect(res!.chamfered).toBe(1);
    expect(res!.skipped).toBe(2);
  });

  it('returns null when no corner fits the distances', () => {
    const tiny = polyline([[0, 0], [100, 0], [100, 40], [0, 40]], true);
    expect(computeChamferPolyline(tiny, 30, 30)).toBeNull();
  });
});

describe('computeChamferPolylineCorner — bevel ONE corner (Φ4f.2 same-polyline)', () => {
  it('bevels only the picked corner (vertex → pIn + straight bevel + pOut)', () => {
    const l = polyline([[0, 0], [100, 0], [100, 100]], false); // open, corner at vertex 1
    const res = computeChamferPolylineCorner(l, 1, 20, 20);
    expect(res).not.toBeNull();
    expect(res!.chamfered).toBe(1);
    expect(res!.entity.vertices).toHaveLength(4); // 3 → corner vertex becomes two bevel vertices
    // Chamfer inserts a straight segment (no bulge) — all remain 0.
    expect((res!.entity.bulges ?? []).every((b) => b === 0)).toBe(true);
  });

  it('returns null for a non-corner index (open-polyline endpoint)', () => {
    const l = polyline([[0, 0], [100, 0], [100, 100]], false);
    expect(computeChamferPolylineCorner(l, 0, 20, 20)).toBeNull();
  });

  it('rounds a closed-square corner (wrap vertex 0)', () => {
    const square = polyline([[0, 0], [100, 0], [100, 100], [0, 100]], true);
    const res = computeChamferPolylineCorner(square, 0, 20, 20);
    expect(res).not.toBeNull();
    expect(res!.chamfered).toBe(1);
    expect(res!.entity.vertices).toHaveLength(5);
  });
});
