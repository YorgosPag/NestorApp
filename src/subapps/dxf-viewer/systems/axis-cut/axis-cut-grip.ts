/**
 * ADR-455 — on-canvas drag-handle geometry for the vertical X/Y section cuts.
 *
 * SSoT for WHERE the section-line handle sits on screen, shared by the 2D overlay
 * renderer (which draws it) and the mouse pipeline (which hit-tests it on pointer-down).
 * The handle is a small tab anchored to the canvas EDGE on the section line: the X cut's
 * vertical line carries its tab on the bottom edge (above the horizontal ruler); the Y
 * cut's horizontal line carries its tab on the left edge (right of the vertical ruler).
 * It is world-anchored via `worldToScreen(position)`, so it tracks pan/zoom together with
 * the line — the redesign that replaced the Radix normalized slider, whose thumb could
 * not align with a world-anchored line.
 *
 * Pure (apart from reading the cut SSoT in the hit-test) so the geometry is unit-testable.
 */

import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import { CoordinateTransforms, COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import type { AxisCutKey, AxisCutSetting } from '../../config/bim-render-settings-types';

/** Screen rectangle (top-left origin, CSS pixels). */
export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Tab extent ALONG the cut's drag axis (long side — easy to grab + slide). */
export const AXIS_CUT_GRIP_LONG = 34;
/** Tab extent ACROSS the section line (short side). */
export const AXIS_CUT_GRIP_SHORT = 16;
/** Gap between the tab and the ruler edge it rests against. */
const EDGE_GAP = 4;
/** Extra hit-test padding around the visible tab for forgiving grabs. */
const HIT_PAD = 6;
/** Perpendicular pixel tolerance for grabbing the section LINE anywhere (Revit-style). */
const LINE_GRAB_TOL = 7;

/**
 * Screen position of the cut along its axis (the other coord is irrelevant): the screen-x
 * of a vertical X cut, or the screen-y of a horizontal Y cut.
 */
export function cutScreenCoord(
  axis: AxisCutKey,
  cut: AxisCutSetting,
  transform: ViewTransform,
  viewport: Viewport,
): number {
  const probe: Point2D = axis === 'x' ? { x: cut.position, y: 0 } : { x: 0, y: cut.position };
  const s = CoordinateTransforms.worldToScreen(probe, transform, viewport);
  return axis === 'x' ? s.x : s.y;
}

function clampNum(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The handle's screen rect for one axis cut, or `null` when the viewport is degenerate.
 * X cut → vertical line at screen-x → tab on the bottom edge, centred on the line, wide
 * along the horizontal drag axis. Y cut → horizontal line at screen-y → tab on the left
 * edge, centred on the line, tall along the vertical drag axis.
 *
 * The tab's along-line coordinate is **clamped to the visible drawing area** so the handle
 * stays reachable at any zoom/pan even when the section line itself scrolls off-screen
 * (the line stays world-anchored; only the handle follows the screen — grab it at the edge
 * and drag to pull the cut back into view).
 */
export function getAxisCutGripRect(
  axis: AxisCutKey,
  cut: AxisCutSetting,
  transform: ViewTransform,
  viewport: Viewport,
): ScreenRect | null {
  if (!viewport.width || !viewport.height) return null;
  const { left, bottom } = COORDINATE_LAYOUT.MARGINS;
  if (axis === 'x') {
    const px = cutScreenCoord('x', cut, transform, viewport);
    // Clamp the tab centre to [left … right] of the drawing area (right ruler width = 0).
    const cx = clampNum(px, left + AXIS_CUT_GRIP_LONG / 2, viewport.width - AXIS_CUT_GRIP_LONG / 2);
    const cy = viewport.height - bottom - EDGE_GAP - AXIS_CUT_GRIP_SHORT / 2;
    return {
      x: cx - AXIS_CUT_GRIP_LONG / 2,
      y: cy - AXIS_CUT_GRIP_SHORT / 2,
      w: AXIS_CUT_GRIP_LONG,
      h: AXIS_CUT_GRIP_SHORT,
    };
  }
  const py = cutScreenCoord('y', cut, transform, viewport);
  const cx = left + EDGE_GAP + AXIS_CUT_GRIP_SHORT / 2;
  // Clamp the tab centre to [top … bottom] of the drawing area (above the bottom ruler).
  const cy = clampNum(py, AXIS_CUT_GRIP_LONG / 2, viewport.height - bottom - AXIS_CUT_GRIP_LONG / 2);
  return {
    x: cx - AXIS_CUT_GRIP_SHORT / 2,
    y: cy - AXIS_CUT_GRIP_LONG / 2,
    w: AXIS_CUT_GRIP_SHORT,
    h: AXIS_CUT_GRIP_LONG,
  };
}

/** Point-in-rect with symmetric padding. */
function pointInRect(p: Point2D, r: ScreenRect, pad: number): boolean {
  return (
    p.x >= r.x - pad &&
    p.x <= r.x + r.w + pad &&
    p.y >= r.y - pad &&
    p.y <= r.y + r.h + pad
  );
}

/** True when `screenPos` is within {@link LINE_GRAB_TOL} of the cut's section line. */
function nearSectionLine(
  axis: AxisCutKey,
  cut: AxisCutSetting,
  screenPos: Point2D,
  transform: ViewTransform,
  viewport: Viewport,
): boolean {
  const c = cutScreenCoord(axis, cut, transform, viewport);
  // X cut → vertical line at screen-x = c; Y cut → horizontal line at screen-y = c.
  return axis === 'x'
    ? Math.abs(screenPos.x - c) <= LINE_GRAB_TOL
    : Math.abs(screenPos.y - c) <= LINE_GRAB_TOL;
}

/**
 * Which active section-cut handle (if any) lies under `screenPos`. Only ACTIVE cuts match.
 * A grab counts when the pointer is on the handle tab OR anywhere along the section line
 * (Revit-style — the whole line is draggable), so the control is easy to find. X is tested
 * before Y; in the rare both-active overlap at the lines' crossing, X wins (arbitrary).
 */
export function hitTestAxisCutGrip(
  screenPos: Point2D,
  transform: ViewTransform,
  viewport: Viewport,
): AxisCutKey | null {
  const s = useBimRenderSettingsStore.getState();
  if (s.xAxisCut.active) {
    const r = getAxisCutGripRect('x', s.xAxisCut, transform, viewport);
    if (r && pointInRect(screenPos, r, HIT_PAD)) return 'x';
    if (nearSectionLine('x', s.xAxisCut, screenPos, transform, viewport)) return 'x';
  }
  if (s.yAxisCut.active) {
    const r = getAxisCutGripRect('y', s.yAxisCut, transform, viewport);
    if (r && pointInRect(screenPos, r, HIT_PAD)) return 'y';
    if (nearSectionLine('y', s.yAxisCut, screenPos, transform, viewport)) return 'y';
  }
  return null;
}
