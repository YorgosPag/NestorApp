/**
 * ADR-363 Phase 3 — `computeSlabGeometry` + polygon-utils tests.
 *
 * Coverage:
 *   - Square / rectangle / L-shape / triangle areas via shoelace
 *   - Perimeter sum-of-edges
 *   - Bbox folds vertices
 *   - Volume = netArea × thickness (m³)
 *   - CCW vs CW orientation handling (unsigned area)
 *   - Degenerate polygons (< 3 vertices)
 *   - Phase 3 netArea === area (slab-openings deferred)
 */

import { computeSlabGeometry, getSlabMaxBboxDimensionM } from '../slab-geometry';
import { computeSlabOpeningGeometry } from '../slab-opening-geometry';
import {
  isPolygonSelfIntersecting,
  isPolygonCCW,
  shoelaceArea,
} from '../shared/polygon-utils';
import type { SlabParams } from '../../types/slab-types';
import type {
  SlabOpeningEntity,
  SlabOpeningParams,
} from '../../types/slab-opening-types';

const FLOAT_TOL = 1e-6;

function makeSlab(verts: ReadonlyArray<{ x: number; y: number }>, overrides?: Partial<SlabParams>): SlabParams {
  return {
    kind: 'floor',
    outline: { vertices: verts.map((v) => ({ x: v.x, y: v.y, z: 0 })) },
    levelElevation: 0,
    thickness: 200,
    geometryType: 'box',
    ...overrides,
  } as SlabParams;
}

describe('computeSlabGeometry — area', () => {
  it('computes 100m² area for a 10m × 10m square (mm input)', () => {
    // 10000 × 10000 mm = 100 m² (CCW).
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 },
    ]));
    expect(g.area).toBeCloseTo(100, FLOAT_TOL);
  });

  it('computes 60m² for a 6m × 10m rectangle', () => {
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 10000 }, { x: 0, y: 10000 },
    ]));
    expect(g.area).toBeCloseTo(60, FLOAT_TOL);
  });

  it('computes 12.5m² for a triangle 5m × 5m', () => {
    // Right triangle base 5m height 5m → area = 12.5 m².
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 0, y: 5000 },
    ]));
    expect(g.area).toBeCloseTo(12.5, FLOAT_TOL);
  });

  it('computes correct area for an L-shape (75m²)', () => {
    // L-shape: 10×10 minus 5×5 corner = 100 - 25 = 75 m².
    const g = computeSlabGeometry(makeSlab([
      { x: 0,     y: 0 },
      { x: 10000, y: 0 },
      { x: 10000, y: 5000 },
      { x: 5000,  y: 5000 },
      { x: 5000,  y: 10000 },
      { x: 0,     y: 10000 },
    ]));
    expect(g.area).toBeCloseTo(75, FLOAT_TOL);
  });

  it('returns unsigned area regardless of CW vs CCW orientation', () => {
    const ccwVerts = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 }];
    const cwVerts = [...ccwVerts].reverse();
    const ccwArea = computeSlabGeometry(makeSlab(ccwVerts)).area;
    const cwArea = computeSlabGeometry(makeSlab(cwVerts)).area;
    expect(ccwArea).toBeCloseTo(cwArea, FLOAT_TOL);
    expect(ccwArea).toBeGreaterThan(0);
  });

  it('returns area 0 for degenerate polygon (2 vertices)', () => {
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 1000, y: 0 },
    ]));
    expect(g.area).toBeCloseTo(0, FLOAT_TOL);
  });
});

describe('computeSlabGeometry — perimeter + bbox + volume', () => {
  it('computes perimeter as sum-of-edges (40m for 10m square)', () => {
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 },
    ]));
    expect(g.perimeter).toBeCloseTo(40, FLOAT_TOL);
  });

  it('bbox folds all vertices into AABB', () => {
    const g = computeSlabGeometry(makeSlab([
      { x: -1000, y: -2000 }, { x: 5000, y: 0 }, { x: 0, y: 4000 },
    ]));
    expect(g.bbox.min.x).toBeCloseTo(-1000, FLOAT_TOL);
    expect(g.bbox.min.y).toBeCloseTo(-2000, FLOAT_TOL);
    expect(g.bbox.max.x).toBeCloseTo(5000, FLOAT_TOL);
    expect(g.bbox.max.y).toBeCloseTo(4000, FLOAT_TOL);
  });

  it('bbox z in metres: top=levelElevation/1000, bottom=top-thickness/1000 (ADR-369 Phase B)', () => {
    // levelElevation=3000mm, thickness=200mm → top=3m, bottom=2.8m
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 },
    ], { levelElevation: 3000, thickness: 200 }));
    expect(g.bbox.max.z).toBeCloseTo(3, FLOAT_TOL);
    expect(g.bbox.min.z).toBeCloseTo(2.8, FLOAT_TOL);
  });

  it('bbox z: heightOffsetFromLevel shifts top face', () => {
    // levelElevation=3000mm + offset=50mm → top=3.05m; thickness=200mm → bottom=2.85m
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 },
    ], { levelElevation: 3000, heightOffsetFromLevel: 50, thickness: 200 }));
    expect(g.bbox.max.z).toBeCloseTo(3.05, FLOAT_TOL);
    expect(g.bbox.min.z).toBeCloseTo(2.85, FLOAT_TOL);
  });

  it('bbox z: foundation slab at elevation=0, thickness=500mm → [−0.5, 0]', () => {
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 6000, y: 6000 }, { x: 0, y: 6000 },
    ], { kind: 'foundation', levelElevation: 0, thickness: 500 }));
    expect(g.bbox.max.z).toBeCloseTo(0, FLOAT_TOL);
    expect(g.bbox.min.z).toBeCloseTo(-0.5, FLOAT_TOL);
  });

  it('computes volume = netArea × thickness (m³)', () => {
    // 10m × 10m × 200mm thickness = 100 × 0.2 = 20 m³.
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 },
    ], { thickness: 200 }));
    expect(g.volume).toBeCloseTo(20, FLOAT_TOL);
  });

  it('netArea === area όταν slabOpenings παραλείπεται (legacy behaviour)', () => {
    const g = computeSlabGeometry(makeSlab([
      { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 },
    ]));
    expect(g.netArea).toBeCloseTo(g.area, FLOAT_TOL);
  });

  it('getSlabMaxBboxDimensionM returns min(dx,dy) in meters (structural span direction)', () => {
    // 8m × 3m slab — spans the SHORT direction (3m), not the 8m length.
    const params = makeSlab([
      { x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 3000 }, { x: 0, y: 3000 },
    ]);
    expect(getSlabMaxBboxDimensionM(params)).toBeCloseTo(3, FLOAT_TOL);
  });
});

describe('computeSlabGeometry — Phase 3.7 netArea subtraction', () => {
  function makeShaftEntity(
    cx: number,
    cy: number,
    half: number,
  ): SlabOpeningEntity {
    const params: SlabOpeningParams = {
      kind: 'shaft',
      slabId: 'slab_test',
      outline: {
        vertices: [
          { x: cx - half, y: cy - half, z: 0 },
          { x: cx + half, y: cy - half, z: 0 },
          { x: cx + half, y: cy + half, z: 0 },
          { x: cx - half, y: cy + half, z: 0 },
        ],
      },
    };
    return {
      id: `slbopn_${cx}_${cy}`,
      type: 'slab-opening',
      kind: 'shaft',
      layerId: '0',
      params,
      geometry: computeSlabOpeningGeometry(params),
      validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
      visible: true,
    } as SlabOpeningEntity;
  }

  it('αφαιρεί ένα cutout από netArea (100m² - 2.25m² = 97.75m²)', () => {
    const slab = makeSlab([
      { x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 },
    ]);
    // 1.5×1.5m shaft → 2.25m².
    const shaft = makeShaftEntity(3000, 3000, 750);
    const g = computeSlabGeometry(slab, [shaft]);
    expect(g.area).toBeCloseTo(100, FLOAT_TOL);
    expect(g.netArea).toBeCloseTo(97.75, FLOAT_TOL);
  });

  it('αφαιρεί πολλά cutouts (100m² - 2 × 1m² = 98m²)', () => {
    const slab = makeSlab([
      { x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 },
    ]);
    // 1m × 1m squares (1m²) × 2.
    const a = makeShaftEntity(2000, 2000, 500);
    const b = makeShaftEntity(7000, 7000, 500);
    const g = computeSlabGeometry(slab, [a, b]);
    expect(g.netArea).toBeCloseTo(98, FLOAT_TOL);
  });

  it('clamp στο 0 όταν openings ξεπερνούν το slab area', () => {
    // 1m² slab, 4m² opening.
    const slab = makeSlab([
      { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 },
    ]);
    const oversize = makeShaftEntity(0, 0, 1000); // 2×2m = 4m²
    const g = computeSlabGeometry(slab, [oversize]);
    expect(g.netArea).toBeCloseTo(0, FLOAT_TOL);
  });

  it('volume συνυπολογίζεται από netArea (όχι area)', () => {
    const slab = makeSlab([
      { x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 },
    ], { thickness: 200 });
    const shaft = makeShaftEntity(3000, 3000, 750);
    const g = computeSlabGeometry(slab, [shaft]);
    // 97.75 m² × 0.2m = 19.55 m³.
    expect(g.volume).toBeCloseTo(19.55, 4);
  });

  it('παραλειπόμενα openings → netArea === area (legacy path)', () => {
    const slab = makeSlab([
      { x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 4000 }, { x: 0, y: 4000 },
    ]);
    const g = computeSlabGeometry(slab);
    expect(g.netArea).toBeCloseTo(g.area, FLOAT_TOL);
  });
});

describe('polygon-utils helpers', () => {
  it('shoelaceArea is positive for CCW orientation', () => {
    const verts = [
      { x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }, { x: 1000, y: 1000, z: 0 }, { x: 0, y: 1000, z: 0 },
    ];
    expect(shoelaceArea(verts)).toBeGreaterThan(0);
    expect(isPolygonCCW(verts)).toBe(true);
  });

  it('shoelaceArea is negative for CW orientation', () => {
    const verts = [
      { x: 0, y: 0, z: 0 }, { x: 0, y: 1000, z: 0 }, { x: 1000, y: 1000, z: 0 }, { x: 1000, y: 0, z: 0 },
    ];
    expect(shoelaceArea(verts)).toBeLessThan(0);
    expect(isPolygonCCW(verts)).toBe(false);
  });

  it('isPolygonSelfIntersecting detects classic bowtie quadrilateral', () => {
    // Bowtie: edges (0→1) and (2→3) cross.
    const bowtie = [
      { x: 0, y: 0, z: 0 }, { x: 100, y: 100, z: 0 },
      { x: 100, y: 0, z: 0 }, { x: 0, y: 100, z: 0 },
    ];
    expect(isPolygonSelfIntersecting(bowtie)).toBe(true);
  });

  it('isPolygonSelfIntersecting returns false for simple convex quad', () => {
    const square = [
      { x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 },
      { x: 100, y: 100, z: 0 }, { x: 0, y: 100, z: 0 },
    ];
    expect(isPolygonSelfIntersecting(square)).toBe(false);
  });
});
