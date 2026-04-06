import {
  circleFrom3Points,
  circleBestFit,
  circleFromChordAndSagitta,
  circleFrom2PointsAndRadius,
  lineIntersectionExtended,
  circleTangentTo3Lines
} from '../geometry-circle-utils';

describe('geometry-circle-utils', () => {
  // ===== circleFrom3Points =====
  describe('circleFrom3Points', () => {
    it('finds circle through 3 points on unit circle', () => {
      const p1 = { x: 1, y: 0 };
      const p2 = { x: 0, y: 1 };
      const p3 = { x: -1, y: 0 };
      const result = circleFrom3Points(p1, p2, p3);

      expect(result).not.toBeNull();
      expect(result!.center.x).toBeCloseTo(0, 5);
      expect(result!.center.y).toBeCloseTo(0, 5);
      expect(result!.radius).toBeCloseTo(1, 5);
    });

    it('returns null for collinear points', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 1, y: 0 };
      const p3 = { x: 2, y: 0 };
      expect(circleFrom3Points(p1, p2, p3)).toBeNull();
    });

    it('finds circle with radius 5', () => {
      // Points on circle of radius 5 centered at origin
      const r = 5;
      const p1 = { x: r, y: 0 };
      const p2 = { x: 0, y: r };
      const p3 = { x: -r, y: 0 };
      const result = circleFrom3Points(p1, p2, p3);

      expect(result).not.toBeNull();
      expect(result!.radius).toBeCloseTo(r, 3);
    });
  });

  // ===== circleBestFit =====
  describe('circleBestFit', () => {
    it('fits perfect circle through 4 points on unit circle', () => {
      const points = [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 0, y: -1 }
      ];
      const result = circleBestFit(points);

      expect(result).not.toBeNull();
      expect(result!.center.x).toBeCloseTo(0, 3);
      expect(result!.center.y).toBeCloseTo(0, 3);
      expect(result!.radius).toBeCloseTo(1, 3);
    });

    it('returns null for fewer than 3 points', () => {
      expect(circleBestFit([{ x: 0, y: 0 }, { x: 1, y: 0 }])).toBeNull();
    });

    it('returns null for empty array', () => {
      expect(circleBestFit([])).toBeNull();
    });
  });

  // ===== circleFromChordAndSagitta =====
  describe('circleFromChordAndSagitta', () => {
    it('finds circle from horizontal chord and sagitta', () => {
      // Chord from (-1,0) to (1,0), sagitta at top of unit circle
      const result = circleFromChordAndSagitta(
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      );

      expect(result).not.toBeNull();
      expect(result!.radius).toBeCloseTo(1, 3);
    });

    it('returns null for degenerate chord (same points)', () => {
      const result = circleFromChordAndSagitta(
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 1 }
      );
      expect(result).toBeNull();
    });
  });

  // ===== circleFrom2PointsAndRadius =====
  describe('circleFrom2PointsAndRadius', () => {
    it('finds circle from 2 points and radius indicator', () => {
      const result = circleFrom2PointsAndRadius(
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 2 }
      );

      expect(result).not.toBeNull();
      expect(result!.radius).toBeGreaterThan(0);
    });
  });

  // ===== lineIntersectionExtended =====
  describe('lineIntersectionExtended', () => {
    it('finds intersection of crossing lines', () => {
      // Horizontal line y=0 and vertical line x=0
      const result = lineIntersectionExtended(
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: -1 }, { x: 0, y: 1 }
      );

      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(0, 10);
      expect(result!.y).toBeCloseTo(0, 10);
    });

    it('finds intersection of diagonal lines', () => {
      // y=x and y=-x+2
      const result = lineIntersectionExtended(
        { x: 0, y: 0 }, { x: 2, y: 2 },
        { x: 0, y: 2 }, { x: 2, y: 0 }
      );

      expect(result).not.toBeNull();
      expect(result!.x).toBeCloseTo(1, 5);
      expect(result!.y).toBeCloseTo(1, 5);
    });

    it('returns null for parallel lines', () => {
      const result = lineIntersectionExtended(
        { x: 0, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: 1 }, { x: 1, y: 1 }
      );
      expect(result).toBeNull();
    });
  });

  // ===== circleTangentTo3Lines =====
  describe('circleTangentTo3Lines', () => {
    it('finds incircle of right triangle', () => {
      // Right triangle: (0,0)-(4,0)-(0,3) → incircle radius = (a+b-c)/2 = (3+4-5)/2 = 1
      const result = circleTangentTo3Lines(
        { start: { x: 0, y: 0 }, end: { x: 4, y: 0 } },
        { start: { x: 4, y: 0 }, end: { x: 0, y: 3 } },
        { start: { x: 0, y: 3 }, end: { x: 0, y: 0 } }
      );

      expect(result).not.toBeNull();
      expect(result!.radius).toBeCloseTo(1, 1);
    });
  });
});
