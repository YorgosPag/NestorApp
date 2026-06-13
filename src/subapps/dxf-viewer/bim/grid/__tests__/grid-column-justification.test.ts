/**
 * ADR-441 — Tests για το column justification (3-mode → 9-position anchor).
 * @see ../grid-column-justification.ts
 */

import { gridColumnJustification } from '../grid-column-justification';
import type { ColumnAnchor } from '../../types/column-types';

describe('gridColumnJustification — 3×3 grid', () => {
  // (xi, yi) → anchor. Πλέγμα 3×3: index 0 = κάτω/αριστερά ακραίος, 2 = πάνω/δεξιά, 1 = εσωτερικός.
  describe("mode 'inner' — περιμετρικές flush προς τα μέσα (εξωτερική γωνία/ακμή στον κόμβο)", () => {
    const cases: ReadonlyArray<[number, number, ColumnAnchor]> = [
      [0, 0, 'sw'], // κάτω-αριστερά γωνία → σώμα προς ΒΑ
      [2, 0, 'se'], // κάτω-δεξιά → σώμα προς ΒΔ
      [0, 2, 'nw'], // πάνω-αριστερά → σώμα προς ΝΑ
      [2, 2, 'ne'], // πάνω-δεξιά → σώμα προς ΝΔ
      [1, 0, 's'], // κάτω ακμή
      [1, 2, 'n'], // πάνω ακμή
      [0, 1, 'w'], // αριστερή ακμή
      [2, 1, 'e'], // δεξιά ακμή
      [1, 1, 'center'], // εσωτερική → κεντραρισμένη
    ];
    it.each(cases)('(%i,%i) → %s', (xi, yi, expected) => {
      expect(gridColumnJustification(xi, 3, yi, 3, 'inner')).toBe(expected);
    });
  });

  describe("mode 'center' — όλες κεντραρισμένες", () => {
    it.each([
      [0, 0],
      [2, 0],
      [1, 1],
      [2, 2],
    ])('(%i,%i) → center', (xi, yi) => {
      expect(gridColumnJustification(xi, 3, yi, 3, 'center')).toBe('center');
    });
  });

  describe("mode 'outer' — περιμετρικές προεξέχουν (αντίστροφο του inner)", () => {
    it.each<[number, number, ColumnAnchor]>([
      [0, 0, 'ne'], // κάτω-αριστερά → σώμα προς ΝΔ (έξω)
      [2, 2, 'sw'], // πάνω-δεξιά → σώμα προς ΒΑ (έξω)
      [1, 1, 'center'], // εσωτερική πάντα center
    ])('(%i,%i) → %s', (xi, yi, expected) => {
      expect(gridColumnJustification(xi, 3, yi, 3, 'outer')).toBe(expected);
    });
  });
});

describe('gridColumnJustification — 2×2 grid (όλες περιμετρικές)', () => {
  it("inner: και οι 4 γωνιακές", () => {
    expect(gridColumnJustification(0, 2, 0, 2, 'inner')).toBe('sw');
    expect(gridColumnJustification(1, 2, 0, 2, 'inner')).toBe('se');
    expect(gridColumnJustification(0, 2, 1, 2, 'inner')).toBe('nw');
    expect(gridColumnJustification(1, 2, 1, 2, 'inner')).toBe('ne');
  });
});
