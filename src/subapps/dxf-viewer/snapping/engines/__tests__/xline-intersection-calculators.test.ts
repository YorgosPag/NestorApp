import {
  xlineLineIntersection,
  xlineXlineIntersection,
  xlineCircleIntersection,
  xlineArcIntersection,
} from '../intersection-calculators';
import type { XLineEntity, LineEntity, CircleEntity, ArcEntity } from '../../../types/entities';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function xline(bx: number, by: number, dx: number, dy: number): XLineEntity {
  return { id: 'xl', type: 'xline', basePoint: { x: bx, y: by }, direction: { x: dx, y: dy } };
}

function line(sx: number, sy: number, ex: number, ey: number): LineEntity {
  return { id: 'ln', type: 'line', start: { x: sx, y: sy }, end: { x: ex, y: ey } };
}

function circle(cx: number, cy: number, r: number): CircleEntity {
  return { id: 'ci', type: 'circle', center: { x: cx, y: cy }, radius: r };
}

function arc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): ArcEntity {
  return { id: 'ar', type: 'arc', center: { x: cx, y: cy }, radius: r, startAngle, endAngle };
}

const PREC = 8;

// ─── xlineLineIntersection ───────────────────────────────────────────────────

describe('xlineLineIntersection', () => {
  it('crossing at origin — horizontal xline × vertical segment', () => {
    const result = xlineLineIntersection(xline(0, 0, 1, 0), line(0, -1, 0, 1));
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(0, PREC);
    expect(result[0].point.y).toBeCloseTo(0, PREC);
    expect(result[0].type).toBe('XLine-Line');
  });

  it('xline misses segment (t_segment outside [0,1])', () => {
    // xline y=0, segment from (2,1) to (2,2) — vertical at x=2 but only above y=0
    const result = xlineLineIntersection(xline(0, 0, 1, 0), line(2, 1, 2, 2));
    expect(result).toHaveLength(0);
  });

  it('parallel xline and segment → no intersection', () => {
    const result = xlineLineIntersection(xline(0, 1, 1, 0), line(0, 0, 1, 0));
    expect(result).toHaveLength(0);
  });

  it('xline horizontal, segment diagonal, crossing mid-segment', () => {
    // xline: y=0. segment: (1,1)→(3,-1) → crosses y=0 at x=2
    const result = xlineLineIntersection(xline(0, 0, 1, 0), line(1, 1, 3, -1));
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(2, PREC);
    expect(result[0].point.y).toBeCloseTo(0, PREC);
  });

  it('segment endpoint exactly on xline → intersects', () => {
    const result = xlineLineIntersection(xline(0, 0, 1, 0), line(3, 0, 3, 5));
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(3, PREC);
    expect(result[0].point.y).toBeCloseTo(0, PREC);
  });

  it('non-axis-aligned xline × segment', () => {
    // xline: base=(0,0), dir=(1,1) → y=x. segment: (0,2)→(2,0) → crosses y=x at (1,1)
    const result = xlineLineIntersection(xline(0, 0, 1, 1), line(0, 2, 2, 0));
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(1, PREC);
    expect(result[0].point.y).toBeCloseTo(1, PREC);
  });
});

// ─── xlineXlineIntersection ──────────────────────────────────────────────────

describe('xlineXlineIntersection', () => {
  it('two crossing xlines → 1 intersection', () => {
    const result = xlineXlineIntersection(xline(0, 0, 1, 0), xline(1, -1, 0, 1));
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(1, PREC);
    expect(result[0].point.y).toBeCloseTo(0, PREC);
  });

  it('parallel xlines → no intersection', () => {
    const result = xlineXlineIntersection(xline(0, 0, 1, 0), xline(0, 1, 1, 0));
    expect(result).toHaveLength(0);
  });

  it('same base point, different directions → base point', () => {
    const result = xlineXlineIntersection(xline(3, 4, 1, 0), xline(3, 4, 0, 1));
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(3, PREC);
    expect(result[0].point.y).toBeCloseTo(4, PREC);
  });

  it('near-parallel (anti-parallel) → no intersection', () => {
    // direction vectors nearly the same (collinear lines offset)
    const result = xlineXlineIntersection(xline(0, 0, 1, 0), xline(0, 1e-12, 1, 0));
    expect(result).toHaveLength(0);
  });

  it('diagonal xlines crossing at origin', () => {
    // y=x and y=-x cross at (0,0)
    const result = xlineXlineIntersection(xline(1, 1, 1, 1), xline(1, -1, 1, -1));
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(0, PREC);
    expect(result[0].point.y).toBeCloseTo(0, PREC);
  });
});

// ─── xlineCircleIntersection ─────────────────────────────────────────────────

describe('xlineCircleIntersection', () => {
  it('xline through circle center → 2 diametrically opposite points', () => {
    // xline y=0, circle center (0,0) r=1 → intersects at (−1,0) and (1,0)
    const result = xlineCircleIntersection(xline(0, 0, 1, 0), circle(0, 0, 1));
    expect(result).toHaveLength(2);
    const xs = result.map(r => r.point.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-1, PREC);
    expect(xs[1]).toBeCloseTo(1, PREC);
    result.forEach(r => expect(r.point.y).toBeCloseTo(0, PREC));
    result.forEach(r => expect(r.type).toBe('XLine-Circle'));
  });

  it('xline tangent to circle → 1 point', () => {
    // xline y=1 (base=(0,1), dir=(1,0)), circle center=(0,0) r=1 → tangent at (0,1)
    const result = xlineCircleIntersection(xline(0, 1, 1, 0), circle(0, 0, 1));
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(0, PREC);
    expect(result[0].point.y).toBeCloseTo(1, PREC);
  });

  it('xline misses circle → no intersection', () => {
    // xline y=2, circle center=(0,0) r=1
    const result = xlineCircleIntersection(xline(0, 2, 1, 0), circle(0, 0, 1));
    expect(result).toHaveLength(0);
  });

  it('xline offset from center, 2 intersections', () => {
    // xline y=0.5, circle center=(0,0) r=1 → 2 points
    const result = xlineCircleIntersection(xline(0, 0.5, 1, 0), circle(0, 0, 1));
    expect(result).toHaveLength(2);
    // Each point should satisfy x²+0.25=1 → x=±√0.75
    result.forEach(r => {
      expect(r.point.y).toBeCloseTo(0.5, PREC);
      expect(Math.abs(r.point.x)).toBeCloseTo(Math.sqrt(0.75), PREC);
    });
  });

  it('diagonal xline through circle → 2 points', () => {
    const result = xlineCircleIntersection(xline(0, 0, 1, 1), circle(5, 5, 2));
    expect(result).toHaveLength(2);
    result.forEach(r => {
      const d = Math.sqrt((r.point.x - 5) ** 2 + (r.point.y - 5) ** 2);
      expect(d).toBeCloseTo(2, PREC);
    });
  });
});

// ─── xlineArcIntersection ────────────────────────────────────────────────────

describe('xlineArcIntersection', () => {
  it('xline through circle, both intersections in arc range → 2 points', () => {
    // xline y=0 intersects at (1,0)=0° and (-1,0)=180°.
    // arc 180°→0° wraps: covers a>=180 OR a<=0 → both 0° and 180° included.
    const result = xlineArcIntersection(xline(0, 0, 1, 0), arc(0, 0, 1, 180, 0));
    expect(result).toHaveLength(2);
    const xs = result.map(r => r.point.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-1, PREC);
    expect(xs[1]).toBeCloseTo(1, PREC);
    result.forEach(r => expect(r.type).toBe('XLine-Arc'));
  });

  it('xline through circle, only 1 intersection in arc range → 1 point', () => {
    // xline y=0 intersects at (1,0)=0° and (-1,0)=180°.
    // arc 270°→45° wraps: covers a>=270 OR a<=45 → 0° in, 180° out.
    const result = xlineArcIntersection(xline(0, 0, 1, 0), arc(0, 0, 1, 270, 45));
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(1, PREC);
    expect(result[0].point.y).toBeCloseTo(0, PREC);
  });

  it('xline through circle, both intersections outside arc range → 0 points', () => {
    // xline y=0 intersects at 0° and 180°. arc 45°→135° → neither 0° nor 180° in [45,135].
    const result = xlineArcIntersection(xline(0, 0, 1, 0), arc(0, 0, 1, 45, 135));
    expect(result).toHaveLength(0);
  });

  it('xline misses circle → 0 points regardless of arc', () => {
    const result = xlineArcIntersection(xline(0, 3, 1, 0), arc(0, 0, 1, 0, 360));
    expect(result).toHaveLength(0);
  });

  it('wrap-around arc (start > end) — intersection in wrapped range', () => {
    // arc 315°→45° (wraps, covers right half diagonally), xline y=0
    // (1,0) is at 0° which is in [315,45] wrap range → included
    // (-1,0) is at 180° → not in [315,45] → excluded
    const result = xlineArcIntersection(xline(0, 0, 1, 0), arc(0, 0, 1, 315, 45));
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(1, PREC);
  });
});
