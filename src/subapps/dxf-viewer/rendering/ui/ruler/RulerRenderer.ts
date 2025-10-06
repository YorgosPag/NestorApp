/**
 * CENTRALIZED RULER RENDERER - UI Rendering System
 * ✅ ΦΑΣΗ 6: Κεντρικοποιημένο ruler rendering χωρίς διπλότυπα
 */

import type { Point2D, Viewport } from '../../types/Types';
import { CoordinateTransforms } from '../../core/CoordinateTransforms';
import type {
  UIRenderer,
  UIRenderContext,
  UIElementSettings,
  UIRenderMetrics
} from '../core/UIRenderer';
import type {
  RulerSettings,
  RulerRenderData,
  RulerRenderMode,
  RulerOrientation,
  RulerPosition
} from './RulerTypes';
import { COORDINATE_LAYOUT } from '../../core/CoordinateTransforms';

/**
 * 🔺 CENTRALIZED RULER RENDERER
 * Single Source of Truth για ruler rendering
 * Αντικαθιστά όλα τα duplicate Ruler rendering code
 */
export class RulerRenderer implements UIRenderer {
  readonly type = 'ruler';

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
   * Render horizontal ruler
   * 🎯 ΤΡΟΠΟΠΟΙΗΣΗ: (0,0) στην κάτω αριστερή γωνία του lime πλαισίου
   */
  private renderHorizontalRuler(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: RulerSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    rect: { x: number; y: number; width: number; height: number }
  ): void {
    const step = settings.tickInterval * transform.scale;
    if (step < 20) return; // Skip if ticks are too close

    // ✅ CORRECT: Use world (0,0) as reference
    // Calculate screen position of world point (0,0)
    const worldOrigin = { x: 0, y: 0 };
    const screenOrigin = CoordinateTransforms.worldToScreen(worldOrigin, transform, viewport);
    const originScreenX = screenOrigin.x;
    const startX = (originScreenX % step);

    // 🔍 DEBUG: Log ruler calculation
    console.log('📏 RULER X-axis (using world 0,0):', {
      worldOrigin,
      screenOrigin,
      'transform.scale': transform.scale,
      'tickInterval': settings.tickInterval,
      step,
      startX,
      'First tick at': startX,
      'Second tick at': startX + step
    });

    // Text styling
    ctx.fillStyle = settings.textColor;
    ctx.font = `${settings.fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let x = startX; x <= viewport.width; x += step) {
      // ✅ UNIFIED: worldX calculation using same origin as DxfRenderer/LayerRenderer
      const worldX = (x - originScreenX) / transform.scale;

      // Major ticks
      if (settings.showMajorTicks) {
        ctx.strokeStyle = settings.majorTickColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, rect.y + rect.height - settings.majorTickLength);
        ctx.lineTo(x, rect.y + rect.height);
        ctx.stroke();
      }

      // Labels
      if (settings.showLabels && x >= 30) { // Avoid overlap with vertical ruler
        const numberText = worldX.toFixed(settings.labelPrecision);

        // 🔍 DEBUG: Log when we draw label near "0"

        // Number
        ctx.fillStyle = settings.textColor;
        ctx.font = `${settings.fontSize}px Arial`;
        ctx.fillText(numberText, x, rect.y + rect.height / 2);

        // Units
        if (settings.showUnits) {
          const numberWidth = ctx.measureText(numberText).width;
          ctx.fillStyle = settings.unitsColor;
          ctx.font = `${settings.unitsFontSize}px Arial`;
          ctx.fillText(settings.unit, x + numberWidth / 2 + 5, rect.y + rect.height / 2);
        }
      }

      // Minor ticks
      if (settings.showMinorTicks) {
        const minorStep = step / 5; // 5 minor ticks between major ticks
        for (let i = 1; i < 5; i++) {
          const minorX = x + (i * minorStep);
          if (minorX <= viewport.width) {
            ctx.strokeStyle = settings.minorTickColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(minorX, rect.y + rect.height - settings.minorTickLength);
            ctx.lineTo(minorX, rect.y + rect.height);
            ctx.stroke();
          }
        }
      }
    }
  }

  /**
   * Render vertical ruler
   * 🎯 ΤΡΟΠΟΠΟΙΗΣΗ: (0,0) στην κάτω αριστερή γωνία του lime πλαισίου
   * ✅ UNIFIED: Works like horizontal ruler - iterate screen pixels, calculate worldY
   */
  private renderVerticalRuler(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    settings: RulerSettings,
    transform: { scale: number; offsetX: number; offsetY: number },
    rect: { x: number; y: number; width: number; height: number }
  ): void {
    const step = settings.tickInterval * transform.scale;
    if (step < 20) return; // Skip if ticks are too close

    // ✅ CORRECT: Use world (0,0) as reference (same as horizontal ruler)
    const worldOrigin = { x: 0, y: 0 };
    const screenOrigin = CoordinateTransforms.worldToScreen(worldOrigin, transform, viewport);
    const originScreenY = screenOrigin.y;
    const startY = (originScreenY % step);

    const minY = COORDINATE_LAYOUT.MARGINS.top; // 30px - for labels only

    // 🔍 DEBUG: Log EXACT values for comparison with Grid
    console.log('🔴 RULER Y-axis (using world 0,0):', {
      worldOrigin,
      screenOrigin,
      'transform.scale': transform.scale,
      'tickInterval': settings.tickInterval,
      step,
      startY,
      'First tick at': startY,
      'Second tick at': startY + step
    });

    // Text styling
    ctx.fillStyle = settings.textColor;
    ctx.font = `${settings.fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = startY; y <= viewport.height; y += step) {
      // ✅ UNIFIED: worldY calculation using same origin as DxfRenderer/LayerRenderer
      const worldY = (originScreenY - y) / transform.scale;

      // Major ticks
      if (settings.showMajorTicks) {
        ctx.strokeStyle = settings.majorTickColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rect.x + rect.width - settings.majorTickLength, y);
        ctx.lineTo(rect.x + rect.width, y);
        ctx.stroke();
      }

      // Labels (rotated for vertical ruler)
      if (settings.showLabels && y >= minY) {
        const numberText = worldY.toFixed(settings.labelPrecision);

        ctx.save();
        ctx.translate(rect.x + rect.width / 2, y);
        ctx.rotate(-Math.PI / 2);

        // Number
        ctx.fillStyle = settings.textColor;
        ctx.font = `${settings.fontSize}px Arial`;
        ctx.fillText(numberText, 0, 0);

        // Units
        if (settings.showUnits) {
          const numberWidth = ctx.measureText(numberText).width;
          ctx.fillStyle = settings.unitsColor;
          ctx.font = `${settings.unitsFontSize}px Arial`;
          ctx.fillText(settings.unit, numberWidth / 2 + 5, 0);
        }

        ctx.restore();
      }

      // Minor ticks
      if (settings.showMinorTicks) {
        const minorStep = step / 5; // 5 minor ticks between major ticks
        for (let i = 1; i < 5; i++) {
          const minorY = y + (i * minorStep);
          if (minorY <= viewport.height) {
            ctx.strokeStyle = settings.minorTickColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(rect.x + rect.width - settings.minorTickLength, minorY);
            ctx.lineTo(rect.x + rect.width, minorY);
            ctx.stroke();
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