/**
 * @module systems/guides/guide-renderer
 * @description Canvas renderer for construction guide lines
 *
 * Draws infinite guide lines spanning the full viewport, similar to
 * GridRenderer's axis lines but with configurable dash patterns,
 * colors per axis type, and ghost-preview capability.
 *
 * Rendering is intentionally lightweight — guides are simple dashed
 * lines, so the entire pass stays well under 1 ms per frame.
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @see rendering/ui/grid/GridRenderer.ts (coordinate transform pattern)
 * @since 2026-02-19
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { Guide, GuideRenderStyle } from './guide-types';
import type { GridAxis } from '../../ai-assistant/grid-types';
import { GUIDE_COLORS, DEFAULT_GUIDE_STYLE, GHOST_GUIDE_STYLE, HIGHLIGHT_GUIDE_STYLE } from './guide-types';
// ADR-088: Pixel-perfect alignment for crisp 1px rendering
import { pixelPerfect } from '../../rendering/entities/shared/geometry-rendering-utils';
// ADR-118: Centralized coordinate transforms (require to avoid circular deps — same as GridRenderer)
import { WORLD_ORIGIN } from '../../config/geometry-constants';

// ============================================================================
// GUIDE RENDERER
// ============================================================================

/**
 * Stateless renderer for construction guide lines.
 *
 * Follows the same coordinate-transform approach as `GridRenderer`:
 * 1. Convert guide's world offset → screen position via `CoordinateTransforms.worldToScreen`
 * 2. Draw a full-viewport-spanning line (vertical or horizontal)
 * 3. Apply per-axis color, dash pattern, and opacity
 */
export class GuideRenderer {

  // ── Main Render ──

  /**
   * Render all visible guides onto the canvas.
   *
   * Call this between grid rendering (step 2) and ruler rendering (step 3)
   * in the DxfCanvas render loop — "step 2.5".
   */
  renderGuides(
    ctx: CanvasRenderingContext2D,
    guides: readonly Guide[],
    transform: ViewTransform,
    viewport: Viewport,
    highlightedGuideId?: string | null,
  ): void {
    if (guides.length === 0) return;

    ctx.save();

    // Collect screen positions for intersection markers
    const xPositions: number[] = [];
    const yPositions: number[] = [];

    for (const guide of guides) {
      if (!guide.visible) continue;

      const isHighlighted = guide.id === highlightedGuideId;
      const style = isHighlighted ? HIGHLIGHT_GUIDE_STYLE : this.resolveStyle(guide);
      const screenPos = this.guideOffsetToScreen(guide.axis, guide.offset, transform, viewport);

      // Skip if entirely off-screen
      if (guide.axis === 'X' && (screenPos < -1 || screenPos > viewport.width + 1)) continue;
      if (guide.axis === 'Y' && (screenPos < -1 || screenPos > viewport.height + 1)) continue;

      this.drawGuideLine(ctx, guide.axis, screenPos, viewport, style);

      // Collect for intersections
      if (guide.axis === 'X') xPositions.push(screenPos);
      else yPositions.push(screenPos);
    }

    // Draw intersection markers (small ✕) where X and Y guides cross
    if (xPositions.length > 0 && yPositions.length > 0) {
      this.drawIntersectionMarkers(ctx, xPositions, yPositions, viewport);
    }

    ctx.restore();
  }

  // ── Ghost (Preview) Render ──

  /**
   * Render a semi-transparent "ghost" guide line during placement.
   * Called when the guide tool is active and the cursor moves.
   */
  renderGhostGuide(
    ctx: CanvasRenderingContext2D,
    axis: GridAxis,
    worldOffset: number,
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    ctx.save();

    const screenPos = this.guideOffsetToScreen(axis, worldOffset, transform, viewport);
    this.drawGuideLine(ctx, axis, screenPos, viewport, GHOST_GUIDE_STYLE);

    ctx.restore();
  }

  // ── Internals ──

  /**
   * Convert a guide's world-space offset to a screen-space pixel position.
   *
   * - X guide (vertical line): offset is on the world X-axis → returns screen X
   * - Y guide (horizontal line): offset is on the world Y-axis → returns screen Y
   *
   * Uses the same `CoordinateTransforms.worldToScreen` formula as `GridRenderer`
   * to guarantee guides align perfectly with the grid and entities.
   */
  private guideOffsetToScreen(
    axis: GridAxis,
    offset: number,
    transform: ViewTransform,
    viewport: Viewport,
  ): number {
    // Lazy require — same technique as GridRenderer to avoid circular deps
    const { CoordinateTransforms: CT } = require('../../rendering/core/CoordinateTransforms');

    if (axis === 'X') {
      // Vertical guide: world point at (offset, 0) → we need screen X
      const screen: Point2D = CT.worldToScreen({ x: offset, y: WORLD_ORIGIN.y }, transform, viewport);
      return screen.x;
    }

    // Horizontal guide: world point at (0, offset) → we need screen Y
    const screen: Point2D = CT.worldToScreen({ x: WORLD_ORIGIN.x, y: offset }, transform, viewport);
    return screen.y;
  }

  /**
   * Draw a single guide line spanning the full viewport.
   */
  private drawGuideLine(
    ctx: CanvasRenderingContext2D,
    axis: GridAxis,
    screenPos: number,
    viewport: Viewport,
    style: GuideRenderStyle,
  ): void {
    const pos = pixelPerfect(screenPos);

    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    ctx.globalAlpha = style.opacity;
    ctx.setLineDash(style.dashPattern);

    ctx.beginPath();

    if (axis === 'X') {
      // Vertical line from top to bottom
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, viewport.height);
    } else {
      // Horizontal line from left to right
      ctx.moveTo(0, pos);
      ctx.lineTo(viewport.width, pos);
    }

    ctx.stroke();

    // Reset dash pattern to avoid leaking into subsequent draws
    ctx.setLineDash([]);
  }

  /**
   * Resolve the render style for a guide based on its axis and parentId.
   */
  private resolveStyle(guide: Guide): GuideRenderStyle {
    // Parallel guides (created from a reference) get the purple style
    if (guide.parentId) {
      return { ...DEFAULT_GUIDE_STYLE, color: GUIDE_COLORS.PARALLEL };
    }

    // Standard axis coloring
    const color = guide.axis === 'X' ? GUIDE_COLORS.X : GUIDE_COLORS.Y;
    return { ...DEFAULT_GUIDE_STYLE, color };
  }

  // ── Intersection Markers ──

  /** Small ✕ size in pixels */
  private static readonly MARKER_SIZE = 4;

  /**
   * Draw small ✕ markers at every intersection of X and Y guides.
   * Provides visual reference points at grid intersections.
   */
  private drawIntersectionMarkers(
    ctx: CanvasRenderingContext2D,
    xPositions: readonly number[],
    yPositions: readonly number[],
    viewport: Viewport,
  ): void {
    const size = GuideRenderer.MARKER_SIZE;

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.8;

    for (const sx of xPositions) {
      // Skip if off-screen horizontally
      if (sx < -size || sx > viewport.width + size) continue;

      for (const sy of yPositions) {
        // Skip if off-screen vertically
        if (sy < -size || sy > viewport.height + size) continue;

        const px = pixelPerfect(sx);
        const py = pixelPerfect(sy);
        ctx.beginPath();
        ctx.moveTo(px - size, py - size);
        ctx.lineTo(px + size, py + size);
        ctx.moveTo(px + size, py - size);
        ctx.lineTo(px - size, py + size);
        ctx.stroke();
      }
    }
  }
}
