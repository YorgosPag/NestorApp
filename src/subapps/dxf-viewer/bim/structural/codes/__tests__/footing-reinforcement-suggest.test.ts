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
});
