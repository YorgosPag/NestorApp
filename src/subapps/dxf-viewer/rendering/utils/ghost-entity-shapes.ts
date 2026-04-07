/**
 * GHOST ENTITY SHAPES - Individual Entity Ghost Renderers
 *
 * Types, configuration, utilities, and per-shape ghost rendering strategies.
 * Extracted from ghost-entity-renderer.ts per ADR-065 (file size compliance).
 *
 * @module rendering/utils/ghost-entity-shapes
 * @see ghost-entity-renderer.ts for main render orchestrator
 */

import type { Point2D } from '../../rendering/types/Types';
// 🏢 ADR-044: Centralized line widths
// 🏢 ADR-083: Centralized line dash patterns
// 🏢 ADR-090: Centralized UI Fonts
// 🏢 ADR-091: Centralized Text Label Offsets
import { RENDER_LINE_WIDTHS, LINE_DASH_PATTERNS, UI_FONTS, TEXT_LABEL_OFFSETS } from '../../config/text-rendering-config';
// 🏢 ADR-166: Centralized Ghost Entity Colors
import { GHOST_COLORS } from '../../config/color-config';
// 🏢 ADR-058: Centralized Canvas Primitives
import { addCirclePath } from '../primitives/canvasPaths';
// 🏢 ADR-080: Centralized Rectangle Bounds
import { rectFromTwoPoints } from '../entities/shared/geometry-rendering-utils';

// ============================================================================
// 🏢 ENTERPRISE: Configuration
// ============================================================================

export const GHOST_RENDER_CONFIG = {
  GHOST_FILL: GHOST_COLORS.FILL,
  GHOST_STROKE: GHOST_COLORS.STROKE,
  GHOST_STROKE_WIDTH: RENDER_LINE_WIDTHS.GHOST,
  DELTA_LINE_COLOR: GHOST_COLORS.DELTA_LINE,
  DELTA_LINE_WIDTH: RENDER_LINE_WIDTHS.DELTA,
  DELTA_LINE_DASH: LINE_DASH_PATTERNS.GHOST,
  READOUT_FONT: UI_FONTS.MONOSPACE.SMALL,
  READOUT_COLOR: GHOST_COLORS.READOUT_TEXT,
  READOUT_BG: GHOST_COLORS.READOUT_BG,
  /** @deprecated Use TEXT_LABEL_OFFSETS.LABEL_BOX_PADDING */
  READOUT_PADDING: 4,
  DETAIL_THRESHOLD: 50,
  SIMPLIFIED_BOX_COLOR: GHOST_COLORS.SIMPLIFIED_BOX,
} as const;

// Re-export centralized constants used by ghost-entity-renderer
export { LINE_DASH_PATTERNS, TEXT_LABEL_OFFSETS };

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions
// ============================================================================

export interface GhostableEntity {
  id: string;
  type: string;
  start?: Point2D;
  end?: Point2D;
  center?: Point2D;
  radius?: number;
  corner1?: Point2D;
  corner2?: Point2D;
  vertices?: Point2D[];
  position?: Point2D;
}

export interface GhostRenderOptions {
  ghostFill?: string;
  ghostStroke?: string;
  strokeWidth?: number;
  showDeltaLine?: boolean;
  showReadout?: boolean;
  worldToScreen?: (point: Point2D) => Point2D;
  scale?: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ============================================================================
// 🏢 ENTERPRISE: Utility Functions
// ============================================================================

export function applyDelta(point: Point2D, delta: Point2D): Point2D {
  return { x: point.x + delta.x, y: point.y + delta.y };
}

export function defaultWorldToScreen(point: Point2D): Point2D {
  return point;
}

export function getEntityBounds(entity: GhostableEntity): BoundingBox | null {
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

export function mergeBounds(boxes: BoundingBox[]): BoundingBox | null {
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
// 🏢 ENTERPRISE: Individual Shape Renderers (Strategy Pattern)
// ============================================================================

function renderGhostLine(
  ctx: CanvasRenderingContext2D,
  start: Point2D, end: Point2D,
  delta: Point2D, options: GhostRenderOptions
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

function renderGhostCircle(
  ctx: CanvasRenderingContext2D,
  center: Point2D, radius: number,
  delta: Point2D, options: GhostRenderOptions
): void {
  const worldToScreen = options.worldToScreen ?? defaultWorldToScreen;
  const scale = options.scale ?? 1;
  const ghostCenter = worldToScreen(applyDelta(center, delta));
  const screenRadius = radius * scale;

  ctx.beginPath();
  addCirclePath(ctx, ghostCenter, screenRadius);
  ctx.fillStyle = options.ghostFill ?? GHOST_RENDER_CONFIG.GHOST_FILL;
  ctx.fill();
  ctx.strokeStyle = options.ghostStroke ?? GHOST_RENDER_CONFIG.GHOST_STROKE;
  ctx.lineWidth = options.strokeWidth ?? GHOST_RENDER_CONFIG.GHOST_STROKE_WIDTH;
  ctx.stroke();
}

function renderGhostRectangle(
  ctx: CanvasRenderingContext2D,
  corner1: Point2D, corner2: Point2D,
  delta: Point2D, options: GhostRenderOptions
): void {
  const worldToScreen = options.worldToScreen ?? defaultWorldToScreen;
  const ghostCorner1 = worldToScreen(applyDelta(corner1, delta));
  const ghostCorner2 = worldToScreen(applyDelta(corner2, delta));
  const { x, y, width, height } = rectFromTwoPoints(ghostCorner1, ghostCorner2);

  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.fillStyle = options.ghostFill ?? GHOST_RENDER_CONFIG.GHOST_FILL;
  ctx.fill();
  ctx.strokeStyle = options.ghostStroke ?? GHOST_RENDER_CONFIG.GHOST_STROKE;
  ctx.lineWidth = options.strokeWidth ?? GHOST_RENDER_CONFIG.GHOST_STROKE_WIDTH;
  ctx.stroke();
}

function renderGhostPolyline(
  ctx: CanvasRenderingContext2D,
  vertices: Point2D[], delta: Point2D,
  closed: boolean, options: GhostRenderOptions
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
 * Render ghost for a single entity (strategy dispatcher)
 */
export function renderSingleGhostEntity(
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
