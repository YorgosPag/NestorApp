/**
 * 🛠️ CALIBRATION GRID RENDERER
 * Renders reference grid for visual ruler/grid alignment verification
 * Cyan grid lines every 100mm with coordinate labels
 */

import type { UIRenderer, UIRenderContext, UIRenderMetrics } from '../rendering/ui/core/UIRenderer';
import type { Viewport, ViewTransform } from '../rendering/types/Types';
import type { RulerDebugSettings, CalibrationGridSettings } from './RulerDebugTypes';
// 🏢 ADR-044: Centralized Line Widths
// 🏢 ADR-091: Centralized UI Fonts
// 🏢 ADR-141: Centralized Origin/Cursor Offsets
import { RENDER_LINE_WIDTHS, UI_FONTS, TEXT_LABEL_OFFSETS, buildUIFont } from '../config/text-rendering-config';
// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../rendering/primitives/canvasPaths';
// 🏢 ADR-118: Centralized Zero Point Pattern
import { WORLD_ORIGIN } from '../config/geometry-constants';

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
    // 🎯 TYPE-SAFE: Use UIRenderContextWithWorld for worldTransform
    const extendedContext = context as import('../rendering/ui/core/UIRenderer').UIRenderContextWithWorld;
    if (!extendedContext.worldTransform) return;
    const transform = extendedContext.worldTransform;

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
   * ✅ FIXED: Get actual ruler height from global ruler settings
   */
  private renderGridLines(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    transform: ViewTransform,
    settings: CalibrationGridSettings
  ): void {
    const spacing = settings.gridSpacing; // e.g. 100mm

    // ✅ UNIFIED WITH RULERS: Use CoordinateTransforms to find world (0,0)
    // 🏢 ADR-118: Using centralized WORLD_ORIGIN constant
    const { CoordinateTransforms } = require('../rendering/core/CoordinateTransforms');
    const screenOrigin = CoordinateTransforms.worldToScreen(WORLD_ORIGIN, transform, viewport);
    const originScreenX = screenOrigin.x;
    const originScreenY = screenOrigin.y;

    // Calculate step in screen pixels
    const step = spacing * transform.scale;

    // ✅ X-axis: Start from origin and step by spacing (same as RulerRenderer)
    const startXScreen = (originScreenX % step);

    // 🔍 DEBUG: Log calibration grid calculation
    console.log('🎯 CalibrationGrid DEBUG (UNIFIED):', {
      WORLD_ORIGIN,
      screenOrigin,
      viewportHeight: viewport.height,
      viewportWidth: viewport.width,
      transform: {
        scale: transform.scale,
        offsetX: transform.offsetX,
        offsetY: transform.offsetY
      },
      spacing,
      step,
      startXScreen,
      originScreenY
    });

    ctx.strokeStyle = settings.lineColor;
    ctx.lineWidth = settings.lineWidth;
    ctx.beginPath();

    // ✅ Y-axis: Start from origin and step by spacing (same as RulerRenderer)
    const startYScreen = (originScreenY % step);

    console.log('🎯 CalibrationGrid Y-axis (UNIFIED):', {
      originScreenY,
      step,
      startYScreen,
      calculation: `originScreenY (${originScreenY}) % step (${step}) = ${startYScreen}`
    });

    // Vertical grid lines (X-axis) - ✅ UNIFIED: Same calculation as RulerRenderer
    for (let x = startXScreen; x <= viewport.width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewport.height);
    }

    // Horizontal grid lines (Y-axis) - ✅ UNIFIED: Same calculation as RulerRenderer
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
    // 🏢 ADR-118: Using centralized WORLD_ORIGIN constant
    const { CoordinateTransforms } = require('../rendering/core/CoordinateTransforms');
    const screenOrigin = CoordinateTransforms.worldToScreen(WORLD_ORIGIN, transform, viewport);
    const originScreenX = screenOrigin.x;
    const originScreenY = screenOrigin.y;

    ctx.fillStyle = settings.originMarkerColor;
    ctx.beginPath();
    ctx.arc(originScreenX, originScreenY, settings.originMarkerSize, 0, TAU);
    ctx.fill();

    // Draw crosshair at origin
    // 🏢 ADR-141: Centralized origin crosshair arm length
    const armLength = TEXT_LABEL_OFFSETS.ORIGIN_CROSSHAIR_ARM;
    ctx.strokeStyle = settings.originMarkerColor;
    ctx.lineWidth = RENDER_LINE_WIDTHS.DEBUG; // 🏢 ADR-044
    ctx.beginPath();
    ctx.moveTo(originScreenX - armLength, originScreenY);
    ctx.lineTo(originScreenX + armLength, originScreenY);
    ctx.moveTo(originScreenX, originScreenY - armLength);
    ctx.lineTo(originScreenX, originScreenY + armLength);
    ctx.stroke();

    // Label
    ctx.fillStyle = settings.originMarkerColor;
    ctx.font = UI_FONTS.MONOSPACE.BOLD_LARGE;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('ORIGIN (0,0)', originScreenX + 20, originScreenY + 5);
  }

  /**
   * 🎯 RENDER COORDINATE LABELS
   * ✅ UNIFIED: Uses same calculation as RulerRenderer for perfect alignment
   */
  private renderCoordinateLabels(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    transform: ViewTransform,
    settings: CalibrationGridSettings
  ): void {
    const spacing = settings.gridSpacing;
    const labelSpacing = spacing * 2; // Every 200mm for readability

    // ✅ UNIFIED: Use CoordinateTransforms to find world (0,0) (same as grid lines)
    // 🏢 ADR-118: Using centralized WORLD_ORIGIN constant
    const { CoordinateTransforms } = require('../rendering/core/CoordinateTransforms');
    const screenOrigin = CoordinateTransforms.worldToScreen(WORLD_ORIGIN, transform, viewport);
    const originScreenX = screenOrigin.x;
    const originScreenY = screenOrigin.y;

    // Calculate step in screen pixels
    const step = labelSpacing * transform.scale;

    // ✅ X-axis and Y-axis: Start from origin (same as RulerRenderer)
    const startXScreen = (originScreenX % step);
    const startYScreen = (originScreenY % step);

    ctx.fillStyle = settings.labelColor;
    ctx.font = buildUIFont(settings.labelFontSize, 'monospace');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Render labels at major intersections
    for (let x = startXScreen; x <= viewport.width; x += step) {
      // ✅ UNIFIED: worldX calculation (same as RulerRenderer line 208)
      const worldX = (x - originScreenX) / transform.scale;
      const worldXRounded = Math.round(worldX / labelSpacing) * labelSpacing;

      for (let y = startYScreen; y <= viewport.height; y += step) {
        // ✅ UNIFIED: worldY calculation (same as RulerRenderer line 301)
        const worldY = (originScreenY - y) / transform.scale;
        const worldYRounded = Math.round(worldY / labelSpacing) * labelSpacing;

        // Skip origin (already labeled)
        if (worldXRounded === 0 && worldYRounded === 0) continue;

        // Only render if visible
        if (x >= 0 && x <= viewport.width &&
            y >= 0 && y <= viewport.height) {
          ctx.fillText(`(${worldXRounded},${worldYRounded})`, x + 3, y + 3);
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
