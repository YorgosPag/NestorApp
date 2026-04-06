/**
 * GUIDE ANNOTATIONS RENDERER — Dimensions & axis label bubbles
 *
 * Renders distance labels between guides and AutoCAD/Revit-style
 * grid identifier bubbles (A, B, C... / 1, 2, 3...).
 * Extracted from GuideRenderer (ADR-065).
 *
 * @module systems/guides/guide-annotations-renderer
 * @see guide-renderer.ts (orchestrator)
 */

import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type { Guide } from './guide-types';
import type { GridAxis } from '../../ai-assistant/grid-types';
import { GUIDE_COLORS } from './guide-types';
import { pixelPerfect } from '../../rendering/entities/shared/geometry-rendering-utils';
import { formatDistance } from '../../rendering/entities/shared/distance-label-utils';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Font for dimension labels — screen-space, does NOT scale with zoom */
const DIM_FONT = '11px Inter, sans-serif';
/** Tick mark length at each guide position (px) */
const DIM_TICK_SIZE = 4;
/** Text + connector opacity */
const DIM_OPACITY = 0.7;
/** Minimum screen-space gap (px) between two guides to render a label */
const DIM_MIN_GAP_PX = 30;
/** Screen offset for dimension bar from viewport edge */
const DIM_EDGE_OFFSET = 16;

/** Bubble circle radius (px, screen-space) */
const BUBBLE_RADIUS = 10;
/** Font for bubble labels */
const BUBBLE_FONT = 'bold 10px Inter, sans-serif';
/** Bubble fill color (white background) */
const BUBBLE_FILL = '#FFFFFF';
/** Bubble circle stroke width (px) */
const BUBBLE_STROKE_WIDTH = 1.5;
/** Y-position of top bubble for X (vertical) guides */
const BUBBLE_TOP_Y = 14;
/** X-position of left bubble for Y (horizontal) guides */
const BUBBLE_LEFT_X = 14;

// ============================================================================
// DIMENSION ANNOTATIONS (B3: Distance labels between guides)
// ============================================================================

/**
 * Render dimension annotations showing distances between consecutive guides.
 *
 * - X guides (vertical lines): dimension bar along the TOP edge
 * - Y guides (horizontal lines): dimension bar along the LEFT edge
 */
export function renderGuideDimensions(
  ctx: CanvasRenderingContext2D,
  guides: readonly Guide[],
  guideOffsetToScreen: (axis: GridAxis, offset: number, transform: ViewTransform, viewport: Viewport) => number,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  const xGuides: Array<{ offset: number }> = [];
  const yGuides: Array<{ offset: number }> = [];

  for (const g of guides) {
    if (!g.visible || g.axis === 'XZ') continue;
    if (g.axis === 'X') xGuides.push({ offset: g.offset });
    else yGuides.push({ offset: g.offset });
  }

  if (xGuides.length < 2 && yGuides.length < 2) return;

  ctx.save();

  xGuides.sort((a, b) => a.offset - b.offset);
  yGuides.sort((a, b) => a.offset - b.offset);

  if (xGuides.length >= 2) {
    renderAxisDimensions(ctx, xGuides, 'X', guideOffsetToScreen, transform, viewport);
  }

  if (yGuides.length >= 2) {
    renderAxisDimensions(ctx, yGuides, 'Y', guideOffsetToScreen, transform, viewport);
  }

  ctx.restore();
}

/**
 * Render dimension annotations for one axis.
 */
function renderAxisDimensions(
  ctx: CanvasRenderingContext2D,
  sortedGuides: ReadonlyArray<{ offset: number }>,
  axis: 'X' | 'Y',
  guideOffsetToScreen: (axis: GridAxis, offset: number, transform: ViewTransform, viewport: Viewport) => number,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  const color = axis === 'X' ? GUIDE_COLORS.X : GUIDE_COLORS.Y;
  const edge = DIM_EDGE_OFFSET;
  const tick = DIM_TICK_SIZE;
  const minGap = DIM_MIN_GAP_PX;

  const screenPositions: number[] = [];
  for (const g of sortedGuides) {
    screenPositions.push(guideOffsetToScreen(axis, g.offset, transform, viewport));
  }

  ctx.strokeStyle = color;
  ctx.setLineDash([]);
  ctx.globalAlpha = DIM_OPACITY;
  ctx.lineWidth = 0.5;

  ctx.font = DIM_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;

  for (let i = 0; i < screenPositions.length - 1; i++) {
    const pos1 = screenPositions[i];
    const pos2 = screenPositions[i + 1];
    const gap = Math.abs(pos2 - pos1);

    if (gap < minGap) continue;

    const worldDistance = Math.abs(sortedGuides[i + 1].offset - sortedGuides[i].offset);
    const text = formatDistance(worldDistance, 2);
    const mid = (pos1 + pos2) / 2;

    if (axis === 'X') {
      const p1 = pixelPerfect(pos1);
      const p2 = pixelPerfect(pos2);
      const yLine = edge;

      ctx.beginPath();
      ctx.moveTo(p1, yLine - tick);
      ctx.lineTo(p1, yLine + tick);
      ctx.moveTo(p2, yLine - tick);
      ctx.lineTo(p2, yLine + tick);
      ctx.moveTo(p1, yLine);
      ctx.lineTo(p2, yLine);
      ctx.stroke();

      renderDimensionLabel(ctx, text, mid, yLine - tick - 2, color);
    } else {
      const p1 = pixelPerfect(pos1);
      const p2 = pixelPerfect(pos2);
      const xLine = viewport.width - edge;

      ctx.beginPath();
      ctx.moveTo(xLine - tick, p1);
      ctx.lineTo(xLine + tick, p1);
      ctx.moveTo(xLine - tick, p2);
      ctx.lineTo(xLine + tick, p2);
      ctx.moveTo(xLine, p1);
      ctx.lineTo(xLine, p2);
      ctx.stroke();

      ctx.save();
      ctx.translate(xLine + tick + 2, mid);
      ctx.rotate(-Math.PI / 2);
      renderDimensionLabel(ctx, text, 0, 0, color);
      ctx.restore();
    }
  }
}

/**
 * Render a single dimension label (text only, no background).
 */
function renderDimensionLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = DIM_OPACITY;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// ============================================================================
// AXIS LABEL BUBBLES (B1: Revit/AutoCAD-style grid identifiers)
// ============================================================================

/**
 * Generate an auto-label for a guide based on its sorted index.
 *
 * Convention (AutoCAD/Revit structural grid standard):
 * - X guides (vertical lines): Letters A, B, C, ... Z, AA, AB, ...
 * - Y guides (horizontal lines): Numbers 1, 2, 3, ...
 */
function autoLabel(index: number, axis: 'X' | 'Y'): string {
  if (axis === 'X') {
    if (index < 26) return String.fromCharCode(65 + index);
    const first = String.fromCharCode(65 + Math.floor(index / 26) - 1);
    const second = String.fromCharCode(65 + (index % 26));
    return first + second;
  }
  return String(index + 1);
}

/**
 * Render axis label bubbles (circles with letters/numbers) at guide endpoints.
 */
export function renderGuideBubbles(
  ctx: CanvasRenderingContext2D,
  guides: readonly Guide[],
  guideOffsetToScreen: (axis: GridAxis, offset: number, transform: ViewTransform, viewport: Viewport) => number,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  const xGuides: Array<{ offset: number; label: string | null; color: string }> = [];
  const yGuides: Array<{ offset: number; label: string | null; color: string }> = [];

  for (const g of guides) {
    if (!g.visible || g.axis === 'XZ') continue;
    const color = g.style?.color ?? (g.axis === 'X' ? GUIDE_COLORS.X : GUIDE_COLORS.Y);
    if (g.axis === 'X') xGuides.push({ offset: g.offset, label: g.label, color });
    else yGuides.push({ offset: g.offset, label: g.label, color });
  }

  if (xGuides.length === 0 && yGuides.length === 0) return;

  ctx.save();

  xGuides.sort((a, b) => a.offset - b.offset);
  yGuides.sort((a, b) => a.offset - b.offset);

  for (let i = 0; i < xGuides.length; i++) {
    const screenX = guideOffsetToScreen('X', xGuides[i].offset, transform, viewport);
    if (screenX < -BUBBLE_RADIUS || screenX > viewport.width + BUBBLE_RADIUS) continue;
    const label = xGuides[i].label ?? autoLabel(i, 'X');
    drawBubble(ctx, screenX, BUBBLE_TOP_Y, label, xGuides[i].color);
  }

  const bubbleRightX = viewport.width - BUBBLE_LEFT_X;
  for (let i = 0; i < yGuides.length; i++) {
    const screenY = guideOffsetToScreen('Y', yGuides[i].offset, transform, viewport);
    if (screenY < -BUBBLE_RADIUS || screenY > viewport.height + BUBBLE_RADIUS) continue;
    const label = yGuides[i].label ?? autoLabel(i, 'Y');
    drawBubble(ctx, bubbleRightX, screenY, label, yGuides[i].color);
  }

  ctx.restore();
}

/**
 * Draw a single axis label bubble (filled circle with centered text).
 */
function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string,
): void {
  const r = BUBBLE_RADIUS;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = BUBBLE_FILL;
  ctx.globalAlpha = 0.95;
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = BUBBLE_STROKE_WIDTH;
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.stroke();

  ctx.font = BUBBLE_FONT;
  ctx.fillStyle = color;
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 0.5);
}
