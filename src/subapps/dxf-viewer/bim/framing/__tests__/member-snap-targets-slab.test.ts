/**
 * ADR-508 §slab — collectMemberSnapTargets: κάθε ΑΚΜΗ πλάκας → LinearMemberSnapTarget (thin band)
 * ώστε το ghost (τοίχος/δοκάρι/κολώνα) να συμπεριφέρεται όπως σε παρειά μέλους.
 */

import { collectMemberSnapTargets } from '../member-snap-targets';
import type { Entity } from '../../../types/entities';

/** Ορθογώνια πλάκα 4000×3000 (CCW), type 'slab'. */
function slab(): Entity {
  return {
    id: 'slab1', type: 'slab',
    params: { outline: { vertices: [
      { x: 0, y: 0, z: 0 }, { x: 4000, y: 0, z: 0 }, { x: 4000, y: 3000, z: 0 }, { x: 0, y: 3000, z: 0 },
    ] } },
  } as unknown as Entity;
}

describe('collectMemberSnapTargets — slab edges', () => {
  it('παράγει ΕΝΑ target ανά ακμή (4 για ορθογώνιο), με σωστό άξονα ακμής', () => {
    const { memberTargets } = collectMemberSnapTargets([slab()], { memberKinds: ['slab'] });
    expect(memberTargets).toHaveLength(4);
    // 1η ακμή: (0,0)→(4000,0)
    expect(memberTargets[0].axis[0]).toEqual({ x: 0, y: 0 });
    expect(memberTargets[0].axis[1]).toEqual({ x: 4000, y: 0 });
    // outline = λεπτή band (4 κορυφές, ≈ στην ακμή)
    expect(memberTargets[0].outline).toHaveLength(4);
    expect(memberTargets.map((t) => t.id)).toEqual(['slab1#edge0', 'slab1#edge1', 'slab1#edge2', 'slab1#edge3']);
  });

  it('ΔΕΝ μαζεύει πλάκες όταν δεν ζητηθεί το slab kind (backward-compat)', () => {
    const { memberTargets } = collectMemberSnapTargets([slab()], { memberKinds: ['wall', 'beam'] });
    expect(memberTargets).toHaveLength(0);
  });
});
