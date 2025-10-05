/**
 * CENTRALIZED CROSSHAIR RENDERER - UI Rendering System
 * ✅ ΦΑΣΗ 6: Kεντρικοποιημένο crosshair rendering χωρίς διπλότυπα
 */

import type { Point2D, Viewport } from '../../types/Types';
import type {
  UIRenderer,
  UIRenderContext,
  UIElementSettings,
  UIRenderMetrics
} from '../core/UIRenderer';
import type {
  CrosshairSettings,
  CrosshairRenderData,
  CrosshairRenderMode,
  CrosshairLineStyle
} from './CrosshairTypes';

/**
 * 🔺 CENTRALIZED CROSSHAIR RENDERER
 * Single Source of Truth για crosshair rendering
 * Αντικαθιστά όλα τα duplicate CrosshairRenderer instances
 */
export class CrosshairRenderer implements UIRenderer {
  readonly type = 'crosshair';

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
    const crosshairSettings = settings as CrosshairSettings;

    // Position από context ή default στο κέντρο
    const position = this.getMousePosition(context) || {
      x: viewport.width / 2,
      y: viewport.height / 2
    };

    this.renderCrosshair(
      context.ctx,
      position,
      viewport,
      crosshairSettings,
      'with-gap' // Default mode με gap για pickbox
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
    settings: CrosshairSettings,
    mode: CrosshairRenderMode = 'normal'
  ): void {
    this.renderCrosshair(ctx, position, viewport, settings, mode);
  }

  /**
   * Legacy renderWithGap για backward compatibility
   * ✅ FIXED: Delegation pattern - πρέπει να καλείται από LegacyCrosshairAdapter
   */
  renderWithGap(
    position: Point2D,
    viewport: Viewport,
    settings: CrosshairSettings,
    gapSize: number = 10
  ): void {
    console.warn('CrosshairRenderer.renderWithGap is deprecated. Use LegacyCrosshairAdapter.renderWithGap instead.');
  }

  /**
   * 🔺 CORE CROSSHAIR RENDERING
   * Unified rendering logic για όλους τους modes
   */
  private renderCrosshair(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    viewport: Viewport,
    settings: CrosshairSettings,
    mode: CrosshairRenderMode
  ): void {
    const startTime = performance.now();

    // 🔧 SAFE CHECK: visible είναι optional - default true
    const isVisible = settings.visible !== false;

    if (!settings.enabled || !isVisible) {
      return;
    }

    ctx.save();

    // Apply crosshair styling
    ctx.strokeStyle = settings.color;
    ctx.lineWidth = settings.lineWidth;
    ctx.globalAlpha = settings.opacity;

    // Set line style
    this.setLineStyle(ctx, settings.style);

    // Calculate crosshair size
    const crosshairSize = this.calculateCrosshairSize(viewport, settings);
    const halfSize = crosshairSize / 2;

    // Render based on mode
    switch (mode) {
      case 'normal':
        this.renderNormalCrosshair(ctx, position, viewport, halfSize);
        break;
      case 'with-gap':
        const gapSize = settings.useCursorGap ? settings.centerGapPx : 10;
        this.renderCrosshairWithGap(ctx, position, viewport, halfSize, gapSize);
        break;
      case 'animated':
        // Future implementation
        this.renderNormalCrosshair(ctx, position, viewport, halfSize);
        break;
    }

    // Optional center dot
    if (settings.showCenterDot && mode !== 'with-gap') {
      this.renderCenterDot(ctx, position, settings);
    }

    ctx.restore();

    // Update metrics
    this.renderCount++;
    this.lastRenderTime = performance.now() - startTime;
  }

  /**
   * Render normal crosshair (full lines)
   */
  private renderNormalCrosshair(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    viewport: Viewport,
    halfSize: number
  ): void {
    ctx.beginPath();

    if (halfSize >= Math.max(viewport.width, viewport.height) / 2) {
      // Full screen crosshair
      ctx.moveTo(0, position.y);
      ctx.lineTo(viewport.width, position.y);
      ctx.moveTo(position.x, 0);
      ctx.lineTo(position.x, viewport.height);
    } else {
      // Limited size crosshair
      ctx.moveTo(Math.max(0, position.x - halfSize), position.y);
      ctx.lineTo(Math.min(viewport.width, position.x + halfSize), position.y);
      ctx.moveTo(position.x, Math.max(0, position.y - halfSize));
      ctx.lineTo(position.x, Math.min(viewport.height, position.y + halfSize));
    }

    ctx.stroke();
  }

  /**
   * Render crosshair με gap στο κέντρο (για pickbox)
   */
  private renderCrosshairWithGap(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    viewport: Viewport,
    halfSize: number,
    gapSize: number
  ): void {
    const halfGap = gapSize / 2;

    ctx.beginPath();

    if (halfSize >= Math.max(viewport.width, viewport.height) / 2) {
      // Full screen με gap
      // Horizontal lines
      ctx.moveTo(0, position.y);
      ctx.lineTo(position.x - halfGap, position.y);
      ctx.moveTo(position.x + halfGap, position.y);
      ctx.lineTo(viewport.width, position.y);

      // Vertical lines
      ctx.moveTo(position.x, 0);
      ctx.lineTo(position.x, position.y - halfGap);
      ctx.moveTo(position.x, position.y + halfGap);
      ctx.lineTo(position.x, viewport.height);
    } else {
      // Limited size με gap
      // Horizontal lines
      ctx.moveTo(Math.max(0, position.x - halfSize), position.y);
      ctx.lineTo(position.x - halfGap, position.y);
      ctx.moveTo(position.x + halfGap, position.y);
      ctx.lineTo(Math.min(viewport.width, position.x + halfSize), position.y);

      // Vertical lines
      ctx.moveTo(position.x, Math.max(0, position.y - halfSize));
      ctx.lineTo(position.x, position.y - halfGap);
      ctx.moveTo(position.x, position.y + halfGap);
      ctx.lineTo(position.x, Math.min(viewport.height, position.y + halfSize));
    }

    ctx.stroke();
  }

  /**
   * Render center dot
   */
  private renderCenterDot(
    ctx: CanvasRenderingContext2D,
    position: Point2D,
    settings: CrosshairSettings
  ): void {
    ctx.fillStyle = settings.color;
    ctx.beginPath();
    ctx.arc(position.x, position.y, settings.centerDotSize, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Calculate crosshair size based on settings
   */
  private calculateCrosshairSize(viewport: Viewport, settings: CrosshairSettings): number {
    if (settings.size === 100) {
      return Math.max(viewport.width, viewport.height);
    } else if (settings.size === 0) {
      return 0;
    } else {
      const minDimension = Math.min(viewport.width, viewport.height);
      return (settings.size / 100) * minDimension;
    }
  }

  /**
   * Set line style patterns
   */
  private setLineStyle(ctx: CanvasRenderingContext2D, style: CrosshairLineStyle): void {
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
    // Enhanced: Check for mousePosition στο context (από LegacyCrosshairAdapter)
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
      primitiveCount: 2, // Horizontal + vertical line
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