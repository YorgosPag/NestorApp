/**
 * safe-polygon-boolean.test.ts — robustness + crash-proofing του polygon-clipping
 * wrapper (ADR-396 hotfix).
 */

import type { MultiPolygon, Pair, Polygon } from 'polygon-clipping';
import { safeIntersection, safeUnion } from '../safe-polygon-boolean';

/** Άθροισμα εμβαδών μιας MultiPolygon (outer − holes) via shoelace. */
function multiPolygonArea(mp: MultiPolygon): number {
  let total = 0;
  for (const polygon of mp) {
    for (let i = 0; i < polygon.length; i++) {
      const ring = polygon[i];
      let a = 0;
      for (let j = 0; j < ring.length; j++) {
        const [x1, y1] = ring[j];
        const [x2, y2] = ring[(j + 1) % ring.length];
        a += x1 * y2 - x2 * y1;
      }
      a = Math.abs(a) / 2;
      total += i === 0 ? a : -a;
    }
  }
  return total;
}

/** Τετράγωνο [x0,y0]→[x0+w, y0+w] ως single-ring Polygon. */
function square(x0: number, y0: number, w: number): Polygon {
  return [
    [
      [x0, y0],
      [x0 + w, y0],
      [x0 + w, y0 + w],
      [x0, y0 + w],
    ] as Pair[],
  ];
}

describe('safe-polygon-boolean', () => {
  describe('safeUnion', () => {
    it('ενώνει δύο επικαλυπτόμενα meter-scale τετράγωνα χωρίς throw', () => {
      // Meter-scale coords (~0–3) — το εύρος που έσπαγε το polygon-clipping.
      const a = square(0.4, 0.2, 2); // [0.4,0.2]..[2.4,2.2]
      const b = square(1.4, 1.2, 2); // [1.4,1.2]..[3.4,3.2] (επικάλυψη)
      const merged = safeUnion(a, b);

      expect(merged.length).toBe(1); // ένα συνεκτικό σχήμα
      // Area = 2·(2²) − overlap(1²) = 8 − 1 = 7.
      expect(multiPolygonArea(merged)).toBeCloseTo(7, 4);
    });

    it('επιστρέφει αποτέλεσμα στον ΙΔΙΟ χώρο συντεταγμένων (round-trip)', () => {
      const a = square(0.5, 0.5, 1.5);
      const merged = safeUnion(a);
      const xs = merged[0][0].map((p) => p[0]);
      const ys = merged[0][0].map((p) => p[1]);
      // Πίσω στον αρχικό χώρο (όχι κλιμακωμένο στα 1e4).
      expect(Math.min(...xs)).toBeCloseTo(0.5, 4);
      expect(Math.max(...xs)).toBeCloseTo(2.0, 4);
      expect(Math.min(...ys)).toBeCloseTo(0.5, 4);
      expect(Math.max(...ys)).toBeCloseTo(2.0, 4);
    });

    it('κρατά disjoint τετράγωνα ως ξεχωριστά polygons', () => {
      const merged = safeUnion(square(0, 0, 1), square(5, 5, 1));
      expect(merged.length).toBe(2);
      expect(multiPolygonArea(merged)).toBeCloseTo(2, 4);
    });

    it('δουλεύει και σε mm-scale (μεγάλες συντεταγμένες)', () => {
      const merged = safeUnion(square(1000, 2000, 500), square(1250, 2250, 500));
      expect(merged.length).toBe(1);
      expect(multiPolygonArea(merged)).toBeCloseTo(500 * 500 * 2 - 250 * 250, 0);
    });

    it('άδειο input → κενή MultiPolygon (χωρίς throw)', () => {
      expect(safeUnion([])).toEqual([]);
    });

    it('ενώνει 50 εφαπτόμενα meter-scale τετράγωνα (N-way robustness)', () => {
      // Mirror του failing case (geomCount 50, meter span): σειρά από 50
      // εφαπτόμενα τετράγωνα πλάτους 0.25 → ΕΝΑ ορθογώνιο 12.5×0.25.
      const squares = Array.from({ length: 50 }, (_, i) => square(i * 0.25, 0, 0.25));
      const merged = safeUnion(squares[0], ...squares.slice(1));
      expect(merged.length).toBeGreaterThanOrEqual(1); // δεν κατέρρευσε σε κενό
      expect(multiPolygonArea(merged)).toBeCloseTo(50 * 0.25 * 0.25, 3); // 3.125
    });
  });

  describe('safeIntersection', () => {
    it('υπολογίζει την τομή δύο meter-scale τετραγώνων', () => {
      const covered = safeIntersection(square(0.4, 0.2, 2), square(1.4, 1.2, 2));
      expect(multiPolygonArea(covered)).toBeCloseTo(1, 4); // 1×1 overlap
    });

    it('χωρίς τομή → κενό αποτέλεσμα', () => {
      const covered = safeIntersection(square(0, 0, 1), square(10, 10, 1));
      expect(multiPolygonArea(covered)).toBeCloseTo(0, 6);
    });
  });
});
