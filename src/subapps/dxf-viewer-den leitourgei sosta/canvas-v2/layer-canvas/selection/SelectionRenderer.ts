/**
 * CANVAS V2 - SELECTION RENDERER
 * ✅ ΦΑΣΗ 6: Enhanced με UIRenderer interface για centralized rendering
 * Render για selection boxes (window/crossing selection)
 */

import type { Point2D, Viewport } from '../../../rendering/types/Types';
import type { SelectionSettings, SelectionBox } from '../layer-types';
import type { UIRenderer, UIRenderContext, UIElementSettings, UIRenderMetrics } from '../../../rendering/ui/core/UIRenderer';

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

    // Cast to SelectionSettings (same pattern as other renderers)
    const selectionSettings = settings as any as SelectionSettings;

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
    // Temporary implementation - θα ενημερωθεί στο ΒΗΜΑ 6
    const contextData = (context as any).selectionData;
    return contextData || null;
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

    // Calculate selection rectangle
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

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
   */
  private setLineStyle(style: 'solid' | 'dashed' | 'dotted' | 'dash-dot'): void {
    switch (style) {
      case 'solid':
        this.ctx.setLineDash([]);
        break;
      case 'dashed':
        this.ctx.setLineDash([6, 6]);
        break;
      case 'dotted':
        this.ctx.setLineDash([2, 4]);
        break;
      case 'dash-dot':
        this.ctx.setLineDash([8, 4, 2, 4]);
        break;
      default:
        this.ctx.setLineDash([]);
    }
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