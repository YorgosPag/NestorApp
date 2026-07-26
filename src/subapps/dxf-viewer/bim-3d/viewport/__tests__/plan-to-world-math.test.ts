/**
 * ADR-650 M5α.2 — plan-to-world-math: the DXF-plan → three-world axis convention.
 *
 * This is the file every 3D consumer now delegates to, so these tests are the regression guard for
 * a class of bug that is invisible in review and unmistakable on screen: one flipped sign mirrors
 * the entire model across the site, and one wrong scale factor puts it a kilometre away.
 */

import { planMetresToWorld, planMmToWorld } from '../plan-to-world-math';

describe('planMetresToWorld', () => {
  it('maps east→x, elevation→y, north→−z', () => {
    expect(planMetresToWorld(2, 5, 3)).toEqual({ x: 2, y: 3, z: -5 });
  });

  it('keeps the origin at the origin', () => {
    expect(planMetresToWorld(0, 0, 0)).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('maps plan-north zero to +0, never −0', () => {
    expect(Object.is(planMetresToWorld(0, 0, 0).z, 0)).toBe(true);
  });

  it('sends southward (negative north) to positive world Z', () => {
    expect(planMetresToWorld(0, -4, 0).z).toBe(4);
  });
});

describe('planMmToWorld', () => {
  it('scales millimetres to metres, then applies the same axis swap', () => {
    expect(planMmToWorld(2000, 5000, 3000)).toEqual({ x: 2, y: 3, z: -5 });
  });

  it('agrees with planMetresToWorld on the same physical point', () => {
    expect(planMmToWorld(1500, -250, 4750)).toEqual(planMetresToWorld(1.5, -0.25, 4.75));
  });

  it('handles ΕΓΣΑ-magnitude coordinates without losing the axis convention', () => {
    // ~500 km east, ~4 200 km north — the real magnitudes a Greek survey carries.
    expect(planMmToWorld(500_000_000, 4_200_000_000, 106_000))
      .toEqual({ x: 500_000, y: 106, z: -4_200_000 });
  });
});
