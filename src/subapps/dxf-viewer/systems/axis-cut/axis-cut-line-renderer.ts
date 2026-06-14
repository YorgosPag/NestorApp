/**
 * ADR-455 — 2D section-line overlay for the vertical X/Y cuts.
 *
 * Draws, on the DxfCanvas (above entities, below rulers), a full-viewport section
 * line at each active cut's world position plus a direction arrow pointing toward the
 * KEPT (solid) side — the side the user views, mirroring a Revit section head. The
 * cut-away side is ghosted by the renderer (see {@link axisCutGhostFactor}); this line
 * marks WHERE the cut is. Pure imperative draw — mirrors `GuideRenderer.drawGuideLine`.
 */

import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import type { AxisCutSetting } from '../../config/bim-render-settings-types';

const SECTION_LINE_WIDTH = 1.5;
const SECTION_LINE_DASH: readonly number[] = [10, 6];
const ARROW_LEN = 14;
const ARROW_HALF = 6;
/** Fallback for SSR / missing token — the ViewCube accent default (globals.css). */
const SECTION_ACCENT_FALLBACK = 'hsl(33 100% 50%)';

/**
 * Section-line colour = the SAME ViewCube accent the cut sliders use
 * (`--viewcube-accent` → `.cut-plane-slider-accent`). Read from the CSS token so the
 * line and the sliders share ONE source of truth (no hardcoded hex). Resolved only
 * when a cut is active (the caller early-returns otherwise), so it costs nothing idle.
 */
function resolveSectionAccentColor(): string {
  if (typeof document === 'undefined') return SECTION_ACCENT_FALLBACK;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--viewcube-accent').trim();
  return v ? `hsl(${v})` : SECTION_ACCENT_FALLBACK;
}

/** Render the active X/Y section lines + direction arrows. No-op when both off. */
export function renderAxisCutLines(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  const s = useBimRenderSettingsStore.getState();
  if (!s.xAxisCut.active && !s.yAxisCut.active) return;
  const color = resolveSectionAccentColor();
  if (s.xAxisCut.active) drawSectionLine(ctx, transform, viewport, 'x', s.xAxisCut, color);
  if (s.yAxisCut.active) drawSectionLine(ctx, transform, viewport, 'y', s.yAxisCut, color);
}

function drawSectionLine(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
  axis: 'x' | 'y',
  cut: AxisCutSetting,
  color: string,
): void {
  // World→screen of the cut position along its axis (the other coord is irrelevant).
  const probe: Point2D = axis === 'x' ? { x: cut.position, y: 0 } : { x: 0, y: cut.position };
  const screen = CoordinateTransforms.worldToScreen(probe, transform, viewport);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = SECTION_LINE_WIDTH;
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.setLineDash([...SECTION_LINE_DASH]);
  if (axis === 'x') {
    // Vertical screen line at constant screen-x.
    const px = pixelPerfect(screen.x);
    ctx.moveTo(px, 0);
    ctx.lineTo(px, viewport.height);
    ctx.stroke();
    drawArrow(ctx, px, viewport.height / 2, keptScreenDirX(axis, cut), 0);
  } else {
    // Horizontal screen line at constant screen-y.
    const py = pixelPerfect(screen.y);
    ctx.moveTo(0, py);
    ctx.lineTo(viewport.width, py);
    ctx.stroke();
    drawArrow(ctx, viewport.width / 2, py, 0, keptScreenDirY(cut));
  }
  ctx.restore();
}

/**
 * Screen-x direction (±1) from the line toward the KEPT side for an X cut. World X
 * grows rightward on screen, so sign +1 (keep lower X) ⇒ kept side is LEFT (−1).
 */
function keptScreenDirX(_axis: 'x' | 'y', cut: AxisCutSetting): number {
  return cut.sign === 1 ? -1 : 1;
}

/**
 * Screen-y direction (±1) from the line toward the KEPT side for a Y cut. World Y
 * grows UPWARD but screen-y grows downward (CAD y-up inversion), so sign +1 (keep
 * lower Y) ⇒ kept side is DOWN on screen (+1).
 */
function keptScreenDirY(cut: AxisCutSetting): number {
  return cut.sign === 1 ? 1 : -1;
}

/** Draw a small filled arrowhead at (cx,cy) pointing along (dirX,dirY) (unit, one axis). */
function drawArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, dirX: number, dirY: number): void {
  const tipX = cx + dirX * ARROW_LEN;
  const tipY = cy + dirY * ARROW_LEN;
  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  if (dirX !== 0) {
    // Horizontal arrow → triangle base is vertical.
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(cx, cy - ARROW_HALF);
    ctx.lineTo(cx, cy + ARROW_HALF);
  } else {
    // Vertical arrow → triangle base is horizontal.
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(cx - ARROW_HALF, cy);
    ctx.lineTo(cx + ARROW_HALF, cy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Snap to half-pixel for a crisp 1px line (mirrors the guide renderer). */
function pixelPerfect(v: number): number {
  return Math.round(v) + 0.5;
}
