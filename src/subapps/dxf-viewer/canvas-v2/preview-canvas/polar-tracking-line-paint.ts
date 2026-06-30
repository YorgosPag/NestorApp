/**
 * polar-tracking-line-paint — ζωγραφίζει τη **γραμμή πολικής στόχευσης** (ADR-357 Phase 1) στο
 * PreviewCanvas overlay: μια εκτεταμένη dashed ακτίνα από το reference σημείο προς τη snapped γωνία +
 * tooltip κοντά στον cursor.
 *
 * Full SSoT, μηδέν bespoke style:
 *   · γραμμή → `applyOverlayLineStyle` + `OVERLAY_LINE_COLORS.drawingGuide` (0.5px dashed orange)·
 *   · γωνία→διεύθυνση → `degToRad` (screen Y flip)·
 *   · tooltip → `drawOverlayLabel` (ίδιο overlay label SSoT).
 *
 * Called AFTER `drawPreview` (overlays το ghost)· wiped στο επόμενο `drawPreview`/`clear`. Zero-React,
 * immediate paint (ADR-040) — δέχεται έτοιμο `ViewTransform` + viewport (ίδια σύμβαση με
 * `paintGhostFaceDimensions` / `paintPolarDisk`). Screen-space μέσω `CoordinateTransforms.worldToScreen`.
 *
 * @see ./polar-disk-paint.ts — ίδια overlay σύμβαση (paint μετά το ghost)
 * @see docs/centralized-systems/reference/adrs/ADR-357-object-snap-tracking.md
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';
import { applyOverlayLineStyle, OVERLAY_LINE_COLORS } from './overlay-line-style';
import { drawOverlayLabel, CURSOR_LABEL_SLOTS } from './overlay-text-style';

/** Μήκος προέκτασης της ακτίνας σε screen px (αρκετό ώστε να καλύπτει όλο το viewport). */
const EXTEND = 6000;

/**
 * Ζωγράφισε τη γραμμή πολικής στόχευσης + tooltip. Called AFTER `drawPreview` ώστε να overlay-άρει το
 * ghost χωρίς να το καθαρίζει· το επόμενο `drawPreview` το σβήνει αυτόματα.
 */
export function paintPolarTrackingLine(
  ctx: CanvasRenderingContext2D,
  ref: Point2D,
  snappedAngle: number,
  label: string,
  cursorWorld: Point2D,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  const refScreen = CoordinateTransforms.worldToScreen(ref, transform, viewport);
  const cursorScreen = CoordinateTransforms.worldToScreen(cursorWorld, transform, viewport);

  // Direction in screen space — flip Y since screen Y is down
  const rad = degToRad(snappedAngle);
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad);

  ctx.save();
  applyOverlayLineStyle(ctx, OVERLAY_LINE_COLORS.drawingGuide); // SSoT: 0.5px dashed [8,5], ORANGE
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(refScreen.x, refScreen.y);
  ctx.lineTo(refScreen.x + dx * EXTEND, refScreen.y + dy * EXTEND);
  ctx.stroke();
  ctx.restore();

  // Tooltip near cursor — SSoT overlay label (font only), ORANGE to match the guide line.
  // ΠΑΝΩ-δεξιά slot (CURSOR_LABEL_SLOTS.above) ώστε να μη συγκρούεται με το object-snap-tracking
  // tooltip που πιάνει το ΚΑΤΩ slot (Giorgio 2026-06-30).
  drawOverlayLabel(ctx, label, cursorScreen.x + CURSOR_LABEL_SLOTS.above.dx, cursorScreen.y + CURSOR_LABEL_SLOTS.above.dy, {
    textColor: OVERLAY_LINE_COLORS.drawingGuide,
    align: 'left',
  });
}
