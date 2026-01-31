/**
 * =============================================================================
 * ENTERPRISE: Canvas Drawing Primitives - Single Source of Truth (SSoT)
 * =============================================================================
 *
 * Pattern: Autodesk AutoCAD, Bentley MicroStation, Dassault CATIA
 *
 * PURPOSE:
 * Centralized canvas drawing primitives that use ctx.ellipse() internally
 * instead of ctx.arc() to ensure consistent rendering across all browsers
 * and canvas configurations.
 *
 * BACKGROUND:
 * ctx.arc() was found to be unreliable in certain canvas configurations
 * (specifically with HiDPI setTransform scaling). ctx.ellipse() works
 * consistently in all tested scenarios.
 *
 * USAGE:
 * Import these functions instead of using ctx.arc() directly:
 *
 *   import { drawCircle, drawArc } from '@/subapps/dxf-viewer/rendering/primitives/canvasPaths';
 *
 *   drawCircle(ctx, center, radius);
 *   drawArc(ctx, center, radius, startAngle, endAngle);
 *
 * @file canvasPaths.ts
 * @created 2026-01-31
 * @updated 2026-01-31
 */

import type { Point2D } from '../types/Types';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for drawing operations
 */
export interface DrawOptions {
  /** Stroke color (CSS color string) */
  strokeStyle?: string;
  /** Fill color (CSS color string) */
  fillStyle?: string;
  /** Line width in pixels */
  lineWidth?: number;
  /** Line dash pattern */
  lineDash?: number[];
  /** Whether to stroke the path */
  stroke?: boolean;
  /** Whether to fill the path */
  fill?: boolean;
}

/**
 * Default draw options
 */
const DEFAULT_OPTIONS: Required<DrawOptions> = {
  strokeStyle: '#000000',
  fillStyle: 'transparent',
  lineWidth: 1,
  lineDash: [],
  stroke: true,
  fill: false,
};

// =============================================================================
// Private Helpers
// =============================================================================

/**
 * Apply drawing options to canvas context
 */
function applyOptions(ctx: CanvasRenderingContext2D, options: DrawOptions): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  ctx.strokeStyle = opts.strokeStyle;
  ctx.fillStyle = opts.fillStyle;
  ctx.lineWidth = opts.lineWidth;
  ctx.setLineDash(opts.lineDash);
}

/**
 * Finish path by stroking and/or filling
 */
function finishPath(ctx: CanvasRenderingContext2D, options: DrawOptions): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (opts.fill) {
    ctx.fill();
  }
  if (opts.stroke) {
    ctx.stroke();
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Draw a circle using ellipse() instead of arc()
 *
 * This is the CANONICAL way to draw circles in the DXF Viewer.
 * Uses ctx.ellipse() internally for consistent rendering.
 *
 * @param ctx - Canvas rendering context
 * @param center - Center point of the circle
 * @param radius - Radius of the circle
 * @param options - Drawing options (stroke, fill, colors, etc.)
 *
 * @example
 * drawCircle(ctx, { x: 100, y: 100 }, 50, { strokeStyle: '#FF0000' });
 */
export function drawCircle(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  options: DrawOptions = {}
): void {
  if (radius <= 0) return;

  ctx.save();
  applyOptions(ctx, options);

  ctx.beginPath();
  // Use ellipse() instead of arc() for consistent rendering
  ctx.ellipse(center.x, center.y, radius, radius, 0, 0, Math.PI * 2);

  finishPath(ctx, options);
  ctx.restore();
}

/**
 * Draw an arc using ellipse() instead of arc()
 *
 * This is the CANONICAL way to draw arcs in the DXF Viewer.
 * Uses ctx.ellipse() internally for consistent rendering.
 *
 * @param ctx - Canvas rendering context
 * @param center - Center point of the arc
 * @param radius - Radius of the arc
 * @param startAngle - Start angle in radians
 * @param endAngle - End angle in radians
 * @param counterClockwise - Draw counter-clockwise (default: false)
 * @param options - Drawing options (stroke, fill, colors, etc.)
 *
 * @example
 * drawArc(ctx, { x: 100, y: 100 }, 50, 0, Math.PI, false, { strokeStyle: '#00FF00' });
 */
export function drawArc(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  startAngle: number,
  endAngle: number,
  counterClockwise: boolean = false,
  options: DrawOptions = {}
): void {
  if (radius <= 0) return;

  ctx.save();
  applyOptions(ctx, options);

  ctx.beginPath();
  // Use ellipse() instead of arc() for consistent rendering
  ctx.ellipse(center.x, center.y, radius, radius, 0, startAngle, endAngle, counterClockwise);

  finishPath(ctx, options);
  ctx.restore();
}

/**
 * Draw a circle path without stroking/filling (for complex paths)
 *
 * Use this when you need to add a circle to an existing path,
 * or when you want to handle stroke/fill manually.
 *
 * @param ctx - Canvas rendering context
 * @param center - Center point of the circle
 * @param radius - Radius of the circle
 */
export function addCirclePath(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number
): void {
  if (radius <= 0) return;
  ctx.ellipse(center.x, center.y, radius, radius, 0, 0, Math.PI * 2);
}

/**
 * Draw an arc path without stroking/filling (for complex paths)
 *
 * Use this when you need to add an arc to an existing path,
 * or when you want to handle stroke/fill manually.
 *
 * @param ctx - Canvas rendering context
 * @param center - Center point of the arc
 * @param radius - Radius of the arc
 * @param startAngle - Start angle in radians
 * @param endAngle - End angle in radians
 * @param counterClockwise - Draw counter-clockwise (default: false)
 */
export function addArcPath(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  startAngle: number,
  endAngle: number,
  counterClockwise: boolean = false
): void {
  if (radius <= 0) return;
  ctx.ellipse(center.x, center.y, radius, radius, 0, startAngle, endAngle, counterClockwise);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert degrees to radians
 * Useful for DXF files which often use degrees
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * TAU constant (2 * PI) for full circle
 */
export const TAU = Math.PI * 2;
