/**
 * Edge Rendering Utilities
 * Functions for rendering edges with distance measurements and angles
 */

import { HOVER_CONFIG } from './config';
import type { Point2D } from '../../rendering/types/Types';
import { calculateEdgeTextPosition } from './text-labeling-utils';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';
// 🏢 ADR-462: display-unit SSoT — edge distance follows the status-bar unit selector
import { formatLengthForDisplay } from '../../config/display-length-format';
// 🏢 ADR-112: Centralized Text Rotation Pattern
import { withTextRotation } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-109: Centralized Distance Calculation
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';

export function renderHoverEdgeWithDistance(
  ctx: CanvasRenderingContext2D,
  worldStart: Point2D, 
  worldEnd: Point2D, 
  screenStart: Point2D, 
  screenEnd: Point2D
): void {
  // Calculate distance in world coordinates
  // 🏢 ADR-109: Use centralized distance calculation
  const distance = calculateDistance(worldStart, worldEnd);

  // Draw dashed line
  ctx.beginPath();
  ctx.moveTo(screenStart.x, screenStart.y);
  ctx.lineTo(screenEnd.x, screenEnd.y);
  ctx.stroke();

  // Use shared edge text position calculation
  const textPos = calculateEdgeTextPosition(screenStart, screenEnd, HOVER_CONFIG.offsets.gripAvoidance);
  if (!textPos) return;

  // 🏢 ADR-110: Use centralized text rotation pattern
  withTextRotation(ctx, textPos, () => {
    // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
    const distanceText = formatLengthForDisplay(distance);
    renderStyledTextWithOverride(ctx, distanceText, 0, 0);
  });
}