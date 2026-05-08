/**
 * Overlay renderer — text annotation draw.
 *
 * Text is anchored at `position` in world space. `rotation` is in radians,
 * world-space CCW from +X (math standard). After Y-flip we rotate by
 * `-rotation` so the text reads correctly. `fontSize` is in world units;
 * scaled to canvas pixels and clamped to 8-72px.
 *
 * @module components/shared/files/media/overlay-renderer/text
 * @enterprise ADR-340 §3.6 / Phase 9 STEP E
 */

import { worldToScreen } from './transform';
import type { Point2D, SceneBounds, FitTransform } from './types';

const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const DEFAULT_FONT_WORLD = 1;
const MIN_FONT_PX = 8;
const MAX_FONT_PX = 72;

export interface DrawTextStyle {
  stroke?: string;
  fill: string;
}

export interface TextInput {
  position: Point2D;
  text: string;
  fontSize?: number;
  rotation?: number;
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  input: TextInput,
  bounds: SceneBounds,
  fit: FitTransform,
  style: DrawTextStyle,
): void {
  if (!input.text) return;

  const p = worldToScreen(input.position.x, input.position.y, bounds, fit);
  const worldSize = input.fontSize ?? DEFAULT_FONT_WORLD;
  const sizePx = Math.max(MIN_FONT_PX, Math.min(MAX_FONT_PX, worldSize * fit.scale));
  const rotation = input.rotation ?? 0;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-rotation);
  ctx.font = `${sizePx}px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (style.stroke) {
    ctx.lineWidth = Math.max(2, sizePx / 8);
    ctx.strokeStyle = style.stroke;
    ctx.strokeText(input.text, 0, 0);
  }
  ctx.fillStyle = style.fill;
  ctx.fillText(input.text, 0, 0);
  ctx.restore();
}
