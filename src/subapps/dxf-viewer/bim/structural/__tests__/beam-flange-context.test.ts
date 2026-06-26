/**
 * ADR-534 Φ3b — beam T-beam flange detector tests (covering-slab → b_eff).
 */

import { resolveBeamEffectiveFlangeWidthMm } from '../beam-flange-context';
import type { BeamEntity } from '../../types/beam-types';
import type { HostFootprintInput } from '../../geometry/wall-host-plan-builder';

/** Δοκός 300mm πλάτος, μήκος 6m, footprint 6000×300mm γύρω από (0..6000, 0..300). */
function makeBeam(): Pick<BeamEntity, 'params' | 'geometry'> {
  return {
    params: { width: 300 } as BeamEntity['params'],
    geometry: {
      length: 6, // m → span 6000mm
      outline: {
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 6000, y: 0, z: 0 },
          { x: 6000, y: 300, z: 0 },
          { x: 0, y: 300, z: 0 },
        ],
      },
    } as BeamEntity['geometry'],
  };
}

/** Πλάκα-host που καλύπτει όλη τη δοκό (footprint 0..6000 × −2000..2000). */
const coveringSlab: HostFootprintInput = {
  hostId: 'slab_ceiling',
  hostType: 'slab',
  footprint: [
    { x: -100, y: -2000 },
    { x: 6100, y: -2000 },
    { x: 6100, y: 2000 },
    { x: -100, y: 2000 },
  ],
  undersideZmm: 2800,
};

/** Πλάκα μακριά από τη δοκό (δεν την καλύπτει). */
const farSlab: HostFootprintInput = {
  hostId: 'slab_far',
  hostType: 'slab',
  footprint: [
    { x: 50000, y: 50000 },
    { x: 56000, y: 50000 },
    { x: 56000, y: 52000 },
    { x: 50000, y: 52000 },
  ],
  undersideZmm: 2800,
};

describe('resolveBeamEffectiveFlangeWidthMm (ADR-534 Φ3b)', () => {
  it('covering slab → T-beam b_eff (b_w + 2·0.2·l_0, simple span)', () => {
    const bEff = resolveBeamEffectiveFlangeWidthMm(makeBeam(), [coveringSlab], 'simple');
    // l_0 = 6000; 0.2·l_0 = 1200; 300 + 2·1200 = 2700.
    expect(bEff).toBeCloseTo(2700, 6);
  });

  it('continuous support shortens l_0 → smaller b_eff', () => {
    const bEff = resolveBeamEffectiveFlangeWidthMm(makeBeam(), [coveringSlab], 'continuous');
    // l_0 = 4200; 0.2·l_0 = 840; 300 + 2·840 = 1980.
    expect(bEff).toBeCloseTo(1980, 6);
  });

  it('no covering slab → undefined (bare rectangular beam, zero regression)', () => {
    expect(resolveBeamEffectiveFlangeWidthMm(makeBeam(), [farSlab], 'simple')).toBeUndefined();
  });

  it('empty hosts → undefined', () => {
    expect(resolveBeamEffectiveFlangeWidthMm(makeBeam(), [], 'simple')).toBeUndefined();
  });

  it('degenerate footprint (<3 verts) → undefined', () => {
    const beam = makeBeam();
    const degenerate = {
      ...beam,
      geometry: { ...beam.geometry, outline: { vertices: [{ x: 0, y: 0, z: 0 }] } },
    } as Pick<BeamEntity, 'params' | 'geometry'>;
    expect(resolveBeamEffectiveFlangeWidthMm(degenerate, [coveringSlab], 'simple')).toBeUndefined();
  });
});
