/**
 * ADR-455 — 2D section overlay for the vertical X/Y cuts.
 *
 * Draws, on the DxfCanvas (above entities, below rulers), for each active cut:
 *  1. a translucent FADE rectangle over the whole cut-away half-plane — so the sectioned
 *     side (grid + DXF + BIM, including entities that straddle the line) reads uniformly
 *     as a "ghost", replacing the old per-entity ghost (`axis-cut-plan-side`);
 *  2. a full-height/width section LINE at the cut's world position plus a direction arrow
 *     pointing toward the KEPT side (mirrors a Revit section head); and
 *  3. a draggable HANDLE tab on the line at the canvas edge (see `axis-cut-grip`).
 *
 * Everything is world-anchored (`worldToScreen(position)`), so it tracks pan/zoom. Pure
 * imperative draw — mirrors `GuideRenderer.drawGuideLine`.
 */

import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import { CoordinateTransforms, COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import type { AxisCutKey, AxisCutSetting } from '../../config/bim-render-settings-types';
import { getAxisCutGripRect } from './axis-cut-grip';
import { readRootCssVar, resolveDxfCanvasBackgroundHex } from '../../config/color-config';

const SECTION_LINE_WIDTH = 1.5;
const SECTION_LINE_DASH: readonly number[] = [10, 6];
const ARROW_LEN = 14;
const ARROW_HALF = 6;
const GRIP_RADIUS = 3;
/** Cut-away fade opacity → content shows at ~18% (mirrors the old per-entity ghost). */
const FADE_ALPHA = 0.82;
/** Fallback for SSR / missing token — the ViewCube accent default (globals.css). */
const SECTION_ACCENT_FALLBACK = 'hsl(33 100% 50%)';

/**
 * Section-line colour = the SAME ViewCube accent the cut sliders use
 * (`--viewcube-accent` → `.cut-plane-slider-accent`). Read from the CSS token so the
 * line and the sliders share ONE source of truth (no hardcoded hex). Resolved only
 * when a cut is active (the caller early-returns otherwise), so it costs nothing idle.
 */
function resolveSectionAccentColor(): string {
  const v = readRootCssVar('--viewcube-accent');
  return v ? `hsl(${v})` : SECTION_ACCENT_FALLBACK;
}

/**
 * Canvas background colour — the hue the fade rect blends the cut-away side toward, so it
 * fades to "empty canvas" in any theme. Reuses the `--canvas-background-dxf` SSoT resolver
 * (was an inline duplicate of `resolveDxfCanvasBackgroundHex`).
 */
function resolveCanvasBgColor(): string {
  return resolveDxfCanvasBackgroundHex();
}

/** Render the active X/Y section fade + lines + arrows + handles. No-op when both off. */
export function renderAxisCutLines(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  const s = useBimRenderSettingsStore.getState();
  if (!s.xAxisCut.active && !s.yAxisCut.active) return;
  const color = resolveSectionAccentColor();
  const bg = resolveCanvasBgColor();
  // 1) Fade the cut-away half-plane(s) first (under the line + handle).
  if (s.xAxisCut.active) drawCutAwayFade(ctx, transform, viewport, 'x', s.xAxisCut, bg);
  if (s.yAxisCut.active) drawCutAwayFade(ctx, transform, viewport, 'y', s.yAxisCut, bg);
  // 2) Section lines + direction arrows.
  if (s.xAxisCut.active) drawSectionLine(ctx, transform, viewport, 'x', s.xAxisCut, color);
  if (s.yAxisCut.active) drawSectionLine(ctx, transform, viewport, 'y', s.yAxisCut, color);
  // 3) Draggable handles on each line (on top).
  if (s.xAxisCut.active) drawGrip(ctx, transform, viewport, 'x', s.xAxisCut, color, bg);
  if (s.yAxisCut.active) drawGrip(ctx, transform, viewport, 'y', s.yAxisCut, color, bg);
}

/**
 * Translucent rectangle covering the cut-away half-plane (the side OPPOSITE the arrow),
 * clipped to the drawing area (inside the left + bottom rulers). Drawn in the canvas
 * background colour at {@link FADE_ALPHA}, so the sectioned-out grid/DXF/BIM dims to a
 * uniform ghost regardless of whether an entity straddles the line.
 */
function drawCutAwayFade(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
  axis: AxisCutKey,
  cut: AxisCutSetting,
  bg: string,
): void {
  const { left, bottom } = COORDINATE_LAYOUT.MARGINS;
  const areaLeft = left;
  const areaRight = viewport.width;
  const areaTop = 0;
  const areaBottom = viewport.height - bottom;

  const probe: Point2D = axis === 'x' ? { x: cut.position, y: 0 } : { x: 0, y: cut.position };
  const screen = CoordinateTransforms.worldToScreen(probe, transform, viewport);

  let rx: number, ry: number, rw: number, rh: number;
  if (axis === 'x') {
    const px = screen.x;
    // sign +1 keeps lower X (left) solid → cut-away is RIGHT; sign −1 → cut-away LEFT.
    if (cut.sign === 1) {
      rx = Math.max(px, areaLeft);
      rw = areaRight - rx;
    } else {
      rx = areaLeft;
      rw = Math.min(px, areaRight) - areaLeft;
    }
    ry = areaTop;
    rh = areaBottom - areaTop;
  } else {
    const py = screen.y;
    // sign +1 keeps lower Y (screen-down) solid → cut-away is UP; sign −1 → cut-away DOWN.
    if (cut.sign === 1) {
      ry = areaTop;
      rh = Math.min(py, areaBottom) - areaTop;
    } else {
      ry = Math.max(py, areaTop);
      rh = areaBottom - ry;
    }
    rx = areaLeft;
    rw = areaRight - areaLeft;
  }
  if (rw <= 0 || rh <= 0) return;

  ctx.save();
  ctx.setLineDash([]);
  ctx.globalAlpha = FADE_ALPHA;
  ctx.fillStyle = bg;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.restore();
}

/** Draw the draggable handle tab on the section line at the canvas edge. */
function drawGrip(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
  axis: AxisCutKey,
  cut: AxisCutSetting,
  color: string,
  bg: string,
): void {
  const r = getAxisCutGripRect(axis, cut, transform, viewport);
  if (!r) return;
  ctx.save();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  roundedRectPath(ctx, r.x, r.y, r.w, r.h, GRIP_RADIUS);
  ctx.fill();
  // Two short grip ticks (in the canvas bg colour) signalling draggability.
  ctx.strokeStyle = bg;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (axis === 'x') {
    const cx = r.x + r.w / 2;
    ctx.moveTo(cx - 3, r.y + 3); ctx.lineTo(cx - 3, r.y + r.h - 3);
    ctx.moveTo(cx + 3, r.y + 3); ctx.lineTo(cx + 3, r.y + r.h - 3);
  } else {
    const cy = r.y + r.h / 2;
    ctx.moveTo(r.x + 3, cy - 3); ctx.lineTo(r.x + r.w - 3, cy - 3);
    ctx.moveTo(r.x + 3, cy + 3); ctx.lineTo(r.x + r.w - 3, cy + 3);
  }
  ctx.stroke();
  ctx.restore();
}

/** Trace a rounded-rect path (manual — `ctx.roundRect` is not universally available). */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, radius: number,
): void {
  const rr = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
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
