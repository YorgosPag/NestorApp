/**
 * ADR-452 — cut-plane 3D world-Y math + plane construction.
 */

import { computeCutPlaneWorldY, buildCutPlane } from '../cut-plane-3d-math';

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
