/**
 * Ruler corner-box renderer — extracted from `RulerRenderer.ts` for file-size
 * compliance (<500 lines). Pure draw helper (no instance state): fills the
 * bottom-left box where the two rulers meet + a subtle origin crosshair marker.
 *
 * @module rendering/ui/ruler/ruler-corner-box
 * @see ./RulerRenderer.ts
 */

import type { Viewport } from '../../types/Types';
import type { RulerSettings } from './RulerTypes';
import { RENDER_LINE_WIDTHS } from '../../../config/text-rendering-config';
import { OPACITY } from '../../../config/color-config';

/** Draws the corner box (bottom-left, όπου συναντώνται οι δύο χάρακες) + origin marker. */
export function drawRulerCornerBox(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  settings: RulerSettings
): void {
  if (!settings.enabled || !settings.visible) return;

  const verticalRulerWidth = settings.width;
  const horizontalRulerHeight = settings.height;

  // Corner box position: bottom-left where rulers meet
  const cornerRect = {
    x: 0,
    y: viewport.height - horizontalRulerHeight,
    width: verticalRulerWidth,
    height: horizontalRulerHeight
  };

  ctx.save();

  // Background - same as rulers for visual consistency
  ctx.fillStyle = settings.backgroundColor;
  ctx.fillRect(cornerRect.x, cornerRect.y, cornerRect.width, cornerRect.height);

  // Border - matches ruler borders
  if (settings.borderWidth > 0) {
    ctx.strokeStyle = settings.borderColor;
    ctx.lineWidth = settings.borderWidth;
    ctx.strokeRect(cornerRect.x, cornerRect.y, cornerRect.width, cornerRect.height);
  }

  // ✅ CAD-GRADE: Origin indicator (small crosshair or icon)
  // Draw a subtle origin marker in the center of the corner box
  const centerX = cornerRect.x + cornerRect.width / 2;
  const centerY = cornerRect.y + cornerRect.height / 2;
  const markerSize = Math.min(cornerRect.width, cornerRect.height) * 0.3;

  ctx.strokeStyle = settings.textColor || settings.color;
  ctx.lineWidth = RENDER_LINE_WIDTHS.RULER_TICK;
  ctx.globalAlpha = OPACITY.SUBTLE; // 🏢 ADR-119: Centralized opacity

  // Horizontal line of origin marker
  ctx.beginPath();
  ctx.moveTo(centerX - markerSize, centerY);
  ctx.lineTo(centerX + markerSize, centerY);
  ctx.stroke();

  // Vertical line of origin marker
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - markerSize);
  ctx.lineTo(centerX, centerY + markerSize);
  ctx.stroke();

  ctx.globalAlpha = OPACITY.OPAQUE; // 🏢 ADR-119: Centralized opacity
  ctx.restore();
}
