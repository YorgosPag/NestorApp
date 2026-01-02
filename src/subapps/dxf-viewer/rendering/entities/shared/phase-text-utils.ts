/**
 * Phase-aware text rendering utilities
 * Consolidates duplicate text positioning logic across renderers
 */

import type { Point2D } from '../../types/Types';
import type { EntityModel, RenderOptions } from '../../types/Types';
import { renderStyledTextWithOverride } from '../../../hooks/useTextPreviewStyle';

/**
 * Render distance text with phase-aware positioning
 * Inline for preview, offset for measurements
 */
export function renderDistanceTextPhaseAware(
  ctx: CanvasRenderingContext2D,
  startPoint: Point2D,
  endPoint: Point2D,
  screenStart: Point2D,
  screenEnd: Point2D,
  entity: EntityModel,
  options: RenderOptions,
  getDimensionLabel: (distance: number) => string,
  calculateDistance: (start: Point2D, end: Point2D) => number
): void {
  const distance = calculateDistance(startPoint, endPoint);
  const label = getDimensionLabel(distance);
  
  if (options.preview) {
    // Inline positioning for preview - at the midpoint
    const midX = (screenStart.x + screenEnd.x) / 2;
    const midY = (screenStart.y + screenEnd.y) / 2;
    // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
    renderStyledTextWithOverride(ctx, label, midX, midY);
  } else {
    // Offset positioning for measurements - above the line
    const midX = (screenStart.x + screenEnd.x) / 2;
    const midY = (screenStart.y + screenEnd.y) / 2 - 20; // Offset above
    // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
    renderStyledTextWithOverride(ctx, label, midX, midY);
  }
}