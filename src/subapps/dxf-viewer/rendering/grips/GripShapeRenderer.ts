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
// 🏢 ADR-058/064: Centralized Canvas Primitives
import { addCirclePath, addDiamondPath } from '../primitives/canvasPaths';
import { RENDER_LINE_WIDTHS } from '../../config/text-rendering-config';

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
  /**
   * Batch-render N square grips with a single ctx.save()/restore().
   * O(1) state changes instead of O(n) — use when rendering many same-colored grips.
   */
  renderSquareGripsBatch(
    ctx: CanvasRenderingContext2D,
    positions: Point2D[],
    size: number,
    fillColor: string,
    outlineColor: string
  ): void {
    if (positions.length === 0) return;
    const half = size / 2;
    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = RENDER_LINE_WIDTHS.GRIP_OUTLINE;
    for (const pos of positions) {
      ctx.fillRect(pos.x - half, pos.y - half, size, size);
      ctx.strokeRect(pos.x - half, pos.y - half, size, size);
    }
    ctx.restore();
  }

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

      // ADR-393 v2 — BIM parametric handle icon glyphs.
      case 'move':
        this.renderMoveGlyph(ctx, position, size, fillColor);
        break;

      case 'rotation':
        this.renderRotationGlyph(ctx, position, size, fillColor);
        break;

      default:
        // Fallback to square for unknown shapes
        renderSquareGrip(ctx, position, size, fillColor, outlineColor);
    }
  }

  /**
   * Render outer square ring overlay (close indicator or selection indicator)
   *
   * @param ctx - Canvas context
   * @param position - Center position
   * @param outerSize - Total outer size (grip size + extra pixels)
   * @param color - Ring stroke color
   * @param lineWidth - Ring stroke width
   */
  renderSquareRing(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    outerSize: number,
    color: string,
    lineWidth: number
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    const half = outerSize / 2;
    ctx.strokeRect(position.x - half, position.y - half, outerSize, outerSize);
    ctx.restore();
  }

  /**
   * Render outer diamond ring overlay (edge midpoint warm/hot indicator)
   *
   * @param ctx - Canvas context
   * @param position - Center position
   * @param halfSize - Distance from center to each diamond point
   * @param color - Ring stroke color
   * @param lineWidth - Ring stroke width
   */
  renderDiamondRing(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    halfSize: number,
    color: string,
    lineWidth: number
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    addDiamondPath(ctx, position, halfSize * 2);
    ctx.stroke();
    ctx.restore();
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

    // 🏢 ADR-058: Use centralized canvas primitives
    ctx.beginPath();
    addCirclePath(ctx, position, radius);
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
    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineWidth;

    // 🏢 ADR-064: Use centralized shape primitives
    ctx.beginPath();
    addDiamondPath(ctx, position, size);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * ADR-393 v2 — MOVE handle glyph: a 4-way arrow (basePoint translate). Arm
   * length scales with the grip size so it reads as an icon, not a dot. Drawn
   * in the temperature `color` so it warms/heats on hover/drag.
   */
  private renderMoveGlyph(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    size: number,
    color: string,
  ): void {
    const arm = Math.max(5, size);
    const head = Math.max(2.5, size * 0.5);
    const { x, y } = position;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - arm, y);
    ctx.lineTo(x + arm, y);
    ctx.moveTo(x, y - arm);
    ctx.lineTo(x, y + arm);
    ctx.stroke();
    this.fillArrowHead(ctx, x + arm, y, 1, 0, head);
    this.fillArrowHead(ctx, x - arm, y, -1, 0, head);
    this.fillArrowHead(ctx, x, y - arm, 0, -1, head);
    this.fillArrowHead(ctx, x, y + arm, 0, 1, head);
    ctx.restore();
  }

  /**
   * ADR-393 v2 — ROTATION handle glyph: a ~270° curved arrow (direction
   * rotate). Marks the rotate pivot; drawn in the temperature `color`.
   */
  private renderRotationGlyph(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    size: number,
    color: string,
  ): void {
    const r = Math.max(5, size * 0.9);
    const head = Math.max(2.5, size * 0.5);
    const { x, y } = position;
    const start = -Math.PI * 0.75;
    const end = Math.PI * 0.9;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, r, start, end);
    ctx.stroke();
    // Arrowhead at the arc end, pointing along the CCW tangent (−sin, cos).
    const ex = x + r * Math.cos(end);
    const ey = y + r * Math.sin(end);
    this.fillArrowHead(ctx, ex, ey, -Math.sin(end), Math.cos(end), head);
    ctx.restore();
  }

  /**
   * Fill a small triangular arrowhead with its tip at (tipX,tipY) pointing
   * along the unit vector (ux,uy). `h` is the head length.
   */
  private fillArrowHead(
    ctx: CanvasRenderingContext2D,
    tipX: number,
    tipY: number,
    ux: number,
    uy: number,
    h: number,
  ): void {
    const px = -uy;
    const py = ux;
    const baseX = tipX - h * ux;
    const baseY = tipY - h * uy;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX + h * 0.6 * px, baseY + h * 0.6 * py);
    ctx.lineTo(baseX - h * 0.6 * px, baseY - h * 0.6 * py);
    ctx.closePath();
    ctx.fill();
  }
}
