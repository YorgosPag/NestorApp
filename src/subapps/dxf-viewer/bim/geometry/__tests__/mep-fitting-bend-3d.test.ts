/**
 * ADR-408 Φ-B2b — computeBend3DArcPoints tests (3D tilted-elbow centreline SSoT).
 *
 * Pins: the arc is tangent to both legs at `dir · tangentLen` (so it meets each
 * trimmed pipe end), a planar input stays in the z=0 plane (matches the 2D bend), a
 * sloped input lifts the arc out of plane, and a (near-)collinear input degrades to
 * a straight 2-point stub.
 */

import { computeBend3DArcPoints } from '../mep-fitting-bend-3d';
import type { Point3D } from '../../types/bim-base';

const RIGHT: Point3D = { x: 1, y: 0, z: 0 };
const UP: Point3D = { x: 0, y: 1, z: 0 };
const LEFT: Point3D = { x: -1, y: 0, z: 0 };
const T = 15;
const SEG = 16;

const len = (p: Point3D): number => Math.hypot(p.x, p.y, p.z ?? 0);

describe('computeBend3DArcPoints — planar 90° bend', () => {
  const pts = computeBend3DArcPoints(RIGHT, UP, T, SEG);

  it('returns segments+1 samples', () => {
    expect(pts).toHaveLength(SEG + 1);
  });

  it('lands the endpoints on each leg at dir·tangentLen', () => {
    const a = pts[0]!;
    const b = pts[pts.length - 1]!;
    expect(a.x).toBeCloseTo(T, 5);
    expect(a.y).toBeCloseTo(0, 5);
    expect(b.x).toBeCloseTo(0, 5);
    expect(b.y).toBeCloseTo(T, 5);
  });

  it('stays in the z=0 plane (matches the 2D plan bend)', () => {
    for (const p of pts) expect(p.z ?? 0).toBeCloseTo(0, 6);
  });

  it('bows toward the inside corner (every sample within the leg span)', () => {
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.y).toBeGreaterThanOrEqual(-1e-6);
    }
  });
});

describe('computeBend3DArcPoints — sloped bend (lifts out of plane)', () => {
  // Leg B rises out of the plan plane: (0,1,1) normalised.
  const upSlope: Point3D = { x: 0, y: 1 / Math.SQRT2, z: 1 / Math.SQRT2 };
  const pts = computeBend3DArcPoints(RIGHT, upSlope, T, SEG);

  it('lands endpoints on the 3D legs (dir·tangentLen, including z)', () => {
    const b = pts[pts.length - 1]!;
    expect(b.y).toBeCloseTo((T) / Math.SQRT2, 4);
    expect(b.z ?? 0).toBeCloseTo((T) / Math.SQRT2, 4);
  });

  it('has at least one sample with a non-trivial vertical component', () => {
    expect(pts.some((p) => Math.abs(p.z ?? 0) > 1e-3)).toBe(true);
  });
});

describe('computeBend3DArcPoints — degenerate / collinear', () => {
  it('collinear legs → a straight 2-point stub at ±dir·tangentLen', () => {
    const pts = computeBend3DArcPoints(RIGHT, LEFT, T, SEG);
    expect(pts).toHaveLength(2);
    expect(pts[0]!.x).toBeCloseTo(T, 5);
    expect(pts[1]!.x).toBeCloseTo(-T, 5);
  });

  it('a zero-length direction does not throw and returns a 2-point stub', () => {
    const pts = computeBend3DArcPoints({ x: 0, y: 0, z: 0 }, UP, T, SEG);
    expect(pts).toHaveLength(2);
    expect(len(pts[1]!)).toBeCloseTo(T, 5);
  });
});
