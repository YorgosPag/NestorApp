/**
 * GHOST ENTITY RENDERER
 *
 * 🏢 ENTERPRISE (2026-01-25): Visual feedback during entity drag operations
 *
 * Phase 4 of HYBRID_LAYER_MOVEMENT_ARCHITECTURE:
 * - Renders semi-transparent "ghost" preview of entities during drag
 * - Shows movement delta visualization
 * - Provides visual confirmation before committing move
 *
 * Enterprise Pattern: Strategy Pattern for different entity types
 * Based on: AutoCAD drag preview, Figma selection ghost, Adobe Illustrator preview
 *
 * Features:
 * - Ghost outline rendering (semi-transparent)
 * - Delta indicator line (original -> new position)
 * - Coordinate readout during drag
 * - Performance optimized for large selections
 *
 * Usage:
 * ```tsx
 * if (isDragging && selectedEntities.length > 0) {
 *   renderGhostEntities(ctx, selectedEntities, delta, {
 *     ghostColor: 'rgba(0, 120, 255, 0.5)',
 *     showDeltaLine: true,
 *   });
 * }
 * ```
 *
 * @see HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md
 * @see hooks/useEntityDrag.ts
 */

import type { Point2D } from '../../rendering/types/Types';
// 🏢 ADR-066: Centralized Angle Calculation
import { calculateAngle } from '../entities/shared/geometry-rendering-utils';
// 🏢 ADR-XXX: Centralized Angular Constants
import { ARROW_ANGLE } from '../entities/shared/geometry-utils';
// 🏢 ADR-150: Centralized Arrow Head Size
import { OVERLAY_DIMENSIONS } from '../../utils/hover/config';
// 🏢 ADR-080: Centralized Rectangle Bounds
import { rectFromTwoPoints } from '../entities/shared/geometry-rendering-utils';

import {
  GHOST_RENDER_CONFIG,
  LINE_DASH_PATTERNS,
  TEXT_LABEL_OFFSETS,
  applyDelta,
  defaultWorldToScreen,
  getEntityBounds,
  mergeBounds,
  renderSingleGhostEntity,
} from './ghost-entity-shapes';

// Re-export types and config for consumers
export type { GhostableEntity, GhostRenderOptions, BoundingBox } from './ghost-entity-shapes';
export { GHOST_RENDER_CONFIG } from './ghost-entity-shapes';

import type { GhostableEntity, GhostRenderOptions, BoundingBox } from './ghost-entity-shapes';

// ============================================================================
// 🏢 ENTERPRISE: Overlay Renderers
// ============================================================================

/**
 * Render simplified bounding box for large selections
 */
function renderSimplifiedGhost(
  ctx: CanvasRenderingContext2D,
  bounds: BoundingBox,
  delta: Point2D,
  entityCount: number,
  options: GhostRenderOptions
): void {
  const worldToScreen = options.worldToScreen ?? defaultWorldToScreen;

  const ghostMin = worldToScreen(applyDelta({ x: bounds.minX, y: bounds.minY }, delta));
  const ghostMax = worldToScreen(applyDelta({ x: bounds.maxX, y: bounds.maxY }, delta));
  const { x, y, width, height } = rectFromTwoPoints(ghostMin, ghostMax);

  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.fillStyle = GHOST_RENDER_CONFIG.SIMPLIFIED_BOX_COLOR;
  ctx.fill();
  ctx.strokeStyle = options.ghostStroke ?? GHOST_RENDER_CONFIG.GHOST_STROKE;
  ctx.lineWidth = options.strokeWidth ?? GHOST_RENDER_CONFIG.GHOST_STROKE_WIDTH;
  ctx.setLineDash([...GHOST_RENDER_CONFIG.DELTA_LINE_DASH]);
  ctx.stroke();
  ctx.setLineDash(LINE_DASH_PATTERNS.SOLID);

  // Entity count label
  ctx.font = GHOST_RENDER_CONFIG.READOUT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = `${entityCount} entities`;
  const textX = x + width / 2;
  const textY = y + height / 2;

  const metrics = ctx.measureText(label);
  const pad = TEXT_LABEL_OFFSETS.LABEL_BOX_PADDING;
  ctx.fillStyle = GHOST_RENDER_CONFIG.READOUT_BG;
  ctx.fillRect(
    textX - metrics.width / 2 - pad,
    textY - TEXT_LABEL_OFFSETS.ENTITY_COUNT_OFFSET_Y,
    metrics.width + pad * 2,
    TEXT_LABEL_OFFSETS.LABEL_BOX_HEIGHT
  );

  ctx.fillStyle = GHOST_RENDER_CONFIG.READOUT_COLOR;
  ctx.fillText(label, textX, textY);
}

/**
 * Render delta indicator line with arrow head
 */
function renderDeltaLine(
  ctx: CanvasRenderingContext2D,
  originalCenter: Point2D,
  delta: Point2D,
  options: GhostRenderOptions
): void {
  if (delta.x === 0 && delta.y === 0) return;

  const worldToScreen = options.worldToScreen ?? defaultWorldToScreen;
  const startScreen = worldToScreen(originalCenter);
  const endScreen = worldToScreen(applyDelta(originalCenter, delta));

  ctx.beginPath();
  ctx.moveTo(startScreen.x, startScreen.y);
  ctx.lineTo(endScreen.x, endScreen.y);
  ctx.strokeStyle = GHOST_RENDER_CONFIG.DELTA_LINE_COLOR;
  ctx.lineWidth = GHOST_RENDER_CONFIG.DELTA_LINE_WIDTH;
  ctx.setLineDash([...GHOST_RENDER_CONFIG.DELTA_LINE_DASH]);
  ctx.stroke();
  ctx.setLineDash(LINE_DASH_PATTERNS.SOLID);

  // Arrow head
  const angle = calculateAngle(startScreen, endScreen);
  const arrowSize = OVERLAY_DIMENSIONS.ARROW_HEAD;

  ctx.beginPath();
  ctx.moveTo(endScreen.x, endScreen.y);
  ctx.lineTo(
    endScreen.x - arrowSize * Math.cos(angle - ARROW_ANGLE),
    endScreen.y - arrowSize * Math.sin(angle - ARROW_ANGLE)
  );
  ctx.moveTo(endScreen.x, endScreen.y);
  ctx.lineTo(
    endScreen.x - arrowSize * Math.cos(angle + ARROW_ANGLE),
    endScreen.y - arrowSize * Math.sin(angle + ARROW_ANGLE)
  );
  ctx.stroke();
}

/**
 * Render coordinate readout near cursor
 */
function renderCoordinateReadout(
  ctx: CanvasRenderingContext2D,
  delta: Point2D,
  screenPosition: Point2D
): void {
  const label = `dx: ${delta.x.toFixed(2)}, dy: ${delta.y.toFixed(2)}`;

  ctx.font = GHOST_RENDER_CONFIG.READOUT_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';

  const metrics = ctx.measureText(label);
  const padding = TEXT_LABEL_OFFSETS.LABEL_BOX_PADDING;
  const x = screenPosition.x + TEXT_LABEL_OFFSETS.TOOLTIP_HORIZONTAL;
  const y = screenPosition.y - TEXT_LABEL_OFFSETS.TOOLTIP_VERTICAL;

  ctx.fillStyle = GHOST_RENDER_CONFIG.READOUT_BG;
  ctx.fillRect(
    x - padding,
    y - TEXT_LABEL_OFFSETS.READOUT_OFFSET_Y,
    metrics.width + padding * 2,
    TEXT_LABEL_OFFSETS.LABEL_BOX_HEIGHT
  );

  ctx.fillStyle = GHOST_RENDER_CONFIG.READOUT_COLOR;
  ctx.fillText(label, x, y);
}

// ============================================================================
// 🏢 ENTERPRISE: Main Export Function
// ============================================================================

/**
 * Render ghost entities during drag operation
 */
export function renderGhostEntities(
  ctx: CanvasRenderingContext2D,
  entities: GhostableEntity[],
  delta: Point2D,
  options: GhostRenderOptions = {}
): void {
  if (entities.length === 0) return;

  ctx.save();

  if (entities.length > GHOST_RENDER_CONFIG.DETAIL_THRESHOLD) {
    const allBounds = entities
      .map(e => getEntityBounds(e))
      .filter((b): b is BoundingBox => b !== null);

    const combinedBounds = mergeBounds(allBounds);
    if (combinedBounds) {
      renderSimplifiedGhost(ctx, combinedBounds, delta, entities.length, options);
    }
  } else {
    for (const entity of entities) {
      renderSingleGhostEntity(ctx, entity, delta, options);
    }
  }

  // Delta line
  if (options.showDeltaLine) {
    const allBounds = entities
      .map(e => getEntityBounds(e))
      .filter((b): b is BoundingBox => b !== null);

    const combinedBounds = mergeBounds(allBounds);
    if (combinedBounds) {
      const center: Point2D = {
        x: (combinedBounds.minX + combinedBounds.maxX) / 2,
        y: (combinedBounds.minY + combinedBounds.maxY) / 2,
      };
      renderDeltaLine(ctx, center, delta, options);
    }
  }

  // Coordinate readout
  if (options.showReadout && options.worldToScreen) {
    const worldToScreen = options.worldToScreen;
    const allBounds = entities
      .map(e => getEntityBounds(e))
      .filter((b): b is BoundingBox => b !== null);

    const combinedBounds = mergeBounds(allBounds);
    if (combinedBounds) {
      const center: Point2D = {
        x: (combinedBounds.minX + combinedBounds.maxX) / 2 + delta.x,
        y: (combinedBounds.minY + combinedBounds.maxY) / 2 + delta.y,
      };
      const screenPos = worldToScreen(center);
      renderCoordinateReadout(ctx, delta, screenPos);
    }
  }

  ctx.restore();
}

/**
 * Alias for backward compatibility
 */
export const drawGhostEntities = renderGhostEntities;
