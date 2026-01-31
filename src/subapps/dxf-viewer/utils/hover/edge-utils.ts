/**
 * Edge Rendering Utilities
 * Functions for rendering edges with distance measurements and angles
 */

import { HOVER_CONFIG } from './config';
import type { Point2D } from '../../rendering/types/Types';
import { renderEdgeDistanceLabel, calculateEdgeTextPosition } from './text-labeling-utils';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';
// 🏢 ADR-090: Centralized Number Formatting
import { formatDistance } from '../../rendering/entities/shared/distance-label-utils';

export function renderHoverEdgeWithDistance(
  ctx: CanvasRenderingContext2D,
  worldStart: Point2D, 
  worldEnd: Point2D, 
  screenStart: Point2D, 
  screenEnd: Point2D
): void {
  // Calculate distance in world coordinates
  const distance = Math.sqrt(
    Math.pow(worldEnd.x - worldStart.x, 2) + Math.pow(worldEnd.y - worldStart.y, 2)
  );

  // Draw dashed line
  ctx.beginPath();
  ctx.moveTo(screenStart.x, screenStart.y);
  ctx.lineTo(screenEnd.x, screenEnd.y);
  ctx.stroke();

  // Use shared edge text position calculation
  const textPos = calculateEdgeTextPosition(screenStart, screenEnd, HOVER_CONFIG.offsets.gripAvoidance);
  if (!textPos) return;

  ctx.save();
  ctx.translate(textPos.x, textPos.y);

  // Rotate text to be readable
  let textAngle = textPos.angle;
  if (Math.abs(textAngle) > Math.PI / 2) {
    textAngle += Math.PI;
  }
  ctx.rotate(textAngle);

  // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
  const distanceText = formatDistance(distance);
  renderStyledTextWithOverride(ctx, distanceText, 0, 0);

  ctx.restore();
}