/**
 * alignment-guide-paint — ζωγραφίζει τη **γραμμή-οδηγό ευθυγράμμισης** (ADR-398 §3.20) στο PreviewCanvas
 * overlay: ένα dashed world τμήμα στο **άκρο/μέσον** της παρειάς, όταν το **τεταρτημόριο** της κυκλικής
 * κολόνας κουμπώνει εκεί (Revit alignment line).
 *
 * Full SSoT, μηδέν bespoke style: γραμμή → `applyOverlayLineStyle` + `OVERLAY_LINE_COLORS.drawingGuide`
 * (0.5px dashed orange) — ΙΔΙΟ overlay style με την polar tracking line. Called AFTER `drawPreview`
 * (overlays το ghost)· wiped στο επόμενο `drawPreview`/`clear`. Zero-React, immediate paint (ADR-040).
 *
 * @see ./polar-tracking-line-paint.ts — ίδια overlay σύμβαση + στυλ
 * @see ../../bim/columns/column-tangent-snap.ts — PlacementAlignmentGuide (η πηγή του τμήματος)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.20
 */

import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type { PlacementAlignmentGuide } from '../../bim/columns/column-tangent-snap';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { applyOverlayLineStyle, OVERLAY_LINE_COLORS } from './overlay-line-style';

/**
 * Ζωγράφισε τη γραμμή-οδηγό ευθυγράμμισης (world segment → screen). Called AFTER `drawPreview` ώστε να
 * overlay-άρει το ghost χωρίς να το καθαρίζει· το επόμενο `drawPreview` το σβήνει αυτόματα.
 */
export function paintAlignmentGuide(
  ctx: CanvasRenderingContext2D,
  guide: PlacementAlignmentGuide,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  const a = CoordinateTransforms.worldToScreen(guide.a, transform, viewport);
  const b = CoordinateTransforms.worldToScreen(guide.b, transform, viewport);
  ctx.save();
  applyOverlayLineStyle(ctx, OVERLAY_LINE_COLORS.drawingGuide); // SSoT: 0.5px dashed [8,5], ORANGE
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}
