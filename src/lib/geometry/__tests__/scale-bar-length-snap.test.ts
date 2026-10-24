/**
 * ADR-920 Β4.8 — `snapScaleBarLength` στο ΕΝΑ σπίτι του (`@/lib/geometry`).
 *
 * Ο βασικός πίνακας «9.37 → 10» ζει ήδη στο `dxf-viewer/.../scale-bar-geometry.test.ts`
 * (μέσω της επανεξαγωγής). Εδώ κλειδώνεται ό,τι εκείνος ΔΕΝ ρωτά: τα ακριβή σύνορα των
 * κατωφλίων √2 · √10 · √50, οι ακραίες δεκάδες, το άπειρο, και ότι η έξοδος είναι
 * πάντα {1, 2, 5} × 10ⁿ ανεξαρτήτως κλίμακας.
 */

import { snapScaleBarLength } from '../scale-bar-length-snap';

/** Η μάντισσα μιας θετικής τιμής, κανονικοποιημένη στο [1, 10). */
function mantissa(value: number): number {
  return value / Math.pow(10, Math.floor(Math.log10(value)));
}

describe('snapScaleBarLength — σύνορα των κατωφλίων (γεωμετρικοί μέσοι)', () => {
  it.each<[number, number]>([
    [1.414, 1],
    [1.415, 2],
    [3.162, 2],
    [3.163, 5],
    [7.071, 5],
    [7.072, 10],
  ])('%f → %f', (raw, expected) => {
    expect(snapScaleBarLength(raw)).toBeCloseTo(expected, 9);
  });
});

describe('snapScaleBarLength — ακραίες δεκάδες', () => {
  it.each<[number, number]>([
    [0.0037, 0.005],
    [0.00012, 0.0001],
    [3.7e6, 5e6],
    [1.2e9, 1e9],
  ])('%f → %f', (raw, expected) => {
    expect(snapScaleBarLength(raw) / expected).toBeCloseTo(1, 9);
  });
});

describe('snapScaleBarLength — εκφυλισμένη είσοδος', () => {
  it('το άπειρο δίνει 0 («καμία κλίμακα»), όχι άπειρη μπάρα', () => {
    expect(snapScaleBarLength(Number.POSITIVE_INFINITY)).toBe(0);
    expect(snapScaleBarLength(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('snapScaleBarLength — αναλλοίωτο ως προς τη δεκάδα', () => {
  const samples = [1.05, 1.9, 2.4, 3.5, 4.8, 6.6, 8.9, 9.99];

  it('η έξοδος είναι πάντα {1, 2, 5} × 10ⁿ', () => {
    for (const k of [-4, -1, 0, 2, 6]) {
      for (const s of samples) {
        const m = mantissa(snapScaleBarLength(s * Math.pow(10, k)));
        expect([1, 2, 5].some((nice) => Math.abs(m - nice) < 1e-9)).toBe(true);
      }
    }
  });

  it('snap(x · 10ᵏ) = snap(x) · 10ᵏ', () => {
    for (const k of [-3, 1, 4]) {
      for (const s of samples) {
        const scaled = snapScaleBarLength(s * Math.pow(10, k));
        expect(scaled / (snapScaleBarLength(s) * Math.pow(10, k))).toBeCloseTo(1, 9);
      }
    }
  });
});
