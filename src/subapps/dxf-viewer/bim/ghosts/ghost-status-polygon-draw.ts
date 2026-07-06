/**
 * Ghost polygon draw SSoT (ADR-398) — neutral status-coloured schematic drawing.
 *
 * Εξήχθη από τα private `drawGhostOutline`/`drawGhostFill` του `ColumnAnchorGhostRenderer`
 * ώστε ΚΑΙ το column anchor ghost ΚΑΙ το beam 🔴 schematic ghost να ζωγραφίζουν με τον
 * ίδιο κώδικα (world→screen polygon trace). Pure ctx draw — ο caller δίνει transform/viewport.
 *
 * @see ./ghost-status-color.ts — η παλέτα (GhostStatusColor)
 * @see ../columns/ColumnAnchorGhostRenderer.ts — column consumer (outline + fill)
 * @see ../../canvas-v2/preview-canvas/PreviewRenderer.ts — beam 🔴 schematic consumer
 */

import type { ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { GhostStatusColor } from './ghost-status-color';
import { resolveStatusGhostOutline } from './ghost-status-outline';

type PolygonVertices = ReadonlyArray<{ readonly x: number; readonly y: number }>;
interface GhostViewport {
  readonly width: number;
  readonly height: number;
}

/** Χτίζει το polygon path (world→screen) — μοιραζόμενο από stroke & fill. */
function tracePolygon(
  ctx: CanvasRenderingContext2D,
  vertices: PolygonVertices,
  transform: ViewTransform,
  viewport: GhostViewport,
): void {
  ctx.beginPath();
  const first = CoordinateTransforms.worldToScreen({ x: vertices[0].x, y: vertices[0].y }, transform, viewport);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < vertices.length; i++) {
    const s = CoordinateTransforms.worldToScreen({ x: vertices[i].x, y: vertices[i].y }, transform, viewport);
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
}

/** Stroke μόνο (outline) σε world polygon. `<3` κορυφές → no-op. */
export function strokeGhostPolygon(
  ctx: CanvasRenderingContext2D,
  vertices: PolygonVertices,
  transform: ViewTransform,
  viewport: GhostViewport,
  stroke: string,
  opacity: number,
  lineWidth: number,
): void {
  if (vertices.length < 3) return;
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = opacity;
  ctx.setLineDash([]);
  tracePolygon(ctx, vertices, transform, viewport);
  ctx.stroke();
  ctx.restore();
}

/** Fill μόνο σε world polygon (το `fill` φέρει το δικό του alpha). `<3` κορυφές → no-op. */
export function fillGhostPolygon(
  ctx: CanvasRenderingContext2D,
  vertices: PolygonVertices,
  transform: ViewTransform,
  viewport: GhostViewport,
  fill: string,
): void {
  if (vertices.length < 3) return;
  ctx.save();
  ctx.fillStyle = fill;
  tracePolygon(ctx, vertices, transform, viewport);
  ctx.fill();
  ctx.restore();
}

/**
 * Status-coloured schematic polygon: fill (`color.fill` @alpha) + bold outline.
 * Το beam 🔴 ghost το χρησιμοποιεί αντί του WYSIWYG render (mirror του look του
 * active column anchor ghost — fill@30% + 2px outline).
 */
export function drawStatusGhostPolygon(
  ctx: CanvasRenderingContext2D,
  vertices: PolygonVertices,
  transform: ViewTransform,
  viewport: GhostViewport,
  color: GhostStatusColor,
  opts?: { readonly lineWidth?: number },
): void {
  fillGhostPolygon(ctx, vertices, transform, viewport, color.fill);
  strokeGhostPolygon(ctx, vertices, transform, viewport, color.stroke, 1, opts?.lineWidth ?? 2);
}

/**
 * SSoT: resolve το footprint outline μιας preview οντότητας (`resolveStatusGhostOutline`) και
 * ζωγράφισε το status-coloured schematic (`drawStatusGhostPolygon`). Επιστρέφει `true` όταν
 * ζωγράφισε (έγκυρο outline ≥3 κορυφές), `false` όταν η οντότητα δεν φέρει χρησιμοποιήσιμο outline.
 *
 * Το ΜΟΝΑΔΙΚΟ σημείο που ενώνει «resolve outline → guard → draw 🔴» — καταναλώνεται ΚΑΙ από το
 * scene preview path (`preview-entity-paint.ts`, member ghosts κολώνα/δοκάρι/τοίχος) ΚΑΙ από τα
 * direct-paint leaf hooks (`useSlabOpeningGhostPreview`), ώστε το status-schematic να μην
 * ξαναγράφεται inline (ADR-574 Σ2b).
 */
export function drawEntityStatusSchematic(
  ctx: CanvasRenderingContext2D,
  entity: unknown,
  color: GhostStatusColor,
  transform: ViewTransform,
  viewport: GhostViewport,
  opts?: { readonly lineWidth?: number },
): boolean {
  const outline = resolveStatusGhostOutline(entity);
  if (!outline || outline.length < 3) return false;
  drawStatusGhostPolygon(ctx, outline, transform, viewport, color, opts);
  return true;
}
