/**
 * ADR-499 §C v1 — `runBeamTorsionChecks`: warning «στρέψη > T_Rd,max» όταν η πρόβολος-πλάκα
 * στρίβει τη φέρουσα δοκό πέρα από τη στρεπτική αντοχή της διατομής. Fixtures: canvas = mm.
 */

import { runBeamTorsionChecks } from '../beam-torsion-checks';
import type { Entity } from '../../../../types/entities';

function beam(id: string, widthMm: number, depthMm: number, x1: number): Entity {
  return {
    id, type: 'beam', kind: 'straight',
    params: { kind: 'straight', width: widthMm, depth: depthMm, sceneUnits: 'mm', startPoint: { x: 0, y: 0 }, endPoint: { x: x1, y: 0 } },
    geometry: { length: x1 / 1000, volume: 0.5 },
  } as unknown as Entity;
}

function slab(id: string, xMax: number, yMax: number, deadAxialKn: number): Entity {
  return {
    id, type: 'slab', kind: 'roof',
    params: {
      kind: 'roof', sceneUnits: 'mm', thickness: 200,
      appliedLoad: { deadAxialKn, liveAxialKn: 0 },
      outline: { vertices: [
        { x: 0, y: 0, z: 0 }, { x: xMax, y: 0, z: 0 },
        { x: xMax, y: yMax, z: 0 }, { x: 0, y: yMax, z: 0 },
      ] },
    },
    geometry: { maxFreeSpanM: yMax / 1000, area: (xMax * yMax) / 1e6 },
  } as unknown as Entity;
}

const codeOf = (d: { code: string }) => d.code;
const TORSION = 'beamCantileverTorsionExceedsCapacity';

describe('runBeamTorsionChecks (ADR-499 §C/§D — warning ΜΟΝΟ σε growToFix)', () => {
  it('πρόβολος σε φαρδιά-ρηχή δοκό (700×400, λύνεται με μεγαλύτερο ύψος) → warning', () => {
    const diags = runBeamTorsionChecks([beam('b1', 700, 400, 5000), slab('s1', 5000, 4000, 300)]);
    const d = diags.find((x) => x.code === TORSION);
    expect(d).toBeDefined();
    expect(d?.severity).toBe('warning');
    expect(d?.entityIds).toContain('b1');
    expect(d?.messageParams?.tEd).toBeDefined();
  });

  it('ίδιος πρόβολος σε επαρκώς μεγάλη δοκό (800×1200) → σιωπηλό (ok)', () => {
    const diags = runBeamTorsionChecks([beam('b1', 800, 1200, 5000), slab('s1', 5000, 4000, 300)]);
    expect(diags.map(codeOf)).not.toContain(TORSION);
  });

  it('μικρός πρόβολος (q χαμηλό) σε 250×400 → σιωπηλό (ok, T_Ed ≤ T_Rd,max)', () => {
    const diags = runBeamTorsionChecks([beam('b1', 250, 400, 5000), slab('s1', 5000, 1000, 20)]);
    expect(diags.map(codeOf)).not.toContain(TORSION);
  });

  it('ανέφικτη στρέψη σε λεπτή δοκό 250×400 → ΚΑΝΕΝΑ warning (κλιμάκωση σε error στο feasibility)', () => {
    const diags = runBeamTorsionChecks([beam('b1', 250, 400, 5000), slab('s1', 5000, 4000, 300)]);
    expect(diags.map(codeOf)).not.toContain(TORSION);
  });

  it('καμία πλάκα → κενό', () => {
    expect(runBeamTorsionChecks([beam('b1', 250, 400, 5000)])).toHaveLength(0);
  });
});
