import {
  calculatePolylineLength,
  calculatePolygonPerimeter,
  calculatePolygonArea,
  calculatePolygonCentroid,
  simplifyPolyline
} from '../geometry-polyline-utils';

describe('geometry-polyline-utils', () => {
  // ===== calculatePolylineLength =====
  describe('calculatePolylineLength', () => {
    it('unit square open polyline = 3 sides', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ];
      expect(calculatePolylineLength(points, false)).toBeCloseTo(3, 10);
    });

    it('unit square closed polyline = 4 sides', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ];
      expect(calculatePolylineLength(points, true)).toBeCloseTo(4, 10);
    });

    it('single point = 0 length', () => {
      expect(calculatePolylineLength([{ x: 5, y: 5 }])).toBe(0);
    });

    it('empty array = 0 length', () => {
      expect(calculatePolylineLength([])).toBe(0);
    });

    it('diagonal line = √2', () => {
      const points = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
      expect(calculatePolylineLength(points)).toBeCloseTo(Math.SQRT2, 10);
    });
  });

  // ===== calculatePolygonPerimeter =====
  describe('calculatePolygonPerimeter', () => {
    it('unit square perimeter = 4', () => {
      const square = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ];
      expect(calculatePolygonPerimeter(square)).toBeCloseTo(4, 10);
    });

    it('equilateral triangle perimeter = 3 * side', () => {
      const side = 2;
      const h = side * Math.sqrt(3) / 2;
      const triangle = [
        { x: 0, y: 0 },
        { x: side, y: 0 },
        { x: side / 2, y: h }
      ];
      expect(calculatePolygonPerimeter(triangle)).toBeCloseTo(3 * side, 5);
    });
  });

  // ===== calculatePolygonArea =====
  describe('calculatePolygonArea', () => {
    it('unit square area = 1', () => {
      const square = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ];
      expect(calculatePolygonArea(square)).toBeCloseTo(1, 10);
    });

    it('2x3 rectangle area = 6', () => {
      const rect = [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 3 },
        { x: 0, y: 3 }
      ];
      expect(calculatePolygonArea(rect)).toBeCloseTo(6, 10);
    });

    it('right triangle area = 0.5 * base * height', () => {
      const triangle = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 3 }
      ];
      expect(calculatePolygonArea(triangle)).toBeCloseTo(6, 10);
    });

    it('area is always positive (CCW or CW)', () => {
      // CW winding
      const cw = [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 0 }
      ];
      expect(calculatePolygonArea(cw)).toBeGreaterThan(0);
    });
  });

  // ===== calculatePolygonCentroid =====
  describe('calculatePolygonCentroid', () => {
    it('unit square centroid = (0.5, 0.5)', () => {
      const square = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ];
      const centroid = calculatePolygonCentroid(square);
      expect(centroid.x).toBeCloseTo(0.5, 5);
      expect(centroid.y).toBeCloseTo(0.5, 5);
    });

    it('symmetric triangle centroid at 1/3 height', () => {
      const triangle = [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 3, y: 6 }
      ];
      const centroid = calculatePolygonCentroid(triangle);
      expect(centroid.x).toBeCloseTo(3, 3);
      expect(centroid.y).toBeCloseTo(2, 3);
    });
  });

  // ===== simplifyPolyline =====
  describe('simplifyPolyline', () => {
    it('collinear points simplified to endpoints', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 }
      ];
      const result = simplifyPolyline(points, 0.1);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ x: 0, y: 0 });
      expect(result[result.length - 1]).toEqual({ x: 3, y: 0 });
    });

    it('tolerance 0 keeps all non-collinear points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 }
      ];
      const result = simplifyPolyline(points, 0);
      expect(result).toHaveLength(3);
    });

    it('preserves endpoints', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 5, y: 0.01 },
        { x: 10, y: 0 }
      ];
      const result = simplifyPolyline(points, 1);
      expect(result[0]).toEqual(points[0]);
      expect(result[result.length - 1]).toEqual(points[points.length - 1]);
    });

    it('returns same for 2 points', () => {
      const points = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
      expect(simplifyPolyline(points, 1)).toHaveLength(2);
    });
  });
});
