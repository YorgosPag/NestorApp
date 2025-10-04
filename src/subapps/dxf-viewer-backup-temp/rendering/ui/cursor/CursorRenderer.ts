/**
 * CENTRALIZED CURSOR RENDERER - UI Rendering System
 * ✅ ΦΑΣΗ 6: Κεντρικοποιημένο cursor rendering χωρίς διπλότυπα
 */

import type { Point2D, Viewport } from '../../types/Types';
import type {
  UIRenderer,
  UIRenderContext,
  UIElementSettings,
  UIRenderMetrics
} from '../core/UIRenderer';
import type {
  UICursorSettings,
  CursorRenderData,
  CursorRenderMode,
  CursorShape,
  CursorLineStyle
} from './CursorTypes';

/**
 * 🔺 CENTRALIZED CURSOR RENDERER
 * Single Source of Truth για cursor rendering
 * Αντικαθιστά όλα τα duplicate CursorRenderer instances
 */
export class CursorRenderer implements UIRenderer {
  readonly type = 'cursor';

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
    const cursorSettings = settings as UICursorSettings;

    // Position από context ή default στο κέντρο
    const position = this.getMousePosition(context) || {
      x: viewport.width / 2,
      y: viewport.height / 2
    };

    this.renderCursor(
      context.ctx,
      position,
      viewport,
      cursorSettings,
      'normal' // Default mode
    );
  }

  /**
   * 🔺 LEGACY COMPATIBILITY
   * Direct render method για backward compatibility
   */
  renderDirect(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    viewport: Viewport,
    settings: UICursorSettings,
    mode: CursorRenderMode = 'normal'
  ): void {
    this.renderCursor(ctx, position, viewport, settings, mode);
  }

  /**
   * 🔺 CORE CURSOR RENDERING
   * Unified rendering logic για όλους τους modes
   */
  private renderCursor(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    viewport: Viewport,
    settings: UICursorSettings,
    mode: CursorRenderMode
  ): void {
    const startTime = performance.now();

    // 🔧 SAFE CHECK: visible είναι optional - default true
    const isVisible = settings.visible !== false;

    if (!settings.enabled || !isVisible) {
      return;
    }

    ctx.save();

    // Apply cursor styling
    ctx.strokeStyle = settings.color;
    ctx.lineWidth = settings.lineWidth;
    ctx.globalAlpha = settings.opacity;

    // Set line style
    this.setLineStyle(ctx, settings.style);

    // Calculate cursor size based on mode
    let actualSize = settings.size;
    if (mode === 'highlight') {
      actualSize = settings.size * 1.5; // 50% bigger for highlight
    }

    // Render based on shape
    switch (settings.shape) {
      case 'square':
        this.renderSquareCursor(ctx, position, actualSize, settings);
        break;
      case 'circle':
        this.renderCircleCursor(ctx, position, actualSize, settings);
        break;
      case 'diamond':
        this.renderDiamondCursor(ctx, position, actualSize, settings);
        break;
      case 'cross':
        this.renderCrossCursor(ctx, position, actualSize, settings);
        break;
    }

    ctx.restore();

    // Update metrics
    this.renderCount++;
    this.lastRenderTime = performance.now() - startTime;
  }

  /**
   * Render square cursor shape
   */
  private renderSquareCursor(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    size: number,
    settings: UICursorSettings
  ): void {
    const halfSize = size / 2;

    ctx.beginPath();
    ctx.rect(
      position.x - halfSize,
      position.y - halfSize,
      size,
      size
    );

    this.applyFillAndStroke(ctx, settings);
  }

  /**
   * Render circle cursor shape
   */
  private renderCircleCursor(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    size: number,
    settings: UICursorSettings
  ): void {
    const radius = size / 2;

    ctx.beginPath();
    ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);

    this.applyFillAndStroke(ctx, settings);
  }

  /**
   * Render diamond cursor shape
   */
  private renderDiamondCursor(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    size: number,
    settings: UICursorSettings
  ): void {
    const halfSize = size / 2;

    ctx.beginPath();
    ctx.moveTo(position.x, position.y - halfSize); // Top
    ctx.lineTo(position.x + halfSize, position.y); // Right
    ctx.lineTo(position.x, position.y + halfSize); // Bottom
    ctx.lineTo(position.x - halfSize, position.y); // Left
    ctx.closePath();

    this.applyFillAndStroke(ctx, settings);
  }

  /**
   * Render cross cursor shape
   */
  private renderCrossCursor(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    size: number,
    settings: UICursorSettings
  ): void {
    const halfSize = size / 2;

    ctx.beginPath();
    // Horizontal line
    ctx.moveTo(position.x - halfSize, position.y);
    ctx.lineTo(position.x + halfSize, position.y);
    // Vertical line
    ctx.moveTo(position.x, position.y - halfSize);
    ctx.lineTo(position.x, position.y + halfSize);

    ctx.stroke(); // Only stroke for cross shape
  }

  /**
   * Apply fill and stroke based on settings
   */
  private applyFillAndStroke(
    ctx: CanvasRenderingContext2D,
    settings: UICursorSettings
  ): void {
    if (settings.showFill) {
      ctx.fillStyle = settings.fillColor;
      const originalAlpha = ctx.globalAlpha;
      ctx.globalAlpha = settings.fillOpacity;
      ctx.fill();
      ctx.globalAlpha = originalAlpha;
    }

    ctx.stroke();
  }

  /**
   * Set line style patterns
   */
  private setLineStyle(ctx: CanvasRenderingContext2D, style: CursorLineStyle): void {
    switch (style) {
      case 'solid':
        ctx.setLineDash([]);
        break;
      case 'dashed':
        ctx.setLineDash([6, 6]);
        break;
      case 'dotted':
        ctx.setLineDash([2, 4]);
        break;
      case 'dash-dot':
        ctx.setLineDash([8, 4, 2, 4]);
        break;
      default:
        ctx.setLineDash([]);
    }
  }

  /**
   * Extract mouse position από UI context (if available)
   */
  private getMousePosition(context: UIRenderContext): Point2D | null {
    // Enhanced: Check for mousePosition στο context
    const uiContextWithMouse = context as any;
    if (uiContextWithMouse.mousePosition) {
      return uiContextWithMouse.mousePosition;
    }

    // Future: This could be enhanced να διαβάζει από global mouse state
    return null;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): UIRenderMetrics {
    return {
      renderTime: this.lastRenderTime,
      drawCalls: this.renderCount,
      primitiveCount: 1, // One cursor shape
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