/**
 * ADR-363 — «Δομικά στοιχεία από περίγραμμα» perimeter-from-faces SSoT (Φάση 0) tests.
 *
 * Covers: shape classification (rectangle / L / T / U / composite), rectilinear
 * slab decomposition (area-preserving leg rects, rotated frames), closed-polygon
 * extraction (closed polyline / rectangle entity / loose-line loop), and the
 * mixed-selection orchestrator (valid perimeters built, garbage → ignoredCount).
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity, LineEntity, LWPolylineEntity } from '../../../types/entities';
import {
  classifyPerimeter,
  decomposeRectilinear,
  extractClosedPolygons,
  perimeterFacesToRects,
} from '../perimeter-from-faces';

const TOL = 5;

/** Σωρευτικό εμβαδόν σκελών (για έλεγχο area-preservation). */
function sumArea(rects: ReadonlyArray<{ area: number }>): number {
  return rects.reduce((s, r) => s + r.area, 0);
}

// Rectangle 5000×300 (CCW).
const RECT: Point2D[] = [
  { x: 0, y: 0 },
  { x: 5000, y: 0 },
  { x: 5000, y: 300 },
  { x: 0, y: 300 },
];

// L (Γ): stem x[0,300] y[0,3000] + foot x[0,3000] y[0,300]. Area = 1,710,000.
const L_SHAPE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 3000, y: 0 },
  { x: 3000, y: 300 },
  { x: 300, y: 300 }, // reflex
  { x: 300, y: 3000 },
  { x: 0, y: 3000 },
];

// U (Π): foot y[0,300] x[0,3000] + two stems x[0,300] & x[2700,3000] up to y=3000.
const U_SHAPE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 3000, y: 0 },
  { x: 3000, y: 3000 },
  { x: 2700, y: 3000 },
  { x: 2700, y: 300 }, // reflex
  { x: 300, y: 300 }, // reflex
  { x: 300, y: 3000 },
  { x: 0, y: 3000 },
];

// T (Τ): stem x[1350,1650] y[0,2700] + bar x[0,3000] y[2700,3000].
const T_SHAPE: Point2D[] = [
  { x: 1350, y: 0 },
  { x: 1650, y: 0 },
  { x: 1650, y: 2700 }, // reflex
  { x: 3000, y: 2700 },
  { x: 3000, y: 3000 },
  { x: 0, y: 3000 },
  { x: 0, y: 2700 },
  { x: 1350, y: 2700 }, // reflex
];

/** Στρέφει πολύγωνο κατά `ang` (rad) γύρω από το (0,0). */
function rotatePoly(poly: readonly Point2D[], ang: number): Point2D[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return poly.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

describe('perimeter-from-faces — classifyPerimeter', () => {
  it('classifies a rectangle', () => {
    expect(classifyPerimeter(RECT, TOL)).toBe('rectangle');
  });

  it('classifies an L (Γ) — 6 verts, 1 reflex', () => {
    expect(classifyPerimeter(L_SHAPE, TOL)).toBe('L');
  });

  it('classifies a U (Π) — 8 verts, 2 adjacent reflex', () => {
    expect(classifyPerimeter(U_SHAPE, TOL)).toBe('U');
  });

  it('classifies a T (Τ) — 8 verts, 2 stem-separated reflex', () => {
    expect(classifyPerimeter(T_SHAPE, TOL)).toBe('T');
  });

  it('is orientation-independent (classifies a clockwise L the same)', () => {
    expect(classifyPerimeter([...L_SHAPE].reverse(), TOL)).toBe('L');
  });

  it('drops collinear midpoints before counting (rectangle with a split edge)', () => {
    const withMid: Point2D[] = [
      { x: 0, y: 0 },
      { x: 2500, y: 0 }, // collinear midpoint on the bottom edge
      { x: 5000, y: 0 },
      { x: 5000, y: 300 },
      { x: 0, y: 300 },
    ];
    expect(classifyPerimeter(withMid, TOL)).toBe('rectangle');
  });

  it('classifies a non-rectilinear shape (triangle) as composite', () => {
    const tri: Point2D[] = [
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 1500, y: 2000 },
    ];
    expect(classifyPerimeter(tri, TOL)).toBe('composite');
  });

  it('classifies a parallelogram (no right angles) as composite', () => {
    const para: Point2D[] = [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 6000, y: 3000 },
      { x: 1000, y: 3000 },
    ];
    expect(classifyPerimeter(para, TOL)).toBe('composite');
  });
});

describe('perimeter-from-faces — decomposeRectilinear', () => {
  it('returns one rect for a rectangle (length = long side, thickness = short)', () => {
    const rects = decomposeRectilinear(RECT, TOL);
    expect(rects).toHaveLength(1);
    expect(rects[0].longSide).toBeCloseTo(5000, 3);
    expect(rects[0].shortSide).toBeCloseTo(300, 3);
  });

  it('splits an L into 2 area-preserving leg rects', () => {
    const rects = decomposeRectilinear(L_SHAPE, TOL);
    expect(rects).toHaveLength(2);
    expect(sumArea(rects)).toBeCloseTo(1_710_000, 0);
    // each leg thickness = 300 (the short side)
    for (const r of rects) expect(r.shortSide).toBeCloseTo(300, 3);
  });

  it('splits a U into 3 area-preserving leg rects', () => {
    const rects = decomposeRectilinear(U_SHAPE, TOL);
    expect(rects).toHaveLength(3);
    // foot (3000×300) + 2 stems (300×2700) = 900k + 2×810k = 2,520,000
    expect(sumArea(rects)).toBeCloseTo(2_520_000, 0);
  });

  it('decomposes a rotated L identically (rect count + total area invariant)', () => {
    const rotated = rotatePoly(L_SHAPE, Math.PI / 5); // 36°
    const rects = decomposeRectilinear(rotated, TOL);
    expect(rects).toHaveLength(2);
    expect(sumArea(rects)).toBeCloseTo(1_710_000, -1);
  });

  it('returns [] for a non-rectilinear (composite) shape', () => {
    const tri: Point2D[] = [
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 1500, y: 2000 },
    ];
    expect(decomposeRectilinear(tri, TOL)).toHaveLength(0);
  });
});

// ─── Entity extraction ───────────────────────────────────────────────────────

function lwPolyline(id: string, verts: Point2D[], closed: boolean): LWPolylineEntity {
  return { id, type: 'lwpolyline', layerId: 'lyr', vertices: verts, closed } as LWPolylineEntity;
}

function lineEntity(id: string, s: Point2D, e: Point2D): LineEntity {
  return { id, type: 'line', layerId: 'lyr', start: s, end: e };
}

describe('perimeter-from-faces — extractClosedPolygons', () => {
  it('reads a closed lwpolyline directly', () => {
    const polys = extractClosedPolygons([lwPolyline('p', L_SHAPE, true)], TOL);
    expect(polys).toHaveLength(1);
    expect(polys[0]).toHaveLength(6);
  });

  it('ignores an OPEN polyline (not a perimeter)', () => {
    expect(extractClosedPolygons([lwPolyline('p', L_SHAPE, false)], TOL)).toHaveLength(0);
  });

  it('chains loose lines into one loop (L from 6 segments)', () => {
    const segs: Entity[] = L_SHAPE.map((v, i) =>
      lineEntity(`s${i}`, v, L_SHAPE[(i + 1) % L_SHAPE.length]),
    );
    const polys = extractClosedPolygons(segs, TOL);
    expect(polys).toHaveLength(1);
    expect(polys[0]).toHaveLength(6);
  });
});

describe('perimeter-from-faces — perimeterFacesToRects (orchestrator)', () => {
  it('builds rects for a valid L perimeter', () => {
    const res = perimeterFacesToRects([lwPolyline('p', L_SHAPE, true)], TOL);
    expect(res.perimeters).toHaveLength(1);
    expect(res.perimeters[0].shape).toBe('L');
    expect(res.rects).toHaveLength(2);
    expect(res.ignoredCount).toBe(0);
  });

  it('mixed selection: builds valid + counts garbage as ignored', () => {
    const triangle: Point2D[] = [
      { x: 10000, y: 0 },
      { x: 13000, y: 0 },
      { x: 11500, y: 2000 },
    ];
    const res = perimeterFacesToRects(
      [lwPolyline('good', L_SHAPE, true), lwPolyline('bad', triangle, true)],
      TOL,
    );
    expect(res.rects).toHaveLength(2); // only the L
    expect(res.ignoredCount).toBe(1); // the triangle
  });
});
