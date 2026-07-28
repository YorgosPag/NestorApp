/**
 * ADR-726 Φ2 — overlay canvas clear-state ledger.
 *
 * Το ledger είναι η ΜΟΝΗ μνήμη πίσω από την πύλη του `paintOverlayDispatchFrame`. Δύο ιδιότητες
 * είναι κρίσιμες και ελέγχονται εδώ απομονωμένα:
 *
 *  1. **Συντηρητικό default** — άγνωστος καμβάς ⇒ «μπορεί να έχει μελάνι». Το αντίστροφο θα
 *     παρέλειπε ένα αναγκαίο clear και θα άφηνε φαντάσματα στην οθόνη.
 *  2. **Per-element** — δύο καμβάδες δεν μοιράζονται ποτέ κατάσταση.
 */

import {
  isOverlayCanvasClear,
  markOverlayCanvasCleared,
  markOverlayCanvasPainted,
} from '../overlay-canvas-clear-state';

/** Το ledger κλειδώνει σε ταυτότητα αντικειμένου· δεν αγγίζει καμία ιδιότητα του καμβά. */
function makeCanvas(): HTMLCanvasElement {
  return {} as unknown as HTMLCanvasElement;
}

describe('overlay canvas clear-state ledger (ADR-726 Φ2)', () => {
  it('θεωρεί ΜΗ καθαρό έναν καμβά που δεν έχει ξαναδεί (συντηρητικό default)', () => {
    expect(isOverlayCanvasClear(makeCanvas())).toBe(false);
  });

  it('θυμάται το clear', () => {
    const canvas = makeCanvas();
    markOverlayCanvasCleared(canvas);
    expect(isOverlayCanvasClear(canvas)).toBe(true);
  });

  it('η ζωγραφική ακυρώνει το clear', () => {
    const canvas = makeCanvas();
    markOverlayCanvasCleared(canvas);
    markOverlayCanvasPainted(canvas);
    expect(isOverlayCanvasClear(canvas)).toBe(false);
  });

  it('είναι idempotent και προς τις δύο κατευθύνσεις (N.7.2 #3)', () => {
    const canvas = makeCanvas();
    markOverlayCanvasCleared(canvas);
    markOverlayCanvasCleared(canvas);
    expect(isOverlayCanvasClear(canvas)).toBe(true);
    markOverlayCanvasPainted(canvas);
    markOverlayCanvasPainted(canvas);
    expect(isOverlayCanvasClear(canvas)).toBe(false);
  });

  it('δεν διαρρέει κατάσταση μεταξύ καμβάδων — 13 layers, 13 ανεξάρτητες απαντήσεις', () => {
    const a = makeCanvas();
    const b = makeCanvas();
    markOverlayCanvasCleared(a);
    expect(isOverlayCanvasClear(a)).toBe(true);
    expect(isOverlayCanvasClear(b)).toBe(false);

    markOverlayCanvasCleared(b);
    markOverlayCanvasPainted(a);
    expect(isOverlayCanvasClear(a)).toBe(false);
    expect(isOverlayCanvasClear(b)).toBe(true);
  });

  it('ένας νέος καμβάς ΔΕΝ κληρονομεί την κατάσταση ενός ξεφορτωμένου (remount = καθαρό φύλλο)', () => {
    const unmounted = makeCanvas();
    markOverlayCanvasCleared(unmounted);
    // Το React remount δίνει ΝΕΟ element· το ledger πρέπει να ξαναρχίσει από το ασφαλές default.
    expect(isOverlayCanvasClear(makeCanvas())).toBe(false);
  });
});
