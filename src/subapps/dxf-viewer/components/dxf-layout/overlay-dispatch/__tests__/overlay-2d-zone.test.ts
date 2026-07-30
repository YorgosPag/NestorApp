/**
 * ADR-732 ζώνη Β — φρουρός του z-συμβολαίου του κοινού overlay καμβά.
 *
 * Η σειρά ζωγραφικής ΜΕΣΑ στον Overlay2DDispatchCanvas αντικατέστησε το compositing
 * 4 ξεχωριστών στρωμάτων (analytical z10 → envelope z11 → mep-wires z11 → proposals z14).
 * Αν κάποιος αλλάξει τη σειρά ή φιλτράρει τα null, το ορατό αποτέλεσμα ή η πύλη
 * ADR-726 Φ2 αλλάζουν σιωπηλά — αυτά τα tests κοκκινίζουν.
 */

import { composeOverlay2DPainters } from '../overlay-2d-zone';
import type { OverlayDispatchPainter } from '../overlay-dispatch-frame';

/** Painter-φάντασμα με αναγνωρίσιμη ταυτότητα για assertions σειράς. */
const painter = (label: string): OverlayDispatchPainter => {
  const fn: OverlayDispatchPainter = () => {};
  Object.defineProperty(fn, 'name', { value: label });
  return fn;
};

describe('composeOverlay2DPainters — z-συμβόλαιο ζώνης Β (ADR-732)', () => {
  const analytical = [painter('riser'), painter('heatLoad'), painter('warnings')];
  const envelope = painter('envelope');
  const wires = painter('wires');
  const proposals = [painter('water'), painter('gas')];

  it('σειρά: analytical → envelope → mep-wires → proposals (topmost)', () => {
    const out = composeOverlay2DPainters(analytical, envelope, wires, proposals);
    expect(out.map((p) => p?.name)).toEqual([
      'riser', 'heatLoad', 'warnings', // πρώην z10 — κάτω
      'envelope',                      // πρώην z11
      'wires',                         // πρώην z11, DOM μετά το envelope
      'water', 'gas',                  // πρώην z14 — πάνω (κάτω μόνο από PreviewCanvas z15)
    ]);
  });

  it('τα null διατηρούνται ΘΕΣΙΑΚΑ — κανένα φιλτράρισμα (πύλη ADR-726 Φ2)', () => {
    const out = composeOverlay2DPainters([null, analytical[0]], null, null, [null]);
    expect(out).toEqual([null, analytical[0], null, null, null]);
    expect(out).toHaveLength(5);
  });

  it('άδεια ζώνη ⇒ όλα null (η πύλη του primitive δεν θα αγγίξει τον καμβά)', () => {
    const out = composeOverlay2DPainters([null, null], null, null, [null, null]);
    expect(out.every((p) => p === null)).toBe(true);
  });
});
