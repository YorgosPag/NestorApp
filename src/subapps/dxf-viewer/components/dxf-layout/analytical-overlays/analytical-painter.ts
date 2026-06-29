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

// ADR-554 — the frame renderer is now the SHARED `paintOverlayDispatchFrame` (one SSoT for both
// the analytical dispatch canvas and the MEP proposal dispatch canvas, no duplicate). The names
// below are kept as analytical-domain aliases so the 7 analytical painter hooks + dispatch +
// test import unchanged.
import { paintOverlayDispatchFrame, type OverlayDispatchPainter } from '../overlay-dispatch/overlay-dispatch-frame';

/** Analytical layer painter — alias of the shared {@link OverlayDispatchPainter}. */
export type AnalyticalPainter = OverlayDispatchPainter;

/** Analytical dispatch frame renderer — alias of the shared {@link paintOverlayDispatchFrame}. */
export const paintAnalyticalFrame = paintOverlayDispatchFrame;
