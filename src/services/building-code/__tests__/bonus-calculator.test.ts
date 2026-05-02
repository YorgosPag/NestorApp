/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Tests for ΝΟΚ bonus calculator — Phase 1 (A1, A3, A5, combo rules).
 */

import {
  calcA1Bonus,
  calcA3Bonus,
  calcA5Bonus,
  applyBonuses,
} from '@/services/building-code/engines/bonus-calculator';
import type { BonusSelections } from '@/services/building-code/types/bonus.types';

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Minimal site stub for applyBonuses — eligible by default. */
function makeSite(overrides: Record<string, unknown> = {}) {
  return {
    area: 500,
    synt: 0.8,
    syntEfarm: 0.8,
    maxCoveragePct: 60,
    maxBuildableM2: 400,
    maxCoverageM2: 300,
    nokBonusEligible: true,
    isProtectionZone: false,
    ...overrides,
  };
}

// ─── A1: Πολεοδομικά κίνητρα (α–δ) ───────────────────────────────────────────

describe('calcA1Bonus', () => {
  it('A1a: +10% ΣΔ, −10% coverage', () => {
    const r = calcA1Bonus('A1a', 500, 0.8, 60);
    expect(r.id).toBe('A1a');
    expect(r.extraSd).toBeCloseTo(0.08);
    expect(r.extraCoverageM2).toBeCloseTo(-30);
    expect(r.citation).toContain('§2α');
  });

  it('A1b: +15% ΣΔ, −15% coverage', () => {
    const r = calcA1Bonus('A1b', 500, 0.8, 60);
    expect(r.extraSd).toBeCloseTo(0.12);
    expect(r.extraCoverageM2).toBeCloseTo(-45);
    expect(r.citation).toContain('§2β');
  });

  it('A1c: +20% ΣΔ, −20% coverage', () => {
    const r = calcA1Bonus('A1c', 1000, 1.2, 50);
    expect(r.extraSd).toBeCloseTo(0.24);
    expect(r.extraCoverageM2).toBeCloseTo(-100);
    expect(r.citation).toContain('§2γ');
  });

  it('A1d: +25% ΣΔ, −25% coverage', () => {
    const r = calcA1Bonus('A1d', 400, 0.6, 70);
    expect(r.extraSd).toBeCloseTo(0.15);
    expect(r.extraCoverageM2).toBeCloseTo(-70);
    expect(r.citation).toContain('§2δ');
  });
});

// ─── A3: nZEB ──────────────────────────────────────────────────────────────────

describe('calcA3Bonus', () => {
  it('5pct tier: +0.05 ΣΔ, zero coverage', () => {
    const r = calcA3Bonus('5pct', 500, 0.8);
    expect(r.id).toBe('A3_5');
    expect(r.extraSd).toBe(0.05);
    expect(r.extraCoverageM2).toBe(0);
    expect(r.citation).toContain('Άρθρο 25');
  });

  it('10pct tier: +0.10 ΣΔ, zero coverage', () => {
    const r = calcA3Bonus('10pct', 500, 0.8);
    expect(r.id).toBe('A3_10');
    expect(r.extraSd).toBe(0.10);
    expect(r.extraCoverageM2).toBe(0);
  });
});

// ─── A5: Ελάχιστη κάλυψη 120 m² ──────────────────────────────────────────────

describe('calcA5Bonus', () => {
  it('coverage < 120 and pct ≤ 70 → bonus extra', () => {
    const r = calcA5Bonus(100, 200, 60);
    expect(r).not.toBeNull();
    expect(r!.id).toBe('A5');
    expect(r!.extraCoverageM2).toBeCloseTo(20);
    expect(r!.extraSd).toBe(0);
  });

  it('coverage ≥ 120 → null (no bonus needed)', () => {
    const r = calcA5Bonus(120, 500, 60);
    expect(r).toBeNull();
  });

  it('maxCoveragePct > 70 → null (already over cap)', () => {
    const r = calcA5Bonus(80, 200, 80);
    expect(r).toBeNull();
  });

  it('small plot: cap limits extra', () => {
    const r = calcA5Bonus(50, 100, 60);
    expect(r).not.toBeNull();
    expect(r!.extraCoverageM2).toBeCloseTo(20);
  });

  it('cap already below current → null', () => {
    const r = calcA5Bonus(100, 130, 50);
    expect(r).toBeNull();
  });
});

// ─── applyBonuses: combo rules & aggregation ────────────────────────────────

describe('applyBonuses', () => {
  it('nokBonusEligible = false → no bonuses, passthrough base values', () => {
    const site = makeSite({ nokBonusEligible: false });
    const r = applyBonuses(site, { A1a: true, A3_5: true });
    expect(r.items).toHaveLength(0);
    expect(r.totalExtraSd).toBe(0);
    expect(r.adjustedMaxBuildableM2).toBe(400);
    expect(r.adjustedMaxCoverageM2).toBe(300);
    expect(r.warnings).toHaveLength(0);
  });

  it('no selections → only A5 auto-check (no bonus if coverage ≥ 120)', () => {
    const site = makeSite();
    const r = applyBonuses(site, {});
    expect(r.items).toHaveLength(0);
    expect(r.totalExtraSd).toBe(0);
    expect(r.adjustedMaxBuildableM2).toBe(400);
    expect(r.adjustedMaxCoverageM2).toBe(300);
  });

  it('A1α only → +SD and −coverage', () => {
    const site = makeSite();
    const r = applyBonuses(site, { A1a: true });
    expect(r.items).toHaveLength(1);
    expect(r.totalExtraSd).toBeCloseTo(0.08);
    expect(r.adjustedMaxBuildableM2).toBeCloseTo(440);
    expect(r.adjustedMaxCoverageM2).toBeCloseTo(270);
  });

  it('A3_5 only → +5% SD, no coverage change', () => {
    const site = makeSite();
    const r = applyBonuses(site, { A3_5: true });
    expect(r.items).toHaveLength(1);
    expect(r.totalExtraSd).toBeCloseTo(0.05);
    expect(r.adjustedMaxBuildableM2).toBeCloseTo(425);
    expect(r.adjustedMaxCoverageM2).toBeCloseTo(300);
  });

  it('C1: A1α + A3_5 → calculated separately on base ΣΔ', () => {
    const site = makeSite();
    const r = applyBonuses(site, { A1a: true, A3_5: true });
    expect(r.items).toHaveLength(2);
    expect(r.totalExtraSd).toBeCloseTo(0.13);
    expect(r.adjustedMaxBuildableM2).toBeCloseTo(465);
    expect(r.adjustedMaxCoverageM2).toBeCloseTo(270);
  });

  it('C6: protection zone → A1 disabled + warning', () => {
    const site = makeSite({ isProtectionZone: true });
    const r = applyBonuses(site, { A1a: true, A3_5: true });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].id).toBe('A3_5');
    expect(r.warnings).toContain('bonus_warn_protection_zone_a1');
    expect(r.totalExtraSd).toBeCloseTo(0.05);
  });

  it('A1 mutually exclusive — only first found applies', () => {
    const site = makeSite();
    const r = applyBonuses(site, { A1a: true, A1d: true } as BonusSelections);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].id).toBe('A1a');
  });

  it('A3 mutually exclusive — A3_10 takes priority', () => {
    const site = makeSite();
    const r = applyBonuses(site, { A3_5: true, A3_10: true });
    expect(r.items.filter((i) => i.id === 'A3_5' || i.id === 'A3_10')).toHaveLength(1);
    expect(r.items[0].id).toBe('A3_10');
    expect(r.totalExtraSd).toBeCloseTo(0.10);
  });

  it('A5 auto-applied when coverage < 120', () => {
    const site = makeSite({
      area: 150,
      maxCoveragePct: 60,
      maxCoverageM2: 90,
      maxBuildableM2: 120,
    });
    const r = applyBonuses(site, {});
    expect(r.items).toHaveLength(1);
    expect(r.items[0].id).toBe('A5');
    expect(r.items[0].extraCoverageM2).toBeCloseTo(15);
    expect(r.adjustedMaxCoverageM2).toBeCloseTo(105);
  });

  it('A5 considers A1 coverage reduction', () => {
    const site = makeSite({
      area: 200,
      maxCoveragePct: 60,
      maxCoverageM2: 120,
      maxBuildableM2: 160,
    });
    const r = applyBonuses(site, { A1a: true });
    expect(r.items.some((i) => i.id === 'A5')).toBe(true);
    const a5 = r.items.find((i) => i.id === 'A5')!;
    expect(a5.extraCoverageM2).toBeCloseTo(12);
  });

  it('zero area → graceful (no crash, zero results)', () => {
    const site = makeSite({ area: 0, maxBuildableM2: 0, maxCoverageM2: 0 });
    const r = applyBonuses(site, { A1a: true });
    expect(r.totalExtraSd).toBeCloseTo(0.08);
    expect(r.adjustedMaxBuildableM2).toBe(0);
  });

  it('zero ΣΔ → A1 gives zero extraSd', () => {
    const site = makeSite({ synt: 0, syntEfarm: 0, maxBuildableM2: 0 });
    const r = applyBonuses(site, { A1a: true });
    expect(r.totalExtraSd).toBe(0);
  });
});
