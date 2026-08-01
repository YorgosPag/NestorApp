/**
 * @fileoverview Ο κοινός union-find. Μικρός κώδικας, αλλά **τέσσερις** τομείς κρέμονται
 * από αυτόν (θέρμανση, διακλαδώσεις, θεμελιώσεις, πινακίδα) — η σιωπηλή αστοχία του
 * μοιάζει με «λάθος δεδομένα», όχι με σφάλμα.
 */

import {
  computeConnectedComponents,
  groupIndicesByComponent,
} from '../connected-components';

describe('computeConnectedComponents', () => {
  it('χωρίς ακμές, κάθε κόμβος είναι δική του συνιστώσα', () => {
    expect(computeConnectedComponents(3, [])).toEqual([0, 1, 2]);
  });

  it('η συνεκτικότητα είναι ΜΕΤΑΒΑΤΙΚΗ — 0–1 και 1–2 δίνουν μία συνιστώσα', () => {
    const roots = computeConnectedComponents(3, [
      { a: 0, b: 1 },
      { a: 1, b: 2 },
    ]);
    expect(roots[0]).toBe(roots[1]);
    expect(roots[1]).toBe(roots[2]);
  });

  it('δύο ξένες αλυσίδες μένουν ξένες', () => {
    const roots = computeConnectedComponents(4, [
      { a: 0, b: 1 },
      { a: 2, b: 3 },
    ]);
    expect(roots[0]).toBe(roots[1]);
    expect(roots[2]).toBe(roots[3]);
    expect(roots[0]).not.toBe(roots[2]);
  });

  it('βρόχοι και ακμές εκτός ορίων αγνοούνται αντί να καταστρέψουν τη δομή', () => {
    expect(
      computeConnectedComponents(2, [
        { a: 0, b: 0 },
        { a: 0, b: 5 },
        { a: -1, b: 1 },
      ]),
    ).toEqual([0, 1]);
  });

  it('το αποτέλεσμα ΔΕΝ εξαρτάται από τη σειρά των ακμών', () => {
    const forward = groupIndicesByComponent(5, [
      { a: 0, b: 4 },
      { a: 4, b: 2 },
      { a: 1, b: 3 },
    ]);
    const shuffled = groupIndicesByComponent(5, [
      { a: 1, b: 3 },
      { a: 4, b: 2 },
      { a: 0, b: 4 },
    ]);
    expect(forward).toEqual([
      [0, 2, 4],
      [1, 3],
    ]);
    expect(shuffled).toEqual(forward);
  });

  it('αντέχει μακριά αλυσίδα — η συμπίεση διαδρομής δεν αλλάζει το αποτέλεσμα', () => {
    const n = 2000;
    const edges = Array.from({ length: n - 1 }, (_, i) => ({ a: i, b: i + 1 }));
    const groups = groupIndicesByComponent(n, edges);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(n);
  });
});
