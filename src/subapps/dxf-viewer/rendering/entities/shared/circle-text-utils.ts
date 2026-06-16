/**
 * Circle Text Rendering Utilities
 * Shared utilities for rendering text on circles
 */

import type { Point2D } from '../../types/Types';
import { renderStyledTextWithOverride } from '../../../hooks/useTextPreviewStyle';
// 🏢 ADR-462: display-unit SSoT — area + circumference follow the status-bar unit
import { formatLengthForDisplay, formatAreaForDisplay } from '../../../config/display-length-format';

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
  renderStyledTextWithOverride(ctx, `Εμβαδόν: ${formatAreaForDisplay(area)}`, screenCenter.x, screenCenter.y - screenRadius / 2);
  renderStyledTextWithOverride(ctx, `Περιφέρεια: ${formatLengthForDisplay(circumference)}`, screenCenter.x, screenCenter.y + screenRadius / 2);
}