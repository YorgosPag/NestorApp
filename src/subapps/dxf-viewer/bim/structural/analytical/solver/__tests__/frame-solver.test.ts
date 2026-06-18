/**
 * Static FEM solver — validation tests (ADR-481, T3 / S8).
 *
 * Επαληθεύει τον solver έναντι **γνωστών αναλυτικών λύσεων** μηχανικής:
 *   · Αμφιέρειστη δοκός υπό ομοιόμορφο φορτίο → M_mid = wL²/8, V_max = wL/2.
 *   · Πρόβολος υπό ομοιόμορφο φορτίο → M_base = wL²/2, V_base = wL, βέλος = wL⁴/8EI.
 *   · Φορέας χωρίς στήριξη → μηχανισμός (singular K).
 *   · Γραμμική άλγεβρα (LDLᵀ) σε γνωστό SPD σύστημα.
 *
 * Όλα μέσω injected providers (jest-clean — μηδέν entity store/firebase).
 */

import { solveStaticFrame } from '../frame-solver';
import { solveSymmetric } from '../cholesky-solve';
import { buildStandardCombinations } from '../../load-cases';
import { ZERO_MEMBER_LOAD, type MemberLoad } from '../../../loads/structural-loads-types';
import {
  FIXED_DOF, FREE_DOF, type AnalyticalModel, type AnalyticalNode, type RestraintDof,
} from '../../analytical-model-types';
import type { MemberSectionProperties } from '../member-section-properties';
import type { CombinationResult } from '../solver-types';

const SPAN_M = 6;
const TOTAL_LOAD_KN = 60; // w = 10 kN/m επί 6 m
const W_PER_M = TOTAL_LOAD_KN / SPAN_M;

/** Σταθερή τετράγωνη διατομή 300×300, C25/30-ish (στατικά ανεξάρτητα της EI). */
const SECTION: MemberSectionProperties = {
  eKnm2: 30e6, gKnm2: 30e6 / 2.4, areaM2: 0.09, iyM4: 6.75e-4, izM4: 6.75e-4, jM4: 1e-3,
};

const sectionProvider = (): MemberSectionProperties => SECTION;
const loadProvider = (): MemberLoad => ({ ...ZERO_MEMBER_LOAD, deadAxialKn: TOTAL_LOAD_KN });

function node(id: string, xM: number, restraint: RestraintDof): AnalyticalNode {
  return { id, position: { xM, yM: 0, zM: 0 }, restraint, levelId: 'lvl-0' };
}

/** Οριζόντια δοκός κατά X με δεδομένες στηρίξεις άκρων. */
function beamModel(restraintI: RestraintDof, restraintJ: RestraintDof): AnalyticalModel {
  return {
    nodes: [node('n0', 0, restraintI), node('n1', SPAN_M, restraintJ)],
    members: [{ id: 'b1', entityId: 'b1', memberType: 'beam', iNodeId: 'n0', jNodeId: 'n1', lengthM: SPAN_M }],
    supports: [],
    diaphragms: [],
    levels: [{ id: 'lvl-0', elevationM: 0 }],
  };
}

function slsResult(model: AnalyticalModel): CombinationResult {
  const result = solveStaticFrame({ model, sectionProvider, loadProvider, combinations: buildStandardCombinations() });
  const sls = result.combinations.find((c) => c.combinationKind === 'sls');
  expect(sls).toBeDefined();
  return sls as CombinationResult;
}

describe('solveSymmetric (LDLᵀ)', () => {
  it('λύνει γνωστό 2×2 SPD σύστημα', () => {
    const { solution, singular } = solveSymmetric([[4, 1], [1, 3]], [1, 2]);
    expect(singular).toBe(false);
    // Αναλυτική λύση: x = (1/11, 7/11).
    expect(solution[0]).toBeCloseTo(1 / 11, 9);
    expect(solution[1]).toBeCloseTo(7 / 11, 9);
  });

  it('εντοπίζει ιδιάζον (singular) μητρώο', () => {
    const { singular } = solveSymmetric([[1, 1], [1, 1]], [1, 2]);
    expect(singular).toBe(true);
  });
});

describe('αμφιέρειστη δοκός υπό ομοιόμορφο φορτίο', () => {
  // Πείρος: dz fixed (κατακόρυφη στήριξη)· ry ελεύθερο (κάμψη)· dx@i fixed, dx@j free
  // (κύλιση)· dy/rz/rx fixed (αποτροπή πλευρικών/στρεπτικών μηχανισμών — άφόρτιστα).
  const pinI: RestraintDof = { dx: true, dy: true, dz: true, rx: true, ry: false, rz: true };
  const rollerJ: RestraintDof = { dx: false, dy: true, dz: true, rx: true, ry: false, rz: true };

  it('M_mid = wL²/8 και V_max = wL/2', () => {
    const sls = slsResult(beamModel(pinI, rollerJ));
    const beam = sls.memberForces[0];
    expect(beam.extrema.maxAbsMoment).toBeCloseTo((W_PER_M * SPAN_M ** 2) / 8, 6); // 45 kNm
    expect(beam.extrema.maxAbsShear).toBeCloseTo((W_PER_M * SPAN_M) / 2, 6);       // 30 kN
  });
});

describe('πρόβολος υπό ομοιόμορφο φορτίο', () => {
  it('M_base = wL²/2, V_base = wL, βέλος = wL⁴/8EI', () => {
    const sls = slsResult(beamModel(FIXED_DOF, FREE_DOF));
    const beam = sls.memberForces[0];
    expect(beam.extrema.maxAbsMoment).toBeCloseTo((W_PER_M * SPAN_M ** 2) / 2, 5); // 180 kNm
    expect(beam.extrema.maxAbsShear).toBeCloseTo(W_PER_M * SPAN_M, 5);             // 60 kN
    // Βέλος άκρου (κατακόρυφο, προς τα κάτω): w·L⁴/(8·E·Iy).
    const tip = sls.displacements.find((d) => d.nodeId === 'n1');
    const expected = (W_PER_M * SPAN_M ** 4) / (8 * SECTION.eKnm2 * SECTION.iyM4);
    expect(Math.abs(tip?.uz ?? 0)).toBeCloseTo(expected, 6); // ≈ 0.08 m
  });
});

/**
 * Regression (ADR-481 fix 2026-06-18): στηριγμένο portal + ΑΚΑΜΠΤΟ διάφραγμα δεν
 * πρέπει να αναφέρεται ως μηχανισμός. Το penalty διαφράγματος (~1e6×) εκτόξευε το
 * max διαγώνιο → το (σχετικό) κατώφλι μηδενικού pivot ανέβαινε ώστε «έκοβε» γνήσια
 * μικρά pivots → false-singular σε έγκυρο πλαίσιο. Fix: το κατώφλι βασίζεται στη
 * ΦΥΣΙΚΗ κλίμακα ακαμψίας (πριν το penalty). Το διάφραγμα παραμένει πλήρως άκαμπτο.
 */
describe('portal με άκαμπτο διάφραγμα (false-singular regression)', () => {
  const baseNode = (id: string, xM: number): AnalyticalNode =>
    ({ id, position: { xM, yM: 0, zM: 0 }, restraint: FIXED_DOF, levelId: 'lvl-0' });
  const topNode = (id: string, xM: number): AnalyticalNode =>
    ({ id, position: { xM, yM: 0, zM: 3 }, restraint: FREE_DOF, levelId: 'lvl-1' });

  function portal(withDiaphragm: boolean): AnalyticalModel {
    return {
      nodes: [baseNode('nb0', 0), baseNode('nb1', SPAN_M), topNode('nt0', 0), topNode('nt1', SPAN_M)],
      members: [
        { id: 'c1', entityId: 'c1', memberType: 'column', iNodeId: 'nb0', jNodeId: 'nt0', lengthM: 3 },
        { id: 'c2', entityId: 'c2', memberType: 'column', iNodeId: 'nb1', jNodeId: 'nt1', lengthM: 3 },
        { id: 'b1', entityId: 'b1', memberType: 'beam', iNodeId: 'nt0', jNodeId: 'nt1', lengthM: SPAN_M },
      ],
      supports: [
        { nodeId: 'nb0', supportType: 'fixed', entityId: 'f1' },
        { nodeId: 'nb1', supportType: 'fixed', entityId: 'f2' },
      ],
      diaphragms: withDiaphragm ? [{ levelId: 'lvl-1', nodeIds: ['nt0', 'nt1'], masterNodeId: 'nt0' }] : [],
      levels: [{ id: 'lvl-0', elevationM: 0 }, { id: 'lvl-1', elevationM: 3 }],
    };
  }

  const solve = (m: AnalyticalModel) =>
    solveStaticFrame({ model: m, sectionProvider, loadProvider, combinations: buildStandardCombinations() });

  it('στηριγμένο portal + rigid διάφραγμα → ΟΧΙ μηχανισμός', () => {
    expect(solve(portal(true)).unstable).toBe(false);
  });

  it('το penalty διαφράγματος δεν αλλοιώνει τη βαρυτική ροπή δοκαριού (≈ χωρίς διάφραγμα, <1%)', () => {
    const mWith = solve(portal(true)).envelopeByMember.get('b1')?.maxAbsMoment ?? 0;
    const mNo = solve(portal(false)).envelopeByMember.get('b1')?.maxAbsMoment ?? 0;
    expect(mWith).toBeGreaterThan(0);
    expect(Math.abs(mWith - mNo)).toBeLessThan(mNo * 0.01);
  });
});

describe('ευστάθεια', () => {
  it('φορέας χωρίς στήριξη → μηχανισμός (unstable)', () => {
    const model = beamModel(FREE_DOF, FREE_DOF);
    const result = solveStaticFrame({ model, sectionProvider, loadProvider, combinations: buildStandardCombinations() });
    expect(result.unstable).toBe(true);
    expect(result.combinations.every((c) => c.singular)).toBe(true);
  });

  it('κενό μοντέλο → EMPTY (no-op)', () => {
    const empty: AnalyticalModel = { nodes: [], members: [], supports: [], diaphragms: [], levels: [] };
    const result = solveStaticFrame({ model: empty, sectionProvider, loadProvider, combinations: buildStandardCombinations() });
    expect(result.combinations).toHaveLength(0);
    expect(result.unstable).toBe(false);
  });
});
