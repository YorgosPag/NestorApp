/**
 * 🛠️ CALIBRATION GRID RENDERER
 * Renders reference grid for visual ruler/grid alignment verification
 * Cyan grid lines every 100mm with coordinate labels
 */

import type { UIRenderer, UIRenderContext, UIRenderMetrics } from '../rendering/ui/core/UIRenderer';
import type { Viewport, ViewTransform } from '../rendering/types/Types';
import type { RulerDebugSettings, CalibrationGridSettings } from './RulerDebugTypes';

export class CalibrationGridRenderer implements UIRenderer {
  readonly type = 'calibration-grid';

  /**
   * 🎯 MAIN RENDER METHOD
   */
  render(
    context: UIRenderContext,
    viewport: Viewport,
    settings: RulerDebugSettings
  ): void {
    if (!settings.enabled || !settings.visible || !settings.calibrationGrid.enabled) {
      return;
    }

    const ctx = context.ctx;
    const transform = (context as any).worldTransform as ViewTransform | undefined;
    if (!transform) return;

    const gridSettings = settings.calibrationGrid;

    ctx.save();
    ctx.globalAlpha = gridSettings.opacity;

    // 🎯 RENDER GRID LINES
    this.renderGridLines(ctx, viewport, transform, gridSettings);

    // 🎯 RENDER ORIGIN MARKER (if enabled)
    if (gridSettings.showOriginMarker) {
      this.renderOriginMarker(ctx, transform, gridSettings, viewport);
    }

    // 🎯 RENDER COORDINATE LABELS (if enabled)
    if (gridSettings.showLabels) {
      this.renderCoordinateLabels(ctx, viewport, transform, gridSettings);
    }

    ctx.restore();
  }

  /**
   * 🎯 RENDER GRID LINES
   * ✅ FIXED: Simple calculation - CoordinateTransforms already handles flipped Y
   */
  private renderGridLines(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    transform: ViewTransform,
    settings: CalibrationGridSettings
  ): void {
    const spacing = settings.gridSpacing; // e.g. 100mm

    // Simple X calculation
    const worldLeft = -transform.offsetX / transform.scale;
    const worldRight = (viewport.width - transform.offsetX) / transform.scale;
    const startX = Math.floor(worldLeft / spacing) * spacing;
    const endX = Math.ceil(worldRight / spacing) * spacing;

    // ✅ UNIFIED WITH COORDINATETRANSFORMS: Use INVERTED offsetY
    // CoordinateTransforms: screenY = (height - top) - worldY * scale - offsetY
    const step = spacing * transform.scale;
    const baseY = viewport.height - 30; // Assuming 30px margin
    const startYScreen = ((baseY - transform.offsetY) % step);

    ctx.strokeStyle = settings.lineColor;
    ctx.lineWidth = settings.lineWidth;
    ctx.beginPath();

    // Vertical grid lines (X-axis)
    for (let worldX = startX; worldX <= endX; worldX += spacing) {
      const screenX = worldX * transform.scale + transform.offsetX;
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, viewport.height);
    }

    // Horizontal grid lines (Y-axis)
    for (let y = startYScreen; y <= viewport.height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(viewport.width, y);
    }

    ctx.stroke();
  }

  /**
   * 🎯 RENDER ORIGIN MARKER
   * ✅ CORRECT: Calculate screen position of ACTUAL world (0,0)
   */
  private renderOriginMarker(
    ctx: CanvasRenderingContext2D,
    transform: ViewTransform,
    settings: CalibrationGridSettings,
    viewport: Viewport
  ): void {
    // Import CoordinateTransforms for proper world-to-screen conversion
    const { CoordinateTransforms } = require('../rendering/core/CoordinateTransforms');
    const worldOrigin = { x: 0, y: 0 };
    const screenOrigin = CoordinateTransforms.worldToScreen(worldOrigin, transform, viewport);
    const originScreenX = screenOrigin.x;
    const originScreenY = screenOrigin.y;

    ctx.fillStyle = settings.originMarkerColor;
    ctx.beginPath();
    ctx.arc(originScreenX, originScreenY, settings.originMarkerSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw crosshair at origin
    ctx.strokeStyle = settings.originMarkerColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originScreenX - 15, originScreenY);
    ctx.lineTo(originScreenX + 15, originScreenY);
    ctx.moveTo(originScreenX, originScreenY - 15);
    ctx.lineTo(originScreenX, originScreenY + 15);
    ctx.stroke();

    // Label
    ctx.fillStyle = settings.originMarkerColor;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('ORIGIN (0,0)', originScreenX + 20, originScreenY + 5);
  }

  /**
   * 🎯 RENDER COORDINATE LABELS
   * ✅ FIXED: Simple calculation - CoordinateTransforms already handles flipped Y
   */
  private renderCoordinateLabels(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    transform: ViewTransform,
    settings: CalibrationGridSettings
  ): void {
    const spacing = settings.gridSpacing;
    const labelSpacing = spacing * 2; // Every 200mm for readability

    // X-axis calculation
    const worldLeft = -transform.offsetX / transform.scale;
    const worldRight = (viewport.width - transform.offsetX) / transform.scale;
    const labelStartX = Math.floor(worldLeft / labelSpacing) * labelSpacing;
    const labelEndX = Math.ceil(worldRight / labelSpacing) * labelSpacing;

    // Y-axis calculation - ✅ UNIFIED WITH COORDINATETRANSFORMS
    const step = labelSpacing * transform.scale;
    const baseY = viewport.height - 30; // Assuming 30px margin
    const startYScreen = ((baseY - transform.offsetY) % step);

    ctx.fillStyle = settings.labelColor;
    ctx.font = `${settings.labelFontSize}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Render labels at major intersections
    for (let worldX = labelStartX; worldX <= labelEndX; worldX += labelSpacing) {
      const screenX = worldX * transform.scale + transform.offsetX;

      for (let y = startYScreen; y <= viewport.height; y += step) {
        // ✅ UNIFIED: worldY calculation using CoordinateTransforms convention
        const worldY = ((baseY - y + transform.offsetY) / transform.scale);
        const worldYRounded = Math.round(worldY / labelSpacing) * labelSpacing;

        // Skip origin (already labeled)
        if (worldX === 0 && worldYRounded === 0) continue;

        // Only render if visible
        if (screenX >= 0 && screenX <= viewport.width &&
            y >= 0 && y <= viewport.height) {
          ctx.fillText(`(${worldX},${worldYRounded})`, screenX + 3, y + 3);
        }
      }
    }
  }

  /**
   * Optional cleanup
   */
  cleanup(): void {
    // No cleanup needed
  }

  /**
   * Optional performance metrics
   */
  getMetrics(): UIRenderMetrics {
    return {
      renderTime: 0,
      drawCalls: 0,
      primitiveCount: 0
    };
  }
}
