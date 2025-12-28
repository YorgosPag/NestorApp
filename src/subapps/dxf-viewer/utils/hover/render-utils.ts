/**
 * Render Utility Functions
 * Basic rendering utilities for hover display
 */

import { HOVER_CONFIG } from './config';
import type { Point2D } from '../../rendering/types/Types';
import { UI_COLORS } from '../../config/color-config';

export function renderAreaLabel(ctx: CanvasRenderingContext2D, x: number, y: number, area: number): void {
  const text = area.toFixed(2);
  
  ctx.save();
  ctx.translate(x, y);
  
  // Set text style 
  ctx.fillStyle = HOVER_CONFIG.colors.area;
  ctx.font = HOVER_CONFIG.fonts.area;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

export function renderGreenDots(ctx: CanvasRenderingContext2D, points: Point2D[]): void {
  const originalFillStyle = ctx.fillStyle;
  const originalStrokeStyle = ctx.strokeStyle;
  
  ctx.fillStyle = UI_COLORS.BRIGHT_GREEN;
  ctx.strokeStyle = UI_COLORS.BRIGHT_GREEN;
  
  // ⚡ NUCLEAR: HOVER DOTS ELIMINATED
  
  ctx.fillStyle = originalFillStyle;
  ctx.strokeStyle = originalStrokeStyle;
}