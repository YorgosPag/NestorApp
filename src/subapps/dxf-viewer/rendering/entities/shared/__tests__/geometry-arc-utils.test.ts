import {
  arcFrom3Points,
  arcFromCenterStartEnd,
  arcFromStartCenterEnd,
  calculateArcLength,
  isAngleBetween
} from '../geometry-arc-utils';
import { degToRad } from '../geometry-angle-utils';

describe('geometry-arc-utils', () => {
  // ===== arcFrom3Points =====
  describe('arcFrom3Points', () => {
    it('finds semicircle arc through 3 points', () => {
      // Points on top half of unit circle
      const result = arcFrom3Points(
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 }
      );

      expect(result).not.toBeNull();
      expect(result!.center.x).toBeCloseTo(0, 3);
      expect(result!.center.y).toBeCloseTo(0, 3);
      expect(result!.radius).toBeCloseTo(1, 3);
    });

    it('returns null for collinear points', () => {
      const result = arcFrom3Points(
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 }
      );
      expect(result).toBeNull();
    });
  });

  // ===== arcFromCenterStartEnd =====
  describe('arcFromCenterStartEnd', () => {
    it('creates 90° arc from center and points', () => {
      const result = arcFromCenterStartEnd(
        { x: 0, y: 0 },  // center
        { x: 1, y: 0 },  // start (0°)
        { x: 0, y: 1 }   // end (90°)
      );

      expect(result.center.x).toBeCloseTo(0, 10);
      expect(result.center.y).toBeCloseTo(0, 10);
      expect(result.radius).toBeCloseTo(1, 5);
    });

    it('radius matches distance from center to start', () => {
      const center = { x: 2, y: 3 };
      const start = { x: 7, y: 3 }; // 5 units away
      const end = { x: 2, y: 8 };

      const result = arcFromCenterStartEnd(center, start, end);
      expect(result.radius).toBeCloseTo(5, 5);
    });
  });

  // ===== arcFromStartCenterEnd =====
  describe('arcFromStartCenterEnd', () => {
    it('is consistent with arcFromCenterStartEnd', () => {
      const center = { x: 0, y: 0 };
      const start = { x: 1, y: 0 };
      const end = { x: 0, y: 1 };

      const r1 = arcFromCenterStartEnd(center, start, end);
      const r2 = arcFromStartCenterEnd(start, center, end);

      expect(r2.center.x).toBeCloseTo(r1.center.x, 10);
      expect(r2.center.y).toBeCloseTo(r1.center.y, 10);
      expect(r2.radius).toBeCloseTo(r1.radius, 10);
    });
  });

  // ===== calculateArcLength (angles in RADIANS) =====
  describe('calculateArcLength', () => {
    it('full circle = 2πr', () => {
      const r = 5;
      const length = calculateArcLength(r, 0, 2 * Math.PI);
      expect(length).toBeCloseTo(2 * Math.PI * r, 3);
    });

    it('quarter circle = πr/2', () => {
      const r = 10;
      const length = calculateArcLength(r, 0, Math.PI / 2);
      expect(length).toBeCloseTo(Math.PI * r / 2, 3);
    });

    it('semicircle = πr', () => {
      const r = 3;
      const length = calculateArcLength(r, 0, Math.PI);
      expect(length).toBeCloseTo(Math.PI * r, 3);
    });

    it('zero-length arc', () => {
      expect(calculateArcLength(5, 1.0, 1.0)).toBeCloseTo(0, 5);
    });
  });

  // ===== isAngleBetween (angles in RADIANS) =====
  describe('isAngleBetween', () => {
    it('π/4 is between 0 and π/2', () => {
      expect(isAngleBetween(Math.PI / 4, 0, Math.PI / 2)).toBe(true);
    });

    it('3π/4 is NOT between 0 and π/2', () => {
      expect(isAngleBetween(3 * Math.PI / 4, 0, Math.PI / 2)).toBe(false);
    });

    it('handles wrap-around: 350° is between 300° and 30°', () => {
      expect(isAngleBetween(degToRad(350), degToRad(300), degToRad(30))).toBe(true);
    });

    it('handles wrap-around: 180° is NOT between 300° and 30°', () => {
      expect(isAngleBetween(degToRad(180), degToRad(300), degToRad(30))).toBe(false);
    });

    it('exact start angle is included', () => {
      expect(isAngleBetween(0, 0, Math.PI / 2)).toBe(true);
    });
  });
});
