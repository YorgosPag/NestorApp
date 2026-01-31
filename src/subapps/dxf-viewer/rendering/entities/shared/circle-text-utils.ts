/**
 * Circle Text Rendering Utilities
 * Shared utilities for rendering text on circles
 */

import type { Point2D } from '../../types/Types';
import { renderStyledTextWithOverride } from '../../../hooks/useTextPreviewStyle';
// 🏢 ADR-090: Centralized Number Formatting
import { formatDistance } from './distance-label-utils';

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
  renderStyledTextWithOverride(ctx, `Εμβαδόν: ${formatDistance(area)}`, screenCenter.x, screenCenter.y - screenRadius / 2);
  renderStyledTextWithOverride(ctx, `Περιφέρεια: ${formatDistance(circumference)}`, screenCenter.x, screenCenter.y + screenRadius / 2);
}