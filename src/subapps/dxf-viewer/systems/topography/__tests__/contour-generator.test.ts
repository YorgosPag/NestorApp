/**
 * ADR-650 Milestone 1 — contour generation ground-truth tests.
 *
 * Two analytic surfaces with known contours:
 *   1. Inclined plane z = x  → contours are vertical lines x = level.
 *   2. Cone (central peak)   → a mid-level contour is a CLOSED ring around the centre.
 */

import { generateContours } from '../contour-generator';
import { generateLevels } from '../marching-triangles';
import type { TopoPoint } from '../topo-types';
import type { ContourConfig } from '../contour-config';

const CONFIG: ContourConfig = {
  intervalMm: 250,
  majorEvery: 2,
  baseElevationMm: 0,
  labelMajors: true,
  labelDecimals: 2,
};

/** 3×3 grid on the plane z = x (mm). */
function inclinedPlanePoints(): TopoPoint[] {
  const pts: TopoPoint[] = [];
  for (const x of [0, 500, 1000]) {
    for (const y of [0, 500, 1000]) pts.push({ x, y, z: x });
  }
  return pts;
}

describe('generateLevels', () => {
  it('spans the Z range on the interval grid anchored at base', () => {
    expect(generateLevels(0, 1000, CONFIG)).toEqual([0, 250, 500, 750, 1000]);
  });

  it('is empty for a non-positive interval', () => {
    expect(generateLevels(0, 100, { ...CONFIG, intervalMm: 0 })).toEqual([]);
  });
});

describe('generateContours — inclined plane z = x', () => {
  it('produces a vertical contour line x ≈ level at an interior level', () => {
    const { contours } = generateContours(inclinedPlanePoints(), [], CONFIG);
    const at500 = contours.filter((c) => c.level === 500);
    expect(at500.length).toBeGreaterThan(0);
    for (const line of at500) {
      for (const v of line.vertices) {
        expect(v.x).toBeCloseTo(500, 1); // within 0.05 mm (nudge is ~2.5e-4)
      }
      // The contour spans the full Y extent of the plane.
      const ys = line.vertices.map((v) => v.y);
      expect(Math.min(...ys)).toBeCloseTo(0, 1);
      expect(Math.max(...ys)).toBeCloseTo(1000, 1);
    }
  });

  it('classifies level 500 as major (every 2nd of 250) and 250 as minor', () => {
    const { contours } = generateContours(inclinedPlanePoints(), [], CONFIG);
    const at500 = contours.find((c) => c.level === 500);
    const at250 = contours.find((c) => c.level === 250);
    // majorEvery=2, interval=250 → majors at k%2===0 → levels 0, 500, 1000.
    expect(at500?.isMajor).toBe(true);
    expect(at250?.isMajor).toBe(false);
  });
});

describe('generateContours — cone (central peak)', () => {
  it('produces a CLOSED ring at a mid level around the centre', () => {
    const peak: TopoPoint = { x: 0, y: 0, z: 1000 };
    const ring: TopoPoint[] = [];
    const R = 1000;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ring.push({ x: Math.round(Math.cos(a) * R), y: Math.round(Math.sin(a) * R), z: 0 });
    }
    const { contours } = generateContours([peak, ...ring], [], CONFIG);
    const at500 = contours.filter((c) => c.level === 500);
    expect(at500.length).toBe(1);
    expect(at500[0].closed).toBe(true);
    // Every vertex sits ~halfway out (z=500 on a linear cone → radius ≈ R/2).
    for (const v of at500[0].vertices) {
      const r = Math.hypot(v.x, v.y);
      expect(r).toBeGreaterThan(300);
      expect(r).toBeLessThan(700);
    }
  });
});
