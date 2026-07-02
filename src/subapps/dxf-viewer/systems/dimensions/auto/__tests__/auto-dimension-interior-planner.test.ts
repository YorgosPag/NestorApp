/**
 * ADR-563 Φ3 — interior chain planner unit tests.
 */

import { planInteriorChains } from '../auto-dimension-interior-planner';
import { computeOverallBounds } from '../auto-dimension-engine';
import { AUTO_DIMENSION_DEFAULTS } from '../auto-dimension-types';
import { makeBimMock } from './auto-dim-test-mocks';

// L-shaped column trio: c1 (SW), c2 (E of c1), c3 (N of c1).
// Centers → c1(200,200) c2(2200,200) c3(200,3200).
const c1 = makeBimMock('column', 'c1', 0, 0, 400, 400);
const c2 = makeBimMock('column', 'c2', 2000, 0, 2400, 400);
const c3 = makeBimMock('column', 'c3', 0, 3000, 400, 3400);
const trio = [c1, c2, c3];
const overall = computeOverallBounds(trio)!; // cx=1200, cy=1700

describe('planInteriorChains', () => {
  it('produces one horizontal (X) and one vertical (Y) interior chain', () => {
    const segs = planInteriorChains(trio, AUTO_DIMENSION_DEFAULTS, overall);
    const horizontal = segs.filter((s) => s.rotation === 0);
    const vertical = segs.filter((s) => s.rotation === 90);
    expect(horizontal).toHaveLength(1);
    expect(vertical).toHaveLength(1);
    expect(horizontal[0].axis).toBe('x');
    expect(vertical[0].axis).toBe('y');
  });

  it('smart/axes basis → centerline grid, placed through the centroid', () => {
    const [h] = planInteriorChains(trio, AUTO_DIMENSION_DEFAULTS, overall).filter(
      (s) => s.rotation === 0,
    );
    // X centers 200 & 2200 (not faces 0/400), dim line rides cy = 1700.
    expect(h.defPoints[0]).toEqual({ x: 200, y: 1700 });
    expect(h.defPoints[1]).toEqual({ x: 2200, y: 1700 });
    expect(h.defPoints[2]).toEqual({ x: 200, y: 1700 }); // dimLineRef on the centroid line

    const [v] = planInteriorChains(trio, AUTO_DIMENSION_DEFAULTS, overall).filter(
      (s) => s.rotation === 90,
    );
    // Y centers 200 & 3200, vertical chain at cx = 1200.
    expect(v.defPoints[0]).toEqual({ x: 1200, y: 200 });
    expect(v.defPoints[1]).toEqual({ x: 1200, y: 3200 });
  });

  it('faces basis → element faces instead of centers', () => {
    const opts = { ...AUTO_DIMENSION_DEFAULTS, referenceBasis: 'faces' as const };
    const horizontal = planInteriorChains(trio, opts, overall).filter((s) => s.rotation === 0);
    // X faces: {0,400} (c1,c3) ∪ {2000,2400} (c2) → 3 gaps.
    expect(horizontal).toHaveLength(3);
    const xs = horizontal.flatMap((s) => [s.defPoints[0].x, s.defPoints[1].x]);
    expect(xs).toContain(0);
    expect(xs).toContain(400);
    expect(xs).toContain(2000);
  });

  it('dedups coincident centers across elements', () => {
    // c1 and c3 share X center 200 → only one 200 coordinate on the X axis.
    const horizontal = planInteriorChains(trio, AUTO_DIMENSION_DEFAULTS, overall).filter(
      (s) => s.rotation === 0,
    );
    const startXs = horizontal.map((s) => s.defPoints[0].x);
    expect(startXs).toEqual([200]); // single segment 200→2200, no duplicate 200
  });

  it('skips an axis with fewer than two distinct coordinates', () => {
    // A lone column → one center per axis → no segment on either axis.
    const solo = [c1];
    expect(planInteriorChains(solo, AUTO_DIMENSION_DEFAULTS, computeOverallBounds(solo)!)).toEqual(
      [],
    );
  });

  it('excludes openings from the interior grid', () => {
    // Opening centered at X=1200 would add a coord if counted — it must not.
    const opening = makeBimMock('opening', 'o1', 1000, 0, 1400, 200);
    const withOpening = [c1, c2, opening];
    const bounds = computeOverallBounds(withOpening)!;
    const horizontal = planInteriorChains(withOpening, AUTO_DIMENSION_DEFAULTS, bounds).filter(
      (s) => s.rotation === 0,
    );
    // Only c1(200) & c2(2200) → single segment, opening center 1200 absent.
    expect(horizontal).toHaveLength(1);
    const xs = [horizontal[0].defPoints[0].x, horizontal[0].defPoints[1].x];
    expect(xs).not.toContain(1200);
  });

  it('records bimExtent-ready sources on the segment axis', () => {
    const [h] = planInteriorChains(trio, AUTO_DIMENSION_DEFAULTS, overall).filter(
      (s) => s.rotation === 0,
    );
    expect(h.source1?.edge).toBe('center');
    expect(h.source2?.edge).toBe('center');
    expect(h.source1?.id).toBeTruthy();
  });
});
