/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΠΟΛΟΣ ΑΠΡΟΣΠΕΛΑΣΤΟΥ** (ADR-884 Γ3γ-1) — η ετικέτα μέσα στον χώρο, όσο πιο μακριά από τους τοίχους.
 *
 * 🔒 Το «βέλτιστο» δεν το λέει ο ίδιος ο αλγόριθμος: το ελέγχει **ωμή δύναμη** σε πυκνό πλέγμα — ο πόλος πρέπει να είναι μέσα
 * και η απόσταση του να μην υπολείπεται του καλύτερου σημείου του πλέγματος περισσότερο από την ακρίβεια + το βήμα.
 */

import { distanceToRing, pointInPolygon, type PlanarPoint } from '../planar-polygon';
import { polygonLabelPoint } from '../polygon-label-point';

const rect = (w: number, h: number): PlanarPoint[] => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
/** Διάδρομος Γ, σκέλη 8 m × πλάτος 1 m — το κεντροειδές (≈ 2,37 · 2,37) πέφτει ΕΞΩ, στη γωνία που λείπει. */
const ELL: PlanarPoint[] = [
  { x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 8 }, { x: 0, y: 8 },
];

function bruteForceBest(ring: readonly PlanarPoint[], step: number): number {
  let best = 0;
  for (let x = 0; x <= 8; x += step) {
    for (let y = 0; y <= 8; y += step) {
      const p = { x, y };
      if (pointInPolygon(p, ring)) best = Math.max(best, distanceToRing(p, ring));
    }
  }
  return best;
}

describe('polygonLabelPoint', () => {
  it('ορθογώνιο ⇒ το κέντρο, clearance = μισή μικρή πλευρά', () => {
    const { point, clearance } = polygonLabelPoint(rect(6, 4), 0.001);
    expect(clearance).toBeCloseTo(2, 2);
    expect(point.y).toBeCloseTo(2, 2);
    expect(point.x).toBeGreaterThanOrEqual(2 - 0.01);
    expect(point.x).toBeLessThanOrEqual(4 + 0.01);
  });

  it('🔴 Γ-σχήμα: το κεντροειδές είναι ΕΞΩ, ο πόλος ΜΕΣΑ και όσο καλός όσο η ωμή δύναμη', () => {
    const { point, clearance } = polygonLabelPoint(ELL, 0.001);
    expect(pointInPolygon({ x: 2.37, y: 2.37 }, ELL)).toBe(false); // ≈ κεντροειδές του Γ
    expect(pointInPolygon(point, ELL)).toBe(true);
    expect(clearance).toBeCloseTo(distanceToRing(point, ELL), 9);
    expect(clearance).toBeGreaterThanOrEqual(bruteForceBest(ELL, 0.05) - 0.05);
  });

  it('η ακρίβεια τηρείται — χονδρή ακρίβεια δεν δίνει χειρότερο από όσο υπόσχεται', () => {
    const best = bruteForceBest(ELL, 0.02);
    for (const precision of [0.5, 0.1, 0.01]) {
      expect(polygonLabelPoint(ELL, precision).clearance).toBeGreaterThanOrEqual(best - precision - 0.02);
    }
  });

  it('ανεξάρτητο από τη φορά των κορυφών', () => {
    const cw = [...ELL].reverse();
    expect(polygonLabelPoint(cw, 0.001).clearance).toBeCloseTo(polygonLabelPoint(ELL, 0.001).clearance, 2);
  });

  it('εκφυλισμένο ⇒ πρώτη κορυφή, clearance 0 (ποτέ NaN)', () => {
    expect(polygonLabelPoint([{ x: 1, y: 1 }, { x: 2, y: 2 }], 0.01)).toEqual({ point: { x: 1, y: 1 }, clearance: 0 });
    expect(polygonLabelPoint([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], 0.01).clearance).toBe(0);
  });
});
