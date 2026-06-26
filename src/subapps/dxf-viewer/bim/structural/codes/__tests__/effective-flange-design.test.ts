/**
 * ADR-534 Φ3b — wiring test: `b_eff` στον καμπτικό έλεγχο της σαγκ. ροπής.
 *
 * Σε βαριά-φορτισμένη ΑΠΛΗ (sagging) δοκό όπου `M_Ed > M_Rd,lim(b_w)`, το `b_eff`
 * (πλάκα = θλιβόμενο πέλμα) ανεβάζει το `M_Rd,lim` → ο εφελκυόμενος χάλυβας ΔΕΝ κόβεται
 * (capFactor=1) → περισσότερος κάτω οπλισμός από ό,τι η ορθογώνια `b_w`. Χωρίς φορτίο
 * → ταυτόσημος (ο cap ανενεργός — μηδέν regression).
 */

import { resolveStructuralCode } from '../index';
import { barAreaMm2 } from '../../rebar-catalog';
import type { BeamSectionContext } from '../structural-code-types';

const provider = resolveStructuralCode('eurocode');

/** Στενή απλή δοκός 250×400, άνοιγμα 6m. */
function baseCtx(overrides: Partial<BeamSectionContext>): BeamSectionContext {
  return {
    widthMm: 250,
    depthMm: 400,
    spanMm: 6000,
    grossAreaMm2: 250 * 400,
    supportType: 'simple',
    ...overrides,
  };
}

function bottomAreaMm2(ctx: BeamSectionContext): number {
  const r = provider.suggestBeamReinforcement(ctx);
  return r.bottom.count * barAreaMm2(r.bottom.diameterMm);
}

describe('b_eff flexural-cap wiring (ADR-534 Φ3b)', () => {
  it('heavy load, simple span: b_eff yields ≥ bottom steel vs b_w (cap relaxed)', () => {
    const load = { designLineLoadKnM: 60 }; // M_Ed = 60·6²/8 = 270 kNm
    const withWeb = bottomAreaMm2(baseCtx(load));
    const withFlange = bottomAreaMm2(baseCtx({ ...load, effectiveFlangeWidthMm: 2700 }));
    expect(withFlange).toBeGreaterThan(withWeb);
  });

  it('no load: b_eff has zero effect (cap inactive → identical design)', () => {
    const withWeb = bottomAreaMm2(baseCtx({}));
    const withFlange = bottomAreaMm2(baseCtx({ effectiveFlangeWidthMm: 2700 }));
    expect(withFlange).toBeCloseTo(withWeb, 6);
  });

  it('continuous (hogging governs): b_eff ignored → web compression (b_w), identical', () => {
    const load = { designLineLoadKnM: 60, supportType: 'continuous' as const };
    const withWeb = bottomAreaMm2(baseCtx(load));
    const withFlange = bottomAreaMm2(baseCtx({ ...load, effectiveFlangeWidthMm: 2700 }));
    expect(withFlange).toBeCloseTo(withWeb, 6);
  });
});
