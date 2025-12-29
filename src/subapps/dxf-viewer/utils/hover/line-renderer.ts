/**
 * Line Hover Renderer
 * Handles hover rendering for line entities with distance measurements
 */

import { HOVER_CONFIG } from './config';
import type { Point2D } from '../../rendering/types/Types';
import { renderHoverEdgeWithDistance } from './edge-utils';

// ✅ ENTERPRISE FIX: Import HoverRenderContext και LineEntity types
import type { HoverRenderContext } from './types';
import { isLineEntity } from '../../types/entities';

export function renderLineHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  // ✅ ENTERPRISE FIX: Use type guard to ensure entity is LineEntity
  if (!isLineEntity(entity)) return;

  const start = entity.start;
  const end = entity.end;
  
  if (!start || !end) return;

  const screenStart = worldToScreen(start);
  const screenEnd = worldToScreen(end);

  // Draw normal line
  ctx.beginPath();
  ctx.moveTo(screenStart.x, screenStart.y);
  ctx.lineTo(screenEnd.x, screenEnd.y);
  ctx.stroke();

  // Add distance label with grip avoidance - use shared edge utility
  renderHoverEdgeWithDistance(ctx, start, end, screenStart, screenEnd);
}