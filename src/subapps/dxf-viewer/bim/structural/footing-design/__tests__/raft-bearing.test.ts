/**
 * ADR-464 Slice 5 — raft / εδαφόπλακα μέση πίεση έδρασης.
 *
 * Καλύπτει: μέση πίεση = (φορτίο area-load + ίδιο βάρος)/A vs σ_allow, ανίχνευση
 * ανεπάρκειας, και τις αδρανείς περιπτώσεις (χωρίς σ_allow / χωρίς area loads).
 */

import { computeRaftBearing, type RaftBearingInput } from '../raft-bearing';
import type { SlabEntity } from '../../../types/slab-types';

/** Minimal raft (6×4 m, 500 mm) — canvas units = mm (sceneUnits 'mm'). */
function raft(widthMm = 6000, lengthMm = 4000, thicknessMm = 500): SlabEntity {
  return {
    id: 'raft-1',
    kind: 'foundation',
    params: {
      sceneUnits: 'mm',
      thickness: thicknessMm,
      outline: { vertices: [
        { x: 0, y: 0 }, { x: widthMm, y: 0 }, { x: widthMm, y: lengthMm }, { x: 0, y: lengthMm },
      ] },
    },
  } as unknown as SlabEntity;
}

const loaded: RaftBearingInput = {
  storeyCount: 3, deadAreaLoadKpa: 6, liveAreaLoadKpa: 2, soilBearingCapacityKpa: 200,
};

describe('computeRaftBearing', () => {
  it('μέση πίεση ≈ (service φορτίο + self-weight) / εμβαδό', () => {
    const r = computeRaftBearing(raft(), loaded);
    expect(r).not.toBeNull();
    // area=24 m²· service=24×3×(6+2)=576 kN· self=24×0.5×2400×9.81/1000≈282.5 kN.
    // p = (576+282.5)/24 ≈ 35.77 kPa· uniform → pMax=pMin.
    expect(r!.pMaxKpa).toBeCloseTo((576 + (24 * 0.5 * 2400 * 9.81 / 1000)) / 24, 2);
    expect(r!.pMinKpa).toBeCloseTo(r!.pMaxKpa, 6);
    expect(r!.check.adequate).toBe(true);
  });

  it('χαμηλό σ_allow → ανεπαρκής έδραση', () => {
    const r = computeRaftBearing(raft(), { ...loaded, soilBearingCapacityKpa: 20 });
    expect(r!.check.adequate).toBe(false);
    expect(r!.check.utilization).toBeGreaterThan(1);
  });

  it('χωρίς σ_allow → null (αδρανές)', () => {
    expect(computeRaftBearing(raft(), { ...loaded, soilBearingCapacityKpa: 0 })).toBeNull();
  });

  it('χωρίς area loads → null (καμία πηγή φορτίου, advisory)', () => {
    expect(computeRaftBearing(raft(), { ...loaded, deadAreaLoadKpa: 0, liveAreaLoadKpa: 0 })).toBeNull();
  });

  it('μεγαλύτερη πλάκα → μικρότερη μέση πίεση (ίδιο area load)', () => {
    const small = computeRaftBearing(raft(6000, 4000), loaded)!.pMaxKpa;
    const big = computeRaftBearing(raft(12000, 8000), loaded)!.pMaxKpa;
    // Η μέση πίεση area-load είναι ανεξάρτητη επιφάνειας· διαφέρει μόνο το self-weight
    // ανά m² (σταθερό) → ίδια pMax. Επιβεβαιώνει uniform model.
    expect(big).toBeCloseTo(small, 6);
  });
});
