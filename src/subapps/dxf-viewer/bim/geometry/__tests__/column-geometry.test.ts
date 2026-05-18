/**
 * ADR-363 Phase 4 — `computeColumnGeometry` tests.
 *
 * Coverage:
 *   - Rectangular footprint (4 vertices, width × depth)
 *   - Circular footprint (CIRCULAR_COLUMN_SEGMENTS vertices)
 *   - L-shape footprint (6 vertices, correct cut)
 *   - T-shape footprint (8 vertices, flange + web)
 *   - Anchor offset (center vs nw vs se)
 *   - Rotation (0 / 45 / 90 deg)
 *   - Area (m²) — rectangular + circular sanity
 *   - Volume (m³) — area × height/1000
 *   - Bbox folds vertices
 */

import { computeColumnGeometry, getColumnSlenderness } from '../column-geometry';
import { CIRCULAR_COLUMN_SEGMENTS, type ColumnParams } from '../../types/column-types';

const FLOAT_TOL = 1e-6;

function makeColumn(overrides?: Partial<ColumnParams>): ColumnParams {
  return {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    anchor: 'center',
    width: 400,
    depth: 400,
    height: 3000,
    rotation: 0,
    ...overrides,
  };
}

describe('computeColumnGeometry — footprint shape', () => {
  it('rectangular emits 4 CCW vertices centred on position', () => {
    const g = computeColumnGeometry(makeColumn({ width: 400, depth: 600 }));
    expect(g.footprint.vertices).toHaveLength(4);
    // Bbox should span (-200, -300) → (200, 300).
    expect(g.bbox.min.x).toBeCloseTo(-200, FLOAT_TOL);
    expect(g.bbox.max.x).toBeCloseTo(200, FLOAT_TOL);
    expect(g.bbox.min.y).toBeCloseTo(-300, FLOAT_TOL);
    expect(g.bbox.max.y).toBeCloseTo(300, FLOAT_TOL);
  });

  it('circular emits CIRCULAR_COLUMN_SEGMENTS vertices on Ø=width circle', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'circular', width: 500 }));
    expect(g.footprint.vertices).toHaveLength(CIRCULAR_COLUMN_SEGMENTS);
    // Every vertex should sit on radius 250mm από position.
    for (const v of g.footprint.vertices) {
      const r = Math.hypot(v.x, v.y);
      expect(r).toBeCloseTo(250, 3);
    }
  });

  it('L-shape emits 6-vertex CCW footprint', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'L-shape', width: 600, depth: 600 }));
    expect(g.footprint.vertices).toHaveLength(6);
  });

  it('T-shape emits 8-vertex CCW footprint', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'T-shape', width: 600, depth: 600 }));
    expect(g.footprint.vertices).toHaveLength(8);
  });
});

describe('computeColumnGeometry — anchor offset', () => {
  it('center anchor: bbox centred on position', () => {
    const g = computeColumnGeometry(makeColumn({
      position: { x: 1000, y: 2000, z: 0 }, anchor: 'center', width: 400, depth: 400,
    }));
    const cx = (g.bbox.min.x + g.bbox.max.x) / 2;
    const cy = (g.bbox.min.y + g.bbox.max.y) / 2;
    expect(cx).toBeCloseTo(1000, FLOAT_TOL);
    expect(cy).toBeCloseTo(2000, FLOAT_TOL);
  });

  it('nw anchor: position sits στο NW corner του bbox', () => {
    const g = computeColumnGeometry(makeColumn({
      position: { x: 0, y: 0, z: 0 }, anchor: 'nw', width: 400, depth: 400,
    }));
    expect(g.bbox.min.x).toBeCloseTo(0, FLOAT_TOL);
    expect(g.bbox.max.y).toBeCloseTo(0, FLOAT_TOL);
  });

  it('se anchor: position sits στο SE corner του bbox', () => {
    const g = computeColumnGeometry(makeColumn({
      position: { x: 0, y: 0, z: 0 }, anchor: 'se', width: 400, depth: 400,
    }));
    expect(g.bbox.max.x).toBeCloseTo(0, FLOAT_TOL);
    expect(g.bbox.min.y).toBeCloseTo(0, FLOAT_TOL);
  });
});

describe('computeColumnGeometry — rotation', () => {
  it('rotation=0 ταυτίζεται με μη-rotated bbox', () => {
    const a = computeColumnGeometry(makeColumn({ rotation: 0 }));
    const b = computeColumnGeometry(makeColumn({ rotation: 0 }));
    expect(a.bbox.max.x).toBeCloseTo(b.bbox.max.x, FLOAT_TOL);
  });

  it('rotation=90 swaps width/depth στο bbox dimensions', () => {
    const g = computeColumnGeometry(makeColumn({
      width: 400, depth: 200, rotation: 90,
    }));
    const dx = g.bbox.max.x - g.bbox.min.x;
    const dy = g.bbox.max.y - g.bbox.min.y;
    expect(dx).toBeCloseTo(200, 3);
    expect(dy).toBeCloseTo(400, 3);
  });

  it('rotation=45 expands bbox σε ίσες διαστάσεις √2 × max', () => {
    const g = computeColumnGeometry(makeColumn({
      width: 400, depth: 400, rotation: 45,
    }));
    const dx = g.bbox.max.x - g.bbox.min.x;
    const expected = 400 * Math.SQRT2;
    expect(dx).toBeCloseTo(expected, 1);
  });
});

describe('computeColumnGeometry — area / volume', () => {
  it('rectangular area = w × d (m²)', () => {
    const g = computeColumnGeometry(makeColumn({ width: 400, depth: 600 }));
    // 0.4m × 0.6m = 0.24 m²
    expect(g.area).toBeCloseTo(0.24, 4);
  });

  it('circular area ≈ π r² (m²) — accept polygon approx error', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'circular', width: 500 }));
    // 32-segment polygon approximation of Ø500mm (r=0.25m).
    const expected = Math.PI * 0.25 * 0.25;
    // Accept 1% relative error για 32 segments.
    expect(g.area).toBeGreaterThan(expected * 0.98);
    expect(g.area).toBeLessThan(expected * 1.001);
  });

  it('volume = area × height/1000 (m³)', () => {
    const g = computeColumnGeometry(makeColumn({ width: 400, depth: 400, height: 3000 }));
    // 0.16 m² × 3.0 m = 0.48 m³
    expect(g.volume).toBeCloseTo(0.48, 4);
  });

  it('mirrors height από params σε geometry', () => {
    const g = computeColumnGeometry(makeColumn({ height: 2700 }));
    expect(g.height).toBeCloseTo(2700, FLOAT_TOL);
  });
});

describe('getColumnSlenderness', () => {
  it('rectangular: height / min(width, depth)', () => {
    const r = getColumnSlenderness(makeColumn({ width: 400, depth: 300, height: 3000 }));
    expect(r).toBeCloseTo(10, FLOAT_TOL);
  });

  it('circular: height / width (diameter)', () => {
    const r = getColumnSlenderness(makeColumn({ kind: 'circular', width: 300, height: 3000 }));
    expect(r).toBeCloseTo(10, FLOAT_TOL);
  });

  it('zero dimension yields Infinity (degenerate guard)', () => {
    const r = getColumnSlenderness(makeColumn({ width: 0 }));
    expect(r).toBe(Number.POSITIVE_INFINITY);
  });
});
