/**
 * Radius Measurement Utilities
 * Functions for rendering radius measurements on circles and arcs
 */

import { HOVER_CONFIG } from './config';
import type { Point2D } from '../../rendering/types/Types';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-090: Centralized Number Formatting
import { formatDistance } from '../../rendering/entities/shared/distance-label-utils';

export function renderRadiusWithMeasurement(
  ctx: CanvasRenderingContext2D,
  worldCenter: Point2D,
  screenCenter: Point2D,
  screenRadius: number,
  worldRadius: number
): void {
  // Draw radius line from center to edge (horizontal for simplicity)
  const radiusEndX = screenCenter.x + screenRadius;
  const radiusEndY = screenCenter.y;

  // Draw radius line - use existing context style (preserves dashed white style from parent)
  ctx.beginPath();
  ctx.moveTo(screenCenter.x, screenCenter.y);
  ctx.lineTo(radiusEndX, radiusEndY);
  ctx.stroke();

  // Add radius measurement text at midpoint
  const midX = (screenCenter.x + radiusEndX) / 2;
  const midY = (screenCenter.y + radiusEndY) / 2;
  // 🏢 ADR-138: Removed fallback || 15 - HOVER_CONFIG.offsets.gripAvoidance is always defined (= 20)
  const textY = midY - HOVER_CONFIG.offsets.gripAvoidance;

  ctx.save();
  ctx.fillStyle = HOVER_CONFIG.colors?.distance || UI_COLORS.MEASUREMENT_TEXT;
  ctx.font = HOVER_CONFIG.fonts?.distance || '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const radiusText = `R=${formatDistance(worldRadius)}`;
  ctx.fillText(radiusText, midX, textY);
  ctx.restore();
}