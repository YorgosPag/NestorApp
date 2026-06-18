/**
 * ADR-483 (T3-UI / Slice 4) — member-diagram-geometry unit tests.
 *
 * Επαληθεύει το pure mapping solver-result + analytical-model → screen-agnostic
 * διαδρομές διαγράμματος: επιλογή συνδυασμού (ULS-first, skip singular), φιλτράρισμα
 * δοκαριών (όχι κολόνες σε plan v1), fraction f = xM/L, κυρίαρχος άξονας ροπής,
 * ακραία τιμή, μετατροπή μέτρων → canvas units, global max-abs.
 */

import { buildMemberDiagramPaths } from '../member-diagram-geometry';
import type { AnalyticalModel } from '../../analytical-model-types';
import { FREE_DOF } from '../../analytical-model-types';
import type { AnalysisResult, DiagramStation } from '../../solver/solver-types';

function station(xM: number, momentZ: number): DiagramStation {
  return { xM, axialN: 0, shearY: 0, shearZ: 0, torsion: 0, momentY: 0, momentZ };
}

function model(): AnalyticalModel {
  return {
    nodes: [
      { id: 'an-0', position: { xM: 0, yM: 0, zM: 3 }, restraint: FREE_DOF, levelId: 'lvl-1' },
      { id: 'an-1', position: { xM: 4, yM: 0, zM: 3 }, restraint: FREE_DOF, levelId: 'lvl-1' },
    ],
    members: [
      { id: 'beam-1', entityId: 'beam-1', memberType: 'beam', iNodeId: 'an-0', jNodeId: 'an-1', lengthM: 4 },
      { id: 'col-1', entityId: 'col-1', memberType: 'column', iNodeId: 'an-0', jNodeId: 'an-0', lengthM: 3 },
    ],
    supports: [],
    diaphragms: [],
    levels: [],
  };
}

function result(kind: string, singular: boolean): AnalysisResult {
  return {
    combinations: [
      {
        combinationId: kind, combinationKind: kind, singular,
        displacements: [],
        memberForces: [
          {
            memberId: 'beam-1', endForcesLocal: [], extrema: { maxAbsAxialN: 0, maxAbsShear: 0, maxAbsMoment: 50, maxAbsTorsion: 0 },
            diagram: [station(0, -20), station(2, 50), station(4, -20)],
          },
          {
            memberId: 'col-1', endForcesLocal: [], extrema: { maxAbsAxialN: 0, maxAbsShear: 0, maxAbsMoment: 999, maxAbsTorsion: 0 },
            diagram: [station(0, 999), station(3, 999)],
          },
        ],
      },
    ],
    envelopeByMember: new Map(),
    skippedMemberIds: [],
    unstable: false,
  };
}

const OPTS = { component: 'moment' as const, toCanvasFromMeters: 1000 };

describe('buildMemberDiagramPaths', () => {
  it('draws beams only (columns excluded in 2D plan v1)', () => {
    const set = buildMemberDiagramPaths(model(), result('uls', false), OPTS);
    expect(set.paths).toHaveLength(1);
    expect(set.paths[0]!.memberId).toBe('beam-1');
  });

  it('maps xM → fraction f and meters → canvas units', () => {
    const set = buildMemberDiagramPaths(model(), result('uls', false), OPTS);
    const path = set.paths[0]!;
    expect(path.samples.map((s) => s.f)).toEqual([0, 0.5, 1]);
    expect(path.iCanvas).toEqual({ x: 0, y: 0 });
    expect(path.jCanvas).toEqual({ x: 4000, y: 0 }); // 4 m × 1000
    // model-space reference = μέσο μήκος μέλους (canvas units) για zoom-stable κλίμακα
    expect(set.referenceLengthCanvas).toBe(4000);
  });

  it('picks the extremum station (max |moment|) and reports global max-abs', () => {
    const set = buildMemberDiagramPaths(model(), result('uls', false), OPTS);
    expect(set.paths[0]!.extremum).toEqual({ f: 0.5, value: 50 });
    expect(set.globalMaxAbs).toBe(50);
  });

  it('returns empty when the only combination is singular', () => {
    const set = buildMemberDiagramPaths(model(), result('uls', true), OPTS);
    expect(set.paths).toHaveLength(0);
    expect(set.globalMaxAbs).toBe(0);
  });

  it('ADR-483 Slice 4b — reliable flag mirrors result.unstable', () => {
    const stable = buildMemberDiagramPaths(model(), result('uls', false), OPTS);
    expect(stable.reliable).toBe(true);
    const unstable: AnalysisResult = { ...result('uls', false), unstable: true };
    expect(buildMemberDiagramPaths(model(), unstable, OPTS).reliable).toBe(false);
  });

  it('ADR-483 Slice 4b+ — exposes the drawn combination kind (caption)', () => {
    expect(buildMemberDiagramPaths(model(), result('uls', false), OPTS).combinationKind).toBe('uls');
  });

  it('returns empty (no throw) for an empty model', () => {
    const empty: AnalyticalModel = { nodes: [], members: [], supports: [], diaphragms: [], levels: [] };
    const set = buildMemberDiagramPaths(empty, result('uls', false), OPTS);
    expect(set.paths).toHaveLength(0);
  });
});
