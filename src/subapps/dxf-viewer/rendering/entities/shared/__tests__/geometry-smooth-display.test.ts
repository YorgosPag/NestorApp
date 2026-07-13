/**
 * ADR-650 M3 — tests for the non-destructive smooth-display path builder.
 * Verifies: raw fallback for <3 pts, endpoints preserved, closed wrap, LOD
 * decimation, self-intersection guard (no folded output), and the render cache.
 */

import {
  buildSmoothedDisplayPath,
  getSmoothedDisplayPath,
  lodToleranceForScale,
} from '../geometry-smooth-display';

interface P { x: number; y: number; }

/** Brute-force: does a polyline fold onto itself (non-adjacent segment crossing)? */
function hasSelfIntersection(path: P[]): boolean {
  const cross = (a: P, b: P, c: P, d: P): boolean => {
    const d1 = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const d2 = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
    const d3 = (d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x);
    const d4 = (d.x - c.x) * (b.y - c.y) - (d.y - c.y) * (b.x - c.x);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  };
  for (let i = 0; i < path.length - 1; i += 1) {
    for (let j = i + 2; j < path.length - 1; j += 1) {
      if (i === 0 && j === path.length - 2) continue; // shared endpoint on closed loops
      if (cross(path[i], path[i + 1], path[j], path[j + 1])) return true;
    }
  }
  return false;
}

describe('geometry-smooth-display', () => {
  describe('buildSmoothedDisplayPath', () => {
    it('returns a copy of the raw points when fewer than 3 control points', () => {
      const raw = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
      const out = buildSmoothedDisplayPath(raw, false);
      expect(out).toEqual(raw);
      expect(out).not.toBe(raw);
    });

    it('preserves the first and last control points (open)', () => {
      const raw = [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }, { x: 30, y: 8 }];
      const out = buildSmoothedDisplayPath(raw, false);
      expect(out[0]).toEqual(raw[0]);
      expect(out[out.length - 1]).toEqual(raw[raw.length - 1]);
      expect(out.length).toBeGreaterThan(raw.length); // tessellated
    });

    it('a straight collinear line stays on the line (no overshoot)', () => {
      const raw = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }];
      const out = buildSmoothedDisplayPath(raw, false);
      for (const p of out) expect(Math.abs(p.y)).toBeLessThan(1e-6);
    });

    it('closed loop wraps back to the first control point', () => {
      const raw = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
      const out = buildSmoothedDisplayPath(raw, true);
      expect(out[out.length - 1]).toEqual(raw[0]);
    });

    it('does not produce a self-intersecting curve for a convex closed input', () => {
      const raw = [
        { x: 0, y: 0 }, { x: 20, y: 2 }, { x: 40, y: 0 },
        { x: 40, y: 30 }, { x: 20, y: 32 }, { x: 0, y: 30 },
      ];
      const out = buildSmoothedDisplayPath(raw, true);
      expect(hasSelfIntersection(out)).toBe(false);
    });

    it('guards a sharp spike so the output never folds', () => {
      // A near-degenerate spike that a naive Catmull-Rom would overshoot into a loop.
      const raw = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10.2, y: 40 }, { x: 10.4, y: 0 }, { x: 20, y: 0 }];
      const out = buildSmoothedDisplayPath(raw, false);
      expect(hasSelfIntersection(out)).toBe(false);
    });

    it('LOD tolerance decimates the smoothed path', () => {
      const raw = [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }, { x: 30, y: 6 }, { x: 40, y: 0 }];
      const full = buildSmoothedDisplayPath(raw, false, { simplifyTolerance: 0 });
      const lod = buildSmoothedDisplayPath(raw, false, { simplifyTolerance: 5 });
      expect(lod.length).toBeLessThan(full.length);
    });
  });

  describe('lodToleranceForScale', () => {
    it('returns 0 for a non-positive or non-finite scale', () => {
      expect(lodToleranceForScale(0)).toBe(0);
      expect(lodToleranceForScale(-2)).toBe(0);
      expect(lodToleranceForScale(Number.NaN)).toBe(0);
    });

    it('shrinks as the drawing is zoomed in (larger scale)', () => {
      expect(lodToleranceForScale(1000)).toBeLessThan(lodToleranceForScale(1));
    });

    it('returns a power of two (bucketed)', () => {
      const t = lodToleranceForScale(3.3);
      expect(Number.isInteger(Math.log2(t))).toBe(true);
    });
  });

  describe('getSmoothedDisplayPath (cache)', () => {
    it('returns the SAME array reference on a repeat call with identical inputs', () => {
      const raw = [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }, { x: 30, y: 8 }];
      const a = getSmoothedDisplayPath('ent-cache-1', raw, false, 0);
      const b = getSmoothedDisplayPath('ent-cache-1', raw, false, 0);
      expect(b).toBe(a);
    });

    it('rebuilds when the control array reference changes', () => {
      const raw1 = [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }];
      const raw2 = raw1.map((p) => ({ ...p }));
      const a = getSmoothedDisplayPath('ent-cache-2', raw1, false, 0);
      const b = getSmoothedDisplayPath('ent-cache-2', raw2, false, 0);
      expect(b).not.toBe(a);
    });
  });
});
