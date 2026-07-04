/**
 * ADR-510 Φ4d — OFFSET geometry SSoT tests.
 * Covers the per-entity offset dispatcher, the bulge-aware polyline offset, the
 * cursor→signed-distance resolver, and the new `signedDistanceToLine` primitive.
 */

import { offsetEntity, isOffsettable } from '../offset-entity-geometry';
import { offsetPolylineWithBulges } from '../offset-polyline';
import { resolveOffsetDistance, resolveSignedOffset } from '../offset-side';
import { signedDistanceToLine } from '../../../rendering/entities/shared/geometry-vector-utils';
import { bulgeToArc } from '../../../rendering/entities/shared/geometry-bulge-utils';
import type { Entity } from '../../../types/entities';

function line(start: { x: number; y: number }, end: { x: number; y: number }): Entity {
  return { id: 'L1', type: 'line', visible: true, start, end } as unknown as Entity;
}
function circle(center: { x: number; y: number }, radius: number): Entity {
  return { id: 'C1', type: 'circle', visible: true, center, radius } as unknown as Entity;
}
function arc(center: { x: number; y: number }, radius: number, startAngle: number, endAngle: number): Entity {
  return { id: 'A1', type: 'arc', visible: true, center, radius, startAngle, endAngle } as unknown as Entity;
}
function polyline(vertices: { x: number; y: number }[], opts: { closed?: boolean; bulges?: number[] } = {}): Entity {
  return { id: 'P1', type: 'polyline', visible: true, vertices, ...opts } as unknown as Entity;
}

describe('signedDistanceToLine', () => {
  it('is positive on the left of travel (CCW perpendicular)', () => {
    expect(signedDistanceToLine({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5);
    expect(signedDistanceToLine({ x: 5, y: -3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(-3);
  });
  it('returns 0 for a degenerate line', () => {
    expect(signedDistanceToLine({ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
  });
});

describe('offsetEntity — LINE', () => {
  it('translates both endpoints perpendicular by the signed distance', () => {
    const out = offsetEntity(line({ x: 0, y: 0 }, { x: 10, y: 0 }), 5, 'NEW') as { id: string; start: { x: number; y: number }; end: { x: number; y: number } };
    expect(out.id).toBe('NEW');
    expect(out.start).toEqual({ x: 0, y: 5 });
    expect(out.end).toEqual({ x: 10, y: 5 });
  });
  it('offsets to the other side for a negative distance', () => {
    const out = offsetEntity(line({ x: 0, y: 0 }, { x: 10, y: 0 }), -4, 'NEW') as { start: { y: number } };
    expect(out.start.y).toBeCloseTo(-4);
  });
});

describe('offsetEntity — CIRCLE / ARC', () => {
  it('grows the circle radius by +d and shrinks by −d', () => {
    expect((offsetEntity(circle({ x: 0, y: 0 }, 10), 5, 'N') as { radius: number }).radius).toBe(15);
    expect((offsetEntity(circle({ x: 0, y: 0 }, 10), -6, 'N') as { radius: number }).radius).toBe(4);
  });
  it('returns null when the circle collapses (radius ≤ 0)', () => {
    expect(offsetEntity(circle({ x: 0, y: 0 }, 10), -10, 'N')).toBeNull();
    expect(offsetEntity(circle({ x: 0, y: 0 }, 10), -20, 'N')).toBeNull();
  });
  it('keeps arc centre + angles, only changes radius', () => {
    const out = offsetEntity(arc({ x: 0, y: 0 }, 10, 0, Math.PI / 2), 3, 'N') as { radius: number; startAngle: number; endAngle: number; center: { x: number } };
    expect(out.radius).toBe(13);
    expect(out.startAngle).toBe(0);
    expect(out.endAngle).toBeCloseTo(Math.PI / 2);
    expect(out.center.x).toBe(0);
  });
});

describe('offsetEntity — POLYLINE (straight)', () => {
  it('produces a parallel polyline with the same vertex count', () => {
    const src = polyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const out = offsetEntity(src, 2, 'N') as { vertices: { x: number; y: number }[] };
    expect(out.vertices).toHaveLength(3);
    // Not equal to the source (it moved).
    expect(out.vertices[0]).not.toEqual({ x: 0, y: 0 });
  });
});

describe('offsetPolylineWithBulges — concentric arc offset', () => {
  it('moves endpoints radially and preserves the bulge (single semicircle)', () => {
    // Arc (0,0)→(10,0), bulge 1 ⇒ centre (5,0), radius 5.
    const res = offsetPolylineWithBulges([{ x: 0, y: 0 }, { x: 10, y: 0 }], [1], false, 2)!;
    expect(res.bulges).toEqual([1]);
    expect(res.vertices[0].x).toBeCloseTo(2);
    expect(res.vertices[0].y).toBeCloseTo(0);
    expect(res.vertices[1].x).toBeCloseTo(8);
    expect(res.vertices[1].y).toBeCloseTo(0);
    // The offset endpoints + copied bulge must reconstruct a concentric arc (r 5→3).
    const arcOut = bulgeToArc(res.vertices[0], res.vertices[1], res.bulges[0])!;
    expect(arcOut.center.x).toBeCloseTo(5);
    expect(arcOut.radius).toBeCloseTo(3);
  });
  it('returns null when the arc collapses', () => {
    // radius 5, offsetting +6 toward centre ⇒ r' = 5 − 6 < 0.
    expect(offsetPolylineWithBulges([{ x: 0, y: 0 }, { x: 10, y: 0 }], [1], false, 6)).toBeNull();
  });
});

describe('resolveOffsetDistance', () => {
  it('LINE → signed perpendicular distance', () => {
    expect(resolveOffsetDistance(line({ x: 0, y: 0 }, { x: 10, y: 0 }), { x: 5, y: 7 })).toBeCloseTo(7);
  });
  it('CIRCLE → |cursor−centre| − radius (outside positive)', () => {
    expect(resolveOffsetDistance(circle({ x: 0, y: 0 }, 10), { x: 25, y: 0 })).toBeCloseTo(15);
    expect(resolveOffsetDistance(circle({ x: 0, y: 0 }, 10), { x: 4, y: 0 })).toBeCloseTo(-6);
  });
  it('unsupported entity → null', () => {
    expect(resolveOffsetDistance({ id: 'T', type: 'text', visible: true } as unknown as Entity, { x: 0, y: 0 })).toBeNull();
  });
});

describe('resolveSignedOffset — typed distance keeps the cursor side', () => {
  const ln = line({ x: 0, y: 0 }, { x: 10, y: 0 });
  it('no typed distance → cursor-driven signed distance', () => {
    expect(resolveSignedOffset(ln, { x: 5, y: 7 }, null)).toBeCloseTo(7);
  });
  it('typed distance → magnitude with the cursor sign (above = +)', () => {
    expect(resolveSignedOffset(ln, { x: 5, y: 3 }, 100)).toBeCloseTo(100);
  });
  it('typed distance → magnitude with the cursor sign (below = −)', () => {
    expect(resolveSignedOffset(ln, { x: 5, y: -0.1 }, 100)).toBeCloseTo(-100);
  });
  it('cursor exactly on the line → null (no side)', () => {
    expect(resolveSignedOffset(ln, { x: 5, y: 0 }, 100)).toBeNull();
  });
});

describe('isOffsettable', () => {
  it('accepts line/circle/arc/polyline, rejects text', () => {
    expect(isOffsettable(line({ x: 0, y: 0 }, { x: 1, y: 0 }))).toBe(true);
    expect(isOffsettable(circle({ x: 0, y: 0 }, 5))).toBe(true);
    expect(isOffsettable({ id: 'T', type: 'text', visible: true } as unknown as Entity)).toBe(false);
  });
});
