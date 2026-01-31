/**
 * Line rendering utilities
 * Consolidates duplicate line drawing logic across renderers
 *
 * 🏢 ADR-085: Centralized Split Line Rendering
 * This file is the SINGLE SOURCE OF TRUTH for split line rendering.
 * All renderers delegate to these utilities.
 */

import type { Point2D } from '../../types/Types';
import { getTextPreviewStyleWithOverride } from '../../../hooks/useTextPreviewStyle';
// 🏢 ADR-085: Centralized gap calculation from line-utils.ts
import { calculateSplitLineGap } from './line-utils';
// 🏢 ADR-048: Centralized gap size constant
import { RENDER_GEOMETRY } from '../../../config/text-rendering-config';

/**
 * 🏢 ADR-085: Render a split line with a gap in the middle for text
 *
 * SINGLE SOURCE OF TRUTH for split line rendering.
 * Uses centralized:
 * - calculateSplitLineGap() from line-utils.ts for gap calculation
 * - RENDER_GEOMETRY.SPLIT_LINE_GAP (30px) for consistent gap size
 *
 * @param ctx - Canvas rendering context
 * @param startScreen - Start point in screen coordinates
 * @param endScreen - End point in screen coordinates
 * @param gapSize - Size of gap for text (default: RENDER_GEOMETRY.SPLIT_LINE_GAP = 30px)
 */
export function renderSplitLineWithGap(
  ctx: CanvasRenderingContext2D,
  startScreen: Point2D,
  endScreen: Point2D,
  gapSize: number = RENDER_GEOMETRY.SPLIT_LINE_GAP
): void {
  // 🏢 ADR-085: Use centralized gap calculation
  const { gapStart, gapEnd } = calculateSplitLineGap(startScreen, endScreen, gapSize);

  // Draw first segment
  ctx.beginPath();
  ctx.moveTo(startScreen.x, startScreen.y);
  ctx.lineTo(gapStart.x, gapStart.y);
  ctx.stroke();

  // Draw second segment
  ctx.beginPath();
  ctx.moveTo(gapEnd.x, gapEnd.y);
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
 * 🏢 ADR-085: Render line με έλεγχο για text enabled state
 * Αν το κείμενο είναι enabled, σχεδιάζει γραμμή με κενό
 * Αν το κείμενο είναι disabled, σχεδιάζει συνεχόμενη γραμμή
 *
 * Uses centralized RENDER_GEOMETRY.SPLIT_LINE_GAP (30px) for consistent gap size.
 *
 * @param ctx - Canvas rendering context
 * @param startScreen - Start point in screen coordinates
 * @param endScreen - End point in screen coordinates
 * @param gapSize - Size of gap for text (default: RENDER_GEOMETRY.SPLIT_LINE_GAP = 30px)
 */
export function renderLineWithTextCheck(
  ctx: CanvasRenderingContext2D,
  startScreen: Point2D,
  endScreen: Point2D,
  gapSize: number = RENDER_GEOMETRY.SPLIT_LINE_GAP
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