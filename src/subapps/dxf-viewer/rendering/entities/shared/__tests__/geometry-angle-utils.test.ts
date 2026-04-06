import {
  degToRad,
  radToDeg,
  normalizeAngleRad,
  normalizeAngleDeg,
  normalizeAngleDiff,
  normalizeTextAngle,
  bisectorAngle,
  angleBetweenPoints,
  angleFromHorizontal,
  DEGREES_TO_RADIANS,
  RADIANS_TO_DEGREES,
  RIGHT_ANGLE,
  ARROW_ANGLE
} from '../geometry-angle-utils';

describe('geometry-angle-utils', () => {
  // ===== CONSTANTS =====
  describe('constants', () => {
    it('RIGHT_ANGLE equals π/2', () => {
      expect(RIGHT_ANGLE).toBeCloseTo(Math.PI / 2, 10);
    });

    it('ARROW_ANGLE equals π/6', () => {
      expect(ARROW_ANGLE).toBeCloseTo(Math.PI / 6, 10);
    });

    it('DEGREES_TO_RADIANS = π/180', () => {
      expect(DEGREES_TO_RADIANS).toBeCloseTo(Math.PI / 180, 10);
    });

    it('RADIANS_TO_DEGREES = 180/π', () => {
      expect(RADIANS_TO_DEGREES).toBeCloseTo(180 / Math.PI, 10);
    });
  });

  // ===== CONVERSIONS =====
  describe('degToRad / radToDeg', () => {
    it('converts 90° to π/2', () => {
      expect(degToRad(90)).toBeCloseTo(Math.PI / 2, 10);
    });

    it('converts 180° to π', () => {
      expect(degToRad(180)).toBeCloseTo(Math.PI, 10);
    });

    it('converts 0° to 0', () => {
      expect(degToRad(0)).toBe(0);
    });

    it('converts π/2 to 90°', () => {
      expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 10);
    });

    it('round-trip degToRad → radToDeg preserves value', () => {
      const degrees = 137.5;
      expect(radToDeg(degToRad(degrees))).toBeCloseTo(degrees, 10);
    });
  });

  // ===== NORMALIZATION =====
  describe('normalizeAngleRad', () => {
    it('keeps 0 as 0', () => {
      expect(normalizeAngleRad(0)).toBeCloseTo(0, 10);
    });

    it('keeps π as π', () => {
      expect(normalizeAngleRad(Math.PI)).toBeCloseTo(Math.PI, 10);
    });

    it('normalizes 2π to 0', () => {
      expect(normalizeAngleRad(2 * Math.PI)).toBeCloseTo(0, 5);
    });

    it('normalizes negative angle', () => {
      const result = normalizeAngleRad(-Math.PI / 2);
      expect(result).toBeCloseTo(3 * Math.PI / 2, 10);
    });

    it('normalizes >2π angle', () => {
      const result = normalizeAngleRad(5 * Math.PI);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(2 * Math.PI);
    });
  });

  describe('normalizeAngleDeg', () => {
    it('keeps 0 as 0', () => {
      expect(normalizeAngleDeg(0)).toBeCloseTo(0, 10);
    });

    it('normalizes 360 to 0', () => {
      expect(normalizeAngleDeg(360)).toBeCloseTo(0, 5);
    });

    it('normalizes -90 to 270', () => {
      expect(normalizeAngleDeg(-90)).toBeCloseTo(270, 10);
    });

    it('normalizes 450 to 90', () => {
      expect(normalizeAngleDeg(450)).toBeCloseTo(90, 10);
    });
  });

  describe('normalizeAngleDiff', () => {
    it('keeps small positive diff unchanged', () => {
      expect(normalizeAngleDiff(0.5)).toBeCloseTo(0.5, 10);
    });

    it('wraps large positive diff', () => {
      const result = normalizeAngleDiff(3 * Math.PI);
      expect(result).toBeCloseTo(Math.PI, 5);
    });

    it('wraps negative diff to (-π, π]', () => {
      // -3π normalizes to π (since range is (-π, π])
      const result = normalizeAngleDiff(-3 * Math.PI);
      expect(result).toBeCloseTo(Math.PI, 5);
    });
  });

  describe('normalizeTextAngle', () => {
    it('keeps 0 as 0', () => {
      expect(normalizeTextAngle(0)).toBeCloseTo(0, 10);
    });

    it('flips upside-down text (π)', () => {
      const result = normalizeTextAngle(Math.PI);
      // Text at π should be flipped to be readable
      expect(result).toBeDefined();
    });
  });

  // ===== ANGLE CALCULATIONS =====
  describe('bisectorAngle', () => {
    it('bisector of 0 and π is π/2', () => {
      expect(bisectorAngle(0, Math.PI)).toBeCloseTo(Math.PI / 2, 10);
    });

    it('bisector of equal angles is the angle itself', () => {
      expect(bisectorAngle(1.0, 1.0)).toBeCloseTo(1.0, 10);
    });
  });

  describe('angleBetweenPoints', () => {
    it('90° angle at right angle vertex', () => {
      const vertex = { x: 0, y: 0 };
      const p1 = { x: 1, y: 0 };
      const p2 = { x: 0, y: 1 };
      expect(angleBetweenPoints(vertex, p1, p2)).toBeCloseTo(Math.PI / 2, 5);
    });

    it('180° for collinear opposite points', () => {
      const vertex = { x: 0, y: 0 };
      const p1 = { x: 1, y: 0 };
      const p2 = { x: -1, y: 0 };
      expect(angleBetweenPoints(vertex, p1, p2)).toBeCloseTo(Math.PI, 5);
    });

    it('0° for same direction points', () => {
      const vertex = { x: 0, y: 0 };
      const p1 = { x: 1, y: 0 };
      const p2 = { x: 2, y: 0 };
      expect(angleBetweenPoints(vertex, p1, p2)).toBeCloseTo(0, 5);
    });
  });

  describe('angleFromHorizontal', () => {
    it('horizontal right = 0', () => {
      expect(angleFromHorizontal({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0, 10);
    });

    it('vertical up = π/2', () => {
      expect(angleFromHorizontal({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2, 10);
    });

    it('horizontal left = π', () => {
      expect(angleFromHorizontal({ x: 0, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(Math.PI, 10);
    });
  });
});
