/**
 * Render Utility Functions
 * Basic rendering utilities for hover display
 */

import type { Point2D } from '../../rendering/types/Types';
import { UI_COLORS } from '../../config/color-config';

// 🏢 ADR-557 follow-up: the polygon area label moved to the SSoT painter
// (`rendering/entities/shared/measurement-label.ts`) — `renderAreaLabel`
// (screen-space-only, area-only) is no longer referenced by any call site.

export function renderGreenDots(ctx: CanvasRenderingContext2D, points: Point2D[]): void {
  const originalFillStyle = ctx.fillStyle;
  const originalStrokeStyle = ctx.strokeStyle;
  
  ctx.fillStyle = UI_COLORS.BRIGHT_GREEN;
  ctx.strokeStyle = UI_COLORS.BRIGHT_GREEN;
  
  // ⚡ NUCLEAR: HOVER DOTS ELIMINATED
  
  ctx.fillStyle = originalFillStyle;
  ctx.strokeStyle = originalStrokeStyle;
}