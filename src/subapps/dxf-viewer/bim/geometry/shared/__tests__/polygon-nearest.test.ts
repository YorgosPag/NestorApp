/**
 * ADR-569 — polygon-nearest SSoT tests (nearest point / nearest segment μεταξύ πολυγώνων).
 */
import {
  closestPointOnPolygonOutline,
  closestEdgeOnPolygonOutline,
  closestFacingEdgeBetweenPolygons,
  shortestSegmentBetweenPolygons,
} from '../polygon-nearest';
import type { Point2D } from '../../../../rendering/types/Types';

const square = (x0: number, y0: number, s: number): Point2D[] => [
  { x: x0, y: y0 },
  { x: x0 + s, y: y0 },
  { x: x0 + s, y: y0 + s },
  { x: x0, y: y0 + s },
];

const rect = (xmin: number, ymin: number, xmax: number, ymax: number): Point2D[] => [
  { x: xmin, y: ymin },
  { x: xmax, y: ymin },
  { x: xmax, y: ymax },
  { x: xmin, y: ymax },
];

describe('closestPointOnPolygonOutline', () => {
  it('projects an external point onto the nearest edge', () => {
    const q = closestPointOnPolygonOutline(square(0, 0, 10), { x: 15, y: 5 });
    expect(q.x).toBeCloseTo(10);
    expect(q.y).toBeCloseTo(5);
  });

  it('clamps to a corner when the point is diagonally outside', () => {
    const q = closestPointOnPolygonOutline(square(0, 0, 10), { x: 20, y: 20 });
    expect(q.x).toBeCloseTo(10);
    expect(q.y).toBeCloseTo(10);
  });

  it('degenerate outline (single vertex) → that vertex', () => {
    const q = closestPointOnPolygonOutline([{ x: 3, y: 4 }], { x: 99, y: 99 });
    expect(q).toEqual({ x: 3, y: 4 });
  });
});

describe('shortestSegmentBetweenPolygons', () => {
  it('returns the facing-face pair for two separated squares', () => {
    const seg = shortestSegmentBetweenPolygons(square(0, 0, 10), square(20, 0, 10));
    expect(seg).not.toBeNull();
    expect(seg!.dist).toBeCloseTo(10);
    expect(seg!.a.x).toBeCloseTo(10); // right face of A
    expect(seg!.b.x).toBeCloseTo(20); // left face of B
  });

  it('handles vertical separation (nearest edges face each other)', () => {
    const seg = shortestSegmentBetweenPolygons(square(0, 0, 10), square(0, 30, 10));
    expect(seg!.dist).toBeCloseTo(20);
    expect(seg!.a.y).toBeCloseTo(10);
    expect(seg!.b.y).toBeCloseTo(30);
  });

  it('returns null when the polygons share an edge (touching, no clean gap)', () => {
    expect(shortestSegmentBetweenPolygons(square(0, 0, 10), square(10, 0, 10))).toBeNull();
  });

  it('returns null for a degenerate (<3 vertices) polygon', () => {
    expect(shortestSegmentBetweenPolygons([{ x: 0, y: 0 }, { x: 1, y: 1 }], square(20, 0, 10))).toBeNull();
  });

  it('is symmetric in distance regardless of argument order', () => {
    const a = shortestSegmentBetweenPolygons(square(0, 0, 10), square(25, 3, 10));
    const b = shortestSegmentBetweenPolygons(square(25, 3, 10), square(0, 0, 10));
    expect(a!.dist).toBeCloseTo(b!.dist);
  });
});

describe('closestEdgeOnPolygonOutline', () => {
  it('returns the edge direction of the face the point projects onto', () => {
    // Point to the right of a square → projects onto the vertical east edge (dir ±(0,1)).
    const hit = closestEdgeOnPolygonOutline(square(0, 0, 10), { x: 15, y: 5 })!;
    expect(hit).not.toBeNull();
    expect(hit.point.x).toBeCloseTo(10);
    expect(hit.point.y).toBeCloseTo(5);
    expect(Math.abs(hit.edge.x)).toBeCloseTo(0); // vertical edge
    expect(Math.abs(hit.edge.y)).toBeCloseTo(1);
    expect(hit.dist).toBeCloseTo(5);
  });

  it('null for a degenerate (<2 vertices) outline', () => {
    expect(closestEdgeOnPolygonOutline([{ x: 0, y: 0 }], { x: 9, y: 9 })).toBeNull();
  });
});

describe('closestFacingEdgeBetweenPolygons', () => {
  it('facing edge of aligned members is the vertical face (normal = horizontal beam)', () => {
    const fe = closestFacingEdgeBetweenPolygons(square(0, 0, 200), square(1200, 0, 200))!;
    expect(fe).not.toBeNull();
    expect(fe.nearest.dist).toBeCloseTo(1000);
    expect(Math.abs(fe.edge.x)).toBeCloseTo(0); // facing edge vertical → normal horizontal
    expect(Math.abs(fe.edge.y)).toBeCloseTo(1);
  });

  it('members offset in Y still yield a vertical facing edge (never a slanted normal)', () => {
    // A [y 0..40], B [y 30..70] — centres differ by 30 in Y. Facing edge must stay vertical.
    const fe = closestFacingEdgeBetweenPolygons(rect(0, 0, 40, 40), rect(500, 30, 540, 70))!;
    expect(Math.abs(fe.edge.x)).toBeCloseTo(0);
    expect(Math.abs(fe.edge.y)).toBeCloseTo(1);
  });

  it('null for touching members (no clean gap)', () => {
    expect(closestFacingEdgeBetweenPolygons(square(0, 0, 200), square(200, 0, 200))).toBeNull();
  });

  it('null for a degenerate (<3 vertices) polygon', () => {
    expect(closestFacingEdgeBetweenPolygons([{ x: 0, y: 0 }, { x: 1, y: 1 }], square(20, 0, 10))).toBeNull();
  });
});
