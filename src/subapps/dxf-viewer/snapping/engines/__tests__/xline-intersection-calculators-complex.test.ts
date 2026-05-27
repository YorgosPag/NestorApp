import {
  xlinePolylineIntersection,
  xlineEllipseIntersection,
  xlineRectangleIntersection,
} from '../intersection-calculators';
import type { XLineEntity, EllipseEntity, PolylineEntity, RectangleEntity } from '../../../types/entities';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function xline(bx: number, by: number, dx: number, dy: number): XLineEntity {
  return { id: 'xl', type: 'xline', layerId: 'lyr_test_default', basePoint: { x: bx, y: by }, direction: { x: dx, y: dy } };
}

function polyline(vertices: { x: number; y: number }[], closed = false): PolylineEntity {
  return { id: 'pl', type: 'polyline', layerId: 'lyr_test_default', vertices, closed } as PolylineEntity;
}

function ellipse(
  cx: number, cy: number,
  majorAxis: number, minorAxis: number,
  rotation?: number,
  startParam?: number,
  endParam?: number,
): EllipseEntity {
  return { id: 'el', type: 'ellipse', layerId: 'lyr_test_default', center: { x: cx, y: cy }, majorAxis, minorAxis, rotation, startParam, endParam } as EllipseEntity;
}

function rectangle(x: number, y: number, w: number, h: number): RectangleEntity {
  return {
    id: 're', type: 'rectangle', layerId: 'lyr_test_default', x, y, width: w, height: h,
    corner1: { x, y },
    corner2: { x: x + w, y: y + h },
  } as RectangleEntity;
}

const PREC = 6;

// ─── xlinePolylineIntersection ───────────────────────────────────────────────

describe('xlinePolylineIntersection', () => {
  it('horizontal xline × U-shaped polyline → 2 intersections', () => {
    // Polyline: (0,0)→(0,4)→(4,4)→(4,0) — 3 segments, not closed
    // xline y=2: crosses left side (0,2) and right side (4,2)
    const result = xlinePolylineIntersection(
      xline(0, 2, 1, 0),
      polyline([{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 0 }])
    );
    expect(result).toHaveLength(2);
    const pts = result.map(r => r.point).sort((a, b) => a.x - b.x);
    expect(pts[0].x).toBeCloseTo(0, PREC);
    expect(pts[0].y).toBeCloseTo(2, PREC);
    expect(pts[1].x).toBeCloseTo(4, PREC);
    expect(pts[1].y).toBeCloseTo(2, PREC);
    result.forEach(r => expect(r.type).toBe('XLine-Polyline'));
  });

  it('xline parallel to one segment → no intersection on that segment', () => {
    // Polyline: (0,0)→(4,0)→(4,2) — horizontal bottom + vertical right
    // xline at y=0 (horizontal): parallel to bottom segment → 0 for it; vertical segment crosses at (4,0)
    const result = xlinePolylineIntersection(
      xline(0, 0, 1, 0),
      polyline([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }])
    );
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(4, PREC);
    expect(result[0].point.y).toBeCloseTo(0, PREC);
  });

  it('xline × closed triangle → 2 intersections', () => {
    // Triangle: (0,0), (4,0), (2,4) closed
    // xline at y=2: crosses right edge (4,0)→(2,4) at (3,2) and left edge (2,4)→(0,0) at (1,2)
    const result = xlinePolylineIntersection(
      xline(0, 2, 1, 0),
      polyline([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 4 }], true)
    );
    expect(result).toHaveLength(2);
    const pts = result.map(r => r.point).sort((a, b) => a.x - b.x);
    expect(pts[0].x).toBeCloseTo(1, PREC);
    expect(pts[0].y).toBeCloseTo(2, PREC);
    expect(pts[1].x).toBeCloseTo(3, PREC);
    expect(pts[1].y).toBeCloseTo(2, PREC);
  });

  it('xline misses polyline entirely → []', () => {
    // Polyline confined to y∈[0,1], xline at y=5
    const result = xlinePolylineIntersection(
      xline(0, 5, 1, 0),
      polyline([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 0, y: 1 }])
    );
    expect(result).toHaveLength(0);
  });

  it('xline through vertex → 2 results at same point (vertex counted by both adjacent segments)', () => {
    // Polyline: (0,0)→(2,2)→(4,0) — V-shape, vertex at (2,2)
    // xline at y=2: endpoint of first segment, startpoint of second
    const result = xlinePolylineIntersection(
      xline(0, 2, 1, 0),
      polyline([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 0 }])
    );
    expect(result).toHaveLength(2);
    result.forEach(r => {
      expect(r.point.x).toBeCloseTo(2, PREC);
      expect(r.point.y).toBeCloseTo(2, PREC);
    });
  });
});

// ─── xlineEllipseIntersection ────────────────────────────────────────────────

describe('xlineEllipseIntersection', () => {
  it('horizontal xline through center of axis-aligned ellipse → 2 points on major axis', () => {
    // ellipse: center (0,0), a=3, b=2. xline y=0 through center → intersects at (±3, 0)
    const result = xlineEllipseIntersection(
      xline(0, 0, 1, 0),
      ellipse(0, 0, 3, 2)
    );
    expect(result).toHaveLength(2);
    const xs = result.map(r => r.point.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-3, PREC);
    expect(xs[1]).toBeCloseTo(3, PREC);
    result.forEach(r => expect(r.point.y).toBeCloseTo(0, PREC));
    result.forEach(r => expect(r.type).toBe('XLine-Ellipse'));
  });

  it('xline tangent to ellipse → 1 point', () => {
    // ellipse: a=3, b=2. xline at y=2 (= minorAxis) → tangent at (0, 2)
    const result = xlineEllipseIntersection(
      xline(0, 2, 1, 0),
      ellipse(0, 0, 3, 2)
    );
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(0, PREC);
    expect(result[0].point.y).toBeCloseTo(2, PREC);
  });

  it('xline misses ellipse → []', () => {
    // ellipse: a=3, b=2. xline at y=3 > b=2
    const result = xlineEllipseIntersection(
      xline(0, 3, 1, 0),
      ellipse(0, 0, 3, 2)
    );
    expect(result).toHaveLength(0);
  });

  it('xline through rotated ellipse center → 2 points on boundary', () => {
    // ellipse: center (0,0), a=5, b=3, rotation=45°. xline at y=0 through center.
    const result = xlineEllipseIntersection(
      xline(0, 0, 1, 0),
      ellipse(0, 0, 5, 3, 45)
    );
    expect(result).toHaveLength(2);
    // Each point must satisfy ellipse equation in local (rotated) frame
    const cosR = Math.cos(Math.PI / 4);
    const sinR = Math.sin(Math.PI / 4);
    for (const r of result) {
      const u = r.point.x * cosR + r.point.y * sinR;
      const v = r.point.x * (-sinR) + r.point.y * cosR;
      expect((u / 5) ** 2 + (v / 3) ** 2).toBeCloseTo(1, PREC);
    }
  });

  it('partial ellipse arc (startParam/endParam filter) → only in-range intersection returned', () => {
    // ellipse: a=4, b=2. xline at y=1 → 2 raw intersections at x=±2√3≈±3.464
    // startParam=π/2, endParam=π (Q2 of ellipse: top-left quadrant)
    // Right point (x>0): parametric angle ≈ π/6 < π/2 → filtered
    // Left point (x<0): parametric angle ≈ 5π/6 ∈ [π/2, π] → passes
    const result = xlineEllipseIntersection(
      xline(0, 1, 1, 0),
      ellipse(0, 0, 4, 2, 0, Math.PI / 2, Math.PI)
    );
    expect(result).toHaveLength(1);
    expect(result[0].point.x).toBeCloseTo(-2 * Math.sqrt(3), PREC);
    expect(result[0].point.y).toBeCloseTo(1, PREC);
  });
});

// ─── xlineRectangleIntersection ──────────────────────────────────────────────

describe('xlineRectangleIntersection', () => {
  it('horizontal xline through middle of rectangle → 2 intersections', () => {
    // rect (0,0) 4×4. xline at y=2 → crosses left edge (0,2) and right edge (4,2)
    const result = xlineRectangleIntersection(
      xline(0, 2, 1, 0),
      rectangle(0, 0, 4, 4)
    );
    expect(result).toHaveLength(2);
    const pts = result.map(r => r.point).sort((a, b) => a.x - b.x);
    expect(pts[0].x).toBeCloseTo(0, PREC);
    expect(pts[0].y).toBeCloseTo(2, PREC);
    expect(pts[1].x).toBeCloseTo(4, PREC);
    expect(pts[1].y).toBeCloseTo(2, PREC);
    result.forEach(r => expect(r.type).toBe('XLine-Rectangle'));
  });

  it('diagonal xline through rectangle edges (not corners) → 2 intersections', () => {
    // rect (0,0) 4×4. xline from (0,1) direction (1,1) (y=x+1)
    // crosses top edge (y=4) at x=3 → (3,4); crosses left edge (x=0) at y=1 → (0,1)
    const result = xlineRectangleIntersection(
      xline(0, 1, 1, 1),
      rectangle(0, 0, 4, 4)
    );
    expect(result).toHaveLength(2);
    const pts = result.map(r => r.point).sort((a, b) => a.x - b.x);
    expect(pts[0].x).toBeCloseTo(0, PREC);
    expect(pts[0].y).toBeCloseTo(1, PREC);
    expect(pts[1].x).toBeCloseTo(3, PREC);
    expect(pts[1].y).toBeCloseTo(4, PREC);
  });

  it('xline misses rectangle → []', () => {
    // rect (0,0) 2×2. xline at y=5
    const result = xlineRectangleIntersection(
      xline(0, 5, 1, 0),
      rectangle(0, 0, 2, 2)
    );
    expect(result).toHaveLength(0);
  });
});
