/**
 * ADR-929 Δ21 (δ) Δ2 — «Εστίαση στην πηγή»: το περιθώριο γύρω από κείμενο είναι σε **ύψη κειμένου**, όχι σταθερά σε mm.
 *
 * 🔴 Μετρημένο live (DOC014): σταθερό 1500 mm γύρω από κείμενο λίγων εκατοστών (σκίτσο σε μέγεθος χαρτιού) ⇒ το πρώτο άλμα
 * ΑΠΟΜΑΚΡΥΝΕ την όψη 1:3.6 → 1:15. Το συμβόλαιο: η ΙΔΙΑ εικόνα στην οθόνη σε οποιαδήποτε κλίμακα σκηνής.
 */

import { READ_VALUE_FOCUS_PAD_TEXT_HEIGHTS, readValueFocusExtent } from '../assistant-focus';
import type { Point2D } from '../../../rendering/types/Types';

/** Πλαίσιο κειμένου w × h στη σκηνή, γωνία στο (x, y), στραμμένο κατά `angle` rad. */
function ring(x: number, y: number, w: number, h: number, angle = 0): readonly Point2D[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [[0, 0], [w, 0], [w, h], [0, h]].map(([dx, dy]) => ({ x: x + dx * c - dy * s, y: y + dx * s + dy * c }));
}

describe('readValueFocusExtent (Δ2 — περιθώριο σε ύψη κειμένου)', () => {
  it('🔴 σκίτσο σε mm χαρτιού (κείμενο 4 mm): το κουτί είναι δεκάδες mm, όχι μέτρα', () => {
    const extent = readValueFocusExtent(ring(100, 50, 16, 4));
    const pad = 4 * READ_VALUE_FOCUS_PAD_TEXT_HEIGHTS;
    expect(extent?.bounds).toEqual({ min: { x: 100 - pad, y: 50 - pad }, max: { x: 116 + pad, y: 54 + pad } });
  });

  it('βαθμονομημένη κάτοψη 1:50 (κείμενο 125 mm κτιρίου): περιθώριο ~1,25 m, όσο περίπου το παλιό 1,5 m', () => {
    const extent = readValueFocusExtent(ring(0, 0, 500, 125));
    expect(extent?.bounds.min.x).toBeCloseTo(-1250);
  });

  it('ίδια εικόνα σε κάθε κλίμακα σκηνής: κουτί ανάλογο του κειμένου (×1000 ⇒ ×1000)', () => {
    const small = readValueFocusExtent(ring(0, 0, 16, 4));
    const large = readValueFocusExtent(ring(0, 0, 16000, 4000));
    expect(large!.halfExtentM / small!.halfExtentM).toBeCloseTo(1000);
  });

  it('στραμμένη τοποθέτηση: το ύψος είναι η μικρότερη πλευρά, όχι το ύψος του αξονικού κουτιού', () => {
    const extent = readValueFocusExtent(ring(0, 0, 16, 4, Math.PI / 2));
    const pad = 4 * READ_VALUE_FOCUS_PAD_TEXT_HEIGHTS;
    expect(extent!.bounds.max.y - extent!.bounds.min.y).toBeCloseTo(16 + 2 * pad);
  });

  it('εκφυλισμένος ή κενός δακτύλιος ⇒ null (ο καλών δεν κινεί την όψη)', () => {
    expect(readValueFocusExtent([])).toBeNull();
    expect(readValueFocusExtent([{ x: 1, y: 1 }, { x: 1, y: 1 }])).toBeNull();
    expect(readValueFocusExtent(ring(Number.NaN, 0, 16, 4))).toBeNull();
  });
});
