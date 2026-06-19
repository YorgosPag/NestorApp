/**
 * Tests — beam-diagram-3d-geometry (ADR-483 Slice 6).
 *
 * Επαληθεύουμε ότι ο pure 3Δ builder: (1) διαλέγει ΜΟΝΟ beam members (η κολώνα αγνοείται)·
 * (2) κρατά πλήρεις 3D κόμβους start(i)→end(j) από τους αναλυτικούς κόμβους· (3) δειγματίζει
 * f=xM/L + extremum· (4) διαλέγει σωστό εντατικό μέγεθος (M/V/N) + κυρίαρχο άξονα· (5)
 * επιστρέφει EMPTY χωρίς αποτέλεσμα/δοκάρια· (6) referenceLengthM = μέσο άνοιγμα.
 */

import { buildBeamDiagram3DPaths } from '../beam-diagram-3d-geometry';
import type { AnalyticalModel } from '../../../bim/structural/analytical/analytical-model-types';
import type { AnalysisResult, DiagramStation } from '../../../bim/structural/analytical/solver/solver-types';

function station(xM: number, over: Partial<DiagramStation> = {}): DiagramStation {
  return { xM, axialN: 0, shearY: 0, shearZ: 0, torsion: 0, momentY: 0, momentZ: 0, ...over };
}

/** Μοντέλο: 1 δοκάρι (start an-0 → end an-1, οριζόντιο @z3, L=6) + 1 κολώνα (αγνοείται). */
function model(): AnalyticalModel {
  return {
    nodes: [
      { id: 'an-0', position: { xM: 2, yM: 5, zM: 3 }, restraint: { dx: false, dy: false, dz: false, rx: false, ry: false, rz: false }, levelId: 'lvl-1' },
      { id: 'an-1', position: { xM: 8, yM: 5, zM: 3 }, restraint: { dx: false, dy: false, dz: false, rx: false, ry: false, rz: false }, levelId: 'lvl-1' },
      { id: 'an-2', position: { xM: 2, yM: 5, zM: 0 }, restraint: { dx: true, dy: true, dz: true, rx: true, ry: true, rz: true }, levelId: 'lvl-0' },
    ],
    members: [
      { id: 'beam-1', entityId: 'beam-1', memberType: 'beam', iNodeId: 'an-0', jNodeId: 'an-1', lengthM: 6 },
      { id: 'col-1', entityId: 'col-1', memberType: 'column', iNodeId: 'an-2', jNodeId: 'an-0', lengthM: 3 },
    ],
    supports: [],
    diaphragms: [],
    levels: [{ id: 'lvl-0', elevationM: 0 }, { id: 'lvl-1', elevationM: 3 }],
  };
}

/** Αποτέλεσμα: beam με momentZ profile + column (να επιβεβαιωθεί ότι ΔΕΝ μπαίνει). */
function result(over: Partial<DiagramStation>[] = [{ momentZ: 8 }, { momentZ: -60 }, { momentZ: 8 }]): AnalysisResult {
  return {
    combinations: [{
      combinationId: 'c1', combinationKind: 'ULS-1', singular: false,
      displacements: [],
      memberForces: [
        { memberId: 'beam-1', endForcesLocal: [], extrema: { maxAbsAxialN: 0, maxAbsShear: 0, maxAbsMoment: 60, maxAbsTorsion: 0 },
          diagram: [station(0, over[0]), station(3, over[1]), station(6, over[2])] },
        { memberId: 'col-1', endForcesLocal: [], extrema: { maxAbsAxialN: 0, maxAbsShear: 0, maxAbsMoment: 99, maxAbsTorsion: 0 },
          diagram: [station(0, { momentZ: 99 }), station(3, { momentZ: 99 })] },
      ],
    }],
    envelopeByMember: new Map(),
    skippedMemberIds: [],
    unstable: false,
  };
}

describe('buildBeamDiagram3DPaths (ADR-483 Slice 6)', () => {
  it('μόνο beam members — η κολώνα αγνοείται', () => {
    const set = buildBeamDiagram3DPaths(model(), result());
    expect(set.paths).toHaveLength(1);
    expect(set.paths[0]!.memberId).toBe('beam-1');
  });

  it('άξονας start(i)→end(j) με πλήρεις 3D κόμβους (zM διατηρείται)', () => {
    const set = buildBeamDiagram3DPaths(model(), result());
    const p = set.paths[0]!;
    expect(p.start).toEqual({ xM: 2, yM: 5, zM: 3 });
    expect(p.end).toEqual({ xM: 8, yM: 5, zM: 3 });
  });

  it('δειγματοληψία f=xM/L + extremum (max-abs)', () => {
    const set = buildBeamDiagram3DPaths(model(), result());
    const p = set.paths[0]!;
    expect(p.samples.map((s) => s.f)).toEqual([0, 0.5, 1]);
    expect(p.samples.map((s) => s.value)).toEqual([8, -60, 8]);
    expect(p.extremum).toEqual({ f: 0.5, value: -60 });
    expect(set.globalMaxAbs).toBe(60);
    expect(set.referenceLengthM).toBe(6);
    expect(set.combinationKind).toBe('ULS-1');
  });

  it('component switch — axial/shear διαβάζει το σωστό πεδίο στάθμης', () => {
    const r = result([{ momentZ: 8, axialN: -120, shearY: 30 }, { momentZ: -60, axialN: -120, shearY: 0 }, { momentZ: 8, axialN: -120, shearY: -30 }]);
    const axial = buildBeamDiagram3DPaths(model(), r, { component: 'axial' });
    expect(axial.paths[0]!.samples.map((s) => s.value)).toEqual([-120, -120, -120]);
    expect(axial.globalMaxAbs).toBe(120);
    const shear = buildBeamDiagram3DPaths(model(), r, { component: 'shear' });
    expect(shear.paths[0]!.samples.map((s) => s.value)).toEqual([30, 0, -30]);
  });

  it('κυρίαρχος άξονας κάμψης — momentY υπερισχύει όταν είναι μεγαλύτερος', () => {
    const r = result([{ momentY: 20, momentZ: 8 }, { momentY: -90, momentZ: -60 }, { momentY: 20, momentZ: 8 }]);
    const set = buildBeamDiagram3DPaths(model(), r, { component: 'moment' });
    expect(set.paths[0]!.samples.map((s) => s.value)).toEqual([20, -90, 20]);
    expect(set.globalMaxAbs).toBe(90);
  });

  it('κανένα έγκυρο αποτέλεσμα → EMPTY', () => {
    const empty: AnalysisResult = { combinations: [], envelopeByMember: new Map(), skippedMemberIds: [], unstable: false };
    const set = buildBeamDiagram3DPaths(model(), empty);
    expect(set.paths).toHaveLength(0);
    expect(set.globalMaxAbs).toBe(0);
    expect(set.referenceLengthM).toBe(0);
  });

  it('singular combination → EMPTY (μηχανισμός, ύποπτες τιμές)', () => {
    const r = result();
    const singular: AnalysisResult = { ...r, combinations: [{ ...r.combinations[0]!, singular: true }] };
    expect(buildBeamDiagram3DPaths(model(), singular).paths).toHaveLength(0);
  });
});
