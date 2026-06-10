/**
 * ADR-422 L1.7 — tests για το pure μοντέλο αερισμού/διείσδυσης (EN 12831-1 §6.3.3).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Όλες οι αναμενόμενες τιμές παράγονται από τον τύπο με τις ΤΕΛΙΚΕΣ config σταθερές
 * (worked-example βαθμονόμηση του handoff §5.2). Επιβεβαιώνει το zero-regression
 * by construction: defaults (n50=0, η=0) ⇒ n_eff=n_min.
 */

import {
  computeInfiltrationRate,
  computeDesignVentilationRate,
  computeEffectiveVentilationRate,
} from '../ventilation-model';
import {
  getInfiltrationN50,
  getHeatRecoveryEfficiency,
  getWindShieldingCoefficient,
  HEIGHT_CORRECTION_FACTOR_EPSILON,
} from '../heat-load-config';

describe('computeInfiltrationRate — n_inf = 2·n50·e·ε', () => {
  it('n50=0 (unspecified) ⇒ 0 (διείσδυση δεν λαμβάνεται υπόψη)', () => {
    expect(computeInfiltrationRate(0, 0.03, 1)).toBe(0);
  });

  it('leaky (n50=6) + 2 όψεις (e=0.03) + ε=1 ⇒ 0.36', () => {
    expect(computeInfiltrationRate(6, 0.03, 1)).toBeCloseTo(0.36, 6);
  });

  it('very-leaky (n50=10) + e=0.03 + ε=1 ⇒ 0.60', () => {
    expect(computeInfiltrationRate(10, 0.03, 1)).toBeCloseTo(0.6, 6);
  });

  it('0 εκτεθειμένες όψεις (e=0) ⇒ 0 ανεξαρτήτως n50', () => {
    expect(computeInfiltrationRate(10, 0, 1)).toBe(0);
  });

  it('αρνητικά/NaN ⇒ 0 (αμυντικό clamp)', () => {
    expect(computeInfiltrationRate(-5, 0.03, 1)).toBe(0);
    expect(computeInfiltrationRate(6, Number.NaN, 1)).toBe(0);
  });
});

describe('computeDesignVentilationRate — n_ven = n_min·(1−η)', () => {
  it('η=0 ⇒ n_min αμετάβλητο', () => {
    expect(computeDesignVentilationRate(0.75, 0)).toBeCloseTo(0.75, 6);
  });

  it('η=0.8 (high HRV) ⇒ 0.75·0.2 = 0.15', () => {
    expect(computeDesignVentilationRate(0.75, 0.8)).toBeCloseTo(0.15, 6);
  });

  it('η≥1 clamp ⇒ 0 (μη-φυσικό όριο πλήρους ανάκτησης)', () => {
    expect(computeDesignVentilationRate(0.75, 1.5)).toBe(0);
  });

  it('η<0 clamp ⇒ n_min', () => {
    expect(computeDesignVentilationRate(0.75, -0.3)).toBeCloseTo(0.75, 6);
  });
});

describe('computeEffectiveVentilationRate — n_eff = max(n_inf, n_ven)', () => {
  const epsilon = HEIGHT_CORRECTION_FACTOR_EPSILON;

  // (α) Default: unspecified + natural ⇒ n_eff = n_min (zero-regression).
  it('(α) default (n50=0, η=0) ⇒ n_eff = n_min = 0.75', () => {
    const n = computeEffectiveVentilationRate({
      nMin: 0.75,
      n50: getInfiltrationN50('unspecified'),
      shieldingE: getWindShieldingCoefficient(2),
      heightEpsilon: epsilon,
      heatRecoveryEta: getHeatRecoveryEfficiency('natural'),
    });
    expect(n).toBeCloseTo(0.75, 6);
  });

  // (β) Leaky γωνιακό αλλά υγιεινής υπερτερεί ⇒ n_eff = n_min.
  it('(β) leaky (n50=6) 2 όψεις, natural ⇒ max(0.36, 0.75) = 0.75', () => {
    const n = computeEffectiveVentilationRate({
      nMin: 0.75,
      n50: getInfiltrationN50('leaky'),
      shieldingE: getWindShieldingCoefficient(2),
      heightEpsilon: epsilon,
      heatRecoveryEta: getHeatRecoveryEfficiency('natural'),
    });
    expect(n).toBeCloseTo(0.75, 6);
  });

  // (γ) Very-leaky + χαμηλός υγιεινός ⇒ διείσδυση κυριαρχεί.
  it('(γ) very-leaky (n50=10) 2 όψεις, n_min=0.5 ⇒ max(0.60, 0.5) = 0.60', () => {
    const n = computeEffectiveVentilationRate({
      nMin: 0.5,
      n50: getInfiltrationN50('very-leaky'),
      shieldingE: getWindShieldingCoefficient(2),
      heightEpsilon: epsilon,
      heatRecoveryEta: getHeatRecoveryEfficiency('natural'),
    });
    expect(n).toBeCloseTo(0.6, 6);
  });

  // (δ) Μηχανικός με ανάκτηση η=0.8 ⇒ δραστική μείωση.
  it('(δ) mechanical-hr-high (η=0.8), unspecified ⇒ max(0, 0.15) = 0.15 (−80%)', () => {
    const n = computeEffectiveVentilationRate({
      nMin: 0.75,
      n50: getInfiltrationN50('unspecified'),
      shieldingE: getWindShieldingCoefficient(2),
      heightEpsilon: epsilon,
      heatRecoveryEta: getHeatRecoveryEfficiency('mechanical-hr-high'),
    });
    expect(n).toBeCloseTo(0.15, 6);
  });
});
