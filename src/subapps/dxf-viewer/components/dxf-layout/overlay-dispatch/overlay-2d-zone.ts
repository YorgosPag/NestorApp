/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-732 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-732-2d-canvas-layer-consolidation.md
 *
 * ADR-732 ζώνη Β — το z-συμβόλαιο της ζώνης ως pure σύνθεση.
 *
 * Η σειρά ζωγραφικής ΜΕΣΑ στον κοινό καμβά αναπαράγει το πρώην compositing των 4
 * ξεχωριστών στρωμάτων: analytical (πρώην z10) κάτω → envelope (πρώην z11) →
 * mep-wires (πρώην z11, DOM μετά το envelope) → proposals (πρώην z14) πάνω.
 * Pure module (μηδέν React/stores) ώστε το συμβόλαιο να φρουρείται από unit test
 * χωρίς να φορτώνεται η αλυσίδα των painter hooks.
 */

import type { OverlayDispatchPainter } from './overlay-dispatch-frame';

/**
 * Flat λίστα της ζώνης Β στη σειρά ζωγραφικής του z-συμβολαίου. Τα `null` μέλη
 * διατηρούνται ΘΕΣΙΑΚΑ (η πύλη ADR-726 Φ2 του primitive βασίζεται στο «painter ή null» —
 * ΚΑΝΕΝΑ φιλτράρισμα εδώ). ΜΗΝ αλλάξεις τη σειρά χωρίς αλλαγή στο ADR-732.
 */
export function composeOverlay2DPainters(
  analytical: ReadonlyArray<OverlayDispatchPainter | null>,
  envelope: OverlayDispatchPainter | null,
  wires: OverlayDispatchPainter | null,
  proposals: ReadonlyArray<OverlayDispatchPainter | null>,
): ReadonlyArray<OverlayDispatchPainter | null> {
  return [...analytical, envelope, wires, ...proposals];
}
