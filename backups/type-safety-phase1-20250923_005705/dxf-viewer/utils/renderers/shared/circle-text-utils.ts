/**
 * Circle Text Rendering Utilities
 * Shared utilities for rendering text on circles
 */

import type { Point2D } from '../../../systems/rulers-grid/config';
import { renderStyledText } from '../../../hooks/useTextPreviewStyle';

/**
 * Render area and circumference text on circle
 */
export function renderCircleAreaText(
  ctx: CanvasRenderingContext2D,
  screenCenter: Point2D,
  screenRadius: number,
  area: number,
  circumference: number
): void {
  // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
  renderStyledText(ctx, `Εμβαδόν: ${area.toFixed(2)}`, screenCenter.x, screenCenter.y - screenRadius / 2);
  renderStyledText(ctx, `Περιφέρεια: ${circumference.toFixed(2)}`, screenCenter.x, screenCenter.y + screenRadius / 2);
}