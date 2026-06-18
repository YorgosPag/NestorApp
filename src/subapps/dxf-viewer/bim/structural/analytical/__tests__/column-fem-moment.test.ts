/**
 * ADR-491 — pure FEM→column-moment reader (`column-fem-moment.ts`).
 *
 * Verifies:
 *   - unstable φορέας → undefined (οι τιμές μηχανισμού άκυρες).
 *   - μέλος εκτός envelope → undefined.
 *   - μηδενική ροπή → undefined (αμφιέρειστο → ο engine μένει e₀).
 *   - θετική ροπή → η τιμή (kNm).
 *   - buildColumnFemMomentMap: μόνο τα ids με αξιόπιστη μη-μηδενική ροπή.
 */

import { resolveColumnFemMomentKnm, buildColumnFemMomentMap } from '../column-fem-moment';
import { EMPTY_ANALYSIS_RESULT, type AnalysisResult, type MemberForceExtrema } from '../solver/solver-types';

function extrema(maxAbsMoment: number): MemberForceExtrema {
  return { maxAbsAxialN: 100, maxAbsShear: 10, maxAbsMoment, maxAbsTorsion: 0 };
}

function resultWith(entries: ReadonlyArray<[string, number]>, opts?: { unstable?: boolean }): AnalysisResult {
  return {
    ...EMPTY_ANALYSIS_RESULT,
    unstable: opts?.unstable ?? false,
    envelopeByMember: new Map(entries.map(([id, m]) => [id, extrema(m)])),
  };
}

describe('resolveColumnFemMomentKnm (ADR-491)', () => {
  it('επιστρέφει τη θετική ροπή του μέλους (kNm)', () => {
    expect(resolveColumnFemMomentKnm(resultWith([['col-1', 42.5]]), 'col-1')).toBe(42.5);
  });

  it('unstable φορέας → undefined', () => {
    expect(resolveColumnFemMomentKnm(resultWith([['col-1', 42.5]], { unstable: true }), 'col-1')).toBeUndefined();
  });

  it('μέλος εκτός envelope → undefined', () => {
    expect(resolveColumnFemMomentKnm(resultWith([['col-1', 42.5]]), 'col-2')).toBeUndefined();
  });

  it('μηδενική ροπή → undefined (e₀ κυριαρχεί)', () => {
    expect(resolveColumnFemMomentKnm(resultWith([['col-1', 0]]), 'col-1')).toBeUndefined();
  });

  it('κενό αποτέλεσμα → undefined', () => {
    expect(resolveColumnFemMomentKnm(EMPTY_ANALYSIS_RESULT, 'col-1')).toBeUndefined();
  });
});

describe('buildColumnFemMomentMap (ADR-491)', () => {
  it('κρατά μόνο τα ids με αξιόπιστη μη-μηδενική ροπή', () => {
    const result = resultWith([['col-1', 30], ['col-2', 0], ['col-3', 12]]);
    const map = buildColumnFemMomentMap(result, ['col-1', 'col-2', 'col-3', 'col-missing']);
    expect(map.get('col-1')).toBe(30);
    expect(map.has('col-2')).toBe(false); // μηδενική ροπή
    expect(map.get('col-3')).toBe(12);
    expect(map.has('col-missing')).toBe(false);
    expect(map.size).toBe(2);
  });

  it('unstable → κενός χάρτης (μηδέν override)', () => {
    const result = resultWith([['col-1', 30]], { unstable: true });
    expect(buildColumnFemMomentMap(result, ['col-1']).size).toBe(0);
  });
});
