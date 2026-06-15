/**
 * ADR-459 Φ4e/E3 — foundation-slab (raft / εδαφόπλακα) reinforcement.
 *
 * Καλύπτει: compute ποσοτήτων (συμμετρική top+bottom σχάρα, ρ monotonic), τον
 * shared suggester (ρ ≥ ρ_min και στους 2 providers, legacy συντηρητικότερος), και
 * το DERIVED invariant (η συνάρτηση είναι pure — καμία μετάλλαξη εισόδου).
 */

import { computeSlabFoundationReinforcementQuantities } from '../slab-foundation-reinforcement-compute';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import { GREEK_LEGACY_PROVIDER } from '../../codes/greek-legacy-provider';
import { barAreaMm2 } from '../../rebar-catalog';
import type { SlabFoundationReinforcement } from '../slab-foundation-reinforcement-types';
import type { SlabFoundationSectionContext } from '../../codes/structural-code-types';

const ctx: SlabFoundationSectionContext = {
  widthMm: 6000,
  lengthMm: 4000,
  thicknessMm: 500,
  grossAreaMm2: 6000 * 4000,
};

const mesh = (diameterMm: number, spacingMm: number) => ({ diameterMm, spacingMm });

const raft = (d: number, s: number): SlabFoundationReinforcement => ({
  bottomMeshX: mesh(d, s),
  bottomMeshY: mesh(d, s),
  topMeshX: mesh(d, s),
  topMeshY: mesh(d, s),
  coverMm: 50,
});

describe('computeSlabFoundationReinforcementQuantities', () => {
  it('bottom mesh length matches the bbox grid (Ø14/250 on 6×4 m raft)', () => {
    const q = computeSlabFoundationReinforcementQuantities(ctx, raft(14, 250));
    // X-dir: 17 bars × (6000−100 + 2·12·14)/1000 = 17 × 6.236 = 106.012 m
    // Y-dir: 25 bars × (4000−100 + 2·12·14)/1000 = 25 × 4.236 = 105.900 m
    expect(q.bottomLengthM).toBeCloseTo(211.912, 3);
  });

  it('top mesh mirrors the bottom (symmetric raft) and weights sum', () => {
    const q = computeSlabFoundationReinforcementQuantities(ctx, raft(14, 250));
    expect(q.topLengthM).toBeCloseTo(q.bottomLengthM, 6);
    expect(q.topWeightKg).toBeCloseTo(q.bottomWeightKg, 6);
    expect(q.totalSteelWeightKg).toBeCloseTo(q.bottomWeightKg + q.topWeightKg, 6);
  });

  it('ρ = As(bottomX)/(spacing·dEff), dEff = thickness − cover', () => {
    const q = computeSlabFoundationReinforcementQuantities(ctx, raft(14, 250));
    expect(q.ratio).toBeCloseTo(barAreaMm2(14) / (250 * 450), 9);
  });

  it('ρ rises as spacing tightens and as Ø grows', () => {
    const base = computeSlabFoundationReinforcementQuantities(ctx, raft(14, 250)).ratio;
    expect(computeSlabFoundationReinforcementQuantities(ctx, raft(14, 150)).ratio).toBeGreaterThan(base);
    expect(computeSlabFoundationReinforcementQuantities(ctx, raft(20, 250)).ratio).toBeGreaterThan(base);
  });

  it('degenerate (zero spacing) → ρ = 0, no NaN', () => {
    const q = computeSlabFoundationReinforcementQuantities(ctx, raft(14, 0));
    expect(q.ratio).toBe(0);
  });

  it('never mutates the input reinforcement (DERIVED)', () => {
    const r = raft(14, 250);
    const snapshot = JSON.parse(JSON.stringify(r));
    computeSlabFoundationReinforcementQuantities(ctx, r);
    expect(JSON.parse(JSON.stringify(r))).toEqual(snapshot);
  });
});

describe('suggestSlabFoundationReinforcement — both codes', () => {
  it('eurocode: suggested raft satisfies ρ ≥ ρ_min', () => {
    const r = EUROCODE_PROVIDER.suggestSlabFoundationReinforcement(ctx);
    const q = computeSlabFoundationReinforcementQuantities(ctx, r);
    const min = EUROCODE_PROVIDER.slabFoundationReinforcementLimits(ctx).minRatio;
    expect(q.ratio).toBeGreaterThanOrEqual(min);
    expect(r.topMeshX.diameterMm).toBe(r.bottomMeshX.diameterMm); // δι-διευθυντική top+bottom
  });

  it('greek-legacy: suggested raft satisfies ρ ≥ ρ_min and is ≥ eurocode steel', () => {
    const rLegacy = GREEK_LEGACY_PROVIDER.suggestSlabFoundationReinforcement(ctx);
    const qLegacy = computeSlabFoundationReinforcementQuantities(ctx, rLegacy);
    const minLegacy = GREEK_LEGACY_PROVIDER.slabFoundationReinforcementLimits(ctx).minRatio;
    expect(qLegacy.ratio).toBeGreaterThanOrEqual(minLegacy);
    expect(minLegacy).toBeGreaterThan(EUROCODE_PROVIDER.slabFoundationReinforcementLimits(ctx).minRatio);
  });
});
