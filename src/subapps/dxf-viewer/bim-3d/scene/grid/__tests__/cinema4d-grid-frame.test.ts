/**
 * cinema4d-grid-frame.test.ts — ADR-558 distance-fog math (the only CPU per-frame logic;
 * the decade LOD is per-fragment in the shader and not unit-testable here).
 */

import { computeGrid3DFog } from '../cinema4d-grid-frame';
import { GRID3D_FADE_START_K, GRID3D_FADE_END_K } from '../cinema4d-grid-config';

describe('computeGrid3DFog — horizon dissolve radii', () => {
  it('ties the fog radii to the camera→target distance', () => {
    const fog = computeGrid3DFog({ distance: 20 });
    expect(fog.fadeStart).toBeCloseTo(20 * GRID3D_FADE_START_K, 6);
    expect(fog.fadeEnd).toBeCloseTo(20 * GRID3D_FADE_END_K, 6);
  });

  it('keeps fadeEnd strictly beyond fadeStart (no degenerate band)', () => {
    const fog = computeGrid3DFog({ distance: 7.5 });
    expect(fog.fadeEnd).toBeGreaterThan(fog.fadeStart);
  });

  it('clamps a zero/negative distance to a tiny positive radius', () => {
    const fog = computeGrid3DFog({ distance: 0 });
    expect(fog.fadeStart).toBeGreaterThan(0);
    expect(fog.fadeEnd).toBeGreaterThan(fog.fadeStart);
  });

  it('scales linearly with distance (constant screen-depth horizon at any zoom)', () => {
    const near = computeGrid3DFog({ distance: 10 });
    const far = computeGrid3DFog({ distance: 40 });
    expect(far.fadeStart / near.fadeStart).toBeCloseTo(4, 6);
    expect(far.fadeEnd / near.fadeEnd).toBeCloseTo(4, 6);
  });
});
