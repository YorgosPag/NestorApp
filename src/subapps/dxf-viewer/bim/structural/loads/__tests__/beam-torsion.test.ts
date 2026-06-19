/**
 * ADR-499 §C v1 — beam-torsion (`computeBeamDesignTorsion`): T_Ed στη φέρουσα δοκό από
 * μονόπλευρη πρόβολο-πλάκα. Fixtures: canvas = mm (sceneUnits:'mm' → /1000 = m).
 */

import { computeBeamDesignTorsion, classifyBeamTorsion, assessBeamTorsion } from '../beam-torsion';
import { plasticTorsionalResistanceKnm } from '../../codes/torsion-capacity';
import { BEAM_MAX_PRACTICAL_DEPTH_MM } from '../../sizing/member-sizing';
import type { Entity } from '../../../../types/entities';

function beam(id: string, x0: number, y0: number, x1: number, y1: number): Entity {
  return {
    id, type: 'beam', kind: 'straight',
    params: { kind: 'straight', width: 250, depth: 400, sceneUnits: 'mm', startPoint: { x: x0, y: y0 }, endPoint: { x: x1, y: y1 } },
    geometry: { length: Math.hypot(x1 - x0, y1 - y0) / 1000, volume: 0.5 },
  } as unknown as Entity;
}

/** Πλάκα roof (suspended) πρόβολος κατά Y από τη δοκό y=0· με tributary appliedLoad → q_Ed>0. */
function slab(id: string, x0: number, y0: number, x1: number, y1: number, deadAxialKn: number): Entity {
  return {
    id, type: 'slab', kind: 'roof',
    params: {
      kind: 'roof', sceneUnits: 'mm', thickness: 200,
      appliedLoad: { deadAxialKn, liveAxialKn: 0 },
      outline: { vertices: [
        { x: x0, y: y0, z: 0 }, { x: x1, y: y0, z: 0 },
        { x: x1, y: y1, z: 0 }, { x: x0, y: y1, z: 0 },
      ] },
    },
    geometry: { maxFreeSpanM: Math.abs(y1 - y0) / 1000, area: (Math.abs(x1 - x0) * Math.abs(y1 - y0)) / 1e6 },
  } as unknown as Entity;
}

describe('computeBeamDesignTorsion (ADR-499 §C)', () => {
  it('πρόβολος-πλάκα σε 1 δοκό → T_Ed > 0 στη φέρουσα δοκό', () => {
    const map = computeBeamDesignTorsion([beam('b1', 0, 0, 5000, 0), slab('s1', 0, 0, 5000, 4000, 300)]);
    expect((map.get('b1') ?? 0)).toBeGreaterThan(0);
  });

  it('αμφιέρειστη πλάκα (2 παράλληλες δοκοί) → καμία στρέψη', () => {
    const map = computeBeamDesignTorsion([
      beam('b1', 0, 0, 5000, 0),
      beam('b2', 0, 4000, 5000, 4000),
      slab('s1', 0, 0, 5000, 4000, 300),
    ]);
    expect(map.size).toBe(0);
  });

  it('μεγαλύτερο άνοιγμα προβόλου → μεγαλύτερο T_Ed (μονοτονία ~L²)', () => {
    const short = computeBeamDesignTorsion([beam('b1', 0, 0, 5000, 0), slab('s1', 0, 0, 5000, 2000, 300)]).get('b1') ?? 0;
    const long = computeBeamDesignTorsion([beam('b1', 0, 0, 5000, 0), slab('s1', 0, 0, 5000, 4000, 300)]).get('b1') ?? 0;
    expect(long).toBeGreaterThan(short);
  });

  it('καμία πλάκα → κενό', () => {
    expect(computeBeamDesignTorsion([beam('b1', 0, 0, 5000, 0)]).size).toBe(0);
  });

  it('πλάκα χωρίς φορτίο (q=0) → καμία στρέψη', () => {
    const map = computeBeamDesignTorsion([beam('b1', 0, 0, 5000, 0), slab('s1', 0, 0, 5000, 4000, 0)]);
    expect(map.size).toBe(0);
  });
});

describe('classifyBeamTorsion (ADR-499 §D — 3-level escalation)', () => {
  const FCD = 16.67; // C25/30
  const W = 300, D = 400;
  const tRdCurrent = plasticTorsionalResistanceKnm(W, D, FCD);
  const tRdAtMax = plasticTorsionalResistanceKnm(W, BEAM_MAX_PRACTICAL_DEPTH_MM, FCD);

  it('μεγαλώνοντας το ύψος αυξάνεται το T_Rd,max (sanity)', () => {
    expect(tRdAtMax).toBeGreaterThan(tRdCurrent);
  });

  it('T_Ed ≤ T_Rd,max τρέχουσας → ok (σιωπηλό)', () => {
    expect(classifyBeamTorsion(tRdCurrent * 0.5, W, D, FCD).classification).toBe('ok');
  });

  it('T_Rd,max τρέχουσας < T_Ed ≤ T_Rd,max@max → growToFix (warning)', () => {
    const tEd = (tRdCurrent + tRdAtMax) / 2;
    expect(classifyBeamTorsion(tEd, W, D, FCD).classification).toBe('growToFix');
  });

  it('T_Ed > T_Rd,max@max → infeasible (error)', () => {
    expect(classifyBeamTorsion(tRdAtMax * 1.5, W, D, FCD).classification).toBe('infeasible');
  });

  it('εκφυλισμένη διατομή (T_Rd,max=0) → ok (defensive)', () => {
    expect(classifyBeamTorsion(100, 0, 0, FCD).classification).toBe('ok');
  });
});

describe('assessBeamTorsion (ADR-499 §C/§D)', () => {
  it('πρόβολος-πλάκα σε δοκό → assessment με tEd>0 + κατάταξη', () => {
    const map = assessBeamTorsion([beam('b1', 0, 0, 5000, 0), slab('s1', 0, 0, 5000, 4000, 300)]);
    const a = map.get('b1');
    expect(a).toBeDefined();
    expect(a?.tEdKnm).toBeGreaterThan(0);
    expect(['growToFix', 'infeasible']).toContain(a?.classification);
  });

  it('καμία πλάκα → κενό', () => {
    expect(assessBeamTorsion([beam('b1', 0, 0, 5000, 0)]).size).toBe(0);
  });
});
