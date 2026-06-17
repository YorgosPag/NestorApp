/**
 * ADR-459 Phase 4b — footing reinforcement suggester (both code providers).
 *
 * Επιβεβαιώνει ότι κάθε κανονισμός προτείνει έγκυρο ελάχιστο οπλισμό θεμελίωσης
 * ανά kind: pad (δι-διευθυντική σχάρα, ρ ≥ ρ_min), strip (εγκάρσιες + διαμήκεις),
 * tie-beam (delegate σε beam — είναι δοκός).
 */

import { EUROCODE_PROVIDER } from '../eurocode-provider';
import { GREEK_LEGACY_PROVIDER } from '../greek-legacy-provider';
import { computeFootingReinforcementQuantities } from '../../reinforcement/footing-reinforcement-compute';
import { barAreaMm2, rebarFydMpa } from '../../rebar-catalog';
import type {
  PadSectionContext,
  StripSectionContext,
  TieBeamSectionContext,
} from '../structural-code-types';

const padCtx: PadSectionContext = {
  kind: 'pad', widthMm: 1500, lengthMm: 1500, thicknessMm: 500, grossAreaMm2: 2_250_000,
};
const stripCtx: StripSectionContext = {
  kind: 'strip', widthMm: 600, thicknessMm: 400, spanMm: 4000,
};
const tieBeamCtx: TieBeamSectionContext = {
  kind: 'tie-beam', widthMm: 250, depthMm: 500, spanMm: 5000, grossAreaMm2: 125_000, supportType: 'simple',
};

describe.each([
  ['eurocode', EUROCODE_PROVIDER, 50],
  ['greek-legacy', GREEK_LEGACY_PROVIDER, 50],
] as const)('suggestFootingReinforcement — %s', (_id, provider, expectedCover) => {
  it('pad → δι-διευθυντική σχάρα, Ø ≥ 12, βήμα ≤ max, cover θεμελίωσης', () => {
    const r = provider.suggestFootingReinforcement(padCtx);
    if (r.kind !== 'pad') throw new Error('expected pad reinforcement');
    const limits = provider.footingReinforcementLimits(padCtx);
    expect(r.bottomMeshX.diameterMm).toBeGreaterThanOrEqual(12);
    expect(r.bottomMeshY.diameterMm).toBeGreaterThanOrEqual(12);
    expect(r.bottomMeshX.spacingMm).toBeGreaterThan(0);
    expect(r.bottomMeshX.spacingMm).toBeLessThanOrEqual(limits.maxBarSpacingMm);
    expect(r.coverMm).toBe(expectedCover);
  });

  it('pad → ρ ≥ ρ_min του κανονισμού', () => {
    const r = provider.suggestFootingReinforcement(padCtx);
    const minRatio = provider.footingReinforcementLimits(padCtx).minRatio;
    const ratio = computeFootingReinforcementQuantities(padCtx, r).ratio;
    expect(ratio).toBeGreaterThanOrEqual(minRatio);
  });

  it('strip → εγκάρσιες + ≥4 διαμήκεις διανομής', () => {
    const r = provider.suggestFootingReinforcement(stripCtx);
    if (r.kind !== 'strip') throw new Error('expected strip reinforcement');
    expect(r.transverse.diameterMm).toBeGreaterThanOrEqual(12);
    expect(r.longitudinal.count).toBeGreaterThanOrEqual(4);
    const minRatio = provider.footingReinforcementLimits(stripCtx).minRatio;
    expect(computeFootingReinforcementQuantities(stripCtx, r).ratio).toBeGreaterThanOrEqual(minRatio);
  });

  it('tie-beam → delegate σε beam (κάτω/άνω ≥2, beam cover 30)', () => {
    const r = provider.suggestFootingReinforcement(tieBeamCtx);
    if (r.kind !== 'tie-beam') throw new Error('expected tie-beam reinforcement');
    expect(r.bottom.count).toBeGreaterThanOrEqual(2);
    expect(r.top.count).toBeGreaterThanOrEqual(2);
    // Συνδετήρια = εναέρια δοκός → beam cover (όχι θεμελίωσης).
    expect(r.coverMm).toBe(provider.beamReinforcementLimits(tieBeamCtx, r.bottom.diameterMm).nominalCoverMm);
  });

  // ─── ADR-477 Slice 3 — σεισμική δύναμη σύνδεσης (EN1998-5 §5.4.1.2) ──────────

  it('tie-beam χωρίς N_tie → καθαρά δοκός (μηδέν regression)', () => {
    const withZero = provider.suggestFootingReinforcement({ ...tieBeamCtx, designAxialTieKn: 0 });
    expect(withZero).toEqual(provider.suggestFootingReinforcement(tieBeamCtx));
  });

  it('tie-beam με N_tie → As,tie αυξάνει συμμετρικά κάτω+άνω', () => {
    const base = provider.suggestFootingReinforcement(tieBeamCtx);
    const withTie = provider.suggestFootingReinforcement({ ...tieBeamCtx, designAxialTieKn: 400 });
    if (base.kind !== 'tie-beam' || withTie.kind !== 'tie-beam') throw new Error('expected tie-beam');
    const asTiePerFace = (400 * 1000) / rebarFydMpa() / 2;
    const bottomAs = barAreaMm2(withTie.bottom.diameterMm) * withTie.bottom.count;
    const topAs = barAreaMm2(withTie.top.diameterMm) * withTie.top.count;
    expect(bottomAs).toBeGreaterThanOrEqual(asTiePerFace);
    expect(topAs).toBeGreaterThanOrEqual(asTiePerFace);
    expect(bottomAs).toBeGreaterThanOrEqual(barAreaMm2(base.bottom.diameterMm) * base.bottom.count);
  });

  // ─── ADR-464 Slice 2 — κανόνας άνω σχάρας (top mesh) ────────────────────────

  it('default πέδιλο (0.5m, κεντρικό) → ΚΑΜΙΑ άνω σχάρα (μηδέν regression)', () => {
    const r = provider.suggestFootingReinforcement(padCtx);
    if (r.kind !== 'pad') throw new Error('expected pad reinforcement');
    expect(r.topMesh).toBeUndefined();
  });

  it('χονδρό πέδιλο (≥ padTopMeshMinThicknessMm) → άνω σχάρα = κάτω σχάρα', () => {
    const limits = provider.footingReinforcementLimits(padCtx);
    const thick: PadSectionContext = { ...padCtx, thicknessMm: limits.padTopMeshMinThicknessMm };
    const r = provider.suggestFootingReinforcement(thick);
    if (r.kind !== 'pad') throw new Error('expected pad reinforcement');
    expect(r.topMesh).toBeDefined();
    expect(r.topMesh).toEqual(r.bottomMeshX);
  });

  it('έκκεντρο πέδιλο (e/L > kern) → άνω σχάρα παρότι λεπτό', () => {
    const limits = provider.footingReinforcementLimits(padCtx);
    const eccentric: PadSectionContext = {
      ...padCtx,
      eccentricityRatio: limits.padTopMeshKernRatio + 0.05,
    };
    const r = provider.suggestFootingReinforcement(eccentric);
    if (r.kind !== 'pad') throw new Error('expected pad reinforcement');
    expect(r.topMesh).toBeDefined();
  });

  it('μικρή εκκεντρότητα εντός πυρήνα + λεπτό → ΚΑΜΙΑ άνω σχάρα', () => {
    const limits = provider.footingReinforcementLimits(padCtx);
    const slight: PadSectionContext = {
      ...padCtx,
      eccentricityRatio: limits.padTopMeshKernRatio - 0.02,
    };
    const r = provider.suggestFootingReinforcement(slight);
    if (r.kind !== 'pad') throw new Error('expected pad reinforcement');
    expect(r.topMesh).toBeUndefined();
  });
});
