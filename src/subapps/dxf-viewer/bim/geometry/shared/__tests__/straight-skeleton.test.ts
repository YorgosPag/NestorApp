/**
 * Straight-skeleton engine tests (ADR-417 Φ2).
 *
 * Κρίσιμο invariant: οι όψεις **διαμερίζουν** το footprint → Σ(εμβαδά όψεων) =
 * εμβαδόν footprint. Καλύπτει κυρτά (square/triangle) + κοίλα (L/T/U) σχήματα.
 */

import { computeStraightSkeleton, type SkPoint } from '../straight-skeleton';
import { polygonArea } from '../polygon-utils';

const area2D = (pts: readonly SkPoint[]): number =>
  polygonArea(pts.map((p) => ({ x: p.x, y: p.y, z: 0 })));

const sumFaceAreas = (polygon: readonly SkPoint[]): number => {
  const r = computeStraightSkeleton(polygon);
  return r.faces.reduce((s, f) => s + area2D(f.polygon), 0);
};

describe('computeStraightSkeleton — partition invariant', () => {
  it('square → 4 faces, Σ areas = footprint area', () => {
    const sq: SkPoint[] = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
    const r = computeStraightSkeleton(sq);
    expect(r.ok).toBe(true);
    expect(r.faces).toHaveLength(4);
    expect(sumFaceAreas(sq)).toBeCloseTo(16, 4);
  });

  it('triangle → 3 faces, Σ areas = footprint area', () => {
    const tri: SkPoint[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 5 }];
    const r = computeStraightSkeleton(tri);
    expect(r.ok).toBe(true);
    expect(r.faces).toHaveLength(3);
    expect(sumFaceAreas(tri)).toBeCloseTo(15, 4);
  });

  it('non-square rectangle → 4 faces, Σ areas = footprint area', () => {
    const rect: SkPoint[] = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 3 }, { x: 0, y: 3 }];
    const r = computeStraightSkeleton(rect);
    expect(r.ok).toBe(true);
    expect(r.faces).toHaveLength(4);
    expect(sumFaceAreas(rect)).toBeCloseTo(24, 4);
  });

  it('L-shape (1 reflex corner) → 6 faces partition footprint', () => {
    const L: SkPoint[] = [
      { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 },
      { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 },
    ];
    const r = computeStraightSkeleton(L);
    expect(r.ok).toBe(true);
    expect(r.faces).toHaveLength(6);
    expect(sumFaceAreas(L)).toBeCloseTo(12, 3);
  });

  it('T-shape → faces partition footprint', () => {
    const T: SkPoint[] = [
      { x: 0, y: 4 }, { x: 0, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 4 },
      { x: 4, y: 4 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 4 },
    ];
    const r = computeStraightSkeleton(T);
    const footprint = area2D(T);
    expect(r.ok).toBe(true);
    expect(sumFaceAreas(T)).toBeCloseTo(footprint, 2);
  });

  it('U-shape → faces partition footprint', () => {
    const U: SkPoint[] = [
      { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 4, y: 5 },
      { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 5 }, { x: 0, y: 5 },
    ];
    const r = computeStraightSkeleton(U);
    const footprint = area2D(U);
    expect(r.ok).toBe(true);
    expect(sumFaceAreas(U)).toBeCloseTo(footprint, 2);
  });

  it('accepts CW input (auto-normalizes winding)', () => {
    const cwSquare: SkPoint[] = [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 0 }];
    expect(sumFaceAreas(cwSquare)).toBeCloseTo(16, 4);
  });
});
