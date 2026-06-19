/**
 * Tests — column-diagram-3d-geometry (ADR-483 Slice 5).
 *
 * Επαληθεύουμε ότι ο pure 3Δ builder: (1) διαλέγει ΜΟΝΟ column members· (2) τοποθετεί
 * τον άξονα base(i)→top(j) από τους αναλυτικούς κόμβους· (3) δειγματίζει f=xM/L +
 * extremum· (4) διαλέγει σωστό εντατικό μέγεθος (M/V/N) + κυρίαρχο άξονα· (5) επιστρέφει
 * EMPTY χωρίς αποτέλεσμα/κολώνες· (6) referenceLengthM = μέσο ύψος.
 */

import {
  buildColumnDiagram3DPaths,
  DEFAULT_LATERAL_OFFSET_DIR,
} from '../column-diagram-3d-geometry';
import type { AnalyticalModel } from '../../../bim/structural/analytical/analytical-model-types';
import type { AnalysisResult, DiagramStation } from '../../../bim/structural/analytical/solver/solver-types';

function station(xM: number, over: Partial<DiagramStation> = {}): DiagramStation {
  return { xM, axialN: 0, shearY: 0, shearZ: 0, torsion: 0, momentY: 0, momentZ: 0, ...over };
}

/** Μοντέλο: 1 κολώνα (base an-0 @z0 → top an-1 @z3) + 1 δοκάρι (αγνοείται). */
function model(): AnalyticalModel {
  return {
    nodes: [
      { id: 'an-0', position: { xM: 2, yM: 5, zM: 0 }, restraint: { dx: true, dy: true, dz: true, rx: true, ry: true, rz: true }, levelId: 'lvl-0' },
      { id: 'an-1', position: { xM: 2, yM: 5, zM: 3 }, restraint: { dx: false, dy: false, dz: false, rx: false, ry: false, rz: false }, levelId: 'lvl-1' },
      { id: 'an-2', position: { xM: 8, yM: 5, zM: 3 }, restraint: { dx: false, dy: false, dz: false, rx: false, ry: false, rz: false }, levelId: 'lvl-1' },
    ],
    members: [
      { id: 'col-1', entityId: 'col-1', memberType: 'column', iNodeId: 'an-0', jNodeId: 'an-1', lengthM: 3 },
      { id: 'beam-1', entityId: 'beam-1', memberType: 'beam', iNodeId: 'an-1', jNodeId: 'an-2', lengthM: 6 },
    ],
    supports: [],
    diaphragms: [],
    levels: [{ id: 'lvl-0', elevationM: 0 }, { id: 'lvl-1', elevationM: 3 }],
  };
}

/** Αποτέλεσμα: column με momentZ profile + beam (να επιβεβαιωθεί ότι ΔΕΝ μπαίνει). */
function result(over: Partial<DiagramStation>[] = [{ momentZ: 10 }, { momentZ: -40 }, { momentZ: 5 }]): AnalysisResult {
  return {
    combinations: [{
      combinationId: 'c1', combinationKind: 'ULS-1', singular: false,
      displacements: [],
      memberForces: [
        { memberId: 'col-1', endForcesLocal: [], extrema: { maxAbsAxialN: 0, maxAbsShear: 0, maxAbsMoment: 40, maxAbsTorsion: 0 },
          diagram: [station(0, over[0]), station(1.5, over[1]), station(3, over[2])] },
        { memberId: 'beam-1', endForcesLocal: [], extrema: { maxAbsAxialN: 0, maxAbsShear: 0, maxAbsMoment: 99, maxAbsTorsion: 0 },
          diagram: [station(0, { momentZ: 99 }), station(6, { momentZ: 99 })] },
      ],
    }],
    envelopeByMember: new Map(),
    skippedMemberIds: [],
    unstable: false,
  };
}

describe('buildColumnDiagram3DPaths (ADR-483 Slice 5)', () => {
  it('μόνο column members — το δοκάρι αγνοείται', () => {
    const set = buildColumnDiagram3DPaths(model(), result());
    expect(set.paths).toHaveLength(1);
    expect(set.paths[0]!.memberId).toBe('col-1');
  });

  it('άξονας base(i)→top(j) από τους αναλυτικούς κόμβους', () => {
    const set = buildColumnDiagram3DPaths(model(), result());
    const p = set.paths[0]!;
    expect(p.base).toEqual({ xM: 2, yM: 5, zM: 0 });
    expect(p.top).toEqual({ xM: 2, yM: 5, zM: 3 });
    expect(p.offsetDir).toEqual(DEFAULT_LATERAL_OFFSET_DIR);
  });

  it('δειγματοληψία f=xM/L + extremum (max-abs)', () => {
    const set = buildColumnDiagram3DPaths(model(), result());
    const p = set.paths[0]!;
    expect(p.samples.map((s) => s.f)).toEqual([0, 0.5, 1]);
    expect(p.samples.map((s) => s.value)).toEqual([10, -40, 5]);
    expect(p.extremum).toEqual({ f: 0.5, value: -40 });
    expect(set.globalMaxAbs).toBe(40);
    expect(set.referenceLengthM).toBe(3);
    expect(set.combinationKind).toBe('ULS-1');
  });

  it('component switch — axial/shear διαβάζει το σωστό πεδίο στάθμης', () => {
    const r = result([{ momentZ: 10, axialN: -500, shearY: 7 }, { momentZ: -40, axialN: -520, shearY: 9 }, { momentZ: 5, axialN: -540, shearY: 3 }]);
    const axial = buildColumnDiagram3DPaths(model(), r, { component: 'axial' });
    expect(axial.paths[0]!.samples.map((s) => s.value)).toEqual([-500, -520, -540]);
    expect(axial.globalMaxAbs).toBe(540);
    const shear = buildColumnDiagram3DPaths(model(), r, { component: 'shear' });
    expect(shear.paths[0]!.samples.map((s) => s.value)).toEqual([7, 9, 3]);
  });

  it('κυρίαρχος άξονας κάμψης — momentY υπερισχύει όταν είναι μεγαλύτερος', () => {
    const r = result([{ momentY: 80, momentZ: 10 }, { momentY: -120, momentZ: -40 }, { momentY: 20, momentZ: 5 }]);
    const set = buildColumnDiagram3DPaths(model(), r, { component: 'moment' });
    expect(set.paths[0]!.samples.map((s) => s.value)).toEqual([80, -120, 20]);
    expect(set.globalMaxAbs).toBe(120);
  });

  it('κανένα έγκυρο αποτέλεσμα → EMPTY', () => {
    const empty: AnalysisResult = { combinations: [], envelopeByMember: new Map(), skippedMemberIds: [], unstable: false };
    const set = buildColumnDiagram3DPaths(model(), empty);
    expect(set.paths).toHaveLength(0);
    expect(set.globalMaxAbs).toBe(0);
    expect(set.referenceLengthM).toBe(0);
  });

  it('singular combination → EMPTY (μηχανισμός, ύποπτες τιμές)', () => {
    const r = result();
    const singular: AnalysisResult = { ...r, combinations: [{ ...r.combinations[0]!, singular: true }] };
    expect(buildColumnDiagram3DPaths(model(), singular).paths).toHaveLength(0);
  });
});
