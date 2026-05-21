// ============================================================================
// ♿ FOCUS 2D OUTLINE PAINTER — pure canvas-2d (ADR-366 Phase 4.6 / A.7.Q1)
// ============================================================================
//
// Paints a dashed cyan outline around the focused 2D entity's world-space bbox,
// projected to screen coordinates via the current `ViewTransform`. Mirrors the
// 3D `FocusOutlineRenderer` visual style (dashed cyan, depthTest=false) but
// uses the canvas-2d API on a dedicated overlay canvas.
//
// Pure function — caller owns canvas lifecycle. ADR-040 safe: never reads
// stores, never touches the bitmap cache.
// ============================================================================

import type { ViewTransform, Viewport } from '../rendering/types/Types';
import { CoordinateTransforms } from '../rendering/core/CoordinateTransforms';

const FOCUS_OUTLINE_COLOR = '#00ffff';
const FOCUS_OUTLINE_LINE_WIDTH = 1.5;
const FOCUS_OUTLINE_DASH: readonly [number, number] = [6, 4];
const FOCUS_OUTLINE_PADDING_PX = 4;

export interface Focus2DOutlineBBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Clear the canvas (CSS-space). Use before paint to avoid ghost frames. */
export function clearFocus2DOverlay(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

/** Paint a dashed cyan rectangle around the bbox. World coords → screen via transform. */
export function paintFocus2DOutline(
  canvas: HTMLCanvasElement,
  bbox: Focus2DOutlineBBox,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  const topLeftWorld = { x: bbox.minX, y: bbox.maxY };
  const bottomRightWorld = { x: bbox.maxX, y: bbox.minY };
  const topLeft = CoordinateTransforms.worldToScreen(topLeftWorld, transform, viewport);
  const bottomRight = CoordinateTransforms.worldToScreen(bottomRightWorld, transform, viewport);
  const x = Math.min(topLeft.x, bottomRight.x) - FOCUS_OUTLINE_PADDING_PX;
  const y = Math.min(topLeft.y, bottomRight.y) - FOCUS_OUTLINE_PADDING_PX;
  const w = Math.abs(bottomRight.x - topLeft.x) + FOCUS_OUTLINE_PADDING_PX * 2;
  const h = Math.abs(bottomRight.y - topLeft.y) + FOCUS_OUTLINE_PADDING_PX * 2;
  ctx.save();
  ctx.strokeStyle = FOCUS_OUTLINE_COLOR;
  ctx.lineWidth = FOCUS_OUTLINE_LINE_WIDTH;
  ctx.setLineDash([...FOCUS_OUTLINE_DASH]);
  ctx.lineCap = 'butt';
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}
