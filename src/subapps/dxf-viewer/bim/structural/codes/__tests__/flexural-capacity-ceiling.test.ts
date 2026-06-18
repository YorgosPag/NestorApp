/**
 * ADR-499 Slice A — Flexural-capacity ceiling (η φυσική πύλη M_Ed ≤ M_Rd,lim).
 *
 * Επαληθεύει ότι ο εφελκυόμενος χάλυβας **κορεστεί** στο A_s,lim όταν η ροπή ξεπερνά
 * την οριακή αντοχή της διατομής (EC2 Annex A) — αντί να παράγεται ψεύτικη λύση (π.χ.
 * 4Ø32 σε 250×400, Ø25/75 σε πλάκα 200mm). Επαρκής διατομή → cap = 1 (μηδέν regression).
 */

import { EUROCODE_PROVIDER } from '../eurocode-provider';
import { GREEK_LEGACY_PROVIDER } from '../greek-legacy-provider';
import { limitMomentNmm, flexuralCapacityCapFactor } from '../flexural-capacity';
import type { BeamSectionContext, SlabFoundationSectionContext } from '../structural-code-types';

const PI_4 = Math.PI / 4;

/** As (mm²) ενός συνόλου ράβδων. */
function barArea(layer: { diameterMm: number; count: number }): number {
  return PI_4 * layer.diameterMm ** 2 * layer.count;
}
/** As ανά μέτρο (mm²/m) μιας σχάρας. */
function meshAsPerM(m: { diameterMm: number; spacingMm: number }): number {
  return PI_4 * m.diameterMm ** 2 * (1000 / m.spacingMm);
}

function cantileverBeamCtx(over: Partial<BeamSectionContext>): BeamSectionContext {
  return {
    widthMm: 250, depthMm: 400, spanMm: 3000, grossAreaMm2: 250 * 400,
    supportType: 'cantilever', concreteGrade: 'C25/30', designLineLoadKnM: 0,
    ...over,
  };
}
function suspendedSlabCtx(over: Partial<SlabFoundationSectionContext>): SlabFoundationSectionContext {
  return {
    widthMm: 5000, lengthMm: 3000, thicknessMm: 200, grossAreaMm2: 1e6,
    kind: 'suspended', concreteGrade: 'C25/30', supportType: 'cantilever',
    cantileverSpanMm: 7480, designLoadKpa: 0,
    ...over,
  };
}

describe('limitMomentNmm — M_Rd,lim = μ_lim·f_cd·b·d² (EC2 Annex A)', () => {
  it('επιστρέφει τον τύπο μ·f_cd·b·d²', () => {
    const fcd = 25 / 1.5; // C25/30
    expect(limitMomentNmm(250, 360, fcd, 0.295)).toBeCloseTo(0.295 * fcd * 250 * 360 ** 2, 0);
  });
  it('εκφυλισμένη είσοδος → 0 (μη-περιοριστικό)', () => {
    expect(limitMomentNmm(0, 360, 16.7, 0.295)).toBe(0);
    expect(limitMomentNmm(250, 360, 16.7, 0)).toBe(0);
  });
});

describe('flexuralCapacityCapFactor — min(1, M_Rd,lim/M_Ed)', () => {
  it('επαρκής διατομή (M_Ed ≤ M_Rd,lim) → 1 (μηδέν regression)', () => {
    expect(flexuralCapacityCapFactor(100, 160)).toBe(1);
  });
  it('ανεπαρκής (M_Ed = 2·M_Rd,lim) → 0.5', () => {
    expect(flexuralCapacityCapFactor(320, 160)).toBeCloseTo(0.5, 6);
  });
  it('mLim ≤ 0 → 1 (αφόρτιστη/εκφυλισμένη)', () => {
    expect(flexuralCapacityCapFactor(500, 0)).toBe(1);
  });
});

describe('Beam suggester — cap στο A_s,lim (ADR-499)', () => {
  it('διπλασιασμός φορτίου ΠΑΝΩ από το όριο → ίδιος κάτω οπλισμός (saturation)', () => {
    // 250×400 πρόβολος, 3m: M_lim ≈ 159 kNm. w=200 → M_Ed=900 ≫ όριο.
    const r200 = EUROCODE_PROVIDER.suggestBeamReinforcement(cantileverBeamCtx({ designLineLoadKnM: 200 }));
    const r400 = EUROCODE_PROVIDER.suggestBeamReinforcement(cantileverBeamCtx({ designLineLoadKnM: 400 }));
    expect(barArea(r400.bottom)).toBe(barArea(r200.bottom)); // κορεσμός — όχι 2× χάλυβας
  });

  it('επαρκής διατομή: αύξηση φορτίου εντός ορίου → ΑΥΞΑΝΕΙ τον οπλισμό (μηδέν regression)', () => {
    // Μεγάλη διατομή 400×800 (d=720): M_lim πολύ ψηλά → ο cap ανενεργός.
    const lo = EUROCODE_PROVIDER.suggestBeamReinforcement(
      cantileverBeamCtx({ widthMm: 400, depthMm: 800, grossAreaMm2: 320000, designLineLoadKnM: 20 }),
    );
    const hi = EUROCODE_PROVIDER.suggestBeamReinforcement(
      cantileverBeamCtx({ widthMm: 400, depthMm: 800, grossAreaMm2: 320000, designLineLoadKnM: 60 }),
    );
    expect(barArea(hi.bottom)).toBeGreaterThan(barArea(lo.bottom));
  });

  it('αφόρτιστο δοκάρι → ρ_min κυριαρχεί (ο cap δεν επηρεάζει)', () => {
    const r = EUROCODE_PROVIDER.suggestBeamReinforcement(cantileverBeamCtx({ designLineLoadKnM: 0 }));
    expect(r.bottom.count).toBeGreaterThanOrEqual(2);
  });
});

describe('Slab suggester — cap πλάκας-προβόλου (repro: 200mm / 7.48m)', () => {
  it('q ΠΑΝΩ από το όριο → άνω σχάρα (hogging strength) κορεστεί, ΟΧΙ Ø25/75', () => {
    const q20 = EUROCODE_PROVIDER.suggestSlabFoundationReinforcement(suspendedSlabCtx({ designLoadKpa: 20 }));
    const q40 = EUROCODE_PROVIDER.suggestSlabFoundationReinforcement(suspendedSlabCtx({ designLoadKpa: 40 }));
    // strength layer = ΕΠΑΝΩ (πρόβολος hogging, ADR-498) — saturation
    expect(meshAsPerM(q40.topMeshX)).toBe(meshAsPerM(q20.topMeshX));
  });

  it('επαρκές πάχος (1000mm) → ο cap ανενεργός, q αυξάνει τον οπλισμό', () => {
    const thick = (q: number) => suspendedSlabCtx({ thicknessMm: 1000, designLoadKpa: q });
    const lo = EUROCODE_PROVIDER.suggestSlabFoundationReinforcement(thick(10));
    const hi = EUROCODE_PROVIDER.suggestSlabFoundationReinforcement(thick(30));
    expect(meshAsPerM(hi.topMeshX)).toBeGreaterThan(meshAsPerM(lo.topMeshX));
  });
});

describe('Provider μ_lim (ADR-499)', () => {
  it('EC2 & ΕΚΩΣ εκθέτουν flexuralLimitMuLim ≈ 0.295', () => {
    expect(EUROCODE_PROVIDER.flexuralLimitMuLim()).toBeCloseTo(0.295, 3);
    expect(GREEK_LEGACY_PROVIDER.flexuralLimitMuLim()).toBeCloseTo(0.295, 3);
  });
});
