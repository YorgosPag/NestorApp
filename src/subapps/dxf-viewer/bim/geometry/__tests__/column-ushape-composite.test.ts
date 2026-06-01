/**
 * ADR-363 Phase 2 «από περίγραμμα» — U-shape + composite column geometry.
 *
 * Coverage:
 *   - U-shape παραμετρικό → 8-vertex CCW Π, bbox = width×depth, area>0
 *   - U-shape flipY → 8 vertices, ίδιο bbox, area>0 (CCW διατηρείται)
 *   - U-shape με explicit polygon → pass-through (count + scale)
 *   - composite → polygon pass-through (count, bbox, shoelace area)
 *   - composite degenerate guard (<3 κορυφές) → fallback τετράγωνο
 *   - anchor offset (bbox-driven, όπως polygon)
 *   - validator: invalid polygon / thin member → hardError / codeViolation
 *   - dim-labels format (w/d)
 */

import { computeColumnGeometry } from '../column-geometry';
import { validateColumnParams } from '../../validators/column-validator';
import { formatColumnDimLabels } from '../../columns/column-dim-labels';
import type { ColumnParams } from '../../types/column-types';

const FLOAT_TOL = 1e-6;

function makeColumn(overrides?: Partial<ColumnParams>): ColumnParams {
  return {
    kind: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    anchor: 'center',
    width: 600,
    depth: 600,
    height: 3000,
    rotation: 0,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    ...overrides,
  } as ColumnParams;
}

describe('U-shape footprint — parametric Π', () => {
  it('emits an 8-vertex footprint with bbox = width × depth', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'U-shape', width: 600, depth: 600 }));
    expect(g.footprint.vertices).toHaveLength(8);
    expect(g.bbox.min.x).toBeCloseTo(-300, FLOAT_TOL);
    expect(g.bbox.max.x).toBeCloseTo(300, FLOAT_TOL);
    expect(g.bbox.min.y).toBeCloseTo(-300, FLOAT_TOL);
    expect(g.bbox.max.y).toBeCloseTo(300, FLOAT_TOL);
  });

  it('has a positive (non-degenerate) area smaller than the full bbox (notch removed)', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'U-shape', width: 600, depth: 600 }));
    expect(g.area).toBeGreaterThan(0);
    // bbox = 0.36 m²· το Π αφαιρεί κεντρικό notch → μικρότερο εμβαδόν.
    expect(g.area).toBeLessThan(0.36);
  });

  it('flipY keeps 8 vertices, same bbox and positive area', () => {
    const g = computeColumnGeometry(
      makeColumn({ kind: 'U-shape', width: 600, depth: 600, ushape: { flipY: true } }),
    );
    expect(g.footprint.vertices).toHaveLength(8);
    expect(g.bbox.max.x).toBeCloseTo(300, FLOAT_TOL);
    expect(g.area).toBeGreaterThan(0);
  });

  it('custom leg/base thickness produces a thinner channel (more removed area)', () => {
    const thin = computeColumnGeometry(
      makeColumn({ kind: 'U-shape', width: 600, depth: 600, ushape: { legThickness: 80, baseThickness: 80 } }),
    );
    const thick = computeColumnGeometry(
      makeColumn({ kind: 'U-shape', width: 600, depth: 600, ushape: { legThickness: 200, baseThickness: 200 } }),
    );
    expect(thin.area).toBeLessThan(thick.area);
  });
});

describe('U-shape footprint — explicit polygon override', () => {
  it('passes through the polygon verbatim (scaled), ignoring parametric defaults', () => {
    const polygon = [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: -100, y: 0 },
    ];
    const g = computeColumnGeometry(makeColumn({ kind: 'U-shape', ushape: { polygon } }));
    expect(g.footprint.vertices).toHaveLength(5);
  });
});

describe('composite footprint — polygon pass-through', () => {
  it('emits the polygon vertices and bbox', () => {
    const polygon = [
      { x: -300, y: -300 },
      { x: 300, y: -300 },
      { x: 300, y: 300 },
      { x: -300, y: 300 },
    ];
    const g = computeColumnGeometry(makeColumn({ kind: 'composite', composite: { polygon } }));
    expect(g.footprint.vertices).toHaveLength(4);
    expect(g.bbox.min.x).toBeCloseTo(-300, FLOAT_TOL);
    expect(g.bbox.max.y).toBeCloseTo(300, FLOAT_TOL);
    // 600×600 mm² = 0.36 m².
    expect(g.area).toBeCloseTo(0.36, 4);
  });

  it('degenerate composite (no polygon) falls back to a small square', () => {
    const g = computeColumnGeometry(makeColumn({ kind: 'composite' }));
    expect(g.footprint.vertices).toHaveLength(4);
    expect(g.area).toBeGreaterThan(0);
  });
});

describe('anchor offset (bbox-driven for U-shape/composite)', () => {
  it('center anchor: composite bbox centred on position', () => {
    const polygon = [
      { x: -200, y: -200 },
      { x: 200, y: -200 },
      { x: 200, y: 200 },
      { x: -200, y: 200 },
    ];
    const g = computeColumnGeometry(
      makeColumn({ kind: 'composite', composite: { polygon }, position: { x: 1000, y: 2000, z: 0 } }),
    );
    const cx = (g.bbox.min.x + g.bbox.max.x) / 2;
    const cy = (g.bbox.min.y + g.bbox.max.y) / 2;
    expect(cx).toBeCloseTo(1000, FLOAT_TOL);
    expect(cy).toBeCloseTo(2000, FLOAT_TOL);
  });
});

describe('validator — U-shape / composite', () => {
  it('accepts a valid parametric U-shape', () => {
    const r = validateColumnParams(
      makeColumn({ kind: 'U-shape', width: 2000, depth: 400, ushape: { legThickness: 200, baseThickness: 200 } }),
    );
    expect(r.hardErrors).toHaveLength(0);
  });

  it('rejects a U-shape leg thicker than half the width', () => {
    const r = validateColumnParams(
      makeColumn({ kind: 'U-shape', width: 600, depth: 600, ushape: { legThickness: 400 } }),
    );
    expect(r.hardErrors).toContain('column.validation.hardErrors.invalidUshapeLeg');
  });

  it('flags a thin U-shape member as an Eurocode 8 code violation', () => {
    const r = validateColumnParams(
      makeColumn({ kind: 'U-shape', width: 600, depth: 600, ushape: { legThickness: 100, baseThickness: 100 } }),
    );
    expect(r.codeViolations).toContain('column.validation.codeViolations.shearWallThicknessTooSmall');
  });

  it('rejects a composite with fewer than 3 vertices', () => {
    const r = validateColumnParams(
      makeColumn({ kind: 'composite', composite: { polygon: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } }),
    );
    expect(r.hardErrors).toContain('column.validation.hardErrors.invalidCompositePolygon');
  });

  it('accepts a valid composite polygon', () => {
    const r = validateColumnParams(
      makeColumn({
        kind: 'composite',
        composite: { polygon: [{ x: -300, y: -300 }, { x: 300, y: -300 }, { x: 300, y: 300 }, { x: -300, y: 300 }] },
      }),
    );
    expect(r.hardErrors).toHaveLength(0);
  });
});

describe('dim-labels — U-shape / composite', () => {
  it('formats bbox w/d for U-shape', () => {
    expect(formatColumnDimLabels(makeColumn({ kind: 'U-shape', width: 2000, depth: 400 }))).toEqual(['w=2000  d=400']);
  });

  it('formats bbox w/d for composite', () => {
    expect(formatColumnDimLabels(makeColumn({ kind: 'composite', width: 500, depth: 500 }))).toEqual(['w=500  d=500']);
  });
});
