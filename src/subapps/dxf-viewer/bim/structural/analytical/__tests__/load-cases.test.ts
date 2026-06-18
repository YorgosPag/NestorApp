/**
 * ADR-480 (T2) — analytical load-cases & combinations (pure).
 *
 * Καλύπτει: τυπικοί EN1990 συνδυασμοί (ULS 6.10 / SLS χαρακτηριστικός) πάνω στο
 * `load-combinations.ts`, και το extensibility hook σεισμικών (T4) χωρίς αναδόμηση.
 */

import {
  buildStandardCombinations,
  buildLoadCombinations,
  ANALYTICAL_LOAD_CASES,
  type LoadCombination,
} from '../load-cases';
import type { MemberLoad } from '../../loads/structural-loads-types';

const load: MemberLoad = {
  deadAxialKn: 100, liveAxialKn: 40,
  deadMomentXKnm: 10, liveMomentXKnm: 5,
  deadMomentYKnm: 0, liveMomentYKnm: 0,
  source: 'takedown',
};

describe('buildStandardCombinations', () => {
  it('ULS 6.10 = 1.35G + 1.50Q ανά συνιστώσα', () => {
    const uls = buildStandardCombinations().find((c) => c.kind === 'uls') as LoadCombination;
    const r = uls.combine(load);
    expect(r.axialKn).toBeCloseTo(1.35 * 100 + 1.5 * 40, 6); // 195
    expect(r.momentXKnm).toBeCloseTo(1.35 * 10 + 1.5 * 5, 6); // 21
  });

  it('SLS χαρακτηριστικός = G + Q (γ=1)', () => {
    const sls = buildStandardCombinations().find((c) => c.kind === 'sls') as LoadCombination;
    expect(sls.combine(load).axialKn).toBeCloseTo(140, 6);
  });

  it('μη-default συντελεστές → χρησιμοποιούνται στον ULS', () => {
    const uls = buildStandardCombinations({ gammaG: 1.2, gammaQ: 1.4 })
      .find((c) => c.kind === 'uls') as LoadCombination;
    expect(uls.combine(load).axialKn).toBeCloseTo(1.2 * 100 + 1.4 * 40, 6); // 176
  });
});

describe('buildLoadCombinations — extensibility', () => {
  it('χωρίς seismic provider → μόνο ULS + SLS (T2)', () => {
    const all = buildLoadCombinations();
    expect(all.map((c) => c.kind).sort()).toEqual(['sls', 'uls']);
  });

  it('με seismic provider → προστίθενται οι σεισμικοί ΧΩΡΙΣ αναδόμηση (T4 hook)', () => {
    const seismicCombo: LoadCombination = {
      id: 'SEISMIC+X', kind: 'seismic', labelKey: 'x', combine: (l) => ({
        axialKn: l.deadAxialKn, momentXKnm: 0, momentYKnm: 0,
      }),
    };
    const all = buildLoadCombinations({ seismic: () => [seismicCombo] });
    expect(all).toHaveLength(3);
    expect(all.some((c) => c.kind === 'seismic')).toBe(true);
  });
});

describe('ANALYTICAL_LOAD_CASES', () => {
  it('περιλαμβάνει G & Q (η σεισμική E = T4)', () => {
    expect(ANALYTICAL_LOAD_CASES.map((c) => c.id).sort()).toEqual(['G', 'Q']);
    expect(ANALYTICAL_LOAD_CASES.some((c) => c.kind === 'seismic')).toBe(false);
  });
});
