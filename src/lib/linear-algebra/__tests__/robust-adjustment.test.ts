/**
 * ⚓ ADR-929 Φ4 — σταθμισμένα ελάχιστα τετράγωνα + data snooping, σε δίκτυο **χωροστάθμησης** (το κλασικό παράδειγμα της
 * γεωδαισίας): άγνωστα υψόμετρα, παρατηρήσεις υψομετρικών διαφορών, ένα σημείο αναφοράς.
 */

import { describe, expect, it } from '@jest/globals';
import { factorSymmetric, solveFactored, solveSymmetric } from '../ldlt-solve';
import { solveWeightedLeastSquares, chiSquareQuantile, minimalDetectableBias, type LinearObservation } from '../weighted-least-squares';
import { adjustWithDataSnooping } from '../robust-adjustment';

const OPTIONS = { critical: 3.29, minRedundancy: 1e-3 };

/** Σημεία 0..3 με αληθινά υψόμετρα· το 0 «δεμένο» με παρατήρηση υψομέτρου. */
const TRUE_H = [10, 11.5, 12.25, 9.75];
const SIGMA = 0.002;

const diff = (from: number, to: number, value: number): LinearObservation => ({
  terms: [{ index: to, coefficient: 1 }, { index: from, coefficient: -1 }],
  value,
  sigma: SIGMA,
});
const exact = (from: number, to: number): LinearObservation => diff(from, to, TRUE_H[to] - TRUE_H[from]);

/** Κλειστό δίκτυο: κάθε ζεύγος μετρημένο, άρα κάθε διαφορά ελέγχεται από τις άλλες. */
function network(blunder?: { index: number; size: number }): LinearObservation[] {
  const pairs: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]];
  const obs = pairs.map(([a, b]) => exact(a, b));
  if (blunder) obs[blunder.index] = { ...obs[blunder.index], value: obs[blunder.index].value + blunder.size };
  return [{ terms: [{ index: 0, coefficient: 1 }], value: TRUE_H[0], sigma: SIGMA }, ...obs];
}

describe('ldlt-solve — μία παραγοντοποίηση, πολλές λύσεις', () => {
  it('solveFactored == solveSymmetric', () => {
    const k = [[4, 1, 0], [1, 3, 1], [0, 1, 2]];
    const f = [1, 2, 3];
    const fac = factorSymmetric(k);
    expect(fac.singular).toBe(false);
    const a = solveFactored(fac, f);
    const b = solveSymmetric(k, f).solution;
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 12));
  });
});

describe('weighted-least-squares', () => {
  it('ακριβείς παρατηρήσεις ⇒ τα αληθινά υψόμετρα, μηδενικά υπόλοιπα', () => {
    const s = solveWeightedLeastSquares(network(), 4);
    expect(s.singular).toBe(false);
    s.x.forEach((h, i) => expect(h).toBeCloseTo(TRUE_H[i], 9));
    s.residuals.forEach((v) => expect(Math.abs(v)).toBeLessThan(1e-9));
  });

  it('Σ rᵢ = βαθμοί ελευθερίας (ταυτότητα του πλεονασμού)', () => {
    const s = solveWeightedLeastSquares(network(), 4);
    const sum = s.redundancy.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(s.degreesOfFreedom, 9);
    expect(s.degreesOfFreedom).toBe(3);
  });

  it('η μόνη παρατήρηση του σημείου αναφοράς έχει r = 0 (δεν ελέγχεται από τίποτα)', () => {
    const s = solveWeightedLeastSquares(network(), 4);
    expect(s.redundancy[0]).toBeCloseTo(0, 9);
  });

  it('άγνωστος χωρίς παρατήρηση ⇒ singular, όχι NaN', () => {
    const s = solveWeightedLeastSquares([exact(0, 1)], 3);
    expect(s.singular).toBe(true);
    s.x.forEach((v) => expect(Number.isNaN(v)).toBe(false));
  });

  it('Wilson–Hilferty: χ²₀.₉₅(10) ≈ 18,31', () => {
    expect(chiSquareQuantile(10, 1.6448536)).toBeCloseTo(18.307, 1);
  });
});

describe('robust-adjustment — ποιος φταίει', () => {
  it('καθαρό δίκτυο ⇒ καμία απόρριψη, ολικό τεστ περνά', () => {
    const r = adjustWithDataSnooping(network(), 4, OPTIONS);
    expect(r.rejected).toBe(0);
    expect(r.globalTestPassed).toBe(true);
  });

  it.each([1, 2, 3, 4, 5, 6])('χονδροειδές σφάλμα 3 cm στην παρατήρηση %i ⇒ απορρίπτεται ΑΥΤΗ και μόνο', (index) => {
    const r = adjustWithDataSnooping(network({ index: index - 1, size: 0.03 }), 4, OPTIONS);
    expect(r.rejected).toBe(1);
    expect(r.verdicts.map((v) => v.active).indexOf(false)).toBe(index);
    r.solution.x.forEach((h, i) => expect(h).toBeCloseTo(TRUE_H[i], 6));
    expect(Math.abs(r.verdicts[index].w ?? 0)).toBeGreaterThan(OPTIONS.critical);
  });

  it('μικρό σφάλμα (μέσα στον θόρυβο) ⇒ δεν απορρίπτεται', () => {
    const r = adjustWithDataSnooping(network({ index: 2, size: 0.003 }), 4, OPTIONS);
    expect(r.rejected).toBe(0);
  });

  it('ισοβαθμία (ένας πλεονασμός) ⇒ φταίει όποια δηλώνει ο καλών, όχι η τυχαία σειρά', () => {
    const obs = [
      { terms: [{ index: 0, coefficient: 1 }], value: 0, sigma: 1 },
      { terms: [{ index: 0, coefficient: 1 }], value: 10, sigma: 1 },
    ];
    expect(adjustWithDataSnooping(obs, 1, { ...OPTIONS, blamePriority: [0, 1] }).verdicts.map((v) => v.active)).toEqual([true, false]);
    expect(adjustWithDataSnooping(obs, 1, { ...OPTIONS, blamePriority: [1, 0] }).verdicts.map((v) => v.active)).toEqual([false, true]);
  });

  it('ελάχιστο ανιχνεύσιμο σφάλμα: σ·4,13/√r, άπειρο (null) χωρίς πλεονασμό', () => {
    expect(minimalDetectableBias(2, 0.25)).toBeCloseTo((2 * 4.13) / 0.5, 9);
    expect(minimalDetectableBias(2, 0)).toBeNull();
  });

  it('μη ελέγξιμη παρατήρηση (r ≈ 0) δεν απορρίπτεται ποτέ, και το w της είναι null', () => {
    const obs = [{ terms: [{ index: 0, coefficient: 1 }], value: 99, sigma: SIGMA }, exact(0, 1)];
    const r = adjustWithDataSnooping(obs, 2, OPTIONS);
    expect(r.rejected).toBe(0);
    expect(r.verdicts[0].w).toBeNull();
    expect(r.verdicts[1].w).toBeNull();
  });
});
