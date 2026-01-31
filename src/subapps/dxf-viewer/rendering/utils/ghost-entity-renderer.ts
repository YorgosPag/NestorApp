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
 * - Delta indicator line (original → new position)
 * - Coordinate readout during drag
 * - Performance optimized for large selections
 *
 * Usage:
 * ```tsx
 * // In canvas render loop
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

import type { Point2D } from '../types/Types';
// 🏢 ADR-044: Centralized line widths
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';
// 🏢 ADR-058: Centralized Canvas Primitives
import { addCirclePath, TAU } from '../primitives/canvasPaths';
// 🏢 ADR-066: Centralized Angle Calculation
import { calculateAngle } from '../entities/shared/geometry-rendering-utils';

// ============================================================================
// 🏢 ENTERPRISE: Configuration
// ============================================================================

/**
 * Ghost rendering configuration
 */
export const GHOST_RENDER_CONFIG = {
  /** Default ghost fill color (semi-transparent blue) */
  GHOST_FILL: 'rgba(0, 120, 255, 0.15)',
  /** Default ghost stroke color */
  GHOST_STROKE: 'rgba(0, 120, 255, 0.6)',
  /** Ghost stroke width (pixels) - 🏢 ADR-044: Use centralized constant */
  GHOST_STROKE_WIDTH: RENDER_LINE_WIDTHS.GHOST,
  /** Delta line color */
  DELTA_LINE_COLOR: 'rgba(255, 165, 0, 0.8)',
  /** Delta line width - 🏢 ADR-044: Use centralized constant */
  DELTA_LINE_WIDTH: RENDER_LINE_WIDTHS.DELTA,
  /** Delta line dash pattern */
  DELTA_LINE_DASH: [4, 4],
  /** Coordinate readout font */
  READOUT_FONT: '11px monospace',
  /** Coordinate readout color */
  READOUT_COLOR: 'rgba(0, 0, 0, 0.8)',
  /** Coordinate readout background */
  READOUT_BG: 'rgba(255, 255, 255, 0.9)',
  /** Maximum entities to render detailed ghost (performance) */
  DETAIL_THRESHOLD: 50,
  /** Simplified box rendering for large selections */
  SIMPLIFIED_BOX_COLOR: 'rgba(0, 120, 255, 0.3)',
} as const;

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions
// ============================================================================

/**
 * Entity geometry for ghost rendering
 */
export interface GhostableEntity {
  id: string;
  type: string;
  // Geometry properties (union of all entity types)
  start?: Point2D;
  end?: Point2D;
  center?: Point2D;
  radius?: number;
  corner1?: Point2D;
  corner2?: Point2D;
  vertices?: Point2D[];
  position?: Point2D;
}

/**
 * Ghost rendering options
 */
export interface GhostRenderOptions {
  /** Fill color for ghost entities */
  ghostFill?: string;
  /** Stroke color for ghost entities */
  ghostStroke?: string;
  /** Stroke width for ghost entities */
  strokeWidth?: number;
  /** Show delta indicator line */
  showDeltaLine?: boolean;
  /** Show coordinate readout */
  showReadout?: boolean;
  /** Transform world to screen coordinates */
  worldToScreen?: (point: Point2D) => Point2D;
  /** Current zoom scale (for line width adjustment) */
  scale?: number;
}

/**
 * Bounding box for entity
 */
interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ============================================================================
// 🏢 ENTERPRISE: Utility Functions
// ============================================================================

/**
 * Apply delta to a point
 */
function applyDelta(point: Point2D, delta: Point2D): Point2D {
  return {
    x: point.x + delta.x,
    y: point.y + delta.y,
  };
}

/**
 * Default world to screen transform (identity)
 */
function defaultWorldToScreen(point: Point2D): Point2D {
  return point;
}

/**
 * Calculate bounding box for an entity
 */
function getEntityBounds(entity: GhostableEntity): BoundingBox | null {
  switch (entity.type) {
    case 'line':
      if (entity.start && entity.end) {
        return {
          minX: Math.min(entity.start.x, entity.end.x),
          minY: Math.min(entity.start.y, entity.end.y),
          maxX: Math.max(entity.start.x, entity.end.x),
          maxY: Math.max(entity.start.y, entity.end.y),
        };
      }
      break;

    case 'circle':
      if (entity.center && entity.radius !== undefined) {
        return {
          minX: entity.center.x - entity.radius,
          minY: entity.center.y - entity.radius,
          maxX: entity.center.x + entity.radius,
          maxY: entity.center.y + entity.radius,
        };
      }
      break;

    case 'rectangle':
      if (entity.corner1 && entity.corner2) {
        return {
          minX: Math.min(entity.corner1.x, entity.corner2.x),
          minY: Math.min(entity.corner1.y, entity.corner2.y),
          maxX: Math.max(entity.corner1.x, entity.corner2.x),
          maxY: Math.max(entity.corner1.y, entity.corner2.y),
        };
      }
      break;

    case 'polyline':
    case 'polygon':
      if (entity.vertices && entity.vertices.length > 0) {
        let minX = entity.vertices[0].x;
        let minY = entity.vertices[0].y;
        let maxX = entity.vertices[0].x;
        let maxY = entity.vertices[0].y;

        for (const v of entity.vertices) {
          minX = Math.min(minX, v.x);
          minY = Math.min(minY, v.y);
          maxX = Math.max(maxX, v.x);
          maxY = Math.max(maxY, v.y);
        }

        return { minX, minY, maxX, maxY };
      }
      break;

    case 'text':
    case 'point':
      if (entity.position) {
        return {
          minX: entity.position.x - 5,
          minY: entity.position.y - 5,
          maxX: entity.position.x + 5,
          maxY: entity.position.y + 5,
        };
      }
      break;
  }

  return null;
}

/**
 * Merge multiple bounding boxes
 */
function mergeBounds(boxes: BoundingBox[]): BoundingBox | null {
  if (boxes.length === 0) return null;

  let minX = boxes[0].minX;
  let minY = boxes[0].minY;
  let maxX = boxes[0].maxX;
  let maxY = boxes[0].maxY;

  for (const box of boxes) {
    minX = Math.min(minX, box.minX);
    minY = Math.min(minY, box.minY);
    maxX = Math.max(maxX, box.maxX);
    maxY = Math.max(maxY, box.maxY);
  }

  return { minX, minY, maxX, maxY };
}

// ============================================================================
// 🏢 ENTERPRISE: Render Functions
// ============================================================================

/**
 * Render ghost line
 */
function renderGhostLine(
  ctx: CanvasRenderingContext2D,
  start: Point2D,
  end: Point2D,
  delta: Point2D,
  options: GhostRenderOptions
): void {
  const worldToScreen = options.worldToScreen ?? defaultWorldToScreen;

  const ghostStart = worldToScreen(applyDelta(start, delta));
  const ghostEnd = worldToScreen(applyDelta(end, delta));

  ctx.beginPath();
  ctx.moveTo(ghostStart.x, ghostStart.y);
  ctx.lineTo(ghostEnd.x, ghostEnd.y);
  ctx.strokeStyle = options.ghostStroke ?? GHOST_RENDER_CONFIG.GHOST_STROKE;
  ctx.lineWidth = options.strokeWidth ?? GHOST_RENDER_CONFIG.GHOST_STROKE_WIDTH;
  ctx.stroke();
}

/**
 * Render ghost circle
 */
function renderGhostCircle(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  delta: Point2D,
  options: GhostRenderOptions
): void {
  const worldToScreen = options.worldToScreen ?? defaultWorldToScreen;
  const scale = options.scale ?? 1;

  const ghostCenter = worldToScreen(applyDelta(center, delta));
  const screenRadius = radius * scale;

  // 🏢 ADR-058: Use centralized canvas primitives
  ctx.beginPath();
  addCirclePath(ctx, ghostCenter, screenRadius);
  ctx.fillStyle = options.ghostFill ?? GHOST_RENDER_CONFIG.GHOST_FILL;
  ctx.fill();
  ctx.strokeStyle = options.ghostStroke ?? GHOST_RENDER_CONFIG.GHOST_STROKE;
  ctx.lineWidth = options.strokeWidth ?? GHOST_RENDER_CONFIG.GHOST_STROKE_WIDTH;
  ctx.stroke();
}

/**
 * Render ghost rectangle
 */
function renderGhostRectangle(
  ctx: CanvasRenderingContext2D,
  corner1: Point2D,
  corner2: Point2D,
  delta: Point2D,
  options: GhostRenderOptions
): void {
  const worldToScreen = options.worldToScreen ?? defaultWorldToScreen;

  const ghostCorner1 = worldToScreen(applyDelta(corner1, delta));
  const ghostCorner2 = worldToScreen(applyDelta(corner2, delta));

  const x = Math.min(ghostCorner1.x, ghostCorner2.x);
  const y = Math.min(ghostCorner1.y, ghostCorner2.y);
  const width = Math.abs(ghostCorner2.x - ghostCorner1.x);
  const height = Math.abs(ghostCorner2.y - ghostCorner1.y);

  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.fillStyle = options.ghostFill ?? GHOST_RENDER_CONFIG.GHOST_FILL;
  ctx.fill();
  ctx.strokeStyle = options.ghostStroke ?? GHOST_RENDER_CONFIG.GHOST_STROKE;
  ctx.lineWidth = options.strokeWidth ?? GHOST_RENDER_CONFIG.GHOST_STROKE_WIDTH;
  ctx.stroke();
}

/**
 * Render ghost polyline/polygon
 */
function renderGhostPolyline(
  ctx: CanvasRenderingContext2D,
  vertices: Point2D[],
  delta: Point2D,
  closed: boolean,
  options: GhostRenderOptions
): void {
  if (vertices.length < 2) return;

  const worldToScreen = options.worldToScreen ?? defaultWorldToScreen;

  ctx.beginPath();
  const firstPoint = worldToScreen(applyDelta(vertices[0], delta));
  ctx.moveTo(firstPoint.x, firstPoint.y);

  for (let i = 1; i < vertices.length; i++) {
    const point = worldToScreen(applyDelta(vertices[i], delta));
    ctx.lineTo(point.x, point.y);
  }

  if (closed) {
    ctx.closePath();
    ctx.fillStyle = options.ghostFill ?? GHOST_RENDER_CONFIG.GHOST_FILL;
    ctx.fill();
  }

  ctx.strokeStyle = options.ghostStroke ?? GHOST_RENDER_CONFIG.GHOST_STROKE;
  ctx.lineWidth = options.strokeWidth ?? GHOST_RENDER_CONFIG.GHOST_STROKE_WIDTH;
  ctx.stroke();
}

/**
 * Render ghost for single entity
 */
function renderSingleGhostEntity(
  ctx: CanvasRenderingContext2D,
  entity: GhostableEntity,
  delta: Point2D,
  options: GhostRenderOptions
): void {
  switch (entity.type) {
    case 'line':
      if (entity.start && entity.end) {
        renderGhostLine(ctx, entity.start, entity.end, delta, options);
      }
      break;

    case 'circle':
      if (entity.center && entity.radius !== undefined) {
        renderGhostCircle(ctx, entity.center, entity.radius, delta, options);
      }
      break;

    case 'rectangle':
      if (entity.corner1 && entity.corner2) {
        renderGhostRectangle(ctx, entity.corner1, entity.corner2, delta, options);
      }
      break;

    case 'polyline':
      if (entity.vertices) {
        renderGhostPolyline(ctx, entity.vertices, delta, false, options);
      }
      break;

    case 'polygon':
      if (entity.vertices) {
        renderGhostPolyline(ctx, entity.vertices, delta, true, options);
      }
      break;
  }
}

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

  const x = Math.min(ghostMin.x, ghostMax.x);
  const y = Math.min(ghostMin.y, ghostMax.y);
  const width = Math.abs(ghostMax.x - ghostMin.x);
  const height = Math.abs(ghostMax.y - ghostMin.y);

  // Draw simplified box
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.fillStyle = GHOST_RENDER_CONFIG.SIMPLIFIED_BOX_COLOR;
  ctx.fill();
  ctx.strokeStyle = options.ghostStroke ?? GHOST_RENDER_CONFIG.GHOST_STROKE;
  ctx.lineWidth = options.strokeWidth ?? GHOST_RENDER_CONFIG.GHOST_STROKE_WIDTH;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw entity count label
  ctx.font = GHOST_RENDER_CONFIG.READOUT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = `${entityCount} entities`;
  const textX = x + width / 2;
  const textY = y + height / 2;

  // Background
  const metrics = ctx.measureText(label);
  ctx.fillStyle = GHOST_RENDER_CONFIG.READOUT_BG;
  ctx.fillRect(textX - metrics.width / 2 - 4, textY - 8, metrics.width + 8, 16);

  // Text
  ctx.fillStyle = GHOST_RENDER_CONFIG.READOUT_COLOR;
  ctx.fillText(label, textX, textY);
}

/**
 * Render delta indicator line
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
  ctx.setLineDash(GHOST_RENDER_CONFIG.DELTA_LINE_DASH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw arrow head
  // 🏢 ADR-066: Use centralized angle calculation
  const angle = calculateAngle(startScreen, endScreen);
  const arrowSize = 8;

  ctx.beginPath();
  ctx.moveTo(endScreen.x, endScreen.y);
  ctx.lineTo(
    endScreen.x - arrowSize * Math.cos(angle - Math.PI / 6),
    endScreen.y - arrowSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(endScreen.x, endScreen.y);
  ctx.lineTo(
    endScreen.x - arrowSize * Math.cos(angle + Math.PI / 6),
    endScreen.y - arrowSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

/**
 * Render coordinate readout
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
  const padding = 4;
  const x = screenPosition.x + 10;
  const y = screenPosition.y - 10;

  // Background
  ctx.fillStyle = GHOST_RENDER_CONFIG.READOUT_BG;
  ctx.fillRect(x - padding, y - 14, metrics.width + padding * 2, 16);

  // Text
  ctx.fillStyle = GHOST_RENDER_CONFIG.READOUT_COLOR;
  ctx.fillText(label, x, y);
}

// ============================================================================
// 🏢 ENTERPRISE: Main Export Function
// ============================================================================

/**
 * Render ghost entities during drag operation
 *
 * @param ctx - Canvas 2D rendering context
 * @param entities - Entities to render as ghosts
 * @param delta - Movement delta (world coordinates)
 * @param options - Rendering options
 */
export function renderGhostEntities(
  ctx: CanvasRenderingContext2D,
  entities: GhostableEntity[],
  delta: Point2D,
  options: GhostRenderOptions = {}
): void {
  if (entities.length === 0) return;

  ctx.save();

  // Check if we should use simplified rendering
  if (entities.length > GHOST_RENDER_CONFIG.DETAIL_THRESHOLD) {
    // Calculate combined bounds
    const allBounds = entities
      .map(e => getEntityBounds(e))
      .filter((b): b is BoundingBox => b !== null);

    const combinedBounds = mergeBounds(allBounds);
    if (combinedBounds) {
      renderSimplifiedGhost(ctx, combinedBounds, delta, entities.length, options);
    }
  } else {
    // Render each entity as ghost
    for (const entity of entities) {
      renderSingleGhostEntity(ctx, entity, delta, options);
    }
  }

  // Render delta line if enabled
  if (options.showDeltaLine) {
    // Calculate center of all entities
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

  // Render coordinate readout if enabled
  if (options.showReadout && options.worldToScreen) {
    const worldToScreen = options.worldToScreen;
    // Position readout near the cursor (approximate)
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
