/**
 * CANVAS V2 - SELECTION RENDERER
 * ✅ ΦΑΣΗ 6: Enhanced με UIRenderer interface για centralized rendering
 * Render για selection boxes (window/crossing selection)
 */

import type { Point2D, Viewport } from '../../../rendering/types/Types';
import type { SelectionSettings, SelectionBox } from '../layer-types';
import type { UIRenderer, UIRenderContext, UIElementSettings, UIRenderMetrics } from '../../../rendering/ui/core/UIRenderer';
// 🏢 ADR-080: Centralized Rectangle Bounds
import { rectFromTwoPoints } from '../../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-083: Centralized Line Dash Patterns
import { LINE_DASH_PATTERNS } from '../../../config/text-rendering-config';

export class SelectionRenderer implements UIRenderer {
  readonly type = 'selection';
  private ctx: CanvasRenderingContext2D;
  private metrics: UIRenderMetrics = { renderTime: 0, drawCalls: 0, primitiveCount: 0 };

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /**
   * ✅ UIRenderer interface implementation
   */
  render(context: UIRenderContext, viewport: Viewport, settings: UIElementSettings): void {
    const startTime = performance.now();

    // 🎯 TYPE-SAFE: Type assertion with proper interface extension
    const selectionSettings = settings as UIElementSettings & SelectionSettings;

    // Get selection data from context
    const selectionData = this.getSelectionData(context);

    if (!selectionData?.selectionBox) {
      this.metrics = { renderTime: 0, drawCalls: 0, primitiveCount: 0 };
      return;
    }

    // Use existing render method
    this.renderSelection(
      selectionData.selectionBox,
      viewport,
      selectionSettings
    );

    const renderTime = performance.now() - startTime;
    this.metrics = { renderTime, drawCalls: 1, primitiveCount: 1 };
  }

  /**
   * Get selection data από UIRenderContext
   */
  private getSelectionData(context: UIRenderContext): { selectionBox: SelectionBox | null } | null {
    // 🎯 TYPE-SAFE: Use type guard for extended context
    const extendedContext = context as UIRenderContext & { selectionData?: { selectionBox: SelectionBox | null } };
    return extendedContext.selectionData || null;
  }

  /**
   * Legacy render method για backward compatibility
   * Render selection box (window ή crossing selection)
   */
  renderSelection(
    selectionBox: SelectionBox,
    viewport: Viewport,
    settings: SelectionSettings
  ): void {
    if (!selectionBox) return;

    const { startPoint, endPoint, type } = selectionBox;
    const selectionConfig = settings[type]; // window ή crossing

    this.ctx.save();

    // 🏢 ADR-080: Centralized Rectangle Bounds
    const { x, y, width, height } = rectFromTwoPoints(startPoint, endPoint);

    // Render fill
    if (selectionConfig.fillOpacity > 0) {
      this.ctx.fillStyle = selectionConfig.fillColor;
      this.ctx.globalAlpha = selectionConfig.fillOpacity;
      this.ctx.fillRect(x, y, width, height);
    }

    // Render border
    if (selectionConfig.borderOpacity > 0 && selectionConfig.borderWidth > 0) {
      this.ctx.strokeStyle = selectionConfig.borderColor;
      this.ctx.lineWidth = selectionConfig.borderWidth;
      this.ctx.globalAlpha = selectionConfig.borderOpacity;

      // Set line style
      this.setLineStyle(selectionConfig.borderStyle);

      this.ctx.strokeRect(x, y, width, height);
    }

    this.ctx.restore();
  }

  /**
   * Render selection marquee during dragging
   */
  renderMarquee(
    startPoint: Point2D,
    currentPoint: Point2D,
    viewport: Viewport,
    settings: SelectionSettings
  ): void {
    // Determine selection type based on drag direction
    const isWindow = currentPoint.x > startPoint.x; // Left to right = window
    const type = isWindow ? 'window' : 'crossing';

    const selectionBox: SelectionBox = {
      startPoint,
      endPoint: currentPoint,
      type
    };

    this.renderSelection(selectionBox, viewport, settings);
  }

  /**
   * Set line dash pattern based on style
   * 🏢 ADR-083: Uses centralized LINE_DASH_PATTERNS
   */
  private setLineStyle(style: 'solid' | 'dashed' | 'dotted' | 'dash-dot'): void {
    switch (style) {
      case 'solid':
        this.ctx.setLineDash(LINE_DASH_PATTERNS.SOLID);
        break;
      case 'dashed':
        this.ctx.setLineDash([...LINE_DASH_PATTERNS.CURSOR_DASHED]);
        break;
      case 'dotted':
        this.ctx.setLineDash([...LINE_DASH_PATTERNS.CURSOR_DOTTED]);
        break;
      case 'dash-dot':
        this.ctx.setLineDash([...LINE_DASH_PATTERNS.CURSOR_DASH_DOT]);
        break;
      default:
        this.ctx.setLineDash(LINE_DASH_PATTERNS.SOLID);
    }
  }

  /**
   * Render a free-form lasso polygon (AutoCAD 3rd selection mode).
   *
   * mode='window'   → solid blue fill + solid border (entity fully inside)
   * mode='crossing' → dashed green fill + dashed border (entity intersects)
   */
  renderLasso(
    lassoPath: readonly Point2D[],
    mode: 'window' | 'crossing',
    settings: SelectionSettings,
  ): void {
    const config = settings[mode];
    if (lassoPath.length < 2) return;

    this.ctx.save();

    // Build free-form path.
    this.ctx.beginPath();
    this.ctx.moveTo(lassoPath[0].x, lassoPath[0].y);
    for (let i = 1; i < lassoPath.length; i++) {
      this.ctx.lineTo(lassoPath[i].x, lassoPath[i].y);
    }
    this.ctx.closePath();

    // Fill.
    if (config.fillOpacity > 0) {
      this.ctx.fillStyle = config.fillColor;
      this.ctx.globalAlpha = config.fillOpacity;
      this.ctx.fill();
    }

    // Stroke.
    if (config.borderOpacity > 0 && config.borderWidth > 0) {
      this.ctx.strokeStyle = config.borderColor;
      this.ctx.lineWidth = config.borderWidth;
      this.ctx.globalAlpha = config.borderOpacity;
      this.setLineStyle(config.borderStyle);

      // Re-draw path for stroke (fill consumed globalAlpha reset).
      this.ctx.beginPath();
      this.ctx.moveTo(lassoPath[0].x, lassoPath[0].y);
      for (let i = 1; i < lassoPath.length; i++) {
        this.ctx.lineTo(lassoPath[i].x, lassoPath[i].y);
      }
      this.ctx.closePath();
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * ✅ UIRenderer interface: Get performance metrics
   */
  getMetrics(): UIRenderMetrics {
    return this.metrics;
  }

  /**
   * ✅ UIRenderer interface: Cleanup resources
   */
  cleanup(): void {
    this.metrics = { renderTime: 0, drawCalls: 0, primitiveCount: 0 };
  }
}