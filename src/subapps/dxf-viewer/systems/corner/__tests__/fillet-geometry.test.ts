/**
 * Tests for the FILLET geometry (ADR-510 Φ4e) — tangent arc, two-lines trim, R=0
 * extend, and the polyline round-every-corner variant.
 */

import { resolveCornerAnchors } from '../corner-math';
import {
  computeFilletArc,
  computeFilletTwoLines,
  computeFilletPolyline,
} from '../fillet-geometry';
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

describe('computeFilletArc', () => {
  it('solves the tangent arc of a 90° corner (t = R for a right angle)', () => {
    const anchors = resolveCornerAnchors(
      line('l1', 0, 0, 100, 0), { x: 50, y: 0 },
      line('l2', 0, 0, 0, 100), { x: 0, y: 50 },
    )!;
    const fa = computeFilletArc(anchors, 20);
    expect(fa).not.toBeNull();
    expect(fa!.tangentDist).toBeCloseTo(20); // R / tan(45°) = R
    expect(fa!.tangent1.x).toBeCloseTo(20);
    expect(fa!.tangent1.y).toBeCloseTo(0);
    expect(fa!.tangent2.x).toBeCloseTo(0);
    expect(fa!.tangent2.y).toBeCloseTo(20);
    expect(fa!.center.x).toBeCloseTo(20);
    expect(fa!.center.y).toBeCloseTo(20);
    expect(fa!.radius).toBe(20);
    // Center is equidistant (= R) from both tangent points.
    expect(Math.hypot(fa!.center.x - fa!.tangent1.x, fa!.center.y - fa!.tangent1.y)).toBeCloseTo(20);
    expect(Math.hypot(fa!.center.x - fa!.tangent2.x, fa!.center.y - fa!.tangent2.y)).toBeCloseTo(20);
  });

  it('tangent distance grows for an acute (45°) corner', () => {
    // Line2 at 45° from line1 → interior angle 45°, t = R / tan(22.5°) ≈ R * 2.414.
    const anchors = resolveCornerAnchors(
      line('l1', 0, 0, 100, 0), { x: 50, y: 0 },
      line('l2', 0, 0, 100, 100), { x: 50, y: 50 },
    )!;
    const fa = computeFilletArc(anchors, 10);
    expect(fa).not.toBeNull();
    expect(fa!.tangentDist).toBeCloseTo(10 / Math.tan(Math.PI / 8));
  });

  it('returns null for R ≤ 0', () => {
    const anchors = resolveCornerAnchors(
      line('l1', 0, 0, 100, 0), { x: 50, y: 0 },
      line('l2', 0, 0, 0, 100), { x: 0, y: 50 },
    )!;
    expect(computeFilletArc(anchors, 0)).toBeNull();
  });
});

describe('computeFilletTwoLines', () => {
  const l1 = line('l1', 0, 0, 100, 0);
  const l2 = line('l2', 0, 0, 0, 100);

  it('produces an arc + two trims (Trim on)', () => {
    const res = computeFilletTwoLines(l1, { x: 50, y: 0 }, l2, { x: 0, y: 50 }, 20, true, 'arc1');
    expect(res).not.toBeNull();
    expect(res!.arc).not.toBeNull();
    expect(res!.arc!.type).toBe('arc');
    expect(res!.arc!.id).toBe('arc1');
    expect(res!.arc!.layerId).toBe('lyr_test'); // inherits source style
    expect(res!.trims).toHaveLength(2);
    // keep = far end → the near endpoint (start) moves to the tangent point.
    const t1 = res!.trims.find((t) => t.entityId === 'l1')!;
    expect((t1.newGeom as LineEntity).start.x).toBeCloseTo(20);
    expect((t1.newGeom as LineEntity).start.y).toBeCloseTo(0);
    expect((t1.newGeom as LineEntity).end).toEqual({ x: 100, y: 0 });
  });

  it('produces an arc but no trims (Trim off)', () => {
    const res = computeFilletTwoLines(l1, { x: 50, y: 0 }, l2, { x: 0, y: 50 }, 20, false, 'arc1');
    expect(res).not.toBeNull();
    expect(res!.arc).not.toBeNull();
    expect(res!.trims).toHaveLength(0);
  });

  it('R=0 extends both lines to the corner (no arc)', () => {
    const short1 = line('l1', 0, 0, 50, 0);
    const short2 = line('l2', 100, 100, 100, 50); // infinite line x=100
    const res = computeFilletTwoLines(short1, { x: 25, y: 0 }, short2, { x: 100, y: 75 }, 0, true, 'arc1');
    expect(res).not.toBeNull();
    expect(res!.arc).toBeNull();
    expect(res!.trims).toHaveLength(2);
    const t1 = res!.trims.find((t) => t.entityId === 'l1')!;
    // line1 kept its (0,0) start, extended its end to the vertex (100,0).
    expect((t1.newGeom as LineEntity).end.x).toBeCloseTo(100);
    expect((t1.newGeom as LineEntity).end.y).toBeCloseTo(0);
  });

  it('returns null when the radius does not fit the segment', () => {
    const short1 = line('l1', 0, 0, 10, 0);
    const short2 = line('l2', 0, 0, 0, 10);
    const res = computeFilletTwoLines(short1, { x: 5, y: 0 }, short2, { x: 0, y: 5 }, 50, true, 'arc1');
    expect(res).toBeNull();
  });

  it('returns null for parallel lines', () => {
    const p1 = line('l1', 0, 0, 100, 0);
    const p2 = line('l2', 0, 10, 100, 10);
    expect(computeFilletTwoLines(p1, { x: 50, y: 0 }, p2, { x: 50, y: 10 }, 20, true, 'arc1')).toBeNull();
  });
});

describe('computeFilletPolyline', () => {
  it('rounds every corner of a closed square', () => {
    const square = polyline([[0, 0], [100, 0], [100, 100], [0, 100]], true);
    const res = computeFilletPolyline(square, 20);
    expect(res).not.toBeNull();
    expect(res!.filleted).toBe(4);
    expect(res!.skipped).toBe(0);
    // Each rounded corner replaces 1 vertex with 2 → 4 + 4 = 8.
    expect(res!.entity.vertices).toHaveLength(8);
    expect(res!.entity.bulges).toHaveLength(8);
    // The fillet bulge magnitude for a 90° corner = tan((π-π/2)/4) = tan(π/8).
    const magnitudes = (res!.entity.bulges ?? []).filter((b) => Math.abs(b) > 1e-6);
    expect(magnitudes).toHaveLength(4);
    magnitudes.forEach((b) => expect(Math.abs(b)).toBeCloseTo(Math.tan(Math.PI / 8)));
  });

  it('rounds the interior corners of an open polyline', () => {
    const open = polyline([[0, 0], [100, 0], [100, 100], [200, 100], [200, 0]], false);
    const res = computeFilletPolyline(open, 20);
    expect(res).not.toBeNull();
    expect(res!.filleted).toBe(3); // 3 interior corners
    expect(res!.entity.vertices).toHaveLength(5 + 3);
  });

  it('skips corners whose neighbouring segment is an arc (and counts them)', () => {
    const open = polyline([[0, 0], [100, 0], [100, 100], [200, 100], [200, 0]], false, [0, 0.3, 0, 0]);
    const res = computeFilletPolyline(open, 20);
    expect(res).not.toBeNull();
    expect(res!.filleted).toBe(1); // only the last interior corner is straight-straight
    expect(res!.skipped).toBe(2);
  });

  it('returns null when no corner fits the radius', () => {
    const tiny = polyline([[0, 0], [100, 0], [100, 40], [0, 40]], true);
    expect(computeFilletPolyline(tiny, 60)).toBeNull();
  });

  it('returns null for R ≤ 0', () => {
    const square = polyline([[0, 0], [100, 0], [100, 100], [0, 100]], true);
    expect(computeFilletPolyline(square, 0)).toBeNull();
  });
});
