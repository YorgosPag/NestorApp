import {
  pointToLineDistance,
  pointToCircleDistance,
  getNearestPointOnLine,
  getLineParameter,
  calculateBoundingBox,
  expandBoundingBox,
  isPointInBoundingBox,
  createPerpendicularLine,
  createParallelLine,
  lerp,
  lerpPoint,
  clamp,
  clamp01,
  clamp255
} from '../geometry-utils';

describe('geometry-core-utils', () => {
  // ===== DISTANCE CALCULATIONS =====
  describe('pointToLineDistance', () => {
    it('point on line = 0', () => {
      expect(pointToLineDistance(
        { x: 0.5, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      )).toBeCloseTo(0, 10);
    });

    it('point perpendicular to horizontal line', () => {
      expect(pointToLineDistance(
        { x: 0.5, y: 3 },
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      )).toBeCloseTo(3, 10);
    });

    it('point closest to endpoint', () => {
      // Point is beyond segment end, nearest point is endpoint
      const dist = pointToLineDistance(
        { x: 5, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      );
      expect(dist).toBeCloseTo(4, 10);
    });
  });

  describe('pointToCircleDistance', () => {
    it('point on circle = 0', () => {
      expect(pointToCircleDistance({ x: 5, y: 0 }, { x: 0, y: 0 }, 5)).toBeCloseTo(0, 10);
    });

    it('point inside circle', () => {
      expect(pointToCircleDistance({ x: 1, y: 0 }, { x: 0, y: 0 }, 5)).toBeCloseTo(4, 10);
    });

    it('point outside circle', () => {
      expect(pointToCircleDistance({ x: 8, y: 0 }, { x: 0, y: 0 }, 5)).toBeCloseTo(3, 10);
    });
  });

  // ===== NEAREST POINT =====
  describe('getNearestPointOnLine', () => {
    it('midpoint projection', () => {
      const nearest = getNearestPointOnLine(
        { x: 0.5, y: 5 },
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      );
      expect(nearest.x).toBeCloseTo(0.5, 10);
      expect(nearest.y).toBeCloseTo(0, 10);
    });

    it('clamps to start when before segment', () => {
      const nearest = getNearestPointOnLine(
        { x: -5, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        true
      );
      expect(nearest.x).toBeCloseTo(0, 10);
      expect(nearest.y).toBeCloseTo(0, 10);
    });

    it('does not clamp when clampToSegment=false', () => {
      const nearest = getNearestPointOnLine(
        { x: -5, y: 1 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        false
      );
      expect(nearest.x).toBeCloseTo(-5, 10);
      expect(nearest.y).toBeCloseTo(0, 10);
    });

    it('degenerate segment (zero length) returns start', () => {
      const nearest = getNearestPointOnLine(
        { x: 5, y: 5 },
        { x: 0, y: 0 },
        { x: 0, y: 0 }
      );
      expect(nearest.x).toBeCloseTo(0, 10);
      expect(nearest.y).toBeCloseTo(0, 10);
    });
  });

  // ===== LINE PARAMETER =====
  describe('getLineParameter', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 10, y: 0 };

    it('t=0 at start', () => {
      expect(getLineParameter(start, start, end)).toBeCloseTo(0, 10);
    });

    it('t=1 at end', () => {
      expect(getLineParameter(end, start, end)).toBeCloseTo(1, 10);
    });

    it('t=0.5 at midpoint', () => {
      expect(getLineParameter({ x: 5, y: 0 }, start, end)).toBeCloseTo(0.5, 10);
    });

    it('t>1 beyond end', () => {
      expect(getLineParameter({ x: 15, y: 0 }, start, end)).toBeCloseTo(1.5, 10);
    });

    it('t<0 before start', () => {
      expect(getLineParameter({ x: -5, y: 0 }, start, end)).toBeCloseTo(-0.5, 10);
    });
  });

  // ===== BOUNDING BOX =====
  describe('calculateBoundingBox', () => {
    it('returns null for empty array', () => {
      expect(calculateBoundingBox([])).toBeNull();
    });

    it('single point bbox = point', () => {
      const bbox = calculateBoundingBox([{ x: 3, y: 7 }]);
      expect(bbox).not.toBeNull();
      expect(bbox!.min).toEqual({ x: 3, y: 7 });
      expect(bbox!.max).toEqual({ x: 3, y: 7 });
    });

    it('multiple points', () => {
      const bbox = calculateBoundingBox([
        { x: 1, y: 2 },
        { x: 5, y: -1 },
        { x: 3, y: 8 }
      ]);
      expect(bbox!.min).toEqual({ x: 1, y: -1 });
      expect(bbox!.max).toEqual({ x: 5, y: 8 });
    });
  });

  describe('expandBoundingBox', () => {
    const bbox = { min: { x: 0, y: 0 }, max: { x: 5, y: 5 } };

    it('point inside does not expand', () => {
      const result = expandBoundingBox(bbox, { x: 2, y: 3 });
      expect(result.min).toEqual({ x: 0, y: 0 });
      expect(result.max).toEqual({ x: 5, y: 5 });
    });

    it('point outside expands', () => {
      const result = expandBoundingBox(bbox, { x: 10, y: -3 });
      expect(result.min).toEqual({ x: 0, y: -3 });
      expect(result.max).toEqual({ x: 10, y: 5 });
    });
  });

  describe('isPointInBoundingBox', () => {
    const bbox = { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } };

    it('inside point', () => {
      expect(isPointInBoundingBox({ x: 5, y: 5 }, bbox)).toBe(true);
    });

    it('outside point', () => {
      expect(isPointInBoundingBox({ x: 15, y: 5 }, bbox)).toBe(false);
    });

    it('on edge', () => {
      expect(isPointInBoundingBox({ x: 0, y: 5 }, bbox)).toBe(true);
    });

    it('outside but within tolerance', () => {
      expect(isPointInBoundingBox({ x: -0.5, y: 5 }, bbox, 1)).toBe(true);
    });

    it('outside beyond tolerance', () => {
      expect(isPointInBoundingBox({ x: -2, y: 5 }, bbox, 1)).toBe(false);
    });
  });

  // ===== LINE CONSTRUCTION =====
  describe('createPerpendicularLine', () => {
    it('perpendicular to horizontal line', () => {
      const result = createPerpendicularLine(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 3 },
        20
      );

      expect(result).not.toBeNull();
      // Perpendicular to horizontal = vertical line
      expect(result!.start.x).toBeCloseTo(result!.end.x, 5);
    });

    it('returns null for degenerate reference', () => {
      expect(createPerpendicularLine(
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 5, y: 5 }
      )).toBeNull();
    });
  });

  describe('createParallelLine', () => {
    it('parallel to horizontal line, offset above', () => {
      const result = createParallelLine(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 3 }
      );

      expect(result).not.toBeNull();
      // Parallel → same Y for both endpoints
      expect(result!.start.y).toBeCloseTo(result!.end.y, 5);
      // Offset = 3 units above
      expect(result!.start.y).toBeCloseTo(3, 5);
    });

    it('returns null for degenerate reference', () => {
      expect(createParallelLine(
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 5, y: 5 }
      )).toBeNull();
    });
  });

  // ===== MATH UTILITIES =====
  describe('lerp', () => {
    it('t=0 returns a', () => {
      expect(lerp(10, 20, 0)).toBe(10);
    });

    it('t=1 returns b', () => {
      expect(lerp(10, 20, 1)).toBe(20);
    });

    it('t=0.5 returns midpoint', () => {
      expect(lerp(10, 20, 0.5)).toBe(15);
    });
  });

  describe('lerpPoint', () => {
    it('t=0 returns p1', () => {
      const result = lerpPoint({ x: 0, y: 0 }, { x: 10, y: 10 }, 0);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('t=1 returns p2', () => {
      const result = lerpPoint({ x: 0, y: 0 }, { x: 10, y: 10 }, 1);
      expect(result).toEqual({ x: 10, y: 10 });
    });

    it('t=0.5 returns midpoint', () => {
      const result = lerpPoint({ x: 0, y: 0 }, { x: 10, y: 10 }, 0.5);
      expect(result.x).toBeCloseTo(5, 10);
      expect(result.y).toBeCloseTo(5, 10);
    });
  });

  // ===== CLAMP =====
  describe('clamp', () => {
    it('clamps below min', () => {
      expect(clamp(-5, 0, 100)).toBe(0);
    });

    it('clamps above max', () => {
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it('keeps value within range', () => {
      expect(clamp(50, 0, 100)).toBe(50);
    });
  });

  describe('clamp01', () => {
    it('clamps negative to 0', () => {
      expect(clamp01(-0.5)).toBe(0);
    });

    it('clamps >1 to 1', () => {
      expect(clamp01(1.5)).toBe(1);
    });

    it('keeps 0.7', () => {
      expect(clamp01(0.7)).toBe(0.7);
    });
  });

  describe('clamp255', () => {
    it('clamps negative to 0', () => {
      expect(clamp255(-10)).toBe(0);
    });

    it('clamps >255 to 255', () => {
      expect(clamp255(300)).toBe(255);
    });

    it('keeps 128', () => {
      expect(clamp255(128)).toBe(128);
    });
  });
});
