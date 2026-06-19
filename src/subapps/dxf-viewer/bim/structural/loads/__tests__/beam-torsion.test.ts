/**
 * ADR-499 §C v1 — beam-torsion (`computeBeamDesignTorsion`): T_Ed στη φέρουσα δοκό από
 * μονόπλευρη πρόβολο-πλάκα. Fixtures: canvas = mm (sceneUnits:'mm' → /1000 = m).
 */

import { computeBeamDesignTorsion } from '../beam-torsion';
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
