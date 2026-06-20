/**
 * SSOT — ghost-preview-frame (ADR-398 §4 — preview-render unification)
 *
 * **ΕΝΑ canonical "preview frame"** που διαβάζουν ΟΛΑ τα RAF-direct ghost previews.
 *
 * Ρίζα που λύνει: μέχρι τώρα κάθε ghost-preview hook έλυνε ΜΟΝΟΣ του «ποιο είναι το
 * viewport / transform» — άλλος διάβαζε `PreviewCanvas.getBoundingClientRect()`,
 * άλλος `DxfCanvas` rect, άλλος React-prop transform. Αυτή η απόκλιση γέννησε το
 * beam-ghost +Y offset (ADR-398 §3.4) και ένα latent transform-lag (τα previews
 * έβλεπαν React-prop transform ενώ ο main canvas + τα ProposalGhostOverlay διαβάζουν
 * live `getImmediateTransform()` → 1-2 frames καθυστέρηση σε pan/zoom).
 *
 * Λύση: ΜΙΑ πηγή —
 *   - **viewport**: `canvasBoundsService.getBounds(viewportElement)` (cached DOMRect,
 *     ΙΔΙΑ πηγή με τον main `DxfRenderer.render`) → μηδέν per-frame reflow + ταυτόσημο
 *     με την committed οντότητα.
 *   - **transform**: live `getImmediateTransform()` (zero-lag singleton, ΙΔΙΟ με τον
 *     main canvas) → το ghost ακολουθεί το pan/zoom χωρίς lag.
 *
 * @see hooks/tools/useCanvasGhostPreview — ο harness που καταναλώνει αυτό το SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §4
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { getImmediateTransform } from '../cursor/ImmediateTransformStore';
import { canvasBoundsService } from '../../services/CanvasBoundsService';

/**
 * Uniform frame που περνά ο harness σε κάθε ghost `draw` delegate. Το `ctx` μπαίνει
 * εδώ (όχι στον constructor) ώστε το delegate να είναι ένα απλό closure χωρίς
 * instantiation κόστος ανά frame.
 */
export interface GhostDrawFrame {
  readonly ctx: CanvasRenderingContext2D;
  /** World-space cursor (snapped αν ζητηθεί)· `null` όταν `cursorMode: 'none'`. */
  readonly effectiveCursor: Point2D | null;
  readonly viewport: Viewport;
  readonly transform: ViewTransform;
}

/** Uniform delegate — κάθε ghost preview δίνει ΜΟΝΟ τη δική του draw logic. */
export type GhostDrawDelegate = (frame: GhostDrawFrame) => void;

/** Το canonical ζευγάρι viewport+transform για ένα preview frame. */
export interface CanonicalPreviewFrame {
  readonly viewport: Viewport;
  readonly transform: ViewTransform;
}

/**
 * Επιστρέφει το canonical viewport (cached bounds του `viewportElement` — κανονικά
 * του DxfCanvas, ΙΔΙΟ με τον main render) + το live transform. ΜΙΑ πηγή για όλα τα
 * preview paths ώστε να μην ξανα-αποκλίνουν.
 */
export function getCanonicalPreviewFrame(
  viewportElement: HTMLCanvasElement,
): CanonicalPreviewFrame {
  const rect = canvasBoundsService.getBounds(viewportElement);
  return {
    viewport: { width: rect.width, height: rect.height },
    transform: getImmediateTransform(),
  };
}
