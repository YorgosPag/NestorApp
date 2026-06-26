/**
 * ADR-534 Φ3c-B1 — beam effective-flange map builder tests (organism pass producer).
 *
 * Pure logic — μηδέν store/scene. Επαληθεύει ότι το `buildBeamFlangeWidthMap` reuse-άρει τον ΙΔΙΟ
 * detector (`resolveBeamEffectiveFlangeWidthMm`) ανά δοκό, σέβεται τον topology-aware supportType,
 * και παραλείπει ασκεπείς/μη-δοκούς.
 */

import { buildBeamFlangeWidthMap } from '../derive-beam-flange-width';
import type { Entity } from '../../../../types/entities';
import type { BeamEntity, BeamSupportType } from '../../../types/beam-types';
import type { HostFootprintInput } from '../../../geometry/wall-host-plan-builder';

/** Δοκός 300mm πλάτος, μήκος 6m, footprint 6000×300, με id/type (Entity-shaped). */
function makeBeam(id: string): BeamEntity {
  return {
    id,
    type: 'beam',
    params: { width: 300 } as BeamEntity['params'],
    geometry: {
      length: 6,
      outline: {
        vertices: [
          { x: 0, y: 0, z: 0 },
          { x: 6000, y: 0, z: 0 },
          { x: 6000, y: 300, z: 0 },
          { x: 0, y: 300, z: 0 },
        ],
      },
    } as BeamEntity['geometry'],
  } as BeamEntity;
}

/** Πλάκα-host που καλύπτει όλη τη δοκό. */
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

describe('buildBeamFlangeWidthMap (ADR-534 Φ3c-B1)', () => {
  it('covering slab → b_eff στον χάρτη (simple span: 300 + 2·0.2·6000 = 2700)', () => {
    const beam = makeBeam('beam_1');
    const map = buildBeamFlangeWidthMap([beam], [coveringSlab], new Map());
    expect(map.get('beam_1')).toBeCloseTo(2700, 6);
  });

  it('topology-aware supportType: continuous → μικρότερο l_0 → μικρότερο b_eff (1980)', () => {
    const beam = makeBeam('beam_1');
    const support = new Map<string, BeamSupportType>([['beam_1', 'continuous']]);
    const map = buildBeamFlangeWidthMap([beam], [coveringSlab], support);
    expect(map.get('beam_1')).toBeCloseTo(1980, 6);
  });

  it('κανένα host → άδειος χάρτης (καμία T-διατομή, μηδέν override)', () => {
    expect(buildBeamFlangeWidthMap([makeBeam('beam_1')], [], new Map()).size).toBe(0);
  });

  it('μη-δοκοί παραλείπονται (μόνο beams μπαίνουν στον χάρτη)', () => {
    const slabEntity = { id: 'slab_x', type: 'slab' } as unknown as Entity;
    const map = buildBeamFlangeWidthMap([makeBeam('beam_1'), slabEntity], [coveringSlab], new Map());
    expect([...map.keys()]).toEqual(['beam_1']);
  });
});
