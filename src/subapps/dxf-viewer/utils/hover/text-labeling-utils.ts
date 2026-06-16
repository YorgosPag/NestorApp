/**
 * Text Labeling Utilities
 * Shared utilities for positioning and rendering text labels on hover
 */

import type { Point2D } from '../../rendering/types/Types';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-065: Centralized Distance, Angle & Vector Operations
// 🏢 ADR-090: Centralized Point Vector Operations
import { calculateDistance, calculateAngle, calculateMidpoint, getPerpendicularUnitVector, offsetPoint } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-462: display-unit SSoT — edge distance label follows the status-bar unit
import { formatLengthForDisplay } from '../../config/display-length-format';
// 🏢 ADR-112: Centralized Text Rotation Pattern
import { withTextRotation } from '../../rendering/entities/shared/geometry-utils';

/**
 * Calculate optimal text position and rotation for edge labeling
 */
export interface EdgeTextPosition {
  x: number;
  y: number;
  angle: number;
  length: number;
}

/**
 * Calculate optimal text positioning for edge labels
 */
export function calculateEdgeTextPosition(
  screenStart: Point2D,
  screenEnd: Point2D,
  offsetDistance = 12
): EdgeTextPosition | null {
  // 🏢 ADR-073: Use centralized midpoint calculation
  const mid = calculateMidpoint(screenStart, screenEnd);

  // 🏢 ADR-066: Use centralized angle calculation
  const angle = calculateAngle(screenStart, screenEnd);

  // 🏢 ADR-065: Use centralized distance calculation
  const length = calculateDistance(screenStart, screenEnd);
  if (length === 0) return null;

  // 🏢 ADR-065: Use centralized perpendicular unit vector calculation
  const perp = getPerpendicularUnitVector(screenStart, screenEnd);

  // 🏢 ADR-090: Use centralized offsetPoint for text position
  const textPos = offsetPoint(mid, perp, offsetDistance);

  return {
    x: textPos.x,
    y: textPos.y,
    angle,
    length
  };
}

/**
 * Render text at calculated edge position with proper rotation
 */
export function renderTextAtEdgePosition(
  ctx: CanvasRenderingContext2D,
  text: string,
  screenStart: Point2D,
  screenEnd: Point2D,
  offsetDistance = 12,
  withBackground = false
): void {
  const textPos = calculateEdgeTextPosition(screenStart, screenEnd, offsetDistance);
  if (!textPos) return;

  // 🏢 ADR-110: Use centralized text rotation pattern
  withTextRotation(ctx, textPos, () => {
    if (withBackground) {
      // ✅ ENTERPRISE: Use CSS variable instead of hardcoded white (adapts to dark mode)
      const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
      ctx.fillStyle = bgColor ? `hsl(${bgColor} / 0.9)` : UI_COLORS.TEXT_LABEL_BG_FALLBACK; // fallback to slate-800
      ctx.fillRect(-20, -8, 40, 16);
      ctx.strokeStyle = UI_COLORS.TEXT_LABEL_BORDER;
      ctx.strokeRect(-20, -8, 40, 16);
    }

    // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
    renderStyledTextWithOverride(ctx, text, 0, 0);
  });
}

/**
 * Render distance label with optimal positioning
 */
export function renderEdgeDistanceLabel(
  ctx: CanvasRenderingContext2D,
  worldStart: Point2D,
  worldEnd: Point2D,
  screenStart: Point2D,
  screenEnd: Point2D,
  offsetDistance = 12
): void {
  // 🏢 ADR-086: Use centralized distance calculation (already imported!)
  const distance = calculateDistance(worldStart, worldEnd);

  renderTextAtEdgePosition(ctx, formatLengthForDisplay(distance), screenStart, screenEnd, offsetDistance, true);
}