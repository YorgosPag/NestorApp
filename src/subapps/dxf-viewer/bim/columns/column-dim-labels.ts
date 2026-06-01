/**
 * ADR-363 Phase 8F — Column permanent dimension labels.
 *
 * Revit-style: when a column is selected or hovered, a centred pill label
 * appears directly on the column footprint (NOT a floating tooltip).
 *
 * `formatColumnDimLabels` is the SSoT for the label text per kind.
 * `drawColumnDimPill` renders the centred pill on a canvas context.
 *
 * Label format per kind:
 *   rectangular  → "w=400  d=400"
 *   circular     → "Ø=400"
 *   shear-wall   → "L=2000  t=200"
 *   I-shape      → "b=150  h=300"
 *   polygon      → "Ø=400  N=6"
 *   L-shape      → "w=400  d=400"
 *   T-shape      → "w=400  d=400"
 *   U-shape      → "w=400  d=400"   (τοιχείο ΟΣ, ADR-363 Phase 2)
 *   composite    → "w=400  d=400"   (σύνθετη διατομή, ADR-363 Phase 2)
 *
 * When `params.catalogProfile` is set, it is prepended as the first line
 * (e.g. ["IPE-300", "b=150  h=300"]).
 *
 * @see ADR-363 §5.6 Phase 8F
 */

import type { ColumnParams } from '../types/column-types';
import { DEFAULT_POLYGON_SIDES } from '../types/column-types';
import {
  PILL_FONT,
  PILL_TEXT_COLOR,
  PILL_BG_COLOR,
  PILL_PADDING,
  PILL_RADIUS,
  pillPath,
} from '../../rendering/utils/canvas-pill';

/** Hide label when the screen bounding-box span is smaller than this (px). */
export const COLUMN_LABEL_MIN_FOOTPRINT_PX = 20;

const LINE_HEIGHT = 11;

/**
 * Returns the ordered array of label lines for the column.
 * All measurements are rounded to integer mm.
 * Returns `[]` when `params.kind` is unrecognised.
 */
export function formatColumnDimLabels(params: ColumnParams): string[] {
  const w = Math.round(params.width);
  const d = Math.round(params.depth);
  const prefix = params.catalogProfile ? [params.catalogProfile] : [];

  switch (params.kind) {
    case 'rectangular': return [...prefix, `w=${w}  d=${d}`];
    case 'circular':    return [...prefix, `Ø=${w}`];
    case 'shear-wall':  return [...prefix, `L=${w}  t=${d}`];
    case 'I-shape':     return [...prefix, `b=${w}  h=${d}`];
    case 'polygon': {
      const sides = params.polygon?.sides ?? DEFAULT_POLYGON_SIDES;
      return [...prefix, `Ø=${w}  N=${sides}`];
    }
    case 'L-shape':     return [...prefix, `w=${w}  d=${d}`];
    case 'T-shape':     return [...prefix, `w=${w}  d=${d}`];
    // ADR-363 Phase 2 «από περίγραμμα» — τοιχία ΟΣ· bbox w/d (πολύγωνο = SSoT γεωμετρίας).
    case 'U-shape':     return [...prefix, `w=${w}  d=${d}`];
    case 'composite':   return [...prefix, `w=${w}  d=${d}`];
    default:            return [];
  }
}

/**
 * Draws a centred pill label at screen position `(cx, cy)`.
 * Multi-line: each element in `lines` is stacked vertically.
 * Pure canvas draw — no React, no stores (ADR-040 compliant).
 */
export function drawColumnDimPill(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  cx: number,
  cy: number,
): void {
  if (lines.length === 0) return;
  ctx.save();
  ctx.font = PILL_FONT;
  const pillW = Math.max(...lines.map((l) => ctx.measureText(l).width)) + PILL_PADDING * 2;
  const pillH = LINE_HEIGHT * lines.length + PILL_PADDING * 2;
  const x = cx - pillW / 2;
  const y = cy - pillH / 2;
  pillPath(ctx, x, y, pillW, pillH, PILL_RADIUS);
  ctx.fillStyle = PILL_BG_COLOR;
  ctx.fill();
  ctx.fillStyle = PILL_TEXT_COLOR;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, y + PILL_PADDING + i * LINE_HEIGHT);
  }
  ctx.restore();
}
