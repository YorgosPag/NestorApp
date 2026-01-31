/**
 * Phase-aware text rendering utilities
 * Consolidates duplicate text positioning logic across renderers
 */

import type { Point2D } from '../../types/Types';
import type { EntityModel, RenderOptions } from '../../types/Types';
import { renderStyledTextWithOverride } from '../../../hooks/useTextPreviewStyle';
// 🏢 ADR-073: Centralized Midpoint Calculation
import { calculateMidpoint } from './geometry-utils';

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
  
  // 🏢 ADR-073: Use centralized midpoint calculation
  const mid = calculateMidpoint(screenStart, screenEnd);

  if (options.preview) {
    // Inline positioning for preview - at the midpoint
    // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
    renderStyledTextWithOverride(ctx, label, mid.x, mid.y);
  } else {
    // Offset positioning for measurements - above the line
    // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
    renderStyledTextWithOverride(ctx, label, mid.x, mid.y - 20);
  }
}