/**
 * Angle Rendering Utilities
 * Functions for rendering angle arcs and measurements at vertices
 */

import { HOVER_CONFIG } from './config';
import type { Point2D } from '../../rendering/types/Types';
import { calculateAngleData, calculateAngleBisector } from '../angle-calculation';
// 🏢 ADR-044: Centralized Line Widths
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
// 🏢 ADR-058: Centralized Canvas Primitives
import { addArcPath } from '../../rendering/primitives/canvasPaths';

export function renderHoverAngleAtVertex(
  ctx: CanvasRenderingContext2D,
  prevVertex: Point2D, 
  currentVertex: Point2D, 
  nextVertex: Point2D,
  prevScreen: Point2D,
  currentScreen: Point2D,
  nextScreen: Point2D
): void {
  // Use centralized angle calculation
  const angleData = calculateAngleData(prevVertex, currentVertex, nextVertex, prevScreen, currentScreen, nextScreen);
  const { degrees, startAngle, endAngle, clockwise } = angleData;

  ctx.save();

  // Draw arc with orange color
  ctx.strokeStyle = HOVER_CONFIG.colors.angle;
  ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL; // 🏢 ADR-044
  // 🏢 ADR-058: Use centralized canvas primitives
  ctx.beginPath();
  addArcPath(ctx, currentScreen, HOVER_CONFIG.offsets.arcRadius, startAngle, endAngle, clockwise);
  ctx.stroke();

  // Draw angle label (positioned to avoid grip collision)
  const { bisectorAngle } = calculateAngleBisector(startAngle, endAngle);
  const labelRadius = HOVER_CONFIG.offsets.arcRadius + HOVER_CONFIG.offsets.textFromArc;
  const labelX = currentScreen.x + Math.cos(bisectorAngle) * labelRadius;
  const labelY = currentScreen.y + Math.sin(bisectorAngle) * labelRadius;

  ctx.fillStyle = HOVER_CONFIG.colors.angle;
  ctx.font = HOVER_CONFIG.fonts.angle;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const angleText = `${degrees.toFixed(1)}°`;
  ctx.fillText(angleText, labelX, labelY);

  ctx.restore();
}