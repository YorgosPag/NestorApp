/**
 * ADR-920 Β6.11 Ζ1 — the ONE «encloses an area?» predicate and the ring with its arcs.
 *
 *   Κ  the predicate: closed flag + ≥ 3 vertices (the viewer's volume-boundary pick delegates here)
 *   Τ  arcs are geometry: a half-disc closed by a bulge has the area of a half-disc, not of a chord
 *   Δ  no repeated points: a closing repeat of the first vertex and zero-length edges disappear
 *
 * The moved bulge math itself stays anchored by the viewer suite `geometry-bulge-utils.test.ts`, which imports through
 * the re-export and therefore exercises `lib/geometry/polyline-bulge` (a `lib` test may not import the subapp, CHECK 3.62).
 */

import { closedRingWithArcs, qualifiesAsClosedRing, withoutRepeatedPoints } from '../closed-polyline-ring';
import { polygonArea } from '../planar-polygon';

describe('Κ — qualifiesAsClosedRing', () => {
  it.each([
    [true, 3, true],
    [true, 2, false],
    [false, 10, false],
    [undefined, 10, false],
  ])('closed=%s, %i vertices → %s', (closed, count, expected) => {
    expect(qualifiesAsClosedRing(closed, count)).toBe(expected);
  });
});

describe('Τ — closedRingWithArcs keeps the arcs', () => {
  it('a square with straight sides has the square area', () => {
    const ring = closedRingWithArcs([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], undefined)!;
    expect(ring).toHaveLength(4);
    expect(polygonArea(ring)).toBeCloseTo(100, 9);
  });

  it('two vertices are never a ring, arcs or not — the caller must not invent one', () => {
    expect(closedRingWithArcs([{ x: -10, y: 0 }, { x: 10, y: 0 }], [0, 1])).toBeNull();
  });

  it('a square whose top edge is a semicircle adds (bulge +1) or removes (bulge −1) half a disc', () => {
    // CCW square; on the edge (20,20) → (0,20) bulge +1 puts the centre at (10,20) and sweeps 0 → π through (10,30):
    // OUTWARD. Bulge −1 sweeps 0 → −π through (10,10): INWARD.
    const corners = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];
    const out = closedRingWithArcs(corners, [0, 0, 1, 0])!;
    const into = closedRingWithArcs(corners, [0, 0, -1, 0])!;
    const halfDisc = (Math.PI * 10 * 10) / 2;
    expect(Math.abs(polygonArea(out) - (400 + halfDisc))).toBeLessThan(400 * 0.002);
    expect(Math.abs(polygonArea(into) - (400 - halfDisc))).toBeLessThan(400 * 0.002);
  });
});

describe('Δ — withoutRepeatedPoints', () => {
  it('drops a closing repeat and consecutive duplicates', () => {
    expect(withoutRepeatedPoints([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 0 },
    ])).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
  });

  it('tolerates float noise at ΕΓΣΑ magnitudes (mm ~ 10⁹)', () => {
    const a = { x: 384_512_345.6, y: 4_201_234_567.8 };
    const b = { x: a.x + 1e-3, y: a.y }; // noise far below 1e-9 relative
    expect(withoutRepeatedPoints([a, { x: a.x + 5000, y: a.y }, { x: a.x, y: a.y + 5000 }, b])).toHaveLength(3);
  });
});
