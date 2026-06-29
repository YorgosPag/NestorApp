/**
 * cinema4d-grid-frame.test.ts — ADR-558 hard-extent math (the only CPU per-frame logic; the decade
 * LOD is per-fragment in the shader and not unit-testable here).
 */

import { computeGrid3DExtent } from '../cinema4d-grid-frame';
import { GRID3D_EXTENT_K } from '../cinema4d-grid-config';

describe('computeGrid3DExtent — hard finite boundary (C4D stops, never distance-fades)', () => {
  it('ties the extent to the camera→target distance', () => {
    expect(computeGrid3DExtent({ distance: 20 })).toBeCloseTo(20 * GRID3D_EXTENT_K, 6);
  });

  it('scales linearly with distance (edge sits near the horizon at any zoom)', () => {
    const near = computeGrid3DExtent({ distance: 10 });
    const far = computeGrid3DExtent({ distance: 40 });
    expect(far / near).toBeCloseTo(4, 6);
  });

  it('clamps a zero/negative distance to a tiny positive extent (no degenerate boundary)', () => {
    expect(computeGrid3DExtent({ distance: 0 })).toBeGreaterThan(0);
    expect(computeGrid3DExtent({ distance: -5 })).toBeGreaterThan(0);
  });
});
