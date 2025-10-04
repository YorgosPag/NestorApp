/**
 * Angle Rendering Utilities
 * Functions for rendering angle arcs and measurements at vertices
 */

import { HOVER_CONFIG } from './config';
import type { Point2D } from './types';
import { calculateAngleData, calculateAngleBisector } from '../angle-calculation';

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
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(currentScreen.x, currentScreen.y, HOVER_CONFIG.offsets.arcRadius, startAngle, endAngle, clockwise);
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