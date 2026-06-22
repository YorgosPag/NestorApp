/**
 * rect-grid-paint — ζωγραφίζει το **καρτεσιανό πλέγμα** του Cartesian Magnet (ADR-398 §3.15) στο
 * PreviewCanvas overlay: γραμμές πλέγματος (κατά τους local άξονες u/v) + κέντρο (σταυρός).
 *
 * Full SSoT, μηδέν bespoke style: `applyOverlayLineStyle`+`OVERLAY_LINE_COLORS.listeningDim`+
 * `strokeOverlaySegment` (το ΙΔΙΟ 0.5px dashed cyan με τον πολικό painter + τα listening dims).
 * Δουλεύει για **λοξά** ορθογώνια (οι γραμμές προβάλλονται κατά u/v). Called AFTER `drawPreview`·
 * wiped στο επόμενο `drawPreview`/`clear`. Zero-React, immediate paint (ADR-040).
 *
 * @see ../../bim/columns/rect-cartesian-snap.ts — `buildRectGrid` (παράγει το `RectGrid` meta)
 * @see ./polar-disk-paint.ts — το πολικό αδελφό (ίδια overlay σύμβαση)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.15
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { RectGrid } from '../../bim/columns/rect-cartesian-snap';
import { rectLocalToWorld } from '../../bim/framing/rect-frame';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { applyOverlayLineStyle, OVERLAY_LINE_COLORS, strokeOverlaySegment } from './overlay-line-style';

type Viewport = { readonly width: number; readonly height: number };

/** Μισό μήκος (screen px) του σταυρού κέντρου. */
const CENTER_CROSS_PX = 6;

/**
 * Ζωγράφισε το καρτεσιανό πλέγμα (γραμμές κατά u/v + κέντρο). Άδειο grid → no-op.
 */
export function paintRectGrid(
  ctx: CanvasRenderingContext2D,
  grid: RectGrid,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  if (grid.xs.length === 0 && grid.ys.length === 0) return;
  const toScreen = (p: Point2D): Point2D => CoordinateTransforms.worldToScreen(p, transform, viewport);
  applyOverlayLineStyle(ctx, OVERLAY_LINE_COLORS.listeningDim);

  // Κατακόρυφες (κατά v) στις θέσεις xs· οριζόντιες (κατά u) στις θέσεις ys.
  for (const x of grid.xs) strokeOverlaySegment(ctx, toScreen(rectLocalToWorld(grid, x, -grid.halfV)), toScreen(rectLocalToWorld(grid, x, grid.halfV)));
  for (const y of grid.ys) strokeOverlaySegment(ctx, toScreen(rectLocalToWorld(grid, -grid.halfW, y)), toScreen(rectLocalToWorld(grid, grid.halfW, y)));

  // Κέντρο = μικρός σταυρός σε σταθερό screen μέγεθος (zoom-invariant).
  const c = toScreen(grid.center);
  strokeOverlaySegment(ctx, { x: c.x - CENTER_CROSS_PX, y: c.y }, { x: c.x + CENTER_CROSS_PX, y: c.y });
  strokeOverlaySegment(ctx, { x: c.x, y: c.y - CENTER_CROSS_PX }, { x: c.x, y: c.y + CENTER_CROSS_PX });
}
