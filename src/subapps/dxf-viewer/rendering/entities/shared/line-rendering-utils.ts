/**
 * Line rendering utilities
 * Consolidates duplicate line drawing logic across renderers
 */

import type { Point2D } from '../../types/Types';
import { getTextPreviewStyleWithOverride } from '../../../hooks/useTextPreviewStyle';
// 🏢 ADR-065: Centralized Distance & Vector Operations
import { calculateDistance, getUnitVector } from './geometry-rendering-utils';

/**
 * Render a split line with a gap in the middle for text
 */
export function renderSplitLineWithGap(
  ctx: CanvasRenderingContext2D,
  startScreen: Point2D,
  endScreen: Point2D,
  gapSize = 40
): void {
  // 🏢 ADR-065: Use centralized distance calculation
  const length = calculateDistance(startScreen, endScreen);

  if (length < gapSize) {
    // Line too short for gap, draw nothing
    return;
  }

  // 🏢 ADR-065: Use centralized unit vector calculation
  const unit = getUnitVector(startScreen, endScreen);

  const gapStartX = startScreen.x + (length - gapSize) / 2 * unit.x;
  const gapStartY = startScreen.y + (length - gapSize) / 2 * unit.y;
  const gapEndX = startScreen.x + (length + gapSize) / 2 * unit.x;
  const gapEndY = startScreen.y + (length + gapSize) / 2 * unit.y;
  
  // Draw first segment
  ctx.beginPath();
  ctx.moveTo(startScreen.x, startScreen.y);
  ctx.lineTo(gapStartX, gapStartY);
  ctx.stroke();
  
  // Draw second segment
  ctx.beginPath();
  ctx.moveTo(gapEndX, gapEndY);
  ctx.lineTo(endScreen.x, endScreen.y);
  ctx.stroke();
}

/**
 * Render a continuous line between two points
 */
export function renderContinuousLine(
  ctx: CanvasRenderingContext2D,
  startScreen: Point2D,
  endScreen: Point2D
): void {
  ctx.beginPath();
  ctx.moveTo(startScreen.x, startScreen.y);
  ctx.lineTo(endScreen.x, endScreen.y);
  ctx.stroke();
}

/**
 * Render line με έλεγχο για text enabled state
 * Αν το κείμενο είναι enabled, σχεδιάζει γραμμή με κενό
 * Αν το κείμενο είναι disabled, σχεδιάζει συνεχόμενη γραμμή
 */
export function renderLineWithTextCheck(
  ctx: CanvasRenderingContext2D,
  startScreen: Point2D,
  endScreen: Point2D,
  gapSize = 40
): void {
  const textStyle = getTextPreviewStyleWithOverride();

  if (textStyle.enabled) {
    // Κείμενο ενεργοποιημένο: γραμμή με κενό
    renderSplitLineWithGap(ctx, startScreen, endScreen, gapSize);
  } else {
    // Κείμενο απενεργοποιημένο: συνεχόμενη γραμμή
    renderContinuousLine(ctx, startScreen, endScreen);
  }
}