/**
 * Text Labeling Utilities
 * Shared utilities for positioning and rendering text labels on hover
 */

import type { Point2D } from '../../rendering/types/Types';
import { renderStyledText } from '../../hooks/useTextPreviewStyle';

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
  // Calculate midpoint for distance label
  const midX = (screenStart.x + screenEnd.x) / 2;
  const midY = (screenStart.y + screenEnd.y) / 2;

  // Calculate line direction for text rotation
  const dx = screenEnd.x - screenStart.x;
  const dy = screenEnd.y - screenStart.y;
  const angle = Math.atan2(dy, dx);

  // Position text to avoid overlapping with edge grips
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return null;

  // Calculate perpendicular offset
  const perpX = -dy / length;
  const perpY = dx / length;

  return {
    x: midX + perpX * offsetDistance,
    y: midY + perpY * offsetDistance,
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

  ctx.save();
  ctx.translate(textPos.x, textPos.y);
  
  // Rotate text to be readable (don't flip upside down)
  let textAngle = textPos.angle;
  if (Math.abs(textAngle) > Math.PI / 2) {
    textAngle += Math.PI;
  }
  ctx.rotate(textAngle);

  if (withBackground) {
    // ✅ ENTERPRISE: Use CSS variable instead of hardcoded white (adapts to dark mode)
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    ctx.fillStyle = bgColor ? `hsl(${bgColor} / 0.9)` : 'rgba(30, 41, 59, 0.9)'; // fallback to slate-800
    ctx.fillRect(-20, -8, 40, 16);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(-20, -8, 40, 16);
  }

  // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
  renderStyledText(ctx, text, 0, 0);
  
  ctx.restore();
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
  // Calculate world distance
  const distance = Math.sqrt(
    Math.pow(worldEnd.x - worldStart.x, 2) + 
    Math.pow(worldEnd.y - worldStart.y, 2)
  );

  renderTextAtEdgePosition(ctx, distance.toFixed(2), screenStart, screenEnd, offsetDistance, true);
}