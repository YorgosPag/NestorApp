/* eslint-disable design-system/no-hardcoded-colors */
/**
 * Overlay renderer — in-polygon hover label.
 *
 * Centered 3-line text drawn at the polygon vertex centroid. White fill +
 * black outline for max readability against any underlying color. Lines:
 *   1. primary  (12px regular)  — e.g. property code
 *   2. secondary (12px regular) — e.g. "85 τ.μ."
 *   3. emphasis  (18px bold)    — e.g. "€ 150.000"
 *
 * @module components/shared/files/media/overlay-renderer/label
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

import { worldToScreen } from './transform';
import type { Point2D, SceneBounds, FitTransform, OverlayLabel } from './types';

const LABEL_FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const LABEL_BASE_FONT_PX = 16;
const LABEL_EMPHASIS_FONT_PX = 24;
const LABEL_LINE_GAP_PX = 6;

/** Compute screen-space centroid of a vertex array (vertex average). */
export function polygonScreenCentroid(
  vertices: ReadonlyArray<Point2D>,
  bounds: SceneBounds,
  fit: FitTransform,
): { x: number; y: number } | null {
  if (vertices.length < 3) return null;
  let sx = 0;
  let sy = 0;
  for (const v of vertices) {
    const s = worldToScreen(v.x, v.y, bounds, fit);
    sx += s.x;
    sy += s.y;
  }
  return { x: sx / vertices.length, y: sy / vertices.length };
}

/** Render a 3-line label centered at the polygon centroid. */
export function renderOverlayLabel(
  ctx: CanvasRenderingContext2D,
  vertices: ReadonlyArray<Point2D>,
  bounds: SceneBounds,
  fit: FitTransform,
  label: OverlayLabel,
): void {
  const center = polygonScreenCentroid(vertices, bounds, fit);
  if (!center) return;

  const lines = collectLines(label);
  if (lines.length === 0) return;

  const totalHeight =
    lines.reduce((acc, l) => acc + l.sizePx, 0) + LABEL_LINE_GAP_PX * (lines.length - 1);
  let cursorY = center.y - totalHeight / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineJoin = 'round';

  for (const line of lines) {
    const weight = line.bold ? '700' : '500';
    ctx.font = `${weight} ${line.sizePx}px ${LABEL_FONT_FAMILY}`;
    ctx.lineWidth = line.bold ? 4 : 3;
    ctx.strokeText(line.text, center.x, cursorY);
    ctx.fillText(line.text, center.x, cursorY);
    cursorY += line.sizePx + LABEL_LINE_GAP_PX;
  }
  ctx.restore();
}

interface RenderLine {
  text: string;
  sizePx: number;
  bold: boolean;
}

function collectLines(label: OverlayLabel): RenderLine[] {
  const lines: RenderLine[] = [];
  if (label.primaryText) lines.push({ text: label.primaryText, sizePx: LABEL_BASE_FONT_PX, bold: false });
  if (label.secondaryText) lines.push({ text: label.secondaryText, sizePx: LABEL_BASE_FONT_PX, bold: false });
  if (label.emphasisText) lines.push({ text: label.emphasisText, sizePx: LABEL_EMPHASIS_FONT_PX, bold: true });
  return lines;
}
