/**
 * CENTRALIZED SNAP RENDERER - UI Rendering System
 * ✅ ΦΑΣΗ 6: Κεντρικοποιημένο snap indicator rendering χωρίς διπλότυπα
 */

import type { Point2D, Viewport } from '../../types/Types';
import type {
  UIRenderer,
  UIRenderContext,
  UIElementSettings,
  UIRenderMetrics
} from '../core/UIRenderer';
import type {
  SnapSettings,
  SnapResult,
  SnapRenderData,
  SnapRenderMode,
  SnapType
} from './SnapTypes';

/**
 * 🔺 CENTRALIZED SNAP RENDERER
 * Single Source of Truth για snap indicator rendering
 * Αντικαθιστά όλα τα duplicate SnapRenderer instances
 */
export class SnapRenderer implements UIRenderer {
  readonly type = 'snap';

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
    const snapSettings = settings as SnapSettings;

    // Get snap data από context
    const snapData = this.getSnapData(context);
    if (!snapData || !snapData.length) return;

    this.renderSnapIndicators(
      context.ctx,
      snapData,
      viewport,
      snapSettings,
      'normal'
    );
  }

  /**
   * 🔺 LEGACY COMPATIBILITY
   * Direct render method για backward compatibility
   */
  renderDirect(
    ctx: CanvasRenderingContext2D,
    snapResults: SnapResult[],
    viewport: Viewport,
    settings: SnapSettings,
    mode: SnapRenderMode = 'normal'
  ): void {
    this.renderSnapIndicators(ctx, snapResults, viewport, settings, mode);
  }

  /**
   * 🔺 CORE SNAP INDICATOR RENDERING
   * Unified rendering logic για όλους τους modes
   */
  private renderSnapIndicators(
    ctx: CanvasRenderingContext2D,
    snapResults: SnapResult[],
    viewport: Viewport,
    settings: SnapSettings,
    mode: SnapRenderMode
  ): void {
    const startTime = performance.now();

    if (!settings.enabled || !settings.visible || !snapResults.length) return;

    // Sort by priority (higher priority renders last = on top)
    const sortedSnaps = [...snapResults].sort((a, b) => a.priority - b.priority);

    for (const snap of sortedSnaps) {
      this.renderSnapIndicator(ctx, snap, viewport, settings, mode);
    }

    // Update metrics
    this.renderCount++;
    this.lastRenderTime = performance.now() - startTime;
  }

  /**
   * Render single snap indicator
   */
  private renderSnapIndicator(
    ctx: CanvasRenderingContext2D,
    snap: SnapResult,
    viewport: Viewport,
    settings: SnapSettings,
    mode: SnapRenderMode
  ): void {
    ctx.save();

    // Get type-specific color
    const color = this.getSnapColor(snap.type, settings);
    ctx.strokeStyle = color;
    ctx.fillStyle = 'transparent';
    ctx.lineWidth = settings.lineWidth;
    ctx.globalAlpha = settings.opacity;

    // Calculate size based on mode
    let actualSize = settings.size;
    if (mode === 'highlight') {
      actualSize = settings.size * 1.5;
      ctx.strokeStyle = settings.highlightColor;
    }

    // Render shape based on snap type
    this.renderSnapShape(ctx, snap, actualSize);

    // Render tooltip if enabled
    if (settings.showTooltip && mode === 'preview') {
      this.renderSnapTooltip(ctx, snap, settings);
    }

    ctx.restore();
  }

  /**
   * Render snap shape based on type
   */
  private renderSnapShape(
    ctx: CanvasRenderingContext2D,
    snap: SnapResult,
    size: number
  ): void {
    const { x, y } = snap.point;
    const halfSize = size / 2;

    ctx.beginPath();

    switch (snap.type) {
      case 'endpoint':
        // Square for endpoints
        ctx.rect(x - halfSize, y - halfSize, size, size);
        break;

      case 'midpoint':
        // Triangle for midpoints
        ctx.moveTo(x, y - halfSize);
        ctx.lineTo(x - halfSize, y + halfSize);
        ctx.lineTo(x + halfSize, y + halfSize);
        ctx.closePath();
        break;

      case 'center':
        // Circle for centers
        ctx.arc(x, y, halfSize, 0, Math.PI * 2);
        break;

      case 'intersection':
        // X shape for intersections
        ctx.moveTo(x - halfSize, y - halfSize);
        ctx.lineTo(x + halfSize, y + halfSize);
        ctx.moveTo(x + halfSize, y - halfSize);
        ctx.lineTo(x - halfSize, y + halfSize);
        break;

      case 'perpendicular':
        // Right angle symbol
        const quarter = halfSize / 2;
        ctx.moveTo(x - quarter, y - halfSize);
        ctx.lineTo(x - quarter, y - quarter);
        ctx.lineTo(x - halfSize, y - quarter);
        break;

      case 'parallel':
        // Parallel lines
        ctx.moveTo(x - halfSize, y - quarter);
        ctx.lineTo(x + halfSize, y - quarter);
        ctx.moveTo(x - halfSize, y + quarter);
        ctx.lineTo(x + halfSize, y + quarter);
        break;

      case 'tangent':
        // Circle with tangent line
        ctx.arc(x, y, halfSize * 0.6, 0, Math.PI * 2);
        ctx.moveTo(x - halfSize, y);
        ctx.lineTo(x + halfSize, y);
        break;

      case 'quadrant':
        // Diamond for quadrants
        ctx.moveTo(x, y - halfSize);
        ctx.lineTo(x + halfSize, y);
        ctx.lineTo(x, y + halfSize);
        ctx.lineTo(x - halfSize, y);
        ctx.closePath();
        break;

      case 'nearest':
        // Plus sign for nearest
        ctx.moveTo(x - halfSize, y);
        ctx.lineTo(x + halfSize, y);
        ctx.moveTo(x, y - halfSize);
        ctx.lineTo(x, y + halfSize);
        break;

      case 'grid':
        // Grid dot
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        return; // Skip stroke for filled dot

      default:
        // Default: circle
        ctx.arc(x, y, halfSize, 0, Math.PI * 2);
    }

    ctx.stroke();
  }

  /**
   * Render snap tooltip
   */
  private renderSnapTooltip(
    ctx: CanvasRenderingContext2D,
    snap: SnapResult,
    settings: SnapSettings
  ): void {
    const { x, y } = snap.point;
    const text = this.getSnapTooltipText(snap.type);

    ctx.font = '12px Arial';
    ctx.fillStyle = settings.color;
    ctx.fillText(
      text,
      x + settings.tooltipOffset,
      y - settings.tooltipOffset
    );
  }

  /**
   * Get color για specific snap type
   */
  private getSnapColor(type: SnapType, settings: SnapSettings): string {
    switch (type) {
      case 'endpoint': return settings.endpointColor;
      case 'midpoint': return settings.midpointColor;
      case 'center': return settings.centerColor;
      case 'intersection': return settings.intersectionColor;
      default: return settings.color;
    }
  }

  /**
   * Get tooltip text για snap type
   */
  private getSnapTooltipText(type: SnapType): string {
    switch (type) {
      case 'endpoint': return 'Endpoint';
      case 'midpoint': return 'Midpoint';
      case 'center': return 'Center';
      case 'intersection': return 'Intersection';
      case 'perpendicular': return 'Perpendicular';
      case 'parallel': return 'Parallel';
      case 'tangent': return 'Tangent';
      case 'quadrant': return 'Quadrant';
      case 'nearest': return 'Nearest';
      case 'grid': return 'Grid';
      default: return 'Snap';
    }
  }

  /**
   * Extract snap data από UI context (if available)
   */
  private getSnapData(context: UIRenderContext): SnapResult[] | null {
    // Enhanced: Check for snapData στο context
    const uiContextWithSnap = context as any;
    if (uiContextWithSnap.snapData && Array.isArray(uiContextWithSnap.snapData)) {
      return uiContextWithSnap.snapData;
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
      primitiveCount: 1, // Snap indicators count
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