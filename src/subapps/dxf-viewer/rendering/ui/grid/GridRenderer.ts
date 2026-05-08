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
// 🌊 Adaptive grid math (pure helper, extracted for SRP + 500-line limit)
import { computeAdaptiveLevels } from './grid-adaptive';

/**
 * 🔺 CENTRALIZED GRID RENDERER
 * Single Source of Truth για grid rendering
 * Αντικαθιστά όλα τα duplicate Grid rendering code
 */
export class GridRenderer implements UIRenderer {
  readonly type = 'grid';

  private renderCount = 0;
  private lastRenderTime = 0;

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

  /**
   * Render grid as lines.
   *
   * 🌊 ADAPTIVE GRID (2026-05-08): when `settings.smoothFade` is on, we draw
   * minor + major as two passes whose world-space steps are computed by
   * `calculateAdaptiveLevels`. The minor pass receives a smoothstep opacity
   * factor based on its screen spacing, so as the user zooms the finer
   * subdivision appears/disappears continuously instead of snapping.
   * Industry pattern (AutoCAD / Fusion 360 / OnShape / Figma / Miro).
   *
   * When `smoothFade` is off, falls back to the legacy fixed-step rendering.
   */
  private renderGridLines(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): void {
    if (!settings.smoothFade) {
      // Legacy single-step rendering (preserved for backward compatibility).
      const gridSize = settings.size * transform.scale;
      if (settings.showMinorGrid) {
        ctx.strokeStyle = settings.minorGridColor;
        ctx.lineWidth = settings.minorGridWeight;
        this.drawGridLines(ctx, viewport, transform, gridSize);
      }
      if (settings.showMajorGrid) {
        const majorGridSize = gridSize * settings.majorInterval;
        ctx.strokeStyle = settings.majorGridColor;
        ctx.lineWidth = settings.majorGridWeight;
        this.drawGridLines(ctx, viewport, transform, majorGridSize);
      }
      return;
    }

    // 🌊 Adaptive 2-pass rendering with smoothstep fade.
    // Defensive fallback when majorInterval ≤ 1 (no minor level exists).
    if (settings.majorInterval <= 1) {
      const gridSize = settings.size * transform.scale;
      ctx.strokeStyle = settings.majorGridColor;
      ctx.lineWidth = settings.majorGridWeight;
      this.drawGridLines(ctx, viewport, transform, gridSize);
      return;
    }
    const { majorScreenPx, minorScreenPx, minorOpacity } = computeAdaptiveLevels({
      worldStep: settings.size,
      scale: transform.scale,
      subDivisions: settings.majorInterval,
      fadeMinPx: settings.smoothFadeMinPx,
      fadeMaxPx: settings.smoothFadeMaxPx,
    });

    const baseAlpha = ctx.globalAlpha;
    if (settings.showMinorGrid && minorOpacity > 0.001) {
      ctx.globalAlpha = baseAlpha * minorOpacity;
      ctx.strokeStyle = settings.minorGridColor;
      ctx.lineWidth = settings.minorGridWeight;
      this.drawGridLines(ctx, viewport, transform, minorScreenPx);
    }
    if (settings.showMajorGrid) {
      ctx.globalAlpha = baseAlpha;
      ctx.strokeStyle = settings.majorGridColor;
      ctx.lineWidth = settings.majorGridWeight;
      this.drawGridLines(ctx, viewport, transform, majorScreenPx);
    }
    ctx.globalAlpha = baseAlpha;
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
   * Render grid as dots
   * ✅ ENTERPRISE FIX (2026-01-05): Proper dot sizing - minimum 2-3px radius
   */
  private renderGridDots(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): void {
    const gridSize = settings.size * transform.scale;

    // 🏢 ENTERPRISE DOT SIZING:
    // Fixed pixel size - does NOT scale with zoom (like lines and crosses)
    // Factory defaults: minor=1px, major=1.5px (adjustable via Settings)
    const minorDotSize = Math.max(1, settings.minorGridWeight);        // 1px default (1:1 with weight)
    const majorDotSize = Math.max(1.5, settings.majorGridWeight * 0.75); // 1.5px default

    // Calculate grid origin in screen coordinates
    // 🏢 ADR-118: Using centralized WORLD_ORIGIN constant
    const { CoordinateTransforms: CT } = require('../../core/CoordinateTransforms');
    const screenOrigin = CT.worldToScreen(WORLD_ORIGIN, transform, viewport);
    const startX = screenOrigin.x % gridSize;
    const startY = screenOrigin.y % gridSize;

    // Ensure start positions are positive
    const adjustedStartX = startX < 0 ? startX + gridSize : startX;
    const adjustedStartY = startY < 0 ? startY + gridSize : startY;

    // Render dots at grid intersections
    // ✅ ENTERPRISE FIX: Using ellipse() instead of arc() due to browser/GPU compatibility
    // arc() has rendering bugs on some GPU drivers, ellipse() uses different rendering path
    for (let x = adjustedStartX; x <= viewport.width; x += gridSize) {
      for (let y = adjustedStartY; y <= viewport.height; y += gridSize) {
        // Check if this should be a major dot - use Math.round for floating point precision
        const gridIndexX = Math.round((x - adjustedStartX) / gridSize);
        const gridIndexY = Math.round((y - adjustedStartY) / gridSize);
        const isMajorX = gridIndexX % settings.majorInterval === 0;
        const isMajorY = gridIndexY % settings.majorInterval === 0;
        const isMajor = isMajorX && isMajorY;

        if ((isMajor && settings.showMajorGrid) || (!isMajor && settings.showMinorGrid)) {
          const dotSize = isMajor ? majorDotSize : minorDotSize;
          ctx.fillStyle = isMajor ? settings.majorGridColor : settings.minorGridColor;
          // 🏢 ADR-058: Use centralized canvas primitives
          ctx.beginPath();
          addCirclePath(ctx, { x, y }, dotSize);
          ctx.fill();
        }
      }
    }
  }

  /**
   * Render grid as crosses
   * ✅ UNIFIED WITH COORDINATETRANSFORMS: Use INVERTED offsetY
   */
  private renderGridCrosses(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: GridSettings,
    transform: { scale: number; offsetX: number; offsetY: number }
  ): void {
    const gridSize = settings.size * transform.scale;
    const minorCrossSize = Math.max(2, settings.minorGridWeight * 2);
    const majorCrossSize = Math.max(2, settings.majorGridWeight * 2);

    // ✅ CORRECT: Use world (0,0) as reference
    // 🏢 ADR-118: Using centralized WORLD_ORIGIN constant
    const { CoordinateTransforms: CT } = require('../../core/CoordinateTransforms');
    const screenOrigin = CT.worldToScreen(WORLD_ORIGIN, transform, viewport);
    const startX = (screenOrigin.x % gridSize);
    const startY = (screenOrigin.y % gridSize);

    ctx.beginPath();

    for (let x = startX; x <= viewport.width; x += gridSize) {
      for (let y = startY; y <= viewport.height; y += gridSize) {
        // Check if this should be a major cross
        const isMajorX = ((x - startX) / gridSize) % settings.majorInterval === 0;
        const isMajorY = ((y - startY) / gridSize) % settings.majorInterval === 0;
        const isMajor = isMajorX && isMajorY;

        if ((isMajor && settings.showMajorGrid) || (!isMajor && settings.showMinorGrid)) {
          ctx.strokeStyle = isMajor ? settings.majorGridColor : settings.minorGridColor;
          ctx.lineWidth = isMajor ? settings.majorGridWeight : settings.minorGridWeight;

          const size = isMajor ? majorCrossSize : minorCrossSize;

          // Horizontal line
          ctx.moveTo(x - size, y);
          ctx.lineTo(x + size, y);

          // Vertical line
          ctx.moveTo(x, y - size);
          ctx.lineTo(x, y + size);
        }
      }
    }

    ctx.stroke();
  }


  // ============================================================================
  // ORIGIN & AXES RENDERING — AutoCAD UCS Icon Pattern
  // ============================================================================

  /** Size of origin crosshair arms in pixels */
  private static readonly ORIGIN_ARM_LENGTH = 20;
  /** Size of the X/Y axis label text */
  private static readonly AXIS_LABEL_FONT = 'bold 11px monospace';

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
    const { CoordinateTransforms: CT } = require('../../core/CoordinateTransforms');
    const screenOrigin = CT.worldToScreen(WORLD_ORIGIN, transform, viewport);
    const ox = pixelPerfect(screenOrigin.x);
    const oy = pixelPerfect(screenOrigin.y);

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
    const { CoordinateTransforms: CT } = require('../../core/CoordinateTransforms');
    const screenOrigin = CT.worldToScreen(WORLD_ORIGIN, transform, viewport);
    const ox = pixelPerfect(screenOrigin.x);
    const oy = pixelPerfect(screenOrigin.y);
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