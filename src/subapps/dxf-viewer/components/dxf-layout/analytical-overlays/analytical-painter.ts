/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-552 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-552-analytical-overlay-dispatch-canvas.md
 *
 * ADR-552 — Analytical overlay dispatch canvas (7 → 1).
 *
 * Κοινός τύπος + pure frame-renderer για τον ΕΝΑ analytical καμβά. Αντικαθιστά τα 7
 * ξεχωριστά `<canvas>` analytical overlays (heat-load / pipe-sizing / hydraulic-balancing
 * / utilization / diagrams / warnings / riser-through) — βλ. ADR-551 §5.2 #1.
 *
 * **Pull model:** ο dispatch κάνει size+clear **ΜΙΑ** φορά και καλεί τους ενεργούς
 * painters με σειρά (z-order). Κάθε painter ΔΕΝ κάνει clear (αλλιώς θα σβήνανε μεταξύ
 * τους — ο λόγος που το imperative push του PreviewCanvas δεν ταιριάζει εδώ).
 */

import { getDevicePixelRatio } from '../../../systems/cursor/utils';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';

/**
 * Ζωγράφος ενός analytical layer. Λαμβάνει `transform`/`viewport` ως args (όχι capture)
 * ώστε ο painter να μένει memoized στα low-freq δεδομένα του και να μην αλλάζει
 * ταυτότητα σε κάθε pan/zoom — ο dispatch effect ξανατρέχει στο transform/viewport.
 * Ο painter ΔΕΝ κάνει clear/resize — μόνο σχεδιάζει το περιεχόμενό του.
 */
export type AnalyticalPainter = (
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
) => void;

/**
 * Size (DPR-aware) + clear ΜΙΑ φορά, μετά paint κάθε ενεργού painter με σειρά. `null`
 * painters (ανενεργό layer) παραλείπονται. Mirror του canonical pattern που είχαν τα
 * 7 overlays ξεχωριστά (`getDevicePixelRatio` → conditional resize → `setTransform` →
 * `clearRect`), τώρα μία φορά για όλους.
 */
export function paintAnalyticalFrame(
  canvas: HTMLCanvasElement,
  painters: ReadonlyArray<AnalyticalPainter | null>,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = getDevicePixelRatio();
  const w = Math.max(1, Math.round(viewport.width * dpr));
  const h = Math.max(1, Math.round(viewport.height * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewport.width, viewport.height);

  for (const paint of painters) {
    if (paint) paint(ctx, transform, viewport);
  }
}
