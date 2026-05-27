/**
 * ADR-363 Phase 4 / Phase 8 — `computeColumnGeometry` tests.
 *
 * Coverage:
 *   - Rectangular footprint (4 vertices, width × depth)
 *   - Circular footprint (CIRCULAR_COLUMN_SEGMENTS vertices)
 *   - L-shape footprint (6 vertices, correct cut)
 *   - T-shape footprint (8 vertices, flange + web)
 *   - Polygon footprint (N vertices on circumscribed circle, ADR-363 Phase 8)
 *   - Shear-wall footprint (4 vertices, length×thickness, ADR-363 Phase 8)
 *   - I-shape footprint (12 vertices, flange/web, ADR-363 Phase 8)
 *   - Anchor offset (center vs nw vs se)
 *   - Rotation (0 / 45 / 90 deg)
 *   - Area (m²) — all kinds sanity
 *   - Volume (m³) — area × height/1000
 *   - Bbox folds vertices
 */

import { computeColumnGeometry, getColumnSlenderness } from '../column-geometry';
import {
  CIRCULAR_COLUMN_SEGMENTS,
  DEFAULT_I_FLANGE_THICKNESS_MM,
  DEFAULT_I_WEB_THICKNESS_MM,
  DEFAULT_POLYGON_SIDES,
  MAX_POLYGON_SIDES,
  MIN_POLYGON_SIDES,
  type ColumnParams,
} from '../../types/column-types';

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
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    ...overrides,
  } as ColumnParams;
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

  it('polygon: height / width (circumscribed Ø, mirrors circular)', () => {
    const r = getColumnSlenderness(makeColumn({ kind: 'polygon', width: 300, height: 3000 }));
    expect(r).toBeCloseTo(10, FLOAT_TOL);
  });

  it('shear-wall: height / min(length, thickness)', () => {
    const r = getColumnSlenderness(makeColumn({ kind: 'shear-wall', width: 2000, depth: 200, height: 3000 }));
    expect(r).toBeCloseTo(15, FLOAT_TOL);
  });

  it('I-shape: height / min(b, h)', () => {
    const r = getColumnSlenderness(makeColumn({ kind: 'I-shape', width: 200, depth: 300, height: 3000 }));
    expect(r).toBeCloseTo(15, FLOAT_TOL);
  });

  it('zero dimension yields Infinity (degenerate guard)', () => {
    const r = getColumnSlenderness(makeColumn({ width: 0 }));
    expect(r).toBe(Number.POSITIVE_INFINITY);
  });
});

// ─── ADR-363 Phase 8 — polygon / shear-wall / I-shape ──────────────────────

describe('computeColumnGeometry — polygon (regular N-gon)', () => {
  it('default sides (hex) emits DEFAULT_POLYGON_SIDES vertices', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'polygon', width: 400 }));
    expect(g.footprint.vertices).toHaveLength(DEFAULT_POLYGON_SIDES);
  });

  it('vertices sit on circumscribed circle (radius = width/2)', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'polygon', width: 400 }));
    for (const v of g.footprint.vertices) {
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(200, 3);
    }
  });

  it('respects sides override (pentagon = 5)', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'polygon', width: 400, polygon: { sides: 5 } }));
    expect(g.footprint.vertices).toHaveLength(5);
  });

  it('clamps sides below MIN_POLYGON_SIDES (2 → 3)', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'polygon', width: 400, polygon: { sides: 2 } }));
    expect(g.footprint.vertices).toHaveLength(MIN_POLYGON_SIDES);
  });

  it('clamps sides above MAX_POLYGON_SIDES (15 → 12)', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'polygon', width: 400, polygon: { sides: 15 } }));
    expect(g.footprint.vertices).toHaveLength(MAX_POLYGON_SIDES);
  });

  it('vertex 0 points up (math +Y) per Revit/AutoCAD convention', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'polygon', width: 400, polygon: { sides: 4 } }));
    const v0 = g.footprint.vertices[0];
    expect(v0.x).toBeCloseTo(0, 3);
    expect(v0.y).toBeCloseTo(200, 3);
  });

  it('area matches (1/2) n r² sin(2π/n) for hexagon', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'polygon', width: 400, polygon: { sides: 6 } }));
    const n = 6, r = 0.2;  // 200mm in meters
    const expected = 0.5 * n * r * r * Math.sin((2 * Math.PI) / n);
    expect(g.area).toBeCloseTo(expected, 4);
  });
});

describe('computeColumnGeometry — shear-wall', () => {
  it('emits 4-vertex CCW footprint (rectangular reuse)', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'shear-wall', width: 2000, depth: 200 }));
    expect(g.footprint.vertices).toHaveLength(4);
  });

  it('bbox spans length × thickness', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'shear-wall', width: 2000, depth: 200 }));
    expect(g.bbox.max.x - g.bbox.min.x).toBeCloseTo(2000, 3);
    expect(g.bbox.max.y - g.bbox.min.y).toBeCloseTo(200, 3);
  });

  it('area = length × thickness (m²)', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'shear-wall', width: 2000, depth: 200 }));
    // 2.0m × 0.2m = 0.4 m²
    expect(g.area).toBeCloseTo(0.4, 4);
  });

  it('supports anchor offset (se corner)', () => {
    const g = computeColumnGeometry(makeColumn({
      kind: 'shear-wall', position: { x: 0, y: 0, z: 0 }, anchor: 'se', width: 2000, depth: 200,
    }));
    expect(g.bbox.max.x).toBeCloseTo(0, 3);
    expect(g.bbox.min.y).toBeCloseTo(0, 3);
  });
});

describe('computeColumnGeometry — I-shape (double-T)', () => {
  it('emits 12-vertex outline', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'I-shape', width: 200, depth: 300 }));
    expect(g.footprint.vertices).toHaveLength(12);
  });

  it('bbox spans b × h', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'I-shape', width: 200, depth: 300 }));
    expect(g.bbox.max.x - g.bbox.min.x).toBeCloseTo(200, 3);
    expect(g.bbox.max.y - g.bbox.min.y).toBeCloseTo(300, 3);
  });

  it('area = 2*(b*tf) + tw*(h - 2*tf) (m²) με defaults IPE-300', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'I-shape', width: 200, depth: 300 }));
    const b = 0.2, h = 0.3;
    const tf = DEFAULT_I_FLANGE_THICKNESS_MM / 1000;
    const tw = DEFAULT_I_WEB_THICKNESS_MM / 1000;
    const expected = 2 * (b * tf) + tw * (h - 2 * tf);
    expect(g.area).toBeCloseTo(expected, 5);
  });

  it('respects ishape.flangeThickness override', () => {
    const g = computeColumnGeometry(makeColumn({
      kind: 'I-shape', width: 200, depth: 300, ishape: { flangeThickness: 30 },
    }));
    const b = 0.2, h = 0.3;
    const tf = 0.03;
    const tw = DEFAULT_I_WEB_THICKNESS_MM / 1000;
    const expected = 2 * (b * tf) + tw * (h - 2 * tf);
    expect(g.area).toBeCloseTo(expected, 5);
  });
});
