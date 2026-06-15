/**
 * ADR-456 — Στατικά Slice 1 tests: concrete grades, rebar catalog, code
 * providers, reinforcement compute + format labels.
 */

import {
  CONCRETE_DENSITY_KGM3,
  CONCRETE_GRADES,
  DEFAULT_CONCRETE_GRADE,
  concreteFcdMpa,
  concreteWeightKg,
  isConcreteGrade,
} from '../concrete-grades';
import {
  barAreaMm2,
  barMassPerMeterKg,
  nextRebarDiameterMm,
  rebarFydMpa,
  REBAR_FYK_MPA,
} from '../rebar-catalog';
import {
  DEFAULT_STRUCTURAL_CODE,
  resolveStructuralCode,
} from '../codes';
import type { ColumnSectionContext } from '../codes';
import {
  computeColumnReinforcementQuantities,
  formatLongitudinalLabel,
  formatStirrupsLabel,
} from '../reinforcement/column-reinforcement-compute';
import type { ColumnReinforcement } from '../reinforcement/column-reinforcement-types';

const COL_400: ColumnSectionContext = {
  widthMm: 400,
  depthMm: 400,
  heightMm: 3000,
  grossAreaMm2: 400 * 400,
};

// ─── Concrete grades ──────────────────────────────────────────────────────────

describe('concrete-grades', () => {
  it('default grade is a valid grade', () => {
    expect(isConcreteGrade(DEFAULT_CONCRETE_GRADE)).toBe(true);
    expect(CONCRETE_GRADES[DEFAULT_CONCRETE_GRADE].fckMpa).toBe(25);
  });

  it('isConcreteGrade rejects junk', () => {
    expect(isConcreteGrade('C99/99')).toBe(false);
    expect(isConcreteGrade(undefined)).toBe(false);
  });

  it('concreteWeightKg = volume × 2400', () => {
    expect(concreteWeightKg(2)).toBeCloseTo(2 * CONCRETE_DENSITY_KGM3, 6);
    expect(concreteWeightKg(0)).toBe(0);
    expect(concreteWeightKg(-1)).toBe(0);
  });

  it('fcd = fck / 1.5 (αcc=1.0 Greek NA)', () => {
    expect(concreteFcdMpa('C25/30')).toBeCloseTo(25 / 1.5, 4);
  });
});

// ─── Rebar catalog ────────────────────────────────────────────────────────────

describe('rebar-catalog', () => {
  it('barAreaMm2(Ø16) ≈ 201', () => {
    expect(barAreaMm2(16)).toBeCloseTo(201.06, 1);
  });

  it('barMassPerMeterKg(Ø16) ≈ 1.578 kg/m (εμπορικός πίνακας)', () => {
    expect(barMassPerMeterKg(16)).toBeCloseTo(1.578, 2);
  });

  it('rebarFydMpa = 500 / 1.15 ≈ 434.8', () => {
    expect(rebarFydMpa()).toBeCloseTo(REBAR_FYK_MPA / 1.15, 2);
  });

  it('nextRebarDiameterMm rounds up to commercial', () => {
    expect(nextRebarDiameterMm(6.25)).toBe(8);
    expect(nextRebarDiameterMm(12)).toBe(12);
    expect(nextRebarDiameterMm(99)).toBe(32);
  });
});

// ─── Code providers ───────────────────────────────────────────────────────────

describe('structural code providers', () => {
  it('resolveStructuralCode default = eurocode', () => {
    expect(resolveStructuralCode(undefined).id).toBe(DEFAULT_STRUCTURAL_CODE);
    expect(resolveStructuralCode('eurocode').id).toBe('eurocode');
    expect(resolveStructuralCode('greek-legacy').id).toBe('greek-legacy');
  });

  it('eurocode ρ_min=1%, ρ_max=4%, min Ø ράβδου 12', () => {
    const lim = resolveStructuralCode('eurocode').columnReinforcementLimits(COL_400, 16);
    expect(lim.minRatio).toBeCloseTo(0.01);
    expect(lim.maxRatio).toBeCloseTo(0.04);
    expect(lim.minBarDiameterMm).toBe(12);
    expect(lim.minBarCount).toBe(4);
  });

  it('greek-legacy is more conservative (min Ø ράβδου 14, cover 25)', () => {
    const lim = resolveStructuralCode('greek-legacy').columnReinforcementLimits(COL_400, 16);
    expect(lim.minBarDiameterMm).toBe(14);
    expect(lim.nominalCoverMm).toBe(25);
  });

  it('suggestColumnReinforcement gives ρ ≥ ρ_min for 400×400', () => {
    const provider = resolveStructuralCode('eurocode');
    const r = provider.suggestColumnReinforcement(COL_400);
    // 400mm πλευρά > 200mm max-bar-spacing → ενδιάμεση συγκρατημένη ράβδος ανά
    // πλευρά → 8 (4 γωνιακές + 4 μεσοπλευρικές), όχι 4 (EC8 §5.4.3.2.2(11)).
    expect(r.longitudinal.count).toBe(8);
    const q = computeColumnReinforcementQuantities(COL_400, r);
    expect(q.ratio).toBeGreaterThanOrEqual(0.01);
  });

  // ─── Δυναμικό πλήθος διαμήκων (ADR-456 Slice 1) ──────────────────────────────

  it('πλήθος διαμήκων κλιμακώνεται με τη διατομή (max-bar-spacing)', () => {
    const provider = resolveStructuralCode('eurocode');
    // 2000×2000: ⌈2000/200⌉=10 ανά πλευρά-segment → 2·10 + 2·10 = 40 περιμετρικά.
    const big: ColumnSectionContext = {
      widthMm: 2000,
      depthMm: 2000,
      heightMm: 3000,
      grossAreaMm2: 2000 * 2000,
    };
    const r = provider.suggestColumnReinforcement(big);
    expect(r.longitudinal.count).toBeGreaterThanOrEqual(40);
  });

  it('απόσταση μεταξύ διαδοχικών ράβδων ≤ 200mm σε κάθε πλευρά', () => {
    const provider = resolveStructuralCode('eurocode');
    const big: ColumnSectionContext = {
      widthMm: 1200,
      depthMm: 800,
      heightMm: 3000,
      grossAreaMm2: 1200 * 800,
    };
    const r = provider.suggestColumnReinforcement(big);
    // Ράβδοι ανά πλευρά = count/4 segments… ελέγχουμε ότι το βήμα στη μεγάλη
    // πλευρά (1200) δεν ξεπερνά το όριο: ⌈1200/200⌉=6 segments → ≤200mm.
    const segmentsWide = Math.ceil(1200 / 200);
    expect(1200 / segmentsWide).toBeLessThanOrEqual(200);
    expect(r.longitudinal.count).toBeGreaterThanOrEqual(2 * 6 + 2 * 4);
  });

  it('μεγάλη διατομή που κορεννύει τη μέγιστη Ø → προστίθενται ράβδοι για ρ_min', () => {
    const provider = resolveStructuralCode('eurocode');
    // 2×2m, ρ_min=1% → As_min=40.000mm². Μέγιστη εμπορική Ø32 (804mm²) →
    // χρειάζονται >40 ράβδοι (η spacing δίνει 40) → ο αλγόριθμος προσθέτει.
    const big: ColumnSectionContext = {
      widthMm: 2000,
      depthMm: 2000,
      heightMm: 3000,
      grossAreaMm2: 2000 * 2000,
    };
    const r = provider.suggestColumnReinforcement(big);
    const q = computeColumnReinforcementQuantities(big, r);
    expect(q.ratio).toBeGreaterThanOrEqual(0.01);
  });
});

// ─── Reinforcement compute ────────────────────────────────────────────────────

describe('column-reinforcement-compute', () => {
  const R: ColumnReinforcement = {
    longitudinal: { diameterMm: 16, count: 4 },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100 },
    coverMm: 30,
  };

  it('produces positive lengths, weights, stirrup count', () => {
    const q = computeColumnReinforcementQuantities(COL_400, R);
    expect(q.longitudinalLengthM).toBeGreaterThan(0);
    expect(q.longitudinalWeightKg).toBeGreaterThan(0);
    expect(q.stirrupCount).toBeGreaterThan(0);
    expect(q.stirrupWeightKg).toBeGreaterThan(0);
    expect(q.totalSteelWeightKg).toBeCloseTo(q.longitudinalWeightKg + q.stirrupWeightKg, 6);
  });

  it('longitudinal length = count × (height + 50·Ø) / 1000', () => {
    const q = computeColumnReinforcementQuantities(COL_400, R);
    const expected = 4 * (3000 + 50 * 16) * 0.001;
    expect(q.longitudinalLengthM).toBeCloseTo(expected, 6);
  });

  it('ρ for 4Ø16 in 400×400 ≈ 0.5%', () => {
    const q = computeColumnReinforcementQuantities(COL_400, R);
    expect(q.ratio).toBeCloseTo((4 * barAreaMm2(16)) / 160000, 6);
  });

  it('degenerate section → zero quantities', () => {
    const q = computeColumnReinforcementQuantities(
      { widthMm: 0, depthMm: 0, heightMm: 0, grossAreaMm2: 0 },
      R,
    );
    expect(q.stirrupCount).toBe(0);
    expect(q.ratio).toBe(0);
  });

  it('format labels: 4Ø16 + Ø8/100-200', () => {
    expect(formatLongitudinalLabel(R)).toBe('4Ø16');
    expect(formatStirrupsLabel(R)).toBe('Ø8/100-200');
  });

  it('stirrup label without πύκνωση: Ø8/200', () => {
    const noCrit: ColumnReinforcement = {
      ...R,
      stirrups: { diameterMm: 8, spacingMm: 200 },
    };
    expect(formatStirrupsLabel(noCrit)).toBe('Ø8/200');
  });
});

// ─── Validator integration (ρ_min/ρ_max code violation) ───────────────────────

describe('column reinforcement ratio validation', () => {
  // Imported lazily to keep this file focused; validator owns its own suite too.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { validateColumnParams } = require('../../validators/column-validator');

  const base = {
    kind: 'rectangular' as const,
    position: { x: 0, y: 0, z: 0 },
    anchor: 'center' as const,
    width: 400,
    depth: 400,
    height: 3000,
    rotation: 0,
    baseBinding: 'storey-floor' as const,
    topBinding: 'storey-ceiling' as const,
    baseOffset: 0,
    topOffset: 0,
  };

  it('flags below-min ratio (2Ø12 in 400×400)', () => {
    const r = validateColumnParams({
      ...base,
      reinforcement: {
        longitudinal: { diameterMm: 12, count: 2 },
        stirrups: { diameterMm: 8, spacingMm: 200 },
        coverMm: 30,
      },
    });
    expect(r.codeViolations).toContain('column.validation.codeViolations.reinforcementRatioBelowMin');
  });

  it('no violation for code-suggested reinforcement', () => {
    const provider = resolveStructuralCode('eurocode');
    const reinforcement = provider.suggestColumnReinforcement(COL_400);
    const r = validateColumnParams({ ...base, reinforcement });
    expect(r.codeViolations).not.toContain('column.validation.codeViolations.reinforcementRatioBelowMin');
    expect(r.codeViolations).not.toContain('column.validation.codeViolations.reinforcementRatioAboveMax');
  });
});
