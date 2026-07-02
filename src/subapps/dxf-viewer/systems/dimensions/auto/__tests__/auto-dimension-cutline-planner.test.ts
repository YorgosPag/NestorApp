/**
 * ADR-563 Φ4-Α — interactive cut-line chain planner unit tests.
 */

import type { Point2D } from '../../../../rendering/types/Types';
import { planCutLineChain } from '../auto-dimension-cutline-planner';
import { buildAutoDimensionEntities } from '../auto-dimension-entity-factory';
import { AUTO_DIMENSION_DEFAULTS } from '../auto-dimension-types';
import { makeBimMock } from './auto-dim-test-mocks';

const CTX = { styleId: 'iso', layerId: '0' };

/** 300mm-square column centred at (cx,cy). */
function column(id: string, cx: number, cy: number) {
  return makeBimMock('column', id, cx - 150, cy - 150, cx + 150, cy + 150);
}

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

describe('planCutLineChain', () => {
  it('dimensions 3 columns crossed by a horizontal cut line, center-to-center', () => {
    const cols = [column('c1', 0, 0), column('c2', 5000, 0), column('c3', 9000, 0)];
    const segs = planCutLineChain(
      cols,
      { x: -1000, y: 0 },
      { x: 10000, y: 0 },
      { x: 0, y: 1000 }, // placement 1000mm to the +Y side
      AUTO_DIMENSION_DEFAULTS,
    );
    expect(segs).toHaveLength(2);
    expect(segs.every((s) => s.dimensionType === 'aligned')).toBe(true);
    // Extension origins ride the cut line at each column center.
    expect(segs[0].defPoints[0].x).toBeCloseTo(0, 3);
    expect(segs[0].defPoints[1].x).toBeCloseTo(5000, 3);
    expect(segs[1].defPoints[0].x).toBeCloseTo(5000, 3);
    expect(segs[1].defPoints[1].x).toBeCloseTo(9000, 3);
    // Measured spans = center-to-center.
    expect(dist(segs[0].defPoints[0], segs[0].defPoints[1])).toBeCloseTo(5000, 3);
    expect(dist(segs[1].defPoints[0], segs[1].defPoints[1])).toBeCloseTo(4000, 3);
    // Dim line sits 1000mm on the +Y side (placement point offset).
    expect(segs[0].defPoints[2].y).toBeCloseTo(1000, 3);
  });

  it('places the chain on the OTHER side when the placement point flips', () => {
    const cols = [column('c1', 0, 0), column('c2', 5000, 0)];
    const segs = planCutLineChain(
      cols,
      { x: -1000, y: 0 },
      { x: 6000, y: 0 },
      { x: 0, y: -800 }, // placement on the −Y side
      AUTO_DIMENSION_DEFAULTS,
    );
    expect(segs).toHaveLength(1);
    expect(segs[0].defPoints[2].y).toBeCloseTo(-800, 3);
  });

  it('measures FACE-to-face when the basis is "faces"', () => {
    const segs = planCutLineChain(
      [column('c1', 0, 0)],
      { x: -1000, y: 0 },
      { x: 1000, y: 0 },
      { x: 0, y: 500 },
      { ...AUTO_DIMENSION_DEFAULTS, referenceBasis: 'faces' },
    );
    // One column → its two faces along the axis → one 300mm segment.
    expect(segs).toHaveLength(1);
    expect(dist(segs[0].defPoints[0], segs[0].defPoints[1])).toBeCloseTo(300, 3);
  });

  it('measures the TRUE span along a 45° skewed cut line', () => {
    const cols = [column('c1', 0, 0), column('c2', 1000, 1000)];
    const segs = planCutLineChain(
      cols,
      { x: -100, y: -100 },
      { x: 1100, y: 1100 },
      { x: 1100, y: -900 }, // some perpendicular placement
      AUTO_DIMENSION_DEFAULTS,
    );
    expect(segs).toHaveLength(1);
    // √(1000² + 1000²) ≈ 1414.2 — the diagonal distance, not the bbox width.
    // Tolerance ~2mm: the along coords are quantized to a 1mm grid (dedupSorted).
    expect(Math.abs(dist(segs[0].defPoints[0], segs[0].defPoints[1]) - 1414.21)).toBeLessThan(2);
  });

  it('returns [] for a degenerate (zero-length) cut line', () => {
    const cols = [column('c1', 0, 0), column('c2', 5000, 0)];
    expect(planCutLineChain(cols, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, AUTO_DIMENSION_DEFAULTS)).toEqual([]);
  });

  it('returns [] when the cut line crosses fewer than 2 elements', () => {
    const cols = [column('c1', 0, 0), column('c2', 5000, 0)];
    // Line far away on +Y — crosses nothing.
    const segs = planCutLineChain(cols, { x: -1000, y: 9000 }, { x: 10000, y: 9000 }, { x: 0, y: 1 }, AUTO_DIMENSION_DEFAULTS);
    expect(segs).toEqual([]);
  });

  it('honours includeOpenings for openings on the line', () => {
    const openings = [
      makeBimMock('opening', 'o1', -50, -50, 50, 50),
      makeBimMock('opening', 'o2', 2950, -50, 3050, 50),
    ];
    const cut = [{ x: -500, y: 0 }, { x: 3500, y: 0 }, { x: 0, y: 400 }] as const;
    const off = planCutLineChain(openings, cut[0], cut[1], cut[2], { ...AUTO_DIMENSION_DEFAULTS, includeOpenings: false });
    const on = planCutLineChain(openings, cut[0], cut[1], cut[2], { ...AUTO_DIMENSION_DEFAULTS, includeOpenings: true });
    expect(off).toEqual([]);
    expect(on).toHaveLength(1);
    expect(dist(on[0].defPoints[0], on[0].defPoints[1])).toBeCloseTo(3000, 3);
  });
});

describe('cut-line chain → entity factory', () => {
  it('produces non-associative AlignedDimensionEntity chain', () => {
    const cols = [column('c1', 0, 0), column('c2', 5000, 0), column('c3', 9000, 0)];
    const segs = planCutLineChain(cols, { x: -1000, y: 0 }, { x: 10000, y: 0 }, { x: 0, y: 1000 }, AUTO_DIMENSION_DEFAULTS);
    const dims = buildAutoDimensionEntities(segs, CTX);
    expect(dims).toHaveLength(2);
    expect(dims.every((d) => d.dimensionType === 'aligned')).toBe(true);
    expect(dims.every((d) => !('rotation' in d))).toBe(true);
    expect(dims.every((d) => d.associations === undefined)).toBe(true);
  });
});
