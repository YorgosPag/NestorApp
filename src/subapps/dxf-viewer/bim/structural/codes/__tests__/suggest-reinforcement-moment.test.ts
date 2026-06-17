/**
 * ADR-472 S4 — auto nominal moment M_Ed + M-N column design.
 *
 * Επιβεβαιώνει:
 *   · `nominalColumnEccentricityMm` — EC2 §6.1(4) e₀ = max(h/30, 20mm).
 *   · `nominalColumnMomentKnm` — M_Ed = N_Ed·e₀ (μηδέν αξονικό ⇒ 0).
 *   · M-N suggester — ροπή ⇒ περισσότερος (ή ίσος) διαμήκης· μονοτονία ως προς M_Ed.
 *   · backward-compat — απούσα ροπή ⇒ ταυτόσημο με τον καθαρά-αξονικό S2 σχεδιασμό.
 */

import {
  nominalColumnEccentricityMm,
  nominalColumnMomentKnm,
} from '../suggest-reinforcement';
import { EUROCODE_PROVIDER } from '../eurocode-provider';
import { GREEK_LEGACY_PROVIDER } from '../greek-legacy-provider';
import { barAreaMm2 } from '../../rebar-catalog';
import type { ColumnSectionContext } from '../structural-code-types';

const providedMm2 = (count: number, diameterMm: number): number => count * barAreaMm2(diameterMm);

const HEAVY: ColumnSectionContext = {
  widthMm: 400,
  depthMm: 400,
  heightMm: 3000,
  grossAreaMm2: 400 * 400,
  minThicknessMm: 400,
  designAxialKn: 4000,
  concreteGrade: 'C25/30',
};

describe('ADR-472 S4 — nominal eccentricity (EC2 §6.1(4))', () => {
  it('μικρή διατομή → κυριαρχεί το κατώφλι 20mm', () => {
    expect(nominalColumnEccentricityMm(400)).toBe(20); // 400/30 = 13.3 < 20
  });
  it('μεγάλη διατομή → κυριαρχεί h/30', () => {
    expect(nominalColumnEccentricityMm(900)).toBeCloseTo(30, 6); // 900/30 = 30 > 20
  });
  it('μη-θετικό βάθος → κατώφλι', () => {
    expect(nominalColumnEccentricityMm(0)).toBe(20);
  });
});

describe('ADR-472 S4 — nominal moment M_Ed = N_Ed·e₀', () => {
  it('N=1000 kN, h=400 ⇒ e₀=20mm ⇒ M=20 kNm', () => {
    expect(nominalColumnMomentKnm(1000, 400)).toBeCloseTo(20, 6);
  });
  it('μεγαλύτερο N ⇒ μεγαλύτερη ροπή (μονοτονία)', () => {
    expect(nominalColumnMomentKnm(2000, 400)).toBeGreaterThan(nominalColumnMomentKnm(1000, 400));
  });
  it('μηδενικό/αρνητικό αξονικό ⇒ 0', () => {
    expect(nominalColumnMomentKnm(0, 400)).toBe(0);
    expect(nominalColumnMomentKnm(-50, 400)).toBe(0);
  });
});

describe('ADR-472 S4 — M-N σχεδιασμός κολόνας', () => {
  it('ροπή ⇒ περισσότερος διαμήκης χάλυβας από καθαρά αξονικό', () => {
    for (const provider of [EUROCODE_PROVIDER, GREEK_LEGACY_PROVIDER]) {
      const axialOnly = provider.suggestColumnReinforcement(HEAVY);
      const withMoment = provider.suggestColumnReinforcement({ ...HEAVY, designMomentKnm: 200 });
      expect(providedMm2(withMoment.longitudinal.count, withMoment.longitudinal.diameterMm))
        .toBeGreaterThan(providedMm2(axialOnly.longitudinal.count, axialOnly.longitudinal.diameterMm));
    }
  });

  it('μονοτονία: μεγαλύτερη M_Ed ⇒ ≥ χάλυβας', () => {
    const low = EUROCODE_PROVIDER.suggestColumnReinforcement({ ...HEAVY, designMomentKnm: 100 });
    const high = EUROCODE_PROVIDER.suggestColumnReinforcement({ ...HEAVY, designMomentKnm: 400 });
    expect(providedMm2(high.longitudinal.count, high.longitudinal.diameterMm))
      .toBeGreaterThanOrEqual(providedMm2(low.longitudinal.count, low.longitudinal.diameterMm));
  });

  it('backward-compat: απούσα ροπή ⇒ ταυτόσημο με S2 (καθαρά αξονικό)', () => {
    const a = EUROCODE_PROVIDER.suggestColumnReinforcement(HEAVY);
    const b = EUROCODE_PROVIDER.suggestColumnReinforcement({ ...HEAVY, designMomentKnm: 0 });
    expect(b.longitudinal).toEqual(a.longitudinal);
  });

  it('ελαφρώς φορτισμένη (N κάτω από αντοχή σκυρ.) + ονομαστική ροπή ⇒ μένει ρ_min', () => {
    // 400×400 C25/30: αντοχή σκυρ. ≈ 2667 kN. N=1030 < 2667 ⇒ axial As≈0· e₀=20mm ⇒
    // μικρή As,M (~150 mm²) ≪ ρ_min·Ac (1600) ⇒ ο ρ_min κυριαρχεί (μηδέν regression).
    const base = EUROCODE_PROVIDER.suggestColumnReinforcement({ widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 160000 });
    const light = EUROCODE_PROVIDER.suggestColumnReinforcement({
      ...HEAVY, designAxialKn: 1030, designMomentKnm: nominalColumnMomentKnm(1030, 400),
    });
    expect(light.longitudinal.count).toBe(base.longitudinal.count);
    expect(light.longitudinal.diameterMm).toBe(base.longitudinal.diameterMm);
  });
});
