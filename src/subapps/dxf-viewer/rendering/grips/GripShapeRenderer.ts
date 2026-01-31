/**
 * @fileoverview Grip Shape Renderer - Shape Rendering Logic
 * @description Renders different grip shapes (square/circle/diamond)
 * @author Enterprise Architecture Team
 * @date 2027-01-27
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards
 */

import type { Point2D } from '../types/Types';
import type { GripShape } from './types';
import { renderSquareGrip } from '../entities/shared/geometry-rendering-utils';

// ============================================================================
// GRIP SHAPE RENDERER CLASS
// ============================================================================

/**
 * Enterprise Grip Shape Renderer
 * Renders different grip shapes with fill and outline
 *
 * Supported shapes:
 * - Square: Standard AutoCAD grip (delegates to existing renderSquareGrip)
 * - Circle: Alternative shape (future enhancement)
 * - Diamond: Special case grips (future enhancement)
 *
 * @example
 * ```typescript
 * const renderer = new GripShapeRenderer();
 * renderer.renderShape(
 *   ctx,
 *   { x: 100, y: 200 },
 *   8,
 *   'square',
 *   '#5F9ED1',
 *   '#000000',
 *   1
 * );
 * ```
 */
export class GripShapeRenderer {
  /**
   * Render grip shape with fill and outline
   *
   * @param ctx - Canvas rendering context
   * @param position - Screen position of grip center
   * @param size - Grip size in pixels
   * @param shape - Shape type (square/circle/diamond)
   * @param fillColor - Fill color (hex string)
   * @param outlineColor - Outline color (hex string)
   * @param outlineWidth - Outline width in pixels
   */
  renderShape(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    size: number,
    shape: GripShape,
    fillColor: string,
    outlineColor: string,
    outlineWidth: number
  ): void {
    switch (shape) {
      case 'square':
        // Delegate to existing centralized utility
        renderSquareGrip(ctx, position, size, fillColor, outlineColor);
        break;

      case 'circle':
        this.renderCircle(ctx, position, size, fillColor, outlineColor, outlineWidth);
        break;

      case 'diamond':
        this.renderDiamond(ctx, position, size, fillColor, outlineColor, outlineWidth);
        break;

      default:
        // Fallback to square for unknown shapes
        renderSquareGrip(ctx, position, size, fillColor, outlineColor);
    }
  }

  /**
   * Render circle grip
   * Alternative to standard square grip
   *
   * @param ctx - Canvas context
   * @param position - Center position
   * @param size - Diameter in pixels
   * @param fillColor - Fill color
   * @param outlineColor - Outline color
   * @param outlineWidth - Outline width
   */
  private renderCircle(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    size: number,
    fillColor: string,
    outlineColor: string,
    outlineWidth: number
  ): void {
    const radius = size / 2;

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineWidth;

    // 🔧 FIX (2026-01-31): Use ellipse() instead of arc() - arc() has rendering bug!
    ctx.beginPath();
    ctx.ellipse(position.x, position.y, radius, radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render diamond grip
   * Special case for certain grip types
   *
   * @param ctx - Canvas context
   * @param position - Center position
   * @param size - Size in pixels
   * @param fillColor - Fill color
   * @param outlineColor - Outline color
   * @param outlineWidth - Outline width
   */
  private renderDiamond(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    size: number,
    fillColor: string,
    outlineColor: string,
    outlineWidth: number
  ): void {
    const half = size / 2;

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineWidth;

    ctx.beginPath();
    ctx.moveTo(position.x, position.y - half); // Top
    ctx.lineTo(position.x + half, position.y); // Right
    ctx.lineTo(position.x, position.y + half); // Bottom
    ctx.lineTo(position.x - half, position.y); // Left
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}
