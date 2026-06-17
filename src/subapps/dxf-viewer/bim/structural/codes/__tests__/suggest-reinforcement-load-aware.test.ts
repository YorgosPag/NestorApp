/**
 * ADR-472 — load-aware strength reinforcement (Slice S2).
 *
 * Επιβεβαιώνει ότι ο suggester γίνεται **παράγωγο αντοχής** όταν δίνεται φορτίο
 * σχεδιασμού, διατηρώντας τον ρ_min ως κάτω όριο:
 *   · κολόνα — As ≥ (N_Ed − f_cd·A_c)/f_yd (EC2 §6.1 αξονική)·
 *   · δοκός — As,κάτω ≥ M_Ed/(0.9·d·f_yd), M_Ed = w·L²/c·
 *   · backward-compat — απών/μικρό φορτίο ⇒ ΤΑΥΤΟΣΗΜΟ με την min-detailing συμπεριφορά.
 */

import { EUROCODE_PROVIDER } from '../eurocode-provider';
import { GREEK_LEGACY_PROVIDER } from '../greek-legacy-provider';
import { barAreaMm2, rebarFydMpa } from '../../rebar-catalog';
import { concreteFcdMpa } from '../../concrete-grades';
import type { ColumnSectionContext, BeamSectionContext } from '../structural-code-types';

/** Παρεχόμενο εμβαδό διαμήκους χάλυβα (mm²) από {count, Ø}. */
function providedLongitudinalMm2(count: number, diameterMm: number): number {
  return count * barAreaMm2(diameterMm);
}

// ─── Κολόνα ───────────────────────────────────────────────────────────────────

const COLUMN_BASE: ColumnSectionContext = {
  widthMm: 400,
  depthMm: 400,
  heightMm: 3000,
  grossAreaMm2: 400 * 400,
};

describe('asStrengthColumn — αξονική αντοχή κυριαρχεί σε υψηλό N_Ed', () => {
  // C25/30: f_cd = 25/1.5 = 16.667· χωρητικότητα σκυρ. = 16.667·160000 = 2666.7 kN.
  const concreteCapacityKn =
    (concreteFcdMpa('C25/30') * COLUMN_BASE.grossAreaMm2) / 1000;

  it('N_Ed = 4000 kN ⇒ As ≈ (N − f_cd·Ac)/f_yd, πάνω από ρ_min', () => {
    const nEdKn = 4000;
    const ctx: ColumnSectionContext = { ...COLUMN_BASE, designAxialKn: nEdKn, concreteGrade: 'C25/30' };
    const r = EUROCODE_PROVIDER.suggestColumnReinforcement(ctx);
    const provided = providedLongitudinalMm2(r.longitudinal.count, r.longitudinal.diameterMm);

    const asRequired = ((nEdKn - concreteCapacityKn) * 1000) / rebarFydMpa();
    expect(asRequired).toBeGreaterThan(0); // strength κυριαρχεί (όχι ρ_min)
    expect(provided).toBeGreaterThanOrEqual(asRequired);
    // Σαφώς πάνω από τον ελάχιστο ρ_min·Ac = 0.01·160000 = 1600 mm².
    expect(provided).toBeGreaterThan(1600);
  });

  it('μεγαλύτερο N ⇒ μεγαλύτερο (ή ίσο) As — μονοτονία (και στους δύο κανονισμούς)', () => {
    for (const provider of [EUROCODE_PROVIDER, GREEK_LEGACY_PROVIDER]) {
      const low = provider.suggestColumnReinforcement({ ...COLUMN_BASE, designAxialKn: 3500, concreteGrade: 'C25/30' });
      const high = provider.suggestColumnReinforcement({ ...COLUMN_BASE, designAxialKn: 5000, concreteGrade: 'C25/30' });
      expect(providedLongitudinalMm2(high.longitudinal.count, high.longitudinal.diameterMm))
        .toBeGreaterThanOrEqual(providedLongitudinalMm2(low.longitudinal.count, low.longitudinal.diameterMm));
    }
  });
});

describe('κολόνα backward-compat — μικρό/απών φορτίο ⇒ ρ_min ταυτόσημο', () => {
  it('απών designAxialKn ⇒ ίδιο με χαμηλό N όπου το σκυρόδεμα επαρκεί', () => {
    const base = EUROCODE_PROVIDER.suggestColumnReinforcement(COLUMN_BASE);
    // N = 1000 kN < χωρητικότητα σκυρ. 2667 kN ⇒ strength ≤ 0 ⇒ ρ_min κυριαρχεί.
    const lowN = EUROCODE_PROVIDER.suggestColumnReinforcement({
      ...COLUMN_BASE, designAxialKn: 1000, concreteGrade: 'C25/30',
    });
    expect(lowN.longitudinal.count).toBe(base.longitudinal.count);
    expect(lowN.longitudinal.diameterMm).toBe(base.longitudinal.diameterMm);
  });
});

// ─── Δοκός ────────────────────────────────────────────────────────────────────

const BEAM_BASE: BeamSectionContext = {
  widthMm: 300,
  depthMm: 600,
  spanMm: 6000,
  grossAreaMm2: 300 * 600,
  supportType: 'simple',
};

describe('asStrengthBeam — καμπτική αντοχή κυριαρχεί σε υψηλό w_Ed', () => {
  it('w_Ed = 40 kN/m, αμφιέρειστη ⇒ As,κάτω ≈ M/(0.9d·f_yd)', () => {
    const wEd = 40;
    const loaded = EUROCODE_PROVIDER.suggestBeamReinforcement({ ...BEAM_BASE, designLineLoadKnM: wEd });
    const base = EUROCODE_PROVIDER.suggestBeamReinforcement(BEAM_BASE);
    const providedLoaded = providedLongitudinalMm2(loaded.bottom.count, loaded.bottom.diameterMm);
    const providedBase = providedLongitudinalMm2(base.bottom.count, base.bottom.diameterMm);

    const dEff = 0.9 * BEAM_BASE.depthMm; // 540
    const mEdNmm = ((wEd * 6 * 6) / 8) * 1e6; // 180 kNm
    const asRequired = mEdNmm / (0.9 * dEff * rebarFydMpa());
    expect(providedLoaded).toBeGreaterThanOrEqual(asRequired);
    expect(providedLoaded).toBeGreaterThan(providedBase);
  });

  it('πρόβολος (c=2) ⇒ μεγαλύτερο As από αμφιέρειστη (c=8) στο ίδιο w', () => {
    const simple = EUROCODE_PROVIDER.suggestBeamReinforcement({ ...BEAM_BASE, supportType: 'simple', designLineLoadKnM: 30 });
    const cantilever = EUROCODE_PROVIDER.suggestBeamReinforcement({ ...BEAM_BASE, supportType: 'cantilever', designLineLoadKnM: 30 });
    expect(providedLongitudinalMm2(cantilever.bottom.count, cantilever.bottom.diameterMm))
      .toBeGreaterThanOrEqual(providedLongitudinalMm2(simple.bottom.count, simple.bottom.diameterMm));
  });
});

describe('δοκός backward-compat — μικρό/απών φορτίο ⇒ ρ_min ταυτόσημο', () => {
  it('απών designLineLoadKnM ⇒ ίδιο με αμελητέο w', () => {
    const base = EUROCODE_PROVIDER.suggestBeamReinforcement(BEAM_BASE);
    // w = 1 kN/m ⇒ M = 4.5 kNm ⇒ As ≈ 21 mm² << ρ_min·b·d ⇒ ρ_min κυριαρχεί.
    const tiny = EUROCODE_PROVIDER.suggestBeamReinforcement({ ...BEAM_BASE, designLineLoadKnM: 1 });
    expect(tiny.bottom.count).toBe(base.bottom.count);
    expect(tiny.bottom.diameterMm).toBe(base.bottom.diameterMm);
    expect(tiny.top.count).toBe(base.top.count);
  });
});
