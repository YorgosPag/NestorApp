/**
 * @module systems/guides/guide-renderer
 * @description Canvas renderer for construction guide lines
 *
 * Draws infinite guide lines spanning the full viewport, similar to
 * GridRenderer's axis lines but with configurable dash patterns,
 * colors per axis type, and ghost-preview capability.
 *
 * Split into SRP modules (ADR-065):
 * - guide-markers-renderer.ts — construction points & intersection markers
 * - guide-annotations-renderer.ts — dimension labels & axis label bubbles
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @see rendering/ui/grid/GridRenderer.ts (coordinate transform pattern)
 * @since 2026-02-19
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { Guide, GuideRenderStyle, ConstructionPoint } from './guide-types';
import type { GridAxis } from '../../ai-assistant/grid-types';
import { GUIDE_COLORS, DEFAULT_GUIDE_STYLE, GHOST_GUIDE_STYLE, LOCKED_GUIDE_OPACITY_FACTOR, LOCKED_GUIDE_DASH_PATTERN, SELECTED_GUIDE_STYLE, TEMPORARY_GUIDE_STYLE } from './guide-types';
import { HOVER_HIGHLIGHT } from '../../config/color-config';
import { pixelPerfect } from '../../rendering/entities/shared/geometry-rendering-utils';
import { WORLD_ORIGIN } from '../../config/geometry-constants';

// SRP modules (ADR-065)
import { renderConstructionPoints, drawIntersectionMarkers, drawDiagonalIntersectionMarkers } from './guide-markers-renderer';
import { renderGuideDimensions, renderGuideBubbles } from './guide-annotations-renderer';

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
   */
  renderGuides(
    ctx: CanvasRenderingContext2D,
    guides: readonly Guide[],
    transform: ViewTransform,
    viewport: Viewport,
    highlightedGuideId?: string | null,
    selectedGuideIds?: ReadonlySet<string>,
  ): void {
    if (guides.length === 0) return;

    ctx.save();

    const xPositions: number[] = [];
    const yPositions: number[] = [];
    const diagonalGuides: Array<{ guide: Guide; screenStart: Point2D; screenEnd: Point2D }> = [];

    for (const guide of guides) {
      if (!guide.visible) continue;

      const isHighlighted = guide.id === highlightedGuideId;
      const isSelected = selectedGuideIds?.has(guide.id) ?? false;

      // ADR-189 §3.3: Diagonal (XZ) guides — finite line segment
      if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
        const baseStyle = isSelected ? SELECTED_GUIDE_STYLE : this.resolveDiagonalStyle();
        const style = this.applyLockedMuting(baseStyle, guide.locked);
        const { screenStart, screenEnd } = this.drawDiagonalGuideLine(
          ctx, guide.startPoint, guide.endPoint, transform, viewport, style, isHighlighted || isSelected,
        );
        diagonalGuides.push({ guide, screenStart, screenEnd });
        continue;
      }

      // Axis-aligned guides (X / Y)
      const baseStyle = isSelected ? SELECTED_GUIDE_STYLE : this.resolveStyle(guide);
      const style = this.applyLockedMuting(baseStyle, guide.locked);
      const screenPos = this.guideOffsetToScreen(guide.axis, guide.offset, transform, viewport);

      if (guide.axis === 'X' && (screenPos < -1 || screenPos > viewport.width + 1)) continue;
      if (guide.axis === 'Y' && (screenPos < -1 || screenPos > viewport.height + 1)) continue;

      this.drawGuideLine(ctx, guide.axis, screenPos, viewport, style, isHighlighted || isSelected);

      if (guide.axis === 'X') xPositions.push(screenPos);
      else yPositions.push(screenPos);
    }

    // Intersection markers
    if (xPositions.length > 0 && yPositions.length > 0) {
      drawIntersectionMarkers(ctx, xPositions, yPositions, viewport);
    }
    if (diagonalGuides.length > 0 && (xPositions.length > 0 || yPositions.length > 0)) {
      drawDiagonalIntersectionMarkers(ctx, diagonalGuides, xPositions, yPositions, viewport);
    }

    ctx.restore();
  }

  // ── Ghost (Preview) Render ──

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

  // ── Delegated: Markers & Annotations ──

  renderConstructionPoints(
    ctx: CanvasRenderingContext2D,
    points: readonly ConstructionPoint[],
    transform: ViewTransform,
    viewport: Viewport,
    highlightedPointId?: string | null,
    snappedPointId?: string | null,
  ): void {
    renderConstructionPoints(ctx, points, transform, viewport, highlightedPointId, snappedPointId);
  }

  renderGuideDimensions(
    ctx: CanvasRenderingContext2D,
    guides: readonly Guide[],
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    renderGuideDimensions(ctx, guides, this.guideOffsetToScreen.bind(this), transform, viewport);
  }

  renderGuideBubbles(
    ctx: CanvasRenderingContext2D,
    guides: readonly Guide[],
    transform: ViewTransform,
    viewport: Viewport,
  ): void {
    renderGuideBubbles(ctx, guides, this.guideOffsetToScreen.bind(this), transform, viewport);
  }

  // ── Internals ──

  /**
   * Convert a guide's world-space offset to a screen-space pixel position.
   */
  guideOffsetToScreen(
    axis: GridAxis,
    offset: number,
    transform: ViewTransform,
    viewport: Viewport,
  ): number {
    const { CoordinateTransforms: CT } = require('../../rendering/core/CoordinateTransforms');

    if (axis === 'X') {
      const screen: Point2D = CT.worldToScreen({ x: offset, y: WORLD_ORIGIN.y }, transform, viewport);
      return screen.x;
    }

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
    highlighted = false,
  ): void {
    const pos = pixelPerfect(screenPos);

    ctx.strokeStyle = style.color;
    ctx.setLineDash(style.dashPattern);

    if (highlighted) {
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

    if (axis === 'X') {
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, viewport.height);
    } else {
      ctx.moveTo(0, pos);
      ctx.lineTo(viewport.width, pos);
    }

    ctx.stroke();

    if (highlighted) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    ctx.setLineDash([]);
  }

  // ── Diagonal Guide Rendering (ADR-189 §3.3) ──

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

    if (highlighted) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    ctx.setLineDash([]);
    return { screenStart, screenEnd };
  }

  // ── Style Resolution ──

  private resolveDiagonalStyle(): GuideRenderStyle {
    return { ...DEFAULT_GUIDE_STYLE, color: GUIDE_COLORS.XZ, dashPattern: [6, 3] };
  }

  private resolveStyle(guide: Guide): GuideRenderStyle {
    if (guide.temporary) return { ...TEMPORARY_GUIDE_STYLE };

    if (guide.style) {
      return {
        color: guide.style.color,
        lineWidth: guide.style.lineWidth,
        dashPattern: [...guide.style.dashPattern],
        opacity: DEFAULT_GUIDE_STYLE.opacity,
      };
    }

    if (guide.parentId) return { ...DEFAULT_GUIDE_STYLE, color: GUIDE_COLORS.PARALLEL };

    const color = guide.axis === 'X' ? GUIDE_COLORS.X : GUIDE_COLORS.Y;
    return { ...DEFAULT_GUIDE_STYLE, color };
  }

  private applyLockedMuting(style: GuideRenderStyle, locked: boolean): GuideRenderStyle {
    if (!locked) return style;
    return {
      ...style,
      opacity: style.opacity * LOCKED_GUIDE_OPACITY_FACTOR,
      dashPattern: [...LOCKED_GUIDE_DASH_PATTERN],
    };
  }
}
