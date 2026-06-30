/**
 * cinema4d-grid-frame.test.ts — ADR-558 horizon-fade math (the only CPU per-frame logic; the decade
 * LOD is computed per fragment in the shader and is not unit-testable here).
 */

import { computeGrid3DFrame } from '../cinema4d-grid-frame';
import { GRID3D_FADE_NEAR_K, GRID3D_FADE_FAR_K, GRID3D_MAX_REACH_M } from '../cinema4d-grid-config';

describe('computeGrid3DFrame — view-relative horizon fade, capped at the hard reach', () => {
  it('ties the fade radii to the camera distance (below the cap)', () => {
    const smallD = (GRID3D_MAX_REACH_M / GRID3D_FADE_FAR_K) / 2; // fadeFar stays below the cap
    const f = computeGrid3DFrame({ distance: smallD });
    expect(f.fadeFar).toBeCloseTo(smallD * GRID3D_FADE_FAR_K, 6);
    expect(f.fadeNear).toBeCloseTo(smallD * GRID3D_FADE_NEAR_K, 6);
    expect(f.fadeFar).toBeGreaterThan(f.fadeNear);
  });

  it('caps the far radius at GRID3D_MAX_REACH_M when zoomed far out', () => {
    const f = computeGrid3DFrame({ distance: 1e6 });
    expect(f.fadeFar).toBeCloseTo(GRID3D_MAX_REACH_M, 6);
    expect(f.fadeNear).toBeLessThan(f.fadeFar); // near kept below far even when capped
  });

  it('clamps a zero/negative distance to a finite positive fade (no degenerate grid)', () => {
    expect(computeGrid3DFrame({ distance: 0 }).fadeFar).toBeGreaterThan(0);
    expect(computeGrid3DFrame({ distance: -5 }).fadeFar).toBeGreaterThan(0);
  });
});
