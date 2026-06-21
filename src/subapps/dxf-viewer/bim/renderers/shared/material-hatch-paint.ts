/**
 * Shared material poché painter (ADR-507 Φ7) — ΕΝΑΣ canvas painter για ΟΛΟΥΣ τους
 * structural renderers (κολώνα/δοκάρι/τοίχος/θεμέλιο).
 *
 * Τα `segments` έρχονται ήδη **clipped** στο όριο από το `computeMaterialHatchSegments`
 * (μέσω `buildPredefinedHatchLines`) → ΔΕΝ χρειάζεται `ctx.clip()`. Ο painter απλώς
 * κάνει `worldToScreen` + stroke. Αντικαθιστά τα 4 αντίγραφα `paintHatchPlan`/
 * inline-draw των παλιών poché.
 *
 * @see bim/geometry/shared/material-hatch-geometry.ts
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { HatchLineSegment } from '../../geometry/shared/hatch-pattern-geometry';

/** Faint neutral stroke — η ιστορική σύμβαση structural poché (ADR-363). */
export const MATERIAL_HATCH_STROKE_RGBA = 'rgba(0, 0, 0, 0.20)';
/** Προεπιλεγμένο πάχος γραμμής poché (CSS px, zoom-invariant). */
export const MATERIAL_HATCH_LINE_WIDTH_PX = 0.5;

export interface MaterialHatchPaintStyle {
  /** Stroke (default faint neutral· wall περνά V/G + ADR-509-adapted χρώμα). */
  readonly strokeStyle?: string;
  /** Πάχος γραμμής (CSS px). */
  readonly lineWidthPx?: number;
  /** Dash (px) — wall V/G line pattern· default solid. */
  readonly dashPx?: readonly number[];
}

/**
 * Σχεδιάζει τα (ήδη clipped) pattern segments. Save/restore-balanced. Κενά → no-op.
 */
export function paintMaterialHatchSegments(
  ctx: CanvasRenderingContext2D,
  segments: readonly HatchLineSegment[],
  worldToScreen: (p: Point2D) => Point2D,
  style: MaterialHatchPaintStyle = {},
): void {
  if (segments.length === 0) return;
  ctx.save();
  ctx.strokeStyle = style.strokeStyle ?? MATERIAL_HATCH_STROKE_RGBA;
  ctx.lineWidth = style.lineWidthPx ?? MATERIAL_HATCH_LINE_WIDTH_PX;
  ctx.setLineDash(style.dashPx ? [...style.dashPx] : []);
  ctx.beginPath();
  for (const seg of segments) {
    const a = worldToScreen(seg.start);
    const b = worldToScreen(seg.end);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.restore();
}
