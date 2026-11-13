/**
 * ADR-929 §6.16 #8 — η αραιή LDLᵀ + ο επιλεγμένος αντίστροφος (Takahashi) πρέπει να δίνουν **την ίδια** λύση, τα ίδια
 * στοιχεία του `N⁻¹` (στη δομή **και** εκτός, κατ' απαίτηση), τους ίδιους αριθμούς πλεονασμού και την ίδια διάγνωση
 * ιδιάζοντος με την πυκνή εκδοχή που αντικατέστησαν. Μαντείο: η πυκνή LDLᵀ του `ldlt-solve.ts` (ο FEM) με ρητό αντίστροφο.
 */

import { factorSymmetric, solveFactored } from '../ldlt-solve';
import { analyzeSparsePattern } from '../sparse-ordering';
import { factorSparse, selectedInverse, solveSparse, SparseSymmetricMatrix } from '../sparse-ldlt';
import { solveWeightedLeastSquares, type LinearObservation } from '../weighted-least-squares';
import { adjustWithDataSnooping } from '../robust-adjustment';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Το σχήμα της συνόρθωσης διαστάσεων: θέση κάθε ευθείας + διαστάσεις ανάμεσα σε ζεύγη, προαιρετικά ελεύθερη κλίμακα K. */
function dimensionNetwork(seed: number, freeScale: boolean): { obs: LinearObservation[]; unknowns: number } {
  const r = rng(seed);
  const lines = 3 + Math.floor(r() * 60);
  const k = lines;
  const obs: LinearObservation[] = [];
  for (let i = 0; i < lines; i++) obs.push({ terms: [{ index: i, coefficient: 1 }], value: r() * 1000, sigma: 0.5 + r() });
  const dims = Math.floor(r() * lines * 1.5);
  for (let d = 0; d < dims; d++) {
    const a = Math.floor(r() * lines);
    const b = (a + 1 + Math.floor(r() * (lines - 1))) % lines;
    const valueM = 0.5 + r() * 8;
    const pair = [{ index: b, coefficient: 1 }, { index: a, coefficient: -1 }];
    obs.push(freeScale
      ? { terms: [...pair, { index: k, coefficient: -valueM }], value: (r() - 0.5) * 2, sigma: 0.2 + r() }
      : { terms: pair, value: valueM * 50 + (r() - 0.5) * 20, sigma: 0.2 + r() });
  }
  return { obs, unknowns: lines + (freeScale ? 1 : 0) };
}

/** Πυκνό μαντείο: κανονικές εξισώσεις, πυκνή LDLᵀ, ρητός αντίστροφος. */
function denseOracle(obs: readonly LinearObservation[], unknowns: number, factors?: readonly number[]) {
  const n = Array.from({ length: unknowns }, () => new Array<number>(unknowns).fill(0));
  const u = new Array<number>(unknowns).fill(0);
  obs.forEach((o, i) => {
    const p = (factors?.[i] ?? 1) / (o.sigma * o.sigma);
    for (const s of o.terms) {
      u[s.index] += p * s.coefficient * o.value;
      for (const t of o.terms) n[s.index][t.index] += p * s.coefficient * t.coefficient;
    }
  });
  const fac = factorSymmetric(n);
  if (fac.singular) return { singular: true as const };
  const x = solveFactored(fac, u);
  const q = Array.from({ length: unknowns }, (_, j) => {
    const e = new Array<number>(unknowns).fill(0);
    e[j] = 1;
    return solveFactored(fac, e);
  });
  return { singular: false as const, x, q: (i: number, j: number) => q[j][i] };
}

const close = (a: number, b: number, scale: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(b), scale));

describe('αραιή LDLᵀ + Takahashi ≡ πυκνή λύση με ρητό αντίστροφο', () => {
  it.each(Array.from({ length: 80 }, (_, s) => [s, s % 2 === 0] as const))('δίκτυο %i (ελεύθερη κλίμακα: %s)', (seed, free) => {
    const { obs, unknowns } = dimensionNetwork(seed, free);
    const sparse = solveWeightedLeastSquares(obs, unknowns);
    const dense = denseOracle(obs, unknowns);
    expect(sparse.singular).toBe(dense.singular);
    if (dense.singular) return;
    const qScale = Math.max(...Array.from({ length: unknowns }, (_, i) => Math.abs(dense.q(i, i))));
    sparse.x.forEach((v, i) => close(v, dense.x[i], 1));
    for (let i = 0; i < unknowns; i++) for (let j = 0; j < unknowns; j++) close(sparse.cofactor.at(i, j), dense.q(i, j), qScale);
  });

  it('ιδιάζον (άγνωστος χωρίς παρατήρηση) ⇒ singular και στα δύο, cofactor NaN', () => {
    const obs: LinearObservation[] = [{ terms: [{ index: 0, coefficient: 1 }], value: 1, sigma: 1 }];
    const s = solveWeightedLeastSquares(obs, 2);
    expect(s.singular).toBe(true);
    expect(denseOracle(obs, 2).singular).toBe(true);
    expect(s.cofactor.at(0, 0)).toBeNaN();
  });

  it('μηδενικό βάρος βγάζει την παρατήρηση· η ίδια ανάλυση χρησιμεύει σε όλους τους γύρους', () => {
    const { obs, unknowns } = dimensionNetwork(3, true);
    const factors = obs.map((_, i) => (i % 7 === 3 ? 0 : 1));
    const sparse = solveWeightedLeastSquares(obs, unknowns, factors);
    const dense = denseOracle(obs, unknowns, factors);
    expect(sparse.singular).toBe(dense.singular);
    if (!dense.singular) sparse.x.forEach((v, i) => close(v, dense.x[i], 1));
  });

  it('ίδιος άγνωστος δύο φορές στην ίδια παρατήρηση ⇒ ίδιο N με την πυκνή', () => {
    const obs: LinearObservation[] = [
      { terms: [{ index: 0, coefficient: 2 }, { index: 1, coefficient: 1 }, { index: 0, coefficient: -0.5 }], value: 3, sigma: 1 },
      { terms: [{ index: 1, coefficient: 1 }], value: 1, sigma: 1 },
      { terms: [{ index: 0, coefficient: 1 }, { index: 1, coefficient: 1 }], value: 2, sigma: 2 },
    ];
    const sparse = solveWeightedLeastSquares(obs, 2);
    const dense = denseOracle(obs, 2);
    if (dense.singular) throw new Error('μαντείο ιδιάζον');
    sparse.x.forEach((v, i) => close(v, dense.x[i], 1));
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) close(sparse.cofactor.at(i, j), dense.q(i, j), 1);
  });

  it('η ελεύθερη κλίμακα (κόμβος που αγγίζουν όλες οι διαστάσεις) απαλείφεται τελευταία ⇒ σχήμα βέλους', () => {
    const { obs, unknowns } = dimensionNetwork(10, true);
    const analysis = analyzeSparsePattern(unknowns, obs.map((o) => o.terms.map((t) => t.index)));
    expect(analysis.order[unknowns - 1]).toBe(unknowns - 1);
  });

  it('λύση και αντίστροφος χωρίς παρατηρήσεις: απευθείας μητρώο', () => {
    const analysis = analyzeSparsePattern(3, [[0, 1], [1, 2]]);
    const m = new SparseSymmetricMatrix(analysis);
    [[0, 0, 4], [1, 1, 5], [2, 2, 6], [1, 0, 1], [2, 1, 2]].forEach(([i, j, v]) => m.add(i, j, v));
    const f = factorSparse(m);
    const x = solveSparse(f, [1, 2, 3]);
    const dense = factorSymmetric([[4, 1, 0], [1, 5, 2], [0, 2, 6]]);
    solveFactored(dense, [1, 2, 3]).forEach((v, i) => close(x[i], v, 1));
    const q = selectedInverse(f);
    const e = solveFactored(dense, [0, 0, 1]);
    close(q.at(0, 2), e[0], 1); // (0, 2) εκτός δομής ⇒ κατ' απαίτηση
    expect(() => m.add(0, 2, 1)).toThrow(RangeError);
  });
});

describe('data snooping πάνω στην αραιή λύση — ίδιες απορρίψεις με την πυκνή επανεπίλυση', () => {
  it.each(Array.from({ length: 30 }, (_, s) => s))('δίκτυο με χονδροειδή σφάλματα %i', (seed) => {
    const { obs, unknowns } = dimensionNetwork(100 + seed, seed % 2 === 0);
    const r = rng(seed);
    const blundered = obs.map((o) => (r() < 0.08 ? { ...o, value: o.value + (r() < 0.5 ? -1 : 1) * 40 * o.sigma } : o));
    const out = adjustWithDataSnooping(blundered, unknowns, { critical: 3.29, minRedundancy: 1e-3 });
    // Μαντείο: ίδιος βρόχος, πυκνή επίλυση + w από τον ρητό αντίστροφο.
    const active = blundered.map(() => true);
    for (let round = 0; round < blundered.length; round++) {
      const d = denseOracle(blundered, unknowns, active.map((a) => (a ? 1 : 0)));
      if (d.singular) break;
      let worst = -1;
      let worstW = 0;
      blundered.forEach((o, i) => {
        if (!active[i]) return;
        const v = o.terms.reduce((s, t) => s + t.coefficient * d.x[t.index], 0) - o.value;
        let aqa = 0;
        for (const s of o.terms) for (const t of o.terms) aqa += s.coefficient * t.coefficient * d.q(s.index, t.index);
        const red = Math.max(0, 1 - aqa / (o.sigma * o.sigma));
        if (red < 1e-3) return;
        const w = Math.abs(v) / (o.sigma * Math.sqrt(red));
        if (w > 3.29 && w > worstW * 1.01) [worst, worstW] = [i, w];
      });
      if (worst < 0) break;
      active[worst] = false;
      if (denseOracle(blundered, unknowns, active.map((a) => (a ? 1 : 0))).singular) {
        active[worst] = true;
        break;
      }
    }
    expect(out.verdicts.map((v) => v.active)).toStrictEqual(active);
  });
});
