/**
 * Line Hover Renderer
 * Handles hover rendering for line entities with distance measurements
 */

import { HOVER_CONFIG } from './config';
import type { Point2D } from '../../rendering/types/Types';
import { renderHoverEdgeWithDistance } from './edge-utils';

export function renderLineHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  const start = entity.start as Point2D;
  const end = entity.end as Point2D;
  
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