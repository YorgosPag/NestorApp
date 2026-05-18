import { describe, it, expect } from 'vitest';
import { pointToInfiniteLineDistance, pointToRayDistance } from '../point-to-line-distance';

const tol = 1e-9;

describe('pointToInfiniteLineDistance', () => {
  it('point on the line → 0', () => {
    expect(pointToInfiniteLineDistance({ x: 3, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0, 9);
  });

  it('point perpendicular to horizontal line', () => {
    expect(pointToInfiniteLineDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(3, 9);
  });

  it('point perpendicular to vertical line', () => {
    expect(pointToInfiniteLineDistance({ x: 4, y: 7 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(4, 9);
  });

  it('point at distance from diagonal line y=x (direction 45°)', () => {
    const dir = { x: Math.SQRT2 / 2, y: Math.SQRT2 / 2 };
    // Point (2, 0) has distance 1/√2 * 2 = √2 from y=x line (base at origin)
    expect(pointToInfiniteLineDistance({ x: 2, y: 0 }, { x: 0, y: 0 }, dir)).toBeCloseTo(Math.SQRT2, 9);
  });

  it('degenerate dir (0,0) → Infinity', () => {
    expect(pointToInfiniteLineDistance({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(Infinity);
  });

  it('non-normalized direction gives same result as normalized', () => {
    const p = { x: 5, y: 3 };
    const base = { x: 0, y: 0 };
    const normalised = { x: 1, y: 0 };
    const scaled = { x: 100, y: 0 };
    expect(pointToInfiniteLineDistance(p, base, normalised)).toBeCloseTo(
      pointToInfiniteLineDistance(p, base, scaled),
      9
    );
  });

  it('point far from line still returns correct distance', () => {
    expect(pointToInfiniteLineDistance({ x: 0, y: 1000 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(1000, 9);
  });

  it('negative direction → same distance as positive direction', () => {
    const p = { x: 5, y: 4 };
    const base = { x: 0, y: 0 };
    expect(pointToInfiniteLineDistance(p, base, { x: 1, y: 0 })).toBeCloseTo(
      pointToInfiniteLineDistance(p, base, { x: -1, y: 0 }),
      9
    );
  });

  it('point behind base (t<0) → still returns perpendicular distance', () => {
    // Infinite line doesn't care about t — distance is always perpendicular
    expect(pointToInfiniteLineDistance({ x: -10, y: 3 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(3, 9);
  });
});

describe('pointToRayDistance', () => {
  it('point projecting forward (t>0) → same as infinite line distance', () => {
    expect(pointToRayDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(3, 9);
  });

  it('point projecting behind base (t<0) → distance to base', () => {
    // Point at (-3, 4), base at origin, dir rightward → t = -3 < 0 → dist to base = 5
    expect(pointToRayDistance({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(5, 9);
  });

  it('point exactly at base → 0', () => {
    expect(pointToRayDistance({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0, 9);
  });

  it('point on ray line ahead → 0', () => {
    expect(pointToRayDistance({ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0, 9);
  });

  it('degenerate dir → Infinity', () => {
    expect(pointToRayDistance({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(Infinity);
  });

  it('point perpendicular at t=0 (exactly at base plane) → perpendicular distance', () => {
    // p = (0, 5), base = (0,0), dir = (1,0). t = dot((0,5),(1,0)) = 0. t=0 not < 0 → perp dist = 5
    expect(pointToRayDistance({ x: 0, y: 5 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(5, 9);
  });

  it('point behind base, off-axis → dist to base', () => {
    const p = { x: -4, y: 3 };
    const base = { x: 0, y: 0 };
    const expectedDistToBase = Math.sqrt(16 + 9); // 5
    expect(pointToRayDistance(p, base, { x: 1, y: 0 })).toBeCloseTo(expectedDistToBase, 9);
  });

  it('point forward and off-axis → perpendicular distance', () => {
    // p = (5, 3), dir rightward → perpendicular distance = 3
    expect(pointToRayDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(3, 9);
  });

  it('non-normalized direction gives same result as normalized (forward projection)', () => {
    const p = { x: 5, y: 3 };
    const base = { x: 0, y: 0 };
    expect(pointToRayDistance(p, base, { x: 1, y: 0 })).toBeCloseTo(
      pointToRayDistance(p, base, { x: 100, y: 0 }),
      9
    );
  });
});
