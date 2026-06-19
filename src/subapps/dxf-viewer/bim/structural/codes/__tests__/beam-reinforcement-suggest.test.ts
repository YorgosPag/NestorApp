/**
 * ADR-459 Phase 4a — beam reinforcement suggester (both code providers).
 *
 * Επιβεβαιώνει ότι κάθε κανονισμός προτείνει έγκυρο ελάχιστο οπλισμό δοκού:
 * ≥2 κάτω/άνω ράβδοι, Ø ≥ minimum, ρ ≥ ρ_min, βήμα πύκνωσης ≤ μεσαίο.
 */

import { EUROCODE_PROVIDER } from '../eurocode-provider';
import { GREEK_LEGACY_PROVIDER } from '../greek-legacy-provider';
import { computeBeamReinforcementQuantities } from '../../reinforcement/beam-reinforcement-compute';
import { barAreaMm2 } from '../../rebar-catalog';
import type { BeamSectionContext } from '../structural-code-types';
import type { BeamRebarLayer, BeamStirrups } from '../../reinforcement/beam-reinforcement-types';

const ctx: BeamSectionContext = {
  widthMm: 250,
  depthMm: 500,
  spanMm: 5000,
  grossAreaMm2: 250 * 500,
  supportType: 'simple',
};

/** Ολικό εμβαδό μιας στρώσης διαμήκων (mm²). */
const layerArea = (l: BeamRebarLayer): number => l.count * barAreaMm2(l.diameterMm);
/** Παρεχόμενη A_st/s κλειστού συνδετήρα ανά μέτρο (mm²/m) = barArea·(1000/βήμα). */
const stirrupAreaPerMetre = (s: BeamStirrups): number => barAreaMm2(s.diameterMm) * (1000 / s.spacingMm);

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

describe('στρεπτικός οπλισμός δοκού — μονόπλευρη πρόβολος-πλάκα (ADR-499 §6.3-c)', () => {
  const base = EUROCODE_PROVIDER.suggestBeamReinforcement(ctx);
  const tors = EUROCODE_PROVIDER.suggestBeamReinforcement({ ...ctx, designTorsionKnm: 60 });

  it('μηδέν στρέψη → ίδιος οπλισμός με τη βάση (μηδέν regression)', () => {
    expect(EUROCODE_PROVIDER.suggestBeamReinforcement({ ...ctx, designTorsionKnm: 0 })).toEqual(base);
  });

  it('γωνιακός A_sl → περισσότερος διαμήκης κάτω ΚΑΙ άνω', () => {
    expect(layerArea(tors.bottom)).toBeGreaterThan(layerArea(base.bottom));
    expect(layerArea(tors.top)).toBeGreaterThan(layerArea(base.top));
  });

  it('κλειστοί συνδετήρες A_st/s → πυκνότεροι/μεγαλύτεροι (παρεχόμενο/μέτρο μεγαλύτερο)', () => {
    expect(stirrupAreaPerMetre(tors.stirrups)).toBeGreaterThan(stirrupAreaPerMetre(base.stirrups));
    expect(tors.stirrups.spacingCriticalMm).toBeLessThanOrEqual(tors.stirrups.spacingMm);
  });

  it('μεγαλύτερη στρέψη ποτέ δεν δίνει λιγότερο στρεπτικό χάλυβα (μονοτονία)', () => {
    const light = EUROCODE_PROVIDER.suggestBeamReinforcement({ ...ctx, designTorsionKnm: 40 });
    const heavy = EUROCODE_PROVIDER.suggestBeamReinforcement({ ...ctx, designTorsionKnm: 120 });
    expect(layerArea(heavy.bottom)).toBeGreaterThanOrEqual(layerArea(light.bottom));
    expect(stirrupAreaPerMetre(heavy.stirrups)).toBeGreaterThanOrEqual(stirrupAreaPerMetre(light.stirrups));
  });
});
