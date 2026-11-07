/**
 * ADR-929 §6.9 #7 — ουρά της διωνυμικής σε λογάριθμο, απέναντι σε ακριβή απαρίθμηση.
 */

import { describe, it, expect } from '@jest/globals';
import { log10BinomialTail, logBinomialCoefficient, logGamma } from '../log-binomial-tail';

/** P[X ≥ k] με ακέραιους συντελεστές (ακριβές για μικρά n). */
function bruteTail(n: number, k: number, p: number): number {
  let c = 1;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    if (i > 0) c = (c * (n - i + 1)) / i;
    if (i >= k) sum += c * p ** i * (1 - p) ** (n - i);
  }
  return sum;
}

describe('logGamma', () => {
  it('Γ(1) = 1 · Γ(5) = 24 · Γ(1/2) = √π · Γ(0,1) με ανάκλαση', () => {
    expect(logGamma(1)).toBeCloseTo(0, 12);
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 12);
    expect(logGamma(0.5)).toBeCloseTo(0.5 * Math.log(Math.PI), 12);
    expect(logGamma(0.1)).toBeCloseTo(Math.log(9.513507698668732), 10);
  });

  it('ln C(10, 3) = ln 120', () => {
    expect(logBinomialCoefficient(10, 3)).toBeCloseTo(Math.log(120), 10);
  });
});

describe('log10BinomialTail', () => {
  it('συμφωνεί με την ακριβή απαρίθμηση για n ≤ 30', () => {
    for (const n of [1, 5, 12, 30]) {
      for (const p of [0.03, 0.2, 0.5, 0.9]) {
        for (let k = 1; k <= n; k++) {
          expect(log10BinomialTail(n, k, p)).toBeCloseTo(Math.log10(bruteTail(n, k, p)), 9);
        }
      }
    }
  });

  it('όρια ορισμένα, ποτέ NaN', () => {
    expect(log10BinomialTail(10, 0, 0.3)).toBe(0);
    expect(log10BinomialTail(10, 11, 0.3)).toBe(Number.NEGATIVE_INFINITY);
    expect(log10BinomialTail(10, 3, 0)).toBe(Number.NEGATIVE_INFINITY);
    expect(log10BinomialTail(10, 3, 1)).toBe(0);
  });

  it('n = 3000 κάτω από το όριο του double: πεπερασμένο, όχι 0 και όχι −∞', () => {
    const v = log10BinomialTail(3000, 2900, 0.05);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeLessThan(-1000);
    expect(log10BinomialTail(3000, 2950, 0.05)).toBeLessThan(v);
  });
});
