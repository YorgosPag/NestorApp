/**
 * ADR-459 Phase 4a — beam reinforcement suggester (both code providers).
 *
 * Επιβεβαιώνει ότι κάθε κανονισμός προτείνει έγκυρο ελάχιστο οπλισμό δοκού:
 * ≥2 κάτω/άνω ράβδοι, Ø ≥ minimum, ρ ≥ ρ_min, βήμα πύκνωσης ≤ μεσαίο.
 */

import { EUROCODE_PROVIDER } from '../eurocode-provider';
import { GREEK_LEGACY_PROVIDER } from '../greek-legacy-provider';
import { computeBeamReinforcementQuantities } from '../../reinforcement/beam-reinforcement-compute';
import type { BeamSectionContext } from '../structural-code-types';

const ctx: BeamSectionContext = {
  widthMm: 250,
  depthMm: 500,
  spanMm: 5000,
  grossAreaMm2: 250 * 500,
  supportType: 'simple',
};

describe.each([
  ['eurocode', EUROCODE_PROVIDER, 30],
  ['greek-legacy', GREEK_LEGACY_PROVIDER, 25],
] as const)('suggestBeamReinforcement — %s', (_id, provider, expectedCover) => {
  const r = provider.suggestBeamReinforcement(ctx);

  it('≥2 κάτω + ≥2 άνω ράβδοι, Ø ≥ 14', () => {
    expect(r.bottom.count).toBeGreaterThanOrEqual(2);
    expect(r.top.count).toBeGreaterThanOrEqual(2);
    expect(r.bottom.diameterMm).toBeGreaterThanOrEqual(14);
    expect(r.top.diameterMm).toBeGreaterThanOrEqual(14);
  });

  it('συνδετήρες Ø ≥ 8 με κρίσιμο βήμα ≤ μεσαίο', () => {
    expect(r.stirrups.diameterMm).toBeGreaterThanOrEqual(8);
    expect(r.stirrups.spacingMm).toBeGreaterThan(0);
    expect(r.stirrups.spacingCriticalMm).toBeLessThanOrEqual(r.stirrups.spacingMm);
  });

  it('cover = code nominal', () => {
    expect(r.coverMm).toBe(expectedCover);
  });

  it('ρ ≥ ρ_min του κανονισμού', () => {
    const minRatio = provider.beamReinforcementLimits(ctx, r.bottom.diameterMm).minRatio;
    const ratio = computeBeamReinforcementQuantities(ctx, r).ratio;
    expect(ratio).toBeGreaterThanOrEqual(minRatio);
  });
});
