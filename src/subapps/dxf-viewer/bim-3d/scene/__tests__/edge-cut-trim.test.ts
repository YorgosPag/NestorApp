/**
 * ADR-452 — CPU edge trim at the horizontal cut plane (gradual edge hiding).
 */

import * as THREE from 'three';
import { clipLineSegmentsToCutY, filterPointsBelowCutY, worldYRange } from '../edge-cut-trim';

const I = new THREE.Matrix4(); // identity (local === world)

describe('clipLineSegmentsToCutY (identity transform)', () => {
  it('keeps a segment fully below the cut verbatim', () => {
    const seg = [0, 0, 0, 1, 1, 0]; // both y ≤ 2
    const out = clipLineSegmentsToCutY(seg, I, 2);
    expect(Array.from(out)).toEqual(seg);
  });

  it('drops a segment fully above the cut', () => {
    const seg = [0, 5, 0, 1, 6, 0]; // both y > 2
    const out = clipLineSegmentsToCutY(seg, I, 2);
    expect(out.length).toBe(0);
  });

  it('trims a crossing segment to the plane (a below, b above)', () => {
    const seg = [0, 0, 0, 0, 4, 0]; // vertical, crosses y=2 at midpoint
    const out = clipLineSegmentsToCutY(seg, I, 2);
    // start kept, end moved to the intersection (0,2,0)
    expect(Array.from(out)).toEqual([0, 0, 0, 0, 2, 0]);
  });

  it('trims a crossing segment to the plane (a above, b below)', () => {
    const seg = [0, 4, 0, 0, 0, 0];
    const out = clipLineSegmentsToCutY(seg, I, 1);
    // a moved to intersection (0,1,0), b kept
    expect(Array.from(out)).toEqual([0, 1, 0, 0, 0, 0]);
  });

  it('handles multiple segments independently', () => {
    const segs = [
      0, 0, 0, 1, 1, 0, // below → keep
      0, 5, 0, 1, 6, 0, // above → drop
      0, 0, 0, 0, 4, 0, // crossing → trim end to y=2
    ];
    const out = Array.from(clipLineSegmentsToCutY(segs, I, 2));
    expect(out).toEqual([0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 2, 0]);
  });
});

describe('clipLineSegmentsToCutY (translated transform)', () => {
  it('applies the world transform when classifying + trimming', () => {
    // Local y=0..4 with a +10 world Y offset → world y=10..14. Cut at world 12.
    const m = new THREE.Matrix4().makeTranslation(0, 10, 0);
    const seg = [0, 0, 0, 0, 4, 0]; // world 10..14, crosses at world 12 → local y=2
    const out = clipLineSegmentsToCutY(seg, m, 12);
    expect(out[1]).toBeCloseTo(0, 6); // start local y
    expect(out[4]).toBeCloseTo(2, 6); // trimmed end local y (world 12 → local 2)
  });
});

describe('worldYRange', () => {
  it('returns world-space min/max Y under the transform', () => {
    const m = new THREE.Matrix4().makeTranslation(0, 10, 0);
    const positions = [0, 0, 0, 0, 4, 0, 0, 2, 0];
    const { minY, maxY } = worldYRange(positions, m);
    expect(minY).toBeCloseTo(10, 6);
    expect(maxY).toBeCloseTo(14, 6);
  });
});

describe('filterPointsBelowCutY — the point-set sibling (ADR-920 Β2 vertex discs)', () => {
  it('keeps points at/below the cut, drops the ones above', () => {
    const pts = [0, 1, 0, 0, 2, 0, 0, 3, 0];
    expect(Array.from(filterPointsBelowCutY(pts, I, 2))).toEqual([0, 1, 0, 0, 2, 0]);
  });

  it('classifies in WORLD space — a dropped root (the terrain seat) shifts the threshold', () => {
    const dropped = new THREE.Matrix4().makeTranslation(0, -0.5, 0);
    // local y 2.4 → world 1.9 ≤ 2 kept; local y 2.6 → world 2.1 dropped. Output stays LOCAL.
    expect(Array.from(filterPointsBelowCutY([0, 2.4, 0, 0, 2.6, 0], dropped, 2))).toEqual([0, 2.4, 0].map(Math.fround));
  });
});
