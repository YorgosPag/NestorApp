/**
 * ADR-497 — `resolveColumnFemAxial` / `buildColumnFemAxialMap`: FEM αξονικό βάσης
 * κολώνας (SLS/ULS) από το `AnalysisResult`. Pure reader (μηδέν store).
 *
 * Καλύπτει: SLS+ULS extraction, max-abs ανά combination, unstable→undefined,
 * μέλος εκτός→undefined, λείπει SLS ή ULS→undefined, μηδέν αξονικό→undefined,
 * singular combination skip, map builder.
 */

import { resolveColumnFemAxial, buildColumnFemAxialMap } from '../column-fem-axial';
import type {
  AnalysisResult, CombinationResult, MemberForceResult,
} from '../solver/solver-types';

function member(memberId: string, axialN: number): MemberForceResult {
  return {
    memberId,
    endForcesLocal: [],
    diagram: [],
    extrema: { maxAbsAxialN: axialN, maxAbsShear: 0, maxAbsMoment: 0, maxAbsTorsion: 0 },
  };
}

function combo(
  combinationKind: string, members: MemberForceResult[], singular = false,
): CombinationResult {
  return {
    combinationId: combinationKind, combinationKind, singular,
    displacements: [], memberForces: members,
  };
}

function result(combinations: CombinationResult[], unstable = false): AnalysisResult {
  return { combinations, envelopeByMember: new Map(), skippedMemberIds: [], unstable };
}

describe('resolveColumnFemAxial', () => {
  it('εξάγει SLS + ULS αξονικό από τους αντίστοιχους συνδυασμούς', () => {
    const r = result([
      combo('sls', [member('c1', 120)]),
      combo('uls', [member('c1', 168)]),
    ]);
    expect(resolveColumnFemAxial(r, 'c1')).toEqual({ slsKn: 120, ulsKn: 168 });
  });

  it('max-abs όταν υπάρχουν πολλοί SLS/ULS συνδυασμοί', () => {
    const r = result([
      combo('sls', [member('c1', 100)]),
      combo('sls-2', [member('c1', 130)]),
      combo('uls', [member('c1', 150)]),
      combo('uls-6.10b', [member('c1', 175)]),
    ]);
    expect(resolveColumnFemAxial(r, 'c1')).toEqual({ slsKn: 130, ulsKn: 175 });
  });

  it('μη-ευσταθής φορέας → undefined (μηδέν override)', () => {
    const r = result([combo('sls', [member('c1', 120)]), combo('uls', [member('c1', 168)])], true);
    expect(resolveColumnFemAxial(r, 'c1')).toBeUndefined();
  });

  it('μέλος εκτός αποτελέσματος → undefined', () => {
    const r = result([combo('sls', [member('c1', 120)]), combo('uls', [member('c1', 168)])]);
    expect(resolveColumnFemAxial(r, 'cX')).toBeUndefined();
  });

  it('λείπει ο ULS συνδυασμός → undefined (ασφαλές fallback)', () => {
    const r = result([combo('sls', [member('c1', 120)])]);
    expect(resolveColumnFemAxial(r, 'c1')).toBeUndefined();
  });

  it('singular combination αγνοείται', () => {
    const r = result([
      combo('uls', [member('c1', 999)], true), // singular → skip
      combo('sls', [member('c1', 120)]),
      combo('uls-ok', [member('c1', 168)]),
    ]);
    expect(resolveColumnFemAxial(r, 'c1')).toEqual({ slsKn: 120, ulsKn: 168 });
  });

  it('μηδενικό αξονικό → undefined', () => {
    const r = result([combo('sls', [member('c1', 0)]), combo('uls', [member('c1', 0)])]);
    expect(resolveColumnFemAxial(r, 'c1')).toBeUndefined();
  });
});

describe('buildColumnFemAxialMap', () => {
  it('χάρτης μόνο για κολώνες με αξιόπιστο φορτίο', () => {
    const r = result([
      combo('sls', [member('c1', 120), member('c2', 0)]),
      combo('uls', [member('c1', 168), member('c2', 0)]),
    ]);
    const map = buildColumnFemAxialMap(r, ['c1', 'c2', 'c3']);
    expect(map.get('c1')).toEqual({ slsKn: 120, ulsKn: 168 });
    expect(map.has('c2')).toBe(false); // μηδέν αξονικό
    expect(map.has('c3')).toBe(false); // εκτός
    expect(map.size).toBe(1);
  });
});
