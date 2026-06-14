/**
 * ADR-452 — cut-plane 3D world-Y math + plane construction.
 */

import { computeCutPlaneWorldY, buildCutPlane, buildAxisCutPlane } from '../cut-plane-3d-math';

describe('computeCutPlaneWorldY', () => {
  it('ground floor (FFL 0), base 0: metres = cutPlaneMm/1000', () => {
    expect(computeCutPlaneWorldY(0, 1200, 0)).toBeCloseTo(1.2, 6);
    expect(computeCutPlaneWorldY(0, 3000, 0)).toBeCloseTo(3.0, 6);
  });

  it('upper floor adds the datum-relative FFL', () => {
    // 1st floor at 3 m, cut 1.2 m above its FFL → world 4.2 m
    expect(computeCutPlaneWorldY(3000, 1200, 0)).toBeCloseTo(4.2, 6);
  });

  it('adds the building base offset (metres)', () => {
    expect(computeCutPlaneWorldY(0, 1000, 5)).toBeCloseTo(6.0, 6);
  });
});

describe('buildCutPlane', () => {
  it('keeps points below worldY, clips points above (downward normal)', () => {
    const plane = buildCutPlane(3.0);
    // distanceToPoint > 0 ⇒ kept (visible side) for the clip.
    expect(plane.distanceToPoint({ x: 0, y: 2.0, z: 0 } as never)).toBeGreaterThan(0); // below → kept
    expect(plane.distanceToPoint({ x: 0, y: 4.0, z: 0 } as never)).toBeLessThan(0); // above → clipped
    expect(plane.normal.y).toBe(-1);
    expect(plane.constant).toBe(3.0);
  });
});

describe('buildAxisCutPlane — ADR-455 (axis × sign kept-side)', () => {
  const P = (x: number, y: number, z: number) => ({ x, y, z } as never);

  it('Z sign +1 matches the legacy horizontal cut (keep below)', () => {
    const plane = buildAxisCutPlane('z', 3, 1);
    expect(plane.normal.x).toBeCloseTo(0);
    expect(plane.normal.y).toBe(-1);
    expect(plane.normal.z).toBeCloseTo(0);
    expect(plane.distanceToPoint(P(0, 2, 0))).toBeGreaterThan(0); // below → kept
    expect(plane.distanceToPoint(P(0, 4, 0))).toBeLessThan(0); // above → clipped
  });

  it('Z sign −1 flips to keep above', () => {
    const plane = buildAxisCutPlane('z', 3, -1);
    expect(plane.distanceToPoint(P(0, 4, 0))).toBeGreaterThan(0);
    expect(plane.distanceToPoint(P(0, 2, 0))).toBeLessThan(0);
  });

  it('X sign +1 keeps the lower-X side (three.js x < pos)', () => {
    const plane = buildAxisCutPlane('x', 5, 1);
    expect(plane.normal.x).toBe(-1);
    expect(plane.distanceToPoint(P(4, 0, 0))).toBeGreaterThan(0);
    expect(plane.distanceToPoint(P(6, 0, 0))).toBeLessThan(0);
  });

  it('X sign −1 keeps the higher-X side', () => {
    const plane = buildAxisCutPlane('x', 5, -1);
    expect(plane.normal.x).toBe(1);
    expect(plane.distanceToPoint(P(6, 0, 0))).toBeGreaterThan(0);
    expect(plane.distanceToPoint(P(4, 0, 0))).toBeLessThan(0);
  });

  it('Y sign +1: DXF-Y→three.js −Z handedness keeps three.js z > −pos', () => {
    const plane = buildAxisCutPlane('y', 5, 1);
    expect(plane.normal.z).toBe(1);
    // DXF_Y < pos ⟺ three.js z > −pos → kept.
    expect(plane.distanceToPoint(P(0, 0, -4))).toBeGreaterThan(0); // z=-4 > -5 → kept
    expect(plane.distanceToPoint(P(0, 0, -6))).toBeLessThan(0); // z=-6 < -5 → clipped
  });

  it('Y sign −1 flips the kept half-space', () => {
    const plane = buildAxisCutPlane('y', 5, -1);
    expect(plane.normal.z).toBe(-1);
    expect(plane.distanceToPoint(P(0, 0, -6))).toBeGreaterThan(0);
    expect(plane.distanceToPoint(P(0, 0, -4))).toBeLessThan(0);
  });

  it('constant is sign·worldCoord uniformly across axes', () => {
    expect(buildAxisCutPlane('x', 5, 1).constant).toBe(5);
    expect(buildAxisCutPlane('x', 5, -1).constant).toBe(-5);
    expect(buildAxisCutPlane('y', 5, 1).constant).toBe(5);
    expect(buildAxisCutPlane('z', 3, 1).constant).toBe(3);
  });
});
