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
import type { Guide, GuideRenderStyle, ConstructionPoint } from './guide-types';
import type { GridAxis } from '../../ai-assistant/grid-types';
import { GUIDE_COLORS, DEFAULT_GUIDE_STYLE, GHOST_GUIDE_STYLE } from './guide-types';
// 🏢 Centralized hover highlight config — shadowBlur glow for highlighted guides
import { HOVER_HIGHLIGHT } from '../../config/color-config';
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

    // ADR-189 §3.3: Collect diagonal guides for intersection calculation
    const diagonalGuides: Array<{ guide: Guide; screenStart: Point2D; screenEnd: Point2D }> = [];

    for (const guide of guides) {
      if (!guide.visible) continue;

      const isHighlighted = guide.id === highlightedGuideId;

      // ADR-189 §3.3: Diagonal (XZ) guides — finite line segment
      if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
        // 🏢 Centralized: Keep original style, glow is applied by drawDiagonalGuideLine
        const style = this.resolveDiagonalStyle();
        const { screenStart, screenEnd } = this.drawDiagonalGuideLine(
          ctx, guide.startPoint, guide.endPoint, transform, viewport, style, isHighlighted,
        );
        diagonalGuides.push({ guide, screenStart, screenEnd });
        continue;
      }

      // Axis-aligned guides (X / Y)
      // 🏢 Centralized: Keep original style — glow is applied inside drawGuideLine when highlighted
      const style = this.resolveStyle(guide);
      const screenPos = this.guideOffsetToScreen(guide.axis, guide.offset, transform, viewport);

      // Skip if entirely off-screen
      if (guide.axis === 'X' && (screenPos < -1 || screenPos > viewport.width + 1)) continue;
      if (guide.axis === 'Y' && (screenPos < -1 || screenPos > viewport.height + 1)) continue;

      this.drawGuideLine(ctx, guide.axis, screenPos, viewport, style, isHighlighted);

      // Collect for intersections
      if (guide.axis === 'X') xPositions.push(screenPos);
      else yPositions.push(screenPos);
    }

    // Draw intersection markers (small ✕) where X and Y guides cross
    if (xPositions.length > 0 && yPositions.length > 0) {
      this.drawIntersectionMarkers(ctx, xPositions, yPositions, viewport);
    }

    // ADR-189 §3.3: Draw intersection markers where diagonal guides cross axis-aligned guides
    if (diagonalGuides.length > 0 && (xPositions.length > 0 || yPositions.length > 0)) {
      this.drawDiagonalIntersectionMarkers(ctx, diagonalGuides, xPositions, yPositions, viewport);
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
   * 🏢 Centralized hover glow: when highlighted, applies shadowBlur from HOVER_HIGHLIGHT.GUIDE
   */
  private drawGuideLine(
    ctx: CanvasRenderingContext2D,
    axis: GridAxis,
    screenPos: number,
    viewport: Viewport,
    style: GuideRenderStyle,
    highlighted = false,
  ): void {
    const pos = pixelPerfect(screenPos);

    ctx.strokeStyle = style.color;
    ctx.setLineDash(style.dashPattern);

    if (highlighted) {
      // 🏢 Centralized glow — keep original color, add soft glow (consistent with entity hover)
      ctx.lineWidth = HOVER_HIGHLIGHT.GUIDE.lineWidth;
      ctx.globalAlpha = HOVER_HIGHLIGHT.GUIDE.opacity;
      ctx.setLineDash([]); // Solid line during hover for clarity
      ctx.shadowColor = HOVER_HIGHLIGHT.GUIDE.glowColor;
      ctx.shadowBlur = HOVER_HIGHLIGHT.GUIDE.shadowBlur;
    } else {
      ctx.lineWidth = style.lineWidth;
      ctx.globalAlpha = style.opacity;
    }

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

    // Reset shadow and dash pattern to avoid leaking into subsequent draws
    if (highlighted) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    ctx.setLineDash([]);
  }

  // ── Diagonal Guide Rendering (ADR-189 §3.3) ──

  /**
   * Draw a diagonal guide line segment (world coordinates → screen).
   * Returns screen positions for intersection marker calculations.
   * 🏢 Centralized hover glow: when highlighted, applies shadowBlur from HOVER_HIGHLIGHT.GUIDE
   */
  private drawDiagonalGuideLine(
    ctx: CanvasRenderingContext2D,
    worldStart: Point2D,
    worldEnd: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
    style: GuideRenderStyle,
    highlighted = false,
  ): { screenStart: Point2D; screenEnd: Point2D } {
    const { CoordinateTransforms: CT } = require('../../rendering/core/CoordinateTransforms');
    const screenStart: Point2D = CT.worldToScreen(worldStart, transform, viewport);
    const screenEnd: Point2D = CT.worldToScreen(worldEnd, transform, viewport);

    ctx.strokeStyle = style.color;
    ctx.setLineDash(style.dashPattern);

    if (highlighted) {
      // 🏢 Centralized glow — keep original color, add soft glow (consistent with entity hover)
      ctx.lineWidth = HOVER_HIGHLIGHT.GUIDE.lineWidth;
      ctx.globalAlpha = HOVER_HIGHLIGHT.GUIDE.opacity;
      ctx.setLineDash([]);
      ctx.shadowColor = HOVER_HIGHLIGHT.GUIDE.glowColor;
      ctx.shadowBlur = HOVER_HIGHLIGHT.GUIDE.shadowBlur;
    } else {
      ctx.lineWidth = style.lineWidth;
      ctx.globalAlpha = style.opacity;
    }

    ctx.beginPath();
    ctx.moveTo(screenStart.x, screenStart.y);
    ctx.lineTo(screenEnd.x, screenEnd.y);
    ctx.stroke();

    // Reset shadow and dash pattern
    if (highlighted) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    ctx.setLineDash([]);
    return { screenStart, screenEnd };
  }

  /**
   * Render a ghost preview for diagonal guide during 3-click placement.
   */
  renderGhostDiagonalGuide(
    ctx: CanvasRenderingContext2D,
    worldStart: Point2D,
    worldEnd: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    ctx.save();
    this.drawDiagonalGuideLine(ctx, worldStart, worldEnd, transform, viewport, GHOST_GUIDE_STYLE);
    ctx.restore();
  }

  /**
   * Resolve the render style for a diagonal (XZ) guide.
   */
  private resolveDiagonalStyle(): GuideRenderStyle {
    return { ...DEFAULT_GUIDE_STYLE, color: GUIDE_COLORS.XZ, dashPattern: [6, 3] };
  }

  /**
   * Draw intersection markers where diagonal guides cross axis-aligned guides.
   * For each XZ guide and X/Y guide, compute the intersection point.
   */
  private drawDiagonalIntersectionMarkers(
    ctx: CanvasRenderingContext2D,
    diagonals: Array<{ guide: Guide; screenStart: Point2D; screenEnd: Point2D }>,
    xScreenPositions: readonly number[],
    yScreenPositions: readonly number[],
    viewport: Viewport,
  ): void {
    const size = GuideRenderer.MARKER_SIZE;

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.8;

    for (const { screenStart: s, screenEnd: e } of diagonals) {
      const dx = e.x - s.x;
      const dy = e.y - s.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;

      // Intersection with vertical (X) guides: solve for screen X = xPos
      for (const xPos of xScreenPositions) {
        if (Math.abs(dx) < 0.001) continue; // Parallel to vertical — no intersection
        const t = (xPos - s.x) / dx;
        if (t < 0 || t > 1) continue; // Outside segment
        const iy = s.y + t * dy;
        if (iy < -size || iy > viewport.height + size) continue;

        const px = pixelPerfect(xPos);
        const py = pixelPerfect(iy);
        ctx.beginPath();
        ctx.moveTo(px - size, py - size);
        ctx.lineTo(px + size, py + size);
        ctx.moveTo(px + size, py - size);
        ctx.lineTo(px - size, py + size);
        ctx.stroke();
      }

      // Intersection with horizontal (Y) guides: solve for screen Y = yPos
      for (const yPos of yScreenPositions) {
        if (Math.abs(dy) < 0.001) continue; // Parallel to horizontal — no intersection
        const t = (yPos - s.y) / dy;
        if (t < 0 || t > 1) continue; // Outside segment
        const ix = s.x + t * dx;
        if (ix < -size || ix > viewport.width + size) continue;

        const px = pixelPerfect(ix);
        const py = pixelPerfect(yPos);
        ctx.beginPath();
        ctx.moveTo(px - size, py - size);
        ctx.lineTo(px + size, py + size);
        ctx.moveTo(px + size, py - size);
        ctx.lineTo(px - size, py + size);
        ctx.stroke();
      }
    }
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

  // ── Construction Point Rendering (ADR-189 §3.7-3.16) ──

  /** Size of construction point markers in pixels */
  private static readonly CONSTRUCTION_POINT_SIZE = 5;

  /**
   * Render construction snap points (X markers) onto the canvas.
   * Called after guide lines — points render on top of guides.
   *
   * @param highlightedPointId - Point to highlight in gold (for delete tool hover)
   * @param snappedPointId - Point currently snapped to (renders as + instead of ✕)
   */
  renderConstructionPoints(
    ctx: CanvasRenderingContext2D,
    points: readonly ConstructionPoint[],
    transform: ViewTransform,
    viewport: Viewport,
    highlightedPointId?: string | null,
    snappedPointId?: string | null,
  ): void {
    if (points.length === 0) return;

    const { CoordinateTransforms: CT } = require('../../rendering/core/CoordinateTransforms');
    const size = GuideRenderer.CONSTRUCTION_POINT_SIZE;

    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;

    for (const cpt of points) {
      if (!cpt.visible) continue;

      const screen: Point2D = CT.worldToScreen(cpt.point, transform, viewport);
      const sx = screen.x;
      const sy = screen.y;

      // Skip if off-screen
      if (sx < -size || sx > viewport.width + size) continue;
      if (sy < -size || sy > viewport.height + size) continue;

      const px = pixelPerfect(sx);
      const py = pixelPerfect(sy);
      const isHighlighted = cpt.id === highlightedPointId;
      const isSnapped = cpt.id === snappedPointId;

      this.drawConstructionPointMarker(ctx, px, py, size, isHighlighted, isSnapped);
    }

    ctx.restore();
  }

  /**
   * Draw a single construction point marker.
   * - Default: ✕ (X shape) in white
   * - Highlighted: ✕ in gold with glow (delete hover)
   * - Snapped: + (plus shape) in white — §3.5 UX feedback
   */
  private drawConstructionPointMarker(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    size: number,
    highlighted: boolean,
    snapped: boolean,
  ): void {
    if (highlighted) {
      // Gold glow for delete hover
      ctx.strokeStyle = HOVER_HIGHLIGHT.GUIDE.glowColor;
      ctx.globalAlpha = HOVER_HIGHLIGHT.GUIDE.opacity;
      ctx.shadowColor = HOVER_HIGHLIGHT.GUIDE.glowColor;
      ctx.shadowBlur = HOVER_HIGHLIGHT.GUIDE.shadowBlur;
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
    }

    ctx.beginPath();

    if (snapped) {
      // + shape (horizontal + vertical lines) — snap feedback
      ctx.moveTo(px - size, py);
      ctx.lineTo(px + size, py);
      ctx.moveTo(px, py - size);
      ctx.lineTo(px, py + size);
    } else {
      // ✕ shape (diagonal cross) — default
      ctx.moveTo(px - size, py - size);
      ctx.lineTo(px + size, py + size);
      ctx.moveTo(px + size, py - size);
      ctx.lineTo(px - size, py + size);
    }

    ctx.stroke();

    // Reset shadow
    if (highlighted) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
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
