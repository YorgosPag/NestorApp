/**
 * ADR-929 Φ5.2ε — `weightedMedian`, η ετικέτα των ομάδων πάχους (βάρος = μήκος τοίχου).
 */

import { median, weightedMedian } from '../statistics';

describe('weightedMedian', () => {
  it('με ίσα βάρη ταυτίζεται με τον διάμεσο (μονό και ζυγό πλήθος)', () => {
    for (const values of [[3, 1, 2], [4, 1, 3, 2], [7]]) {
      expect(weightedMedian(values, values.map(() => 1))).toBe(median(values));
    }
  });

  it('το βαρύ δείγμα τραβά τον διάμεσο: ένας μακρύς τοίχος νικά πολλά κοντά κομμάτια', () => {
    expect(weightedMedian([100, 240, 250, 260], [9000, 100, 100, 100])).toBe(100);
  });

  it('ακριβής ισοβαρία ανάμεσα σε δύο τιμές ⇒ ο μέσος τους', () => {
    expect(weightedMedian([10, 20], [5, 5])).toBe(15);
  });

  it('μη θετικά βάρη αγνοούνται· κενό ή μηδενικό βάρος ⇒ 0', () => {
    expect(weightedMedian([1, 50, 99], [0, 2, -3])).toBe(50);
    expect(weightedMedian([], [])).toBe(0);
    expect(weightedMedian([5], [0])).toBe(0);
  });
});
