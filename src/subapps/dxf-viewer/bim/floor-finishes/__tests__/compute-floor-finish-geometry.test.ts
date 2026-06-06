/**
 * ADR-419 — computeFloorFinishGeometry unit tests.
 * Validates bbox correctness, area, and perimeter for various polygons.
 */

import { computeFloorFinishGeometry } from '../../types/floor-finish-types';
import type { FloorFinishParams } from '../../types/floor-finish-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeParams(vertices: Array<{ x: number; y: number }>): Pick<FloorFinishParams, 'footprint'> {
  return { footprint: { vertices } };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeFloorFinishGeometry()', () => {
  describe('degenerate polygon (< 3 vertices)', () => {
    it('returns zero bbox/area/perimeter for empty vertices', () => {
      const result = computeFloorFinishGeometry(makeParams([]));
      expect(result.area).toBe(0);
      expect(result.perimeter).toBe(0);
      expect(result.bbox).toEqual({ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } });
    });

    it('returns zeros for 2 vertices', () => {
      const result = computeFloorFinishGeometry(makeParams([{ x: 0, y: 0 }, { x: 1000, y: 0 }]));
      expect(result.area).toBe(0);
      expect(result.perimeter).toBe(0);
    });
  });

  describe('unit square 1000x1000mm', () => {
    const square = makeParams([
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ]);

    it('area = 1.0 m²', () => {
      const { area } = computeFloorFinishGeometry(square);
      expect(area).toBeCloseTo(1.0, 6);
    });

    it('perimeter = 4.0 m', () => {
      const { perimeter } = computeFloorFinishGeometry(square);
      expect(perimeter).toBeCloseTo(4.0, 6);
    });

    it('bbox: min (0,0) max (1000,1000)', () => {
      const { bbox } = computeFloorFinishGeometry(square);
      expect(bbox.min).toMatchObject({ x: 0, y: 0 });
      expect(bbox.max).toMatchObject({ x: 1000, y: 1000 });
    });
  });

  describe('2000 x 3000 mm rectangle', () => {
    const rect = makeParams([
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: 3000 },
      { x: 0, y: 3000 },
    ]);

    it('area = 6.0 m²', () => {
      expect(computeFloorFinishGeometry(rect).area).toBeCloseTo(6.0, 6);
    });

    it('perimeter = 10.0 m', () => {
      expect(computeFloorFinishGeometry(rect).perimeter).toBeCloseTo(10.0, 6);
    });

    it('bbox: min (0,0) max (2000,3000)', () => {
      const { bbox } = computeFloorFinishGeometry(rect);
      expect(bbox.min).toMatchObject({ x: 0, y: 0 });
      expect(bbox.max).toMatchObject({ x: 2000, y: 3000 });
    });
  });

  describe('triangle (right-angle, 1000x1000mm)', () => {
    const triangle = makeParams([
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 0, y: 1000 },
    ]);

    it('area = 0.5 m²', () => {
      expect(computeFloorFinishGeometry(triangle).area).toBeCloseTo(0.5, 6);
    });

    it('perimeter = (1 + 1 + √2) m ≈ 3.414 m', () => {
      const expected = (1000 + 1000 + Math.sqrt(2) * 1000) * 0.001;
      expect(computeFloorFinishGeometry(triangle).perimeter).toBeCloseTo(expected, 5);
    });

    it('bbox: min (0,0) max (1000,1000)', () => {
      const { bbox } = computeFloorFinishGeometry(triangle);
      expect(bbox.min).toMatchObject({ x: 0, y: 0 });
      expect(bbox.max).toMatchObject({ x: 1000, y: 1000 });
    });
  });

  describe('offset polygon (non-origin anchor)', () => {
    const rect = makeParams([
      { x: 500, y: 300 },
      { x: 1500, y: 300 },
      { x: 1500, y: 1300 },
      { x: 500, y: 1300 },
    ]);

    it('area = 1.0 m² (same as unit square)', () => {
      expect(computeFloorFinishGeometry(rect).area).toBeCloseTo(1.0, 6);
    });

    it('bbox respects actual coordinates', () => {
      const { bbox } = computeFloorFinishGeometry(rect);
      expect(bbox.min).toMatchObject({ x: 500, y: 300 });
      expect(bbox.max).toMatchObject({ x: 1500, y: 1300 });
    });
  });

  describe('L-shaped polygon (6 vertices)', () => {
    // L-shape: 2x2m outer, 1x1m corner removed → area = 4 - 1 = 3 m²
    const Lshape = makeParams([
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: 2000 },
      { x: 1000, y: 2000 },
      { x: 1000, y: 1000 },
      { x: 0, y: 1000 },
    ]);

    it('area = 3.0 m²', () => {
      expect(computeFloorFinishGeometry(Lshape).area).toBeCloseTo(3.0, 5);
    });

    it('bbox = 0,0 → 2000,2000', () => {
      const { bbox } = computeFloorFinishGeometry(Lshape);
      expect(bbox.min).toMatchObject({ x: 0, y: 0 });
      expect(bbox.max).toMatchObject({ x: 2000, y: 2000 });
    });
  });
});
