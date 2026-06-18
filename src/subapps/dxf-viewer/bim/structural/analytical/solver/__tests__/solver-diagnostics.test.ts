/**
 * Static FEM solver — diagnostics, element stiffness & skipped-member tests (ADR-481, T3 / S8).
 */

import { buildElementStiffness } from '../frame-element-stiffness';
import { solveStaticFrame } from '../frame-solver';
import { runAnalysisDiagnostics } from '../analysis-diagnostics';
import { AnalysisResultsStore } from '../analysis-results-store';
import { buildStandardCombinations } from '../../load-cases';
import { ZERO_MEMBER_LOAD, type MemberLoad } from '../../../loads/structural-loads-types';
import { FIXED_DOF, FREE_DOF, type AnalyticalModel } from '../../analytical-model-types';
import { EMPTY_ANALYSIS_RESULT } from '../solver-types';
import type { MemberSectionProperties } from '../member-section-properties';

const SECTION: MemberSectionProperties = {
  eKnm2: 30e6, gKnm2: 30e6 / 2.4, areaM2: 0.09, iyM4: 6.75e-4, izM4: 6.75e-4, jM4: 1e-3,
};

describe('buildElementStiffness', () => {
  const pi = { xM: 0, yM: 0, zM: 0 };
  const pj = { xM: 4, yM: 0, zM: 0 };

  it('παράγει συμμετρικό ολικό μητρώο 12×12', () => {
    const el = buildElementStiffness(pi, pj, SECTION);
    expect(el).not.toBeNull();
    const k = el!.kGlobal;
    expect(k).toHaveLength(12);
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) expect(k[i][j]).toBeCloseTo(k[j][i], 6);
    }
  });

  it('το αξονικό όρος είναι EA/L', () => {
    const el = buildElementStiffness(pi, pj, SECTION)!;
    // Μέλος κατά X → τοπικός x = ολικός x → k[0][0] = EA/L.
    expect(el.kGlobal[0][0]).toBeCloseTo((SECTION.eKnm2 * SECTION.areaM2) / 4, 3);
  });

  it('μηδενικό μήκος → null', () => {
    expect(buildElementStiffness(pi, pi, SECTION)).toBeNull();
  });
});

describe('παραλειπόμενα μέλη (skipped)', () => {
  // Πρόβολος m1 (με διατομή) + παράλληλο m2 (χωρίς διατομή) στους ίδιους κόμβους.
  const model: AnalyticalModel = {
    nodes: [
      { id: 'n0', position: { xM: 0, yM: 0, zM: 0 }, restraint: FIXED_DOF, levelId: 'lvl-0' },
      { id: 'n1', position: { xM: 5, yM: 0, zM: 0 }, restraint: FREE_DOF, levelId: 'lvl-0' },
    ],
    members: [
      { id: 'm1', entityId: 'm1', memberType: 'beam', iNodeId: 'n0', jNodeId: 'n1', lengthM: 5 },
      { id: 'm2', entityId: 'm2', memberType: 'beam', iNodeId: 'n0', jNodeId: 'n1', lengthM: 5 },
    ],
    supports: [], diaphragms: [], levels: [{ id: 'lvl-0', elevationM: 0 }],
  };
  const sectionProvider = (m: { id: string }): MemberSectionProperties | null => (m.id === 'm2' ? null : SECTION);
  const loadProvider = (): MemberLoad => ({ ...ZERO_MEMBER_LOAD, deadAxialKn: 40 });

  it('παραλείπει το μέλος χωρίς διατομή αλλά επιλύει τον φορέα', () => {
    const result = solveStaticFrame({ model, sectionProvider, loadProvider, combinations: buildStandardCombinations() });
    expect(result.skippedMemberIds).toEqual(['m2']);
    expect(result.unstable).toBe(false);
    expect(result.combinations[0].memberForces.some((mf) => mf.memberId === 'm1')).toBe(true);
  });

  it('runAnalysisDiagnostics → warning ανά παραλειπόμενο μέλος', () => {
    const result = solveStaticFrame({ model, sectionProvider, loadProvider, combinations: buildStandardCombinations() });
    const diags = runAnalysisDiagnostics(result, model.members.map((m) => m.id));
    const skipped = diags.filter((d) => d.code === 'staticAnalysisMemberSkipped');
    expect(skipped).toHaveLength(1);
    expect(skipped[0].primaryEntityId).toBe('m2');
    expect(skipped[0].severity).toBe('warning');
  });

  it('μηχανισμός → ένα staticAnalysisUnstable error', () => {
    const diags = runAnalysisDiagnostics({ ...EMPTY_ANALYSIS_RESULT, unstable: true }, ['x1', 'x2']);
    const unstable = diags.filter((d) => d.code === 'staticAnalysisUnstable');
    expect(unstable).toHaveLength(1);
    expect(unstable[0].entityIds).toEqual(['x1', 'x2']);
  });
});

describe('AnalysisResultsStore', () => {
  it('set/get/subscribe roundtrip', () => {
    let notified = 0;
    const unsub = AnalysisResultsStore.subscribe(() => { notified++; });
    AnalysisResultsStore.set({ ...EMPTY_ANALYSIS_RESULT, unstable: true });
    expect(AnalysisResultsStore.get().unstable).toBe(true);
    expect(notified).toBe(1);
    unsub();
    AnalysisResultsStore.set(EMPTY_ANALYSIS_RESULT); // reset· δεν ειδοποιεί (unsub)
    expect(notified).toBe(1);
  });
});
