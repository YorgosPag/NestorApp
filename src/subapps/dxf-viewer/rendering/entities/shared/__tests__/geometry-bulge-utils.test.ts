import {
  isStraightSegment,
  bulgeToArc,
  bulgeToPolyline,
  bulgeApexPoint,
  bulgeFromApexPoint,
  bulgeSegmentExtremes,
  hasAnyBulge,
  expandPolyline,
} from '../geometry-bulge-utils';
import type { Point2D } from '../../../types/Types';

const P0: Point2D = { x: 0, y: 0 };
const P1: Point2D = { x: 1, y: 0 };
const QUARTER = Math.tan(Math.PI / 8); // ≈ 0.41421 → 90° arc

describe('geometry-bulge-utils (ADR-510 Φ3a)', () => {
  describe('isStraightSegment', () => {
    it('treats undefined / null / ~0 as straight', () => {
      expect(isStraightSegment(undefined)).toBe(true);
      expect(isStraightSegment(null)).toBe(true);
      expect(isStraightSegment(0)).toBe(true);
      expect(isStraightSegment(1e-12)).toBe(true);
    });
    it('treats a real bulge as curved', () => {
      expect(isStraightSegment(1)).toBe(false);
      expect(isStraightSegment(-0.5)).toBe(false);
    });
  });

  describe('bulgeToArc', () => {
    it('returns null for straight / degenerate segments', () => {
      expect(bulgeToArc(P0, P1, 0)).toBeNull();
      expect(bulgeToArc(P0, P0, 1)).toBeNull();
    });

    it('bulge = 1 → semicircle (θ = 180°), center at chord midpoint, CCW', () => {
      const arc = bulgeToArc(P0, P1, 1)!;
      expect(arc).not.toBeNull();
      expect(arc.center.x).toBeCloseTo(0.5, 6);
      expect(arc.center.y).toBeCloseTo(0, 6);
      expect(arc.radius).toBeCloseTo(0.5, 6);
      expect(arc.sweep).toBeCloseTo(Math.PI, 6);
      expect(arc.counterclockwise).toBe(true);
      expect(arc.sagitta).toBeCloseTo(0.5, 6);
    });

    it('bulge = tan(22.5°) → quarter circle (θ = 90°), R = √2/2', () => {
      const arc = bulgeToArc(P0, P1, QUARTER)!;
      expect(arc.center.x).toBeCloseTo(0.5, 6);
      expect(arc.center.y).toBeCloseTo(0.5, 6);
      expect(arc.radius).toBeCloseTo(Math.SQRT1_2, 6);
      expect(arc.sweep).toBeCloseTo(Math.PI / 2, 6);
    });

    it('negative bulge flips direction (CW) but mirrors geometry', () => {
      const pos = bulgeToArc(P0, P1, QUARTER)!;
      const neg = bulgeToArc(P0, P1, -QUARTER)!;
      expect(neg.counterclockwise).toBe(false);
      expect(neg.sweep).toBeCloseTo(-Math.PI / 2, 6);
      // center mirrored across the chord (y axis flips)
      expect(neg.center.x).toBeCloseTo(pos.center.x, 6);
      expect(neg.center.y).toBeCloseTo(-pos.center.y, 6);
      expect(neg.radius).toBeCloseTo(pos.radius, 6);
    });
  });

  describe('bulgeToPolyline', () => {
    it('straight segment → exactly the two endpoints', () => {
      expect(bulgeToPolyline(P0, P1, 0)).toEqual([P0, P1]);
    });

    it('pins exact endpoints and stays on the circle in between', () => {
      const pts = bulgeToPolyline(P0, P1, 1, 30);
      expect(pts[0]).toEqual(P0);
      expect(pts[pts.length - 1]).toEqual(P1);
      // semicircle R=0.5 center (0.5,0): every interior point is ~0.5 from center
      for (const p of pts) {
        expect(Math.hypot(p.x - 0.5, p.y - 0)).toBeCloseTo(0.5, 6);
      }
    });

    it('finer maxSegDeg → more tessellation points', () => {
      const coarse = bulgeToPolyline(P0, P1, 1, 45);
      const fine = bulgeToPolyline(P0, P1, 1, 5);
      expect(fine.length).toBeGreaterThan(coarse.length);
    });
  });

  describe('bulgeApexPoint / bulgeFromApexPoint round-trip', () => {
    it('apex of bulge=1 semicircle is below the chord at (0.5,-0.5)', () => {
      const apex = bulgeApexPoint(P0, P1, 1);
      expect(apex.x).toBeCloseTo(0.5, 6);
      expect(apex.y).toBeCloseTo(-0.5, 6);
    });

    it('straight segment apex is the chord midpoint', () => {
      expect(bulgeApexPoint(P0, P1, 0)).toEqual({ x: 0.5, y: 0 });
    });

    it('bulgeFromApexPoint inverts bulgeApexPoint', () => {
      for (const b of [0.2, 0.4142, 1, -0.6, -1.3]) {
        const apex = bulgeApexPoint(P0, P1, b);
        expect(bulgeFromApexPoint(P0, P1, apex)).toBeCloseTo(b, 6);
      }
    });

    it('projects an off-axis drag onto the perpendicular apex', () => {
      // dragging sideways along the chord must not change the bulge
      const apex = bulgeApexPoint(P0, P1, 0.5);
      const dragged = { x: apex.x + 0.3, y: apex.y };
      expect(bulgeFromApexPoint(P0, P1, dragged)).toBeCloseTo(0.5, 6);
    });
  });

  describe('bulgeSegmentExtremes', () => {
    it('straight segment → just the endpoints', () => {
      expect(bulgeSegmentExtremes(P0, P1, 0)).toEqual([P0, P1]);
    });

    it('semicircle includes the bottom cardinal point beyond the chord', () => {
      const ext = bulgeSegmentExtremes(P0, P1, 1);
      const minY = Math.min(...ext.map(p => p.y));
      // apex at y=-0.5 must be captured for the bbox
      expect(minY).toBeCloseTo(-0.5, 6);
    });

    it('shallow arc does NOT spuriously add cardinal points outside the sweep', () => {
      const ext = bulgeSegmentExtremes(P0, P1, 0.1);
      // only endpoints + at most the single apex-side cardinal
      expect(ext.length).toBeLessThanOrEqual(3);
    });
  });

  describe('hasAnyBulge', () => {
    it('false for undefined / all-zero arrays', () => {
      expect(hasAnyBulge(undefined)).toBe(false);
      expect(hasAnyBulge([0, 0, 0])).toBe(false);
    });
    it('true when any segment carries a real arc', () => {
      expect(hasAnyBulge([0, 0.5, 0])).toBe(true);
    });
  });

  describe('expandPolyline', () => {
    const SQUARE: Point2D[] = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ];

    it('straight open polyline passes vertices through unchanged', () => {
      expect(expandPolyline(SQUARE, undefined, false)).toEqual(SQUARE);
    });

    it('closed straight polyline appends the closing vertex back to start', () => {
      const path = expandPolyline(SQUARE, [0, 0, 0, 0], true);
      expect(path[0]).toEqual(SQUARE[0]);
      expect(path[path.length - 1]).toEqual(SQUARE[0]); // loop closed
      expect(path.length).toBe(SQUARE.length + 1);
    });

    it('tessellates only the bulged segment, keeps shared vertices unique', () => {
      // bottom side as a quarter arc, rest straight
      const path = expandPolyline(SQUARE, [Math.tan(Math.PI / 8), 0, 0], false);
      expect(path[0]).toEqual(SQUARE[0]);
      expect(path[path.length - 1]).toEqual(SQUARE[3]);
      // arc adds interior points → more than the 4 plain vertices
      expect(path.length).toBeGreaterThan(SQUARE.length);
      // no consecutive duplicate points at the segment joins
      for (let i = 1; i < path.length; i += 1) {
        expect(path[i]).not.toEqual(path[i - 1]);
      }
    });
  });
});
