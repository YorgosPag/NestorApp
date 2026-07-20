/**
 * CENTRALIZED GRID RENDERER - UI Rendering System
 * ✅ ΦΑΣΗ 6: Κεντρικοποιημένο grid rendering χωρίς διπλότυπα
 */

import type { Viewport } from '../../types/Types';
import type {
  UIRenderer,
  UIRenderContext,
  UIElementSettings,
  UIRenderMetrics
} from '../core/UIRenderer';
import type {
  GridSettings,
  GridRenderMode
} from './GridTypes';
// 🏢 ADR-058: Centralized Canvas Primitives
import { addCirclePath } from '../../primitives/canvasPaths';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { WORLD_ORIGIN } from '../../../config/geometry-constants';
// 🏢 ADR-088: Pixel-perfect alignment for crisp 1px rendering
import { pixelPerfect } from '../../entities/shared/geometry-rendering-utils';
// 🌊 Adaptive grid math + pass schedule (extracted for SRP + 500-line limit)
import { renderAdaptiveGrid } from './grid-adaptive';
// 🔵 ADR-681 §5.9: dot/cross rasterisers — adaptive passes + legacy fallbacks.
import {
  paintDotMarks,
  paintCrossMarks,
  paintLegacyDotGrid,
  paintLegacyCrossGrid,
  dotRadii,
  crossArms,
  roleColor,
  applyRoleStroke,
  type GridMarkLattice,
} from './grid-mark-painters';
// Mark dxf-canvas dirty while temporal lerp is still settling.
import { markSystemsDirty } from '../../core/UnifiedFrameScheduler';
// 🪜 ADR-681 §5.7: major emphasis is DERIVED from minor, never set beside it.
import { deriveMajorGridWeight } from '../../../config/grid-emphasis';

/**
 * 🔺 CENTRALIZED GRID RENDERER
 * Single Source of Truth για grid rendering
 * Αντικαθιστά όλα τα duplicate Grid rendering code
 */
export class GridRenderer implements UIRenderer {
  readonly type = 'grid';

  private renderCount = 0;
  private lastRenderTime = 0;
  // 🌊 Temporal lerp state for adaptive minor opacity. Smooths zoom-induced
  // jumps (e.g. mouse-wheel deltas) into a gradual transition over
  // `smoothFadeDurationMs` ms instead of snapping each frame.
  private renderedMinorOpacity = 0;
  private lastFrameTimestampMs = 0;

  /**
   * Main render method - Implements UIRenderer interface
   */
  render(
    context: UIRenderContext,
    viewport: Viewport,
    settings: UIElementSettings
  ): void {
    const gridSettings = settings as GridSettings;

    // Get transform data από context
    const transformData = this.getTransformData(context);
    if (!transformData) return;

    this.renderGrid(
      context.ctx,
      viewport,
      gridSettings,
      transformData,
      'normal'
    );
  }

  /**
   * 🔺 LEGACY COMPATIBILITY
   * Direct render method για backward compatibility
   */
  renderDirect(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    mode: GridRenderMode = 'normal'
  ): void {
    this.renderGrid(ctx, viewport, settings, transform, mode);
  }

  /**
   * 🔺 CORE GRID RENDERING
   * Unified rendering logic για όλους τους modes
   */
  private renderGrid(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    mode: GridRenderMode
  ): void {
    const startTime = performance.now();

    if (!settings.enabled || !settings.visible) {
      return;
    }

    // Calculate grid size in pixels
    const gridSizePixels = settings.size * transform.scale;

    // Skip rendering if grid is too small
    if (gridSizePixels < settings.minVisibleSize) {
      return;
    }

    ctx.save();

    // Apply adaptive opacity based on zoom
    let opacity = settings.opacity;
    if (settings.adaptiveOpacity) {
      opacity = this.calculateAdaptiveOpacity(gridSizePixels, settings);
    }
    ctx.globalAlpha = opacity;

    // Render based on style
    switch (settings.style) {
      case 'lines':
        this.renderGridLines(ctx, viewport, settings, transform);
        break;
      case 'dots':
        this.renderGridDots(ctx, viewport, settings, transform);
        break;
      case 'crosses':
        this.renderGridCrosses(ctx, viewport, settings, transform);
        break;
      default:
        console.warn('⚠️ GridRenderer: Unknown style:', settings.style);
    }

    // 🏢 ORIGIN & AXES: AutoCAD-style UCS icon — unified rendering (eliminates OriginMarkerUtils duplication)
    // Rendered AFTER grid so axes appear on top of grid lines
    ctx.globalAlpha = 1.0; // Axes always fully opaque (not affected by grid opacity)
    if (settings.showAxes) {
      this.renderAxes(ctx, viewport, settings, transform);
    }
    if (settings.showOrigin) {
      this.renderOriginCrosshair(ctx, viewport, settings, transform);
    }

    ctx.restore();

    // Update metrics
    this.renderCount++;
    this.lastRenderTime = performance.now() - startTime;
  }

  /** 🌊 Render grid as lines: 3-level adaptive cascade with a cross-faded
   *  emphasis (ADR-681 §5.8) — see `renderAdaptiveGrid`. */
  private renderGridLines(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): void {
    if (this.isLegacyGrid(settings)) {
      const gridSize = settings.size * transform.scale;
      if (settings.showMinorGrid && settings.smoothFade && settings.majorInterval > 1) {
        ctx.strokeStyle = settings.minorGridColor;
        ctx.lineWidth = settings.minorGridWeight;
        this.drawGridLines(ctx, viewport, transform, gridSize);
      } else if (settings.showMinorGrid && !settings.smoothFade) {
        ctx.strokeStyle = settings.minorGridColor;
        ctx.lineWidth = settings.minorGridWeight;
        this.drawGridLines(ctx, viewport, transform, gridSize);
      }
      if (settings.showMajorGrid) {
        const majorSize = settings.smoothFade ? gridSize : gridSize * settings.majorInterval;
        ctx.strokeStyle = settings.majorGridColor;
        ctx.lineWidth = deriveMajorGridWeight(settings.minorGridWeight);
        this.drawGridLines(ctx, viewport, transform, majorSize);
      }
      return;
    }
    this.runAdaptiveGrid(ctx, settings, transform, ({ spacingPx, major }) => {
      applyRoleStroke(ctx, settings, major);
      this.drawGridLines(ctx, viewport, transform, spacingPx);
    });
  }

  /**
   * 🌊 Drive the shared adaptive cascade for ONE grid style (ADR-681 §5.9).
   *
   * The temporal fade state lives on the renderer, not per style, so the twelve
   * mechanism inputs are assembled exactly once. Each style differs only in its
   * `drawMarks` callback — which is the whole point of generalising
   * `renderAdaptiveGrid`: three callers, one mechanism, no sibling clones.
   */
  private runAdaptiveGrid(
    ctx: CanvasRenderingContext2D,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    drawMarks: (pass: { spacingPx: number; major: boolean }) => void
  ): void {
    const result = renderAdaptiveGrid({
      ctx,
      drawMarks,
      worldStep: settings.size,
      scale: transform.scale,
      subDivisions: settings.majorInterval,
      minSpacingPx: settings.minGridSpacing,
      fadeDurationMs: settings.smoothFadeDurationMs,
      showMinor: settings.showMinorGrid,
      showMajor: settings.showMajorGrid,
      previousOpacity: this.renderedMinorOpacity,
      previousTimestampMs: this.lastFrameTimestampMs,
      markDirty: () => markSystemsDirty(['dxf-canvas']),
    });
    this.renderedMinorOpacity = result.renderedOpacity;
    this.lastFrameTimestampMs = result.timestampMs;
  }

  /** Screen-space lattice anchor for a mark pass at the given spacing. */
  private markLattice(
    viewport: Viewport,
    transform: { scale: number; offsetX: number; offsetY: number },
    spacingPx: number
  ): GridMarkLattice {
    // 🏢 ADR-118: Using centralized WORLD_ORIGIN constant
    const { CoordinateTransforms: CT } = require('../../core/CoordinateTransforms');
    const screenOrigin = CT.worldToScreen(WORLD_ORIGIN, transform, viewport);
    return {
      viewport,
      originScreenX: screenOrigin.x,
      originScreenY: screenOrigin.y,
      spacingPx,
    };
  }

  /** Lattice at the RAW, uncascaded step — legacy renders only. */
  private rawLattice(
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): GridMarkLattice {
    return this.markLattice(viewport, transform, settings.size * transform.scale);
  }

  /** True when the user has the cascade switched off — legacy render applies. */
  private isLegacyGrid(settings: GridSettings): boolean {
    return !settings.smoothFade || settings.majorInterval <= 1;
  }

  /**
   * Draw grid lines (helper method)
   * ✅ FIXED: Uses simple calculation - CoordinateTransforms already handles flipped Y
   */
  private drawGridLines(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    transform: { scale: number; offsetX: number; offsetY: number },
    gridSize: number
  ): void {
    ctx.beginPath();

    // Vertical lines (X-axis) - ✅ CORRECT: Use world (0,0) as reference
    // Calculate screen position of world point (0,0)
    // 🏢 ADR-118: Using centralized WORLD_ORIGIN constant
    const { CoordinateTransforms: CT } = require('../../core/CoordinateTransforms');
    const screenOrigin = CT.worldToScreen(WORLD_ORIGIN, transform, viewport);
    const originScreenX = screenOrigin.x;
    const startX = (originScreenX % gridSize);

    for (let x = startX; x <= viewport.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewport.height);
    }

    // Horizontal lines (Y-axis) - ✅ CORRECT: Use world (0,0) as reference
    // screenOrigin already calculated above from world (0,0)
    const originScreenY = screenOrigin.y;
    const startY = (originScreenY % gridSize);

    for (let y = startY; y <= viewport.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(viewport.width, y);
    }

    ctx.stroke();
  }

  /**
   * 🔵 Render grid as dots: same 3-level adaptive cascade as the lines
   * (ADR-681 §5.9). Emphasis maps to dot RADIUS instead of stroke weight.
   */
  private renderGridDots(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): void {
    if (this.isLegacyGrid(settings)) {
      paintLegacyDotGrid(ctx, this.rawLattice(viewport, settings, transform), settings);
      return;
    }
    // 🏢 ENTERPRISE DOT SIZING: fixed pixel size — does NOT scale with zoom.
    // Factory defaults: minor=1px, major=1.5px (adjustable via Settings).
    const radii = dotRadii(settings);
    this.runAdaptiveGrid(ctx, settings, transform, ({ spacingPx, major }) => {
      ctx.fillStyle = roleColor(settings, major);
      paintDotMarks(
        ctx,
        this.markLattice(viewport, transform, spacingPx),
        major ? radii.major : radii.minor
      );
    });
  }

  /**
   * ✚ Render grid as crosses: same 3-level adaptive cascade as the lines
   * (ADR-681 §5.9). Emphasis maps to ARM LENGTH plus the usual weight/colour.
   */
  private renderGridCrosses(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): void {
    if (this.isLegacyGrid(settings)) {
      paintLegacyCrossGrid(ctx, this.rawLattice(viewport, settings, transform), settings);
      return;
    }
    const arms = crossArms(settings);
    this.runAdaptiveGrid(ctx, settings, transform, ({ spacingPx, major }) => {
      applyRoleStroke(ctx, settings, major);
      paintCrossMarks(
        ctx,
        this.markLattice(viewport, transform, spacingPx),
        major ? arms.major : arms.minor
      );
    });
  }


  // ============================================================================
  // ORIGIN & AXES RENDERING — AutoCAD UCS Icon Pattern
  // ============================================================================

  /** Size of origin crosshair arms in pixels */
  private static readonly ORIGIN_ARM_LENGTH = 20;
  /** Size of the X/Y axis label text */
  private static readonly AXIS_LABEL_FONT = 'bold 11px monospace';

  /** Pixel-perfect screen position of world origin (0,0). */
  private screenOrigin(
    viewport: Viewport,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): { ox: number; oy: number } {
    const { CoordinateTransforms: CT } = require('../../core/CoordinateTransforms');
    const screen = CT.worldToScreen(WORLD_ORIGIN, transform, viewport);
    return { ox: pixelPerfect(screen.x), oy: pixelPerfect(screen.y) };
  }

  /**
   * 🏢 Render X/Y axis lines through world origin (0,0)
   * AutoCAD draws infinite axis lines through origin in a distinct color.
   * We draw full-viewport lines for X and Y axes.
   */
  private renderAxes(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): void {
    const { ox, oy } = this.screenOrigin(viewport, transform);

    ctx.strokeStyle = settings.axesColor;
    ctx.lineWidth = settings.axesWeight;
    ctx.beginPath();

    // X-axis: horizontal line spanning full viewport
    ctx.moveTo(0, oy);
    ctx.lineTo(viewport.width, oy);

    // Y-axis: vertical line spanning full viewport
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, viewport.height);

    ctx.stroke();
  }

  /**
   * 🏢 Render origin crosshair icon at world (0,0)
   * AutoCAD UCS icon: small L-shape / crosshair marking the exact origin.
   * We draw a prominent crosshair with colored X/Y arms and axis labels.
   */
  private renderOriginCrosshair(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): void {
    const { ox, oy } = this.screenOrigin(viewport, transform);
    const arm = GridRenderer.ORIGIN_ARM_LENGTH;

    ctx.save();
    ctx.lineCap = 'square';

    // X-axis arm (RED — right from origin, AutoCAD convention)
    ctx.strokeStyle = '#E74C3C';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + arm, oy);
    ctx.stroke();

    // Y-axis arm (GREEN — up from origin, AutoCAD convention)
    ctx.strokeStyle = '#2ECC71';
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox, oy - arm); // Negative Y = up in screen coords
    ctx.stroke();

    // Axis labels
    ctx.font = GridRenderer.AXIS_LABEL_FONT;
    ctx.fillStyle = '#E74C3C';
    ctx.fillText('X', ox + arm + 4, oy + 4);
    ctx.fillStyle = '#2ECC71';
    ctx.fillText('Y', ox - 4, oy - arm - 4);

    // Origin dot (small white circle with dark border)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    addCirclePath(ctx, { x: ox, y: oy }, 3);
    ctx.fill();
    ctx.strokeStyle = settings.axesColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Calculate adaptive opacity based on grid size
   */
  private calculateAdaptiveOpacity(gridSizePixels: number, settings: GridSettings): number {
    const minSize = settings.minVisibleSize;
    const maxSize = minSize * 4;

    if (gridSizePixels <= minSize) {
      return 0;
    } else if (gridSizePixels >= maxSize) {
      return settings.opacity;
    } else {
      // Fade in as grid gets larger
      const factor = (gridSizePixels - minSize) / (maxSize - minSize);
      return settings.opacity * factor;
    }
  }

  /**
   * Extract transform data από UI context (if available)
   */
  private getTransformData(context: UIRenderContext): { scale: number; offsetX: number; offsetY: number } | null {
    // 🎯 TYPE-SAFE: Context ήδη έχει transform property από UIRenderContext interface
    if (context.transform) {
      return context.transform;
    }

    return null;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): UIRenderMetrics {
    return {
      renderTime: this.lastRenderTime,
      drawCalls: this.renderCount,
      primitiveCount: 1, // Grid rendering
      memoryUsage: 0
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.renderCount = 0;
    this.lastRenderTime = 0;
  }
}