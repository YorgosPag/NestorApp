/**
 * 📍 SNAP INDICATOR COMPONENT
 *
 * Visual feedback για snap-to-point functionality
 *
 * @module floor-plan-system/snapping/rendering/SnapIndicator
 *
 * Features:
 * - Highlight snap point με colored circle
 * - Show tooltip με coordinates
 * - Smooth animations
 * - AutoCAD-style visual feedback
 */

import React from 'react';
import type { SnapResult } from '../types';
import { SNAP_VISUAL } from '../config';
import { GEO_COLORS } from '../../../config/color-config';

/**
 * Component props
 */
export interface SnapIndicatorProps {
  /** Current snap result (null if no snap) */
  snapResult: SnapResult | null;
  /** Canvas context για rendering */
  ctx: CanvasRenderingContext2D | null;
  /** Canvas width */
  canvasWidth: number;
  /** Canvas height */
  canvasHeight: number;
  /** Show tooltip? (default: true) */
  showTooltip?: boolean;
  /** Custom indicator color (overrides default) */
  color?: string;
  /** Custom indicator size (overrides default) */
  size?: number;
}

/**
 * SnapIndicator Component
 *
 * Renders visual snap feedback on canvas
 */
export const SnapIndicator: React.FC<SnapIndicatorProps> = ({
  snapResult,
  ctx,
  canvasWidth,
  canvasHeight,
  showTooltip = true,
  color,
  size
}) => {
  // ===================================================================
  // RENDERING EFFECT
  // ===================================================================

  React.useEffect(() => {
    if (!snapResult || !ctx) {
      return;
    }

    const { point } = snapResult;

    // Determine color
    const indicatorColor = color || SNAP_VISUAL.COLORS[point.mode] || GEO_COLORS.CAD.SNAP_INDICATOR;
    const indicatorSize = size || SNAP_VISUAL.SIZES.ACTIVE;

    console.debug('🎨 SnapIndicator rendering:', {
      point: { x: point.x, y: point.y },
      color: indicatorColor,
      size: indicatorSize
    });

    // Draw snap indicator circle
    ctx.save();

  // Outer circle (glow effect)
  ctx.beginPath();
  ctx.arc(point.x, point.y, indicatorSize + 2, 0, 2 * Math.PI);
  ctx.strokeStyle = indicatorColor;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5;
  ctx.stroke();

  // Inner circle (solid)
  ctx.beginPath();
  ctx.arc(point.x, point.y, indicatorSize, 0, 2 * Math.PI);
  ctx.strokeStyle = indicatorColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 1.0;
  ctx.stroke();

  // Crosshair lines
  const crosshairSize = indicatorSize + 5;
  ctx.beginPath();
  // Horizontal line
  ctx.moveTo(point.x - crosshairSize, point.y);
  ctx.lineTo(point.x + crosshairSize, point.y);
  // Vertical line
  ctx.moveTo(point.x, point.y - crosshairSize);
  ctx.lineTo(point.x, point.y + crosshairSize);
  ctx.strokeStyle = indicatorColor;
  ctx.lineWidth = 1;
  ctx.stroke();

    // Draw tooltip (if enabled)
    if (showTooltip && point.label) {
      drawTooltip(ctx, point.x, point.y, point.label, indicatorColor);
    }

    ctx.restore();

    console.debug('✅ SnapIndicator: Rendered successfully');
  }, [snapResult, ctx, canvasWidth, canvasHeight, showTooltip, color, size]);

  return null; // Canvas rendering component - no JSX
};

/**
 * Draw tooltip with coordinates
 */
function drawTooltip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string
): void {
  const padding = 8;
  const fontSize = 12;
  const offsetY = -25; // Position above snap point

  ctx.save();

  // Set font
  ctx.font = `${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  // Measure text
  const metrics = ctx.measureText(label);
  const textWidth = metrics.width;
  const textHeight = fontSize;

  // Background rectangle
  const bgX = x - textWidth / 2 - padding;
  const bgY = y + offsetY - textHeight - padding;
  const bgWidth = textWidth + padding * 2;
  const bgHeight = textHeight + padding * 2;

  // Draw background
  ctx.fillStyle = GEO_COLORS.withOpacity(GEO_COLORS.BLACK, 0.85);
  ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

  // Draw border
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);

  // Draw text
  ctx.fillStyle = color;
  ctx.fillText(label, x, y + offsetY);

  ctx.restore();
}

/**
 * Export for convenience
 */
export default SnapIndicator;
