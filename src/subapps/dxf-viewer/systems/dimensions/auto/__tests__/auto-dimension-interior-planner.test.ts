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

  it('smart/axes basis → centerline grid; ext origins on near faces, dim line on centroid', () => {
    const [h] = planInteriorChains(trio, AUTO_DIMENSION_DEFAULTS, overall).filter(
      (s) => s.rotation === 0,
    );
    // X centers 200 & 2200 measured; ext origins ride each host's near face
    // (Φ4-Δ Gap-to-Element), dim line stays on cy = 1700.
    expect(h.defPoints[0]).toEqual({ x: 200, y: 400 }); // c1 top face (nearest to cy)
    expect(h.defPoints[1]).toEqual({ x: 2200, y: 400 }); // c2 top face
    expect(h.defPoints[2]).toEqual({ x: 200, y: 1700 }); // dimLineRef on the centroid line

    const [v] = planInteriorChains(trio, AUTO_DIMENSION_DEFAULTS, overall).filter(
      (s) => s.rotation === 90,
    );
    // Y centers 200 & 3200 measured; ext origins on near faces (x), dim line at cx = 1200.
    expect(v.defPoints[0]).toEqual({ x: 400, y: 200 }); // c1 east face (nearest to cx)
    expect(v.defPoints[1]).toEqual({ x: 400, y: 3200 }); // c3 east face
    expect(v.defPoints[2]).toEqual({ x: 1200, y: 200 }); // dimLineRef on the centroid line
  });

  it('Φ4-Δ: witness is non-zero — ext origin ≠ dim-line ref on the perpendicular axis', () => {
    const segs = planInteriorChains(trio, AUTO_DIMENSION_DEFAULTS, overall);
    for (const s of segs) {
      // extOrigin1 and dimLineRef share the measured coord but differ on the
      // perpendicular axis → a drawable witness line (Gap-to-Element).
      expect(s.defPoints[0]).not.toEqual(s.defPoints[2]);
    }
  });

  it('Φ4-Δ: witness aims at the NEAREST element to the dim line on a shared coord', () => {
    // Two columns share X center 1000 at different Y distances from cy=2400.
    // e1 faces {1400,1600} (near face 1600, dist 800); e2 faces {3000,3400}
    // (near face 3000, dist 600) → e2 wins (closest to the dim line).
    const e1 = makeBimMock('column', 'e1', 900, 1400, 1100, 1600);
    const e2 = makeBimMock('column', 'e2', 900, 3000, 1100, 3400);
    const e3 = makeBimMock('column', 'e3', 2900, 1400, 3100, 1600); // 2nd X coord
    const set = [e1, e2, e3];
    const bounds = computeOverallBounds(set)!; // cx=2000, cy=2400
    const [h] = planInteriorChains(set, AUTO_DIMENSION_DEFAULTS, bounds).filter(
      (s) => s.rotation === 0,
    );
    expect(h.defPoints[0]).toEqual({ x: 1000, y: 3000 }); // e2 near face, not e1's 1600
    expect(h.defPoints[2]).toEqual({ x: 1000, y: 2400 }); // dim line on centroid
  });

  it('Φ4-Δ: witness origin is a host FACE, never the center', () => {
    const [h] = planInteriorChains(trio, AUTO_DIMENSION_DEFAULTS, overall).filter(
      (s) => s.rotation === 0,
    );
    // c1/c2 span Y 0..400 → center 200. The witness rides the face (400), not 200.
    expect(h.defPoints[0].y).toBe(400);
    expect(h.defPoints[0].y).not.toBe(200);
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
