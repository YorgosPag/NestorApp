/**
 * ADR-507 Φ7 — material poché geometry tests (μέσω PAT catalog engine).
 */

import { computeMaterialHatchSegments } from '../material-hatch-geometry';
import type { HatchPoint2D } from '../hatch-pattern-geometry';

const SQUARE: ReadonlyArray<ReadonlyArray<HatchPoint2D>> = [[
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
]];

describe('computeMaterialHatchSegments', () => {
  it('παράγει segments για deterministic cut patterns (steel/masonry)', () => {
    expect(computeMaterialHatchSegments(SQUARE, 'steel', 'cut').length).toBeGreaterThan(0);
    expect(computeMaterialHatchSegments(SQUARE, 'masonry', 'cut').length).toBeGreaterThan(0);
  });

  it('null pattern (glass / concrete-surface) → []', () => {
    expect(computeMaterialHatchSegments(SQUARE, 'glass', 'cut')).toEqual([]);
    expect(computeMaterialHatchSegments(SQUARE, 'rc', 'projection')).toEqual([]);
  });

  it('άγνωστο υλικό → concrete fallback (AR-CONC σε cut → array)', () => {
    const segs = computeMaterialHatchSegments(SQUARE, 'unobtainium', 'cut');
    expect(Array.isArray(segs)).toBe(true);
  });

  it('degenerate boundary (<3 σημεία) → []', () => {
    expect(computeMaterialHatchSegments([[{ x: 0, y: 0 }, { x: 1, y: 1 }]], 'steel', 'cut')).toEqual([]);
  });

  it('τα segments είναι clipped εντός των ορίων', () => {
    const segs = computeMaterialHatchSegments(SQUARE, 'steel', 'cut');
    for (const s of segs) {
      for (const p of [s.start, s.end]) {
        expect(p.x).toBeGreaterThanOrEqual(-0.5);
        expect(p.x).toBeLessThanOrEqual(1000.5);
        expect(p.y).toBeGreaterThanOrEqual(-0.5);
        expect(p.y).toBeLessThanOrEqual(1000.5);
      }
    }
  });

  it('memoized — ίδια args → ίδιο reference', () => {
    const a = computeMaterialHatchSegments(SQUARE, 'masonry', 'cut');
    const b = computeMaterialHatchSegments(SQUARE, 'masonry', 'cut');
    expect(a).toBe(b);
  });
});
