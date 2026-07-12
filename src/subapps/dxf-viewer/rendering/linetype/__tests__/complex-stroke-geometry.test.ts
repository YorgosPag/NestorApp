/**
 * Tests — ADR-642 §6.4 complex-stroke geometry (pure arc-length primitives).
 */

import {
  buildSegments,
  cumulativeLengths,
  offsetPolyline,
  pointAt,
  polylineVertices,
  sampleSubpath,
  totalLength,
  type Point,
} from '../complex-stroke-geometry';

const L: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]; // ⌐ shape, total 20

describe('buildSegments', () => {
  it('builds unit-direction segments and skips zero-length ones', () => {
    const segs = buildSegments([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 0 }]);
    expect(segs).toHaveLength(1);
    expect(segs[0].len).toBe(4);
    expect(segs[0].ux).toBe(1);
    expect(segs[0].uy).toBe(0);
  });

  it('closes the loop when requested', () => {
    const segs = buildSegments([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }], true);
    expect(segs).toHaveLength(3); // 3 edges incl. closing edge
  });
});

describe('totalLength + cumulativeLengths', () => {
  it('sums segment lengths', () => {
    const segs = buildSegments(L);
    expect(totalLength(segs)).toBe(20);
    expect(cumulativeLengths(segs)).toEqual([0, 10, 20]);
  });
});

describe('pointAt', () => {
  it('interpolates along the correct segment with tangent', () => {
    const segs = buildSegments(L);
    const cum = cumulativeLengths(segs);
    expect(pointAt(segs, cum, 5)).toEqual({ x: 5, y: 0, ux: 1, uy: 0 });
    expect(pointAt(segs, cum, 15)).toEqual({ x: 10, y: 5, ux: 0, uy: 1 });
  });

  it('clamps out-of-range distances to the endpoints', () => {
    const segs = buildSegments(L);
    const cum = cumulativeLengths(segs);
    expect(pointAt(segs, cum, -3)).toMatchObject({ x: 0, y: 0 });
    expect(pointAt(segs, cum, 999)).toMatchObject({ x: 10, y: 10 });
  });
});

describe('sampleSubpath', () => {
  it('returns endpoints for a sub-range inside one segment', () => {
    const segs = buildSegments(L);
    const cum = cumulativeLengths(segs);
    expect(sampleSubpath(segs, cum, 2, 6)).toEqual([{ x: 2, y: 0 }, { x: 6, y: 0 }]);
  });

  it('includes the intermediate vertex when the range crosses a corner', () => {
    const segs = buildSegments(L);
    const cum = cumulativeLengths(segs);
    // 5 → 15 crosses the corner at dist 10 → dash bends
    expect(sampleSubpath(segs, cum, 5, 15)).toEqual([
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
    ]);
  });

  it('empty when b<=a', () => {
    const segs = buildSegments(L);
    const cum = cumulativeLengths(segs);
    expect(sampleSubpath(segs, cum, 8, 8)).toEqual([]);
  });
});

describe('offsetPolyline', () => {
  it('offsets a straight line by the perpendicular distance', () => {
    const out = offsetPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 2);
    // normal of +x direction is (0, +1) → y shifts by +2
    expect(out).toEqual([{ x: 0, y: 2 }, { x: 10, y: 2 }]);
  });

  it('passthrough (cloned) at zero offset', () => {
    const src = [{ x: 1, y: 1 }, { x: 2, y: 2 }];
    const out = offsetPolyline(src, 0);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
  });
});

describe('polylineVertices (ADR-642 Φ4 corner-role placement)', () => {
  it('classifies start / interior / end and orients along the tangent/bisector', () => {
    const verts = polylineVertices(L); // ⌐: (0,0)→(10,0)→(10,10)
    expect(verts).toHaveLength(3);

    expect(verts[0]).toMatchObject({ x: 0, y: 0, role: 'start', turn: 0 });
    expect(verts[0].ux).toBeCloseTo(1, 6); // start tangent = first segment dir
    expect(verts[0].uy).toBeCloseTo(0, 6);

    expect(verts[2]).toMatchObject({ x: 10, y: 10, role: 'end', turn: 0 });
    expect(verts[2].ux).toBeCloseTo(0, 6); // end tangent = last segment dir
    expect(verts[2].uy).toBeCloseTo(1, 6);

    const corner = verts[1];
    expect(corner.role).toBe('interior');
    expect(corner).toMatchObject({ x: 10, y: 0 });
    // right/CW turn on screen (right → down) → positive cross → inner corner
    expect(corner.turn).toBeGreaterThan(0);
    // bisector of (1,0) and (0,1) is the 45° diagonal
    expect(corner.ux).toBeCloseTo(Math.SQRT1_2, 6);
    expect(corner.uy).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it('flips the turn sign for the mirror corner (left/CCW turn → outer)', () => {
    // right → up (screen y-DOWN so up = −y): (0,0)→(10,0)→(10,−10)
    const verts = polylineVertices([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: -10 }]);
    expect(verts[1].turn).toBeLessThan(0); // outer corner
  });

  it('merges duplicate points and drops the closing point for closed loops', () => {
    const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }];
    const verts = polylineVertices(square, true);
    expect(verts).toHaveLength(4); // closing dup removed
    expect(verts.every((v) => v.role === 'interior')).toBe(true); // no start/end when closed
  });

  it('is a single start vertex for a degenerate one-point input', () => {
    expect(polylineVertices([{ x: 3, y: 5 }])).toEqual([
      { x: 3, y: 5, ux: 1, uy: 0, turn: 0, role: 'start' },
    ]);
  });
});
