/**
 * CENTRALIZED RULER RENDERER - UI Rendering System
 * ✅ ΦΑΣΗ 6: Κεντρικοποιημένο ruler rendering χωρίς διπλότυπα
 */

import type { Viewport } from '../../types/Types';
import { CoordinateTransforms } from '../../core/CoordinateTransforms';
import type {
  UIRenderer,
  UIRenderContext,
  UIElementSettings,
  UIRenderMetrics
} from '../core/UIRenderer';
import type {
  RulerSettings,
  RulerRenderMode,
  RulerOrientation,
  RulerPosition
} from './RulerTypes';
import { COORDINATE_LAYOUT } from '../../core/CoordinateTransforms';
// 🏢 ADR-044: Centralized line widths
// 🏢 ADR-091: Centralized UI Fonts (buildUIFont for dynamic sizes)
import { RENDER_LINE_WIDTHS, buildUIFont } from '../../../config/text-rendering-config';
// Corner-box draw helper extracted for file-size compliance (<500).
import { drawRulerCornerBox } from './ruler-corner-box';
// 🏢 ADR-XXX: Centralized Angular Constants
import { RIGHT_ANGLE } from '../../entities/shared/geometry-utils';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { WORLD_ORIGIN } from '../../../config/geometry-constants';
// 🏢 ADR-462: display-measurement SSoT — the VISIBLE canvas ruler (this renderer,
// instantiated by DxfCanvas → drawn by dxf-canvas-renderer) follows the status-bar
// unit selector. Tick numbers are world COORDINATES (signed); the unit suffix is the
// live display-unit label. The legacy per-ruler `settings.unit` no longer wins —
// Revit-style ONE project unit, shared with the status-bar X/Y readout.
import { formatCoordinateForDisplay, currentDisplayUnitLabel } from '../../../config/display-length-format';

/**
 * 🔺 CENTRALIZED RULER RENDERER
 * Single Source of Truth για ruler rendering
 * Αντικαθιστά όλα τα duplicate Ruler rendering code
 *
 * ✅ ADR-186: Adaptive Tick Spacing (AutoCAD/Bentley industry standard)
 * Uses 1-2-5 sequence for "nice" tick intervals that adapt to zoom level
 */
export class RulerRenderer implements UIRenderer {
  readonly type = 'ruler';

  private renderCount = 0;
  private lastRenderTime = 0;

  // ─── ADR-186: Adaptive Ruler Constants ───────────────────────────────
  /**
   * 1-2-5 sequence — Industry standard tick intervals (AutoCAD, Bentley, Figma)
   * Each step is ×2, ×2.5, or ×2 of the previous, producing visually "nice" numbers.
   */
  private static readonly ADAPTIVE_INTERVALS: readonly number[] = [
    0.01, 0.02, 0.05,
    0.1,  0.2,  0.5,
    1,    2,    5,
    10,   20,   50,
    100,  200,  500,
    1000, 2000, 5000,
    10_000, 20_000, 50_000,
  ] as const;

  /** Minimum pixel distance between major ticks to keep labels readable */
  private static readonly MIN_TICK_PIXELS = 60;

  /** Maximum pixel distance before we should subdivide further */
  private static readonly MAX_TICK_PIXELS = 200;

  /** Minimum pixel distance between minor ticks to render them */
  private static readonly MIN_MINOR_TICK_PIXELS = 8;

  // ─── Adaptive helpers ────────────────────────────────────────────────

  /**
   * Pick the best major-tick interval for the current zoom.
   * Walks the 1-2-5 table until the resulting pixel step ≥ MIN_TICK_PIXELS.
   */
  private calculateAdaptiveInterval(scale: number): number {
    const intervals = RulerRenderer.ADAPTIVE_INTERVALS;
    for (const interval of intervals) {
      if (interval * scale >= RulerRenderer.MIN_TICK_PIXELS) {
        return interval;
      }
    }
    // Fallback: largest interval
    return intervals[intervals.length - 1];
  }

  /**
   * Main render method - Implements UIRenderer interface
   */
  render(
    context: UIRenderContext,
    viewport: Viewport,
    settings: UIElementSettings
  ): void {
    const rulerSettings = settings as RulerSettings;

    // Get transform data από context
    const transformData = this.getTransformData(context);
    if (!transformData) return;

    // Render both horizontal and vertical rulers
    this.renderRuler(
      context.ctx,
      viewport,
      rulerSettings,
      transformData,
      'horizontal',
      'bottom'
    );

    this.renderRuler(
      context.ctx,
      viewport,
      rulerSettings,
      transformData,
      'vertical',
      'left'
    );

    // ✅ CAD-GRADE: Render corner box where rulers meet (AutoCAD/Revit/Blender standard)
    drawRulerCornerBox(context.ctx, viewport, rulerSettings);
  }

  /**
   * 🔺 LEGACY COMPATIBILITY
   * Direct render method για backward compatibility
   */
  renderDirect(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: RulerSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    mode: RulerRenderMode = 'normal'
  ): void {
    // Render both rulers for legacy compatibility
    this.renderRuler(ctx, viewport, settings, transform, 'horizontal', 'bottom');
    this.renderRuler(ctx, viewport, settings, transform, 'vertical', 'left');

    // ✅ CAD-GRADE: Render corner box where rulers meet
    drawRulerCornerBox(ctx, viewport, settings);
  }

  /**
   * 🔺 CORE RULER RENDERING
   * Unified rendering logic για όλους τους modes
   */
  private renderRuler(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: RulerSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    orientation: RulerOrientation,
    position: RulerPosition
  ): void {
    const startTime = performance.now();

    if (!settings.enabled || !settings.visible) return;

    ctx.save();

    // Calculate ruler dimensions and position
    const rulerSize = orientation === 'horizontal' ? settings.height : settings.width;
    const rulerRect = this.calculateRulerRect(viewport, orientation, position, rulerSize);

    // Render background
    if (settings.showBackground) {
      this.renderRulerBackground(ctx, rulerRect, settings);
    }

    // Render ticks and labels
    if (orientation === 'horizontal') {
      this.renderHorizontalRuler(ctx, viewport, settings, transform, rulerRect);
    } else {
      this.renderVerticalRuler(ctx, viewport, settings, transform, rulerRect);
    }

    ctx.restore();

    // Update metrics
    this.renderCount++;
    this.lastRenderTime = performance.now() - startTime;
  }

  /**
   * Calculate ruler rectangle based on position
   */
  private calculateRulerRect(
    viewport: Viewport,
    orientation: RulerOrientation,
    position: RulerPosition,
    size: number
  ): { x: number; y: number; width: number; height: number } {
    switch (position) {
      case 'top':
        return { x: 0, y: 0, width: viewport.width, height: size };
      case 'bottom':
        return { x: 0, y: viewport.height - size, width: viewport.width, height: size };
      case 'left':
        return { x: 0, y: 0, width: size, height: viewport.height };
      case 'right':
        return { x: viewport.width - size, y: 0, width: size, height: viewport.height };
      default:
        return { x: 0, y: 0, width: viewport.width, height: size };
    }
  }

  /**
   * Render ruler background
   */
  private renderRulerBackground(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    settings: RulerSettings
  ): void {
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Border
    if (settings.borderWidth > 0) {
      ctx.strokeStyle = settings.borderColor;
      ctx.lineWidth = settings.borderWidth;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  /**
   * ✅ CAD-GRADE: Corner Box - Industry Standard (AutoCAD/Revit/Blender/Figma)
   * Renders the square at the intersection of horizontal and vertical rulers
   * This prevents visual overlap and provides origin indicator
   */
  /**
   * Render horizontal ruler
   * ✅ ADR-186: Adaptive tick spacing — ticks & labels adapt to zoom level
   * 🎯 (0,0) στην κάτω αριστερή γωνία του lime πλαισίου
   */
  private renderHorizontalRuler(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: RulerSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    rect: { x: number; y: number; width: number; height: number }
  ): void {
    // ─── ADR-186: Adaptive interval calculation ──────────────────────
    const adaptiveInterval = this.calculateAdaptiveInterval(transform.scale);
    const step = adaptiveInterval * transform.scale;

    // Safety: skip if step is somehow degenerate
    if (step < 1) return;

    // ✅ CORRECT: Use world (0,0) as reference
    // 🏢 ADR-118: Using centralized WORLD_ORIGIN constant
    const screenOrigin = CoordinateTransforms.worldToScreen(WORLD_ORIGIN, transform, viewport);
    const originScreenX = screenOrigin.x;
    const startX = originScreenX % step;

    // Text styling
    ctx.fillStyle = settings.textColor;
    ctx.font = buildUIFont(settings.fontSize, 'arial');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let x = startX; x <= viewport.width; x += step) {
      // ✅ UNIFIED: worldX calculation using same origin as DxfRenderer/LayerRenderer
      const worldX = (x - originScreenX) / transform.scale;

      // Major ticks
      if (settings.showMajorTicks) {
        ctx.strokeStyle = settings.majorTickColor;
        ctx.lineWidth = RENDER_LINE_WIDTHS.RULER_TICK;
        ctx.beginPath();
        ctx.moveTo(x, rect.y + rect.height - settings.majorTickLength);
        ctx.lineTo(x, rect.y + rect.height);
        ctx.stroke();
      }

      // Labels
      if (settings.showLabels && x >= 30) { // Avoid overlap with vertical ruler
        // 🏢 ADR-462: number + unit follow the status-bar display-unit selector.
        const numberText = formatCoordinateForDisplay(worldX, { withUnit: false });

        // Number
        ctx.fillStyle = settings.textColor;
        ctx.font = buildUIFont(settings.fontSize, 'arial');
        ctx.fillText(numberText, x, rect.y + rect.height / 2);

        // Units
        if (settings.showUnits) {
          const numberWidth = ctx.measureText(numberText).width;
          ctx.fillStyle = settings.unitsColor;
          ctx.font = buildUIFont(settings.unitsFontSize, 'arial');
          ctx.fillText(currentDisplayUnitLabel(), x + numberWidth / 2 + 5, rect.y + rect.height / 2);
        }
      }

      // Minor ticks — only render when there is enough pixel space
      if (settings.showMinorTicks) {
        const minorStep = step / 5;
        if (minorStep >= RulerRenderer.MIN_MINOR_TICK_PIXELS) {
          for (let i = 1; i < 5; i++) {
            const minorX = x + (i * minorStep);
            if (minorX <= viewport.width) {
              ctx.strokeStyle = settings.minorTickColor;
              ctx.lineWidth = RENDER_LINE_WIDTHS.RULER_TICK;
              ctx.beginPath();
              ctx.moveTo(minorX, rect.y + rect.height - settings.minorTickLength);
              ctx.lineTo(minorX, rect.y + rect.height);
              ctx.stroke();
            }
          }
        }
      }
    }
  }

  /**
   * Render vertical ruler
   * ✅ ADR-186: Adaptive tick spacing — ticks & labels adapt to zoom level
   * 🎯 (0,0) στην κάτω αριστερή γωνία του lime πλαισίου
   * ✅ UNIFIED: Works like horizontal ruler - iterate screen pixels, calculate worldY
   */
  private renderVerticalRuler(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: RulerSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    rect: { x: number; y: number; width: number; height: number }
  ): void {
    // ─── ADR-186: Adaptive interval calculation ──────────────────────
    const adaptiveInterval = this.calculateAdaptiveInterval(transform.scale);
    const step = adaptiveInterval * transform.scale;

    // Safety: skip if step is somehow degenerate
    if (step < 1) return;

    // ✅ CORRECT: Use world (0,0) as reference (same as horizontal ruler)
    // 🏢 ADR-118: Using centralized WORLD_ORIGIN constant
    const screenOrigin = CoordinateTransforms.worldToScreen(WORLD_ORIGIN, transform, viewport);
    const originScreenY = screenOrigin.y;
    const startY = originScreenY % step;

    const minY = COORDINATE_LAYOUT.MARGINS.top; // 30px - for labels only

    // Text styling
    ctx.fillStyle = settings.textColor;
    ctx.font = buildUIFont(settings.fontSize, 'arial');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = startY; y <= viewport.height; y += step) {
      // ✅ UNIFIED: worldY calculation using same origin as DxfRenderer/LayerRenderer
      const worldY = (originScreenY - y) / transform.scale;

      // Major ticks
      if (settings.showMajorTicks) {
        ctx.strokeStyle = settings.majorTickColor;
        ctx.lineWidth = RENDER_LINE_WIDTHS.RULER_TICK;
        ctx.beginPath();
        ctx.moveTo(rect.x + rect.width - settings.majorTickLength, y);
        ctx.lineTo(rect.x + rect.width, y);
        ctx.stroke();
      }

      // Labels (rotated for vertical ruler)
      if (settings.showLabels && y >= minY) {
        // 🏢 ADR-462: number + unit follow the status-bar display-unit selector.
        const numberText = formatCoordinateForDisplay(worldY, { withUnit: false });

        ctx.save();
        ctx.translate(rect.x + rect.width / 2, y);
        ctx.rotate(-RIGHT_ANGLE);

        // Number
        ctx.fillStyle = settings.textColor;
        ctx.font = buildUIFont(settings.fontSize, 'arial');
        ctx.fillText(numberText, 0, 0);

        // Units
        if (settings.showUnits) {
          const numberWidth = ctx.measureText(numberText).width;
          ctx.fillStyle = settings.unitsColor;
          ctx.font = buildUIFont(settings.unitsFontSize, 'arial');
          ctx.fillText(currentDisplayUnitLabel(), numberWidth / 2 + 5, 0);
        }

        ctx.restore();
      }

      // Minor ticks — only render when there is enough pixel space
      if (settings.showMinorTicks) {
        const minorStep = step / 5;
        if (minorStep >= RulerRenderer.MIN_MINOR_TICK_PIXELS) {
          for (let i = 1; i < 5; i++) {
            const minorY = y + (i * minorStep);
            if (minorY <= viewport.height) {
              ctx.strokeStyle = settings.minorTickColor;
              ctx.lineWidth = RENDER_LINE_WIDTHS.RULER_TICK;
              ctx.beginPath();
              ctx.moveTo(rect.x + rect.width - settings.minorTickLength, minorY);
              ctx.lineTo(rect.x + rect.width, minorY);
              ctx.stroke();
            }
          }
        }
      }
    }
  }

  /**
   * Extract transform data από UI context (if available)
   */
  private getTransformData(context: UIRenderContext): { scale: number; offsetX: number; offsetY: number } | null {
    // 🎯 TYPE-SAFE: Check for worldTransform using extended context type
    const extendedContext = context as import('../core/UIRenderer').ExtendedUIRenderContext;

    // ✅ FIX: Check for worldTransform first (passed by UIRendererComposite)
    if (extendedContext.worldTransform) {
      return extendedContext.worldTransform;
    }

    // Fallback to transform (always available in base UIRenderContext)
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
      primitiveCount: 2, // Horizontal + vertical ruler
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