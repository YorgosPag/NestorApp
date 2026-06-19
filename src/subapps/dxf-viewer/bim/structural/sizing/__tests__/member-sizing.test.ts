/**
 * ADR-475 — member-sizing (auto διαστασιολόγηση διατομής δοκαριού).
 *
 * Επαληθεύει την κυρίαρχη απαίτηση ανά έλεγχο (SLS βέλος / ULS διάτμηση / ελάχιστο),
 * το depth-only (width passthrough), το constructible rounding (50 mm), το πρακτικό
 * clamp, και τη μονοτονία ως προς το φορτίο. Πραγματικό test-model δοκάρι (ADR-475
 * §3): greek-legacy, span 9.6 m, w_Ed ≈ 38 kN/m → ύψος ~850 mm (SLS-governed).
 */

import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import { GREEK_LEGACY_PROVIDER } from '../../codes/greek-legacy-provider';
import type { BeamSectionContext } from '../../codes/structural-code-types';
import {
  BEAM_MAX_PRACTICAL_DEPTH_MM,
  suggestBeamSection,
} from '../member-sizing';
import { concreteFcdMpa, DEFAULT_CONCRETE_GRADE } from '../../concrete-grades';
import { plasticTorsionalResistanceKnm } from '../../codes/torsion-capacity';
import { BEAM_EFFECTIVE_DEPTH_FACTOR } from '../../codes/suggest-reinforcement';

function makeCtx(over: Partial<BeamSectionContext> = {}): BeamSectionContext {
  return {
    widthMm: 250,
    depthMm: 500,
    spanMm: 9600,
    grossAreaMm2: 250 * 500,
    supportType: 'simple',
    ...over,
  };
}

describe('suggestBeamSection', () => {
  it('sizes the test-model beam from serviceability (greek-legacy, 9.6 m)', () => {
    // l/d limit greek-legacy αμφιέρειστη = 13 → d_req = 9600/13 = 738.5 →
    // h = 738.5/0.9 = 820.5 → round up 50 → 850.
    const s = suggestBeamSection(GREEK_LEGACY_PROVIDER, makeCtx({ designLineLoadKnM: 38.15 }));
    expect(s).toEqual({ widthMm: 250, depthMm: 850, governedBy: 'serviceability' });
  });

  it('uses the eurocode l/d limit (14) → 800 mm for the same span', () => {
    // 9600/14 = 685.7 → /0.9 = 761.9 → round up 50 → 800.
    const s = suggestBeamSection(EUROCODE_PROVIDER, makeCtx({ designLineLoadKnM: 38.15 }));
    expect(s.depthMm).toBe(800);
    expect(s.governedBy).toBe('serviceability');
  });

  it('sizes from span alone even without load (deflection is geometric)', () => {
    const s = suggestBeamSection(EUROCODE_PROVIDER, makeCtx());
    expect(s.depthMm).toBe(800);
    expect(s.governedBy).toBe('serviceability');
  });

  it('falls back to the minimum depth for a short span', () => {
    // span 2000, eurocode: 2000/14/0.9 = 158.7 < MIN_BEAM_DEPTH_MM (200).
    const s = suggestBeamSection(EUROCODE_PROVIDER, makeCtx({ spanMm: 2000 }));
    expect(s).toEqual({ widthMm: 250, depthMm: 200, governedBy: 'minimum' });
  });

  it('applies the cantilever system factor (K=0.4 → stricter l/d)', () => {
    // span 3000, K·14 = 5.6 → 3000/5.6/0.9 = 595.2 → round 50 → 600.
    const s = suggestBeamSection(EUROCODE_PROVIDER, makeCtx({ spanMm: 3000, supportType: 'cantilever' }));
    expect(s.depthMm).toBe(600);
    expect(s.governedBy).toBe('serviceability');
  });

  it('lets shear (compression strut) govern under an extreme line load', () => {
    // span 4000, w 400 kN/m: V=800 kN → d_shear ≈ 790 > serviceability (317).
    const s = suggestBeamSection(EUROCODE_PROVIDER, makeCtx({ spanMm: 4000, designLineLoadKnM: 400 }));
    expect(s.governedBy).toBe('shear');
    expect(s.depthMm).toBe(800);
  });

  it('keeps width unchanged (depth-only sizing, v1)', () => {
    const s = suggestBeamSection(EUROCODE_PROVIDER, makeCtx({ widthMm: 400, designLineLoadKnM: 38 }));
    expect(s.widthMm).toBe(400);
  });

  it('clamps to the practical maximum depth for a degenerate span', () => {
    const s = suggestBeamSection(EUROCODE_PROVIDER, makeCtx({ spanMm: 30000 }));
    expect(s.depthMm).toBe(BEAM_MAX_PRACTICAL_DEPTH_MM);
  });

  it('is monotonic — a heavier load never yields a shallower section', () => {
    const light = suggestBeamSection(EUROCODE_PROVIDER, makeCtx({ spanMm: 6000, designLineLoadKnM: 20 }));
    const heavy = suggestBeamSection(EUROCODE_PROVIDER, makeCtx({ spanMm: 6000, designLineLoadKnM: 250 }));
    expect(heavy.depthMm).toBeGreaterThanOrEqual(light.depthMm);
  });
});

describe('suggestBeamSection — torsion από μονόπλευρη πρόβολο-πλάκα (ADR-499 §6.3-b)', () => {
  const torsionCtx = (over: Partial<BeamSectionContext> = {}): BeamSectionContext =>
    makeCtx({ widthMm: 300, spanMm: 3000, ...over });

  it('μεγαλώνει το ύψος όταν η στρέψη κυριαρχεί (governedBy = torsion)', () => {
    const base = suggestBeamSection(EUROCODE_PROVIDER, torsionCtx());
    const tors = suggestBeamSection(EUROCODE_PROVIDER, torsionCtx({ designTorsionKnm: 120 }));
    expect(tors.depthMm).toBeGreaterThan(base.depthMm);
    expect(tors.governedBy).toBe('torsion');
  });

  it('μηδέν στρέψη → ίδια διατομή με τη χωρίς-στρέψη (μηδέν regression)', () => {
    const noField = suggestBeamSection(EUROCODE_PROVIDER, torsionCtx());
    const zero = suggestBeamSection(EUROCODE_PROVIDER, torsionCtx({ designTorsionKnm: 0 }));
    expect(zero).toEqual(noField);
  });

  it('η επιλεγμένη διατομή ικανοποιεί την αλληλεπίδραση T/T_Rd + V/V_Rd ≤ 1', () => {
    const s = suggestBeamSection(
      EUROCODE_PROVIDER, torsionCtx({ designTorsionKnm: 120, designLineLoadKnM: 40 }),
    );
    const fcd = concreteFcdMpa(DEFAULT_CONCRETE_GRADE);
    const tRd = plasticTorsionalResistanceKnm(s.widthMm, s.depthMm, fcd);
    const vEd = 40 * 3 * 0.5; // w·L/2 (simple)
    const vRd = (0.27 * fcd * s.widthMm * (s.depthMm * BEAM_EFFECTIVE_DEPTH_FACTOR)) / 1000;
    expect(120 / tRd + vEd / vRd).toBeLessThanOrEqual(1.0000001);
  });

  it('μεγαλύτερη στρέψη ποτέ δεν δίνει ρηχότερη διατομή (μονοτονία)', () => {
    const light = suggestBeamSection(EUROCODE_PROVIDER, torsionCtx({ designTorsionKnm: 80 }));
    const heavy = suggestBeamSection(EUROCODE_PROVIDER, torsionCtx({ designTorsionKnm: 200 }));
    expect(heavy.depthMm).toBeGreaterThanOrEqual(light.depthMm);
  });

  it('clamp στο πρακτικό μέγιστο όταν η στρέψη είναι ανέφικτη σε κάθε ύψος', () => {
    const s = suggestBeamSection(EUROCODE_PROVIDER, torsionCtx({ widthMm: 250, designTorsionKnm: 5000 }));
    expect(s.depthMm).toBe(BEAM_MAX_PRACTICAL_DEPTH_MM);
    expect(s.governedBy).toBe('torsion');
  });
});
