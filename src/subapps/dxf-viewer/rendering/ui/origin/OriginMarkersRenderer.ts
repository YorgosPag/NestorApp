/**
 * ORIGIN MARKERS RENDERER
 * ✅ UI Renderer-compliant renderer για Origin Markers debugging overlay
 * Εμφανίζει σταυρουδάκι στο (0,0) και πλήρεις άξονες X,Y για debugging
 */

import type { UIRenderer, UIRenderContext, UIRenderMetrics } from '../core/UIRenderer';
import type { Viewport, ViewTransform } from '../../types/Types';
import type { OriginMarkersSettings } from './OriginMarkersTypes';
import { COORDINATE_LAYOUT } from '../../core/CoordinateTransforms';
// 🏢 ADR-042: Centralized UI Fonts
import { UI_FONTS } from '../../../config/text-rendering-config';

export class OriginMarkersRenderer implements UIRenderer {
  readonly type = 'origin-markers';

  /**
   * 🎯 MAIN RENDER METHOD
   * Renders origin markers overlay (crosshair + axis lines)
   */
  render(
    context: UIRenderContext,
    viewport: Viewport,
    settings: OriginMarkersSettings
  ): void {
    console.log('🎯 OriginMarkersRenderer.render called!', {
      enabled: settings.enabled,
      visible: settings.visible,
      viewport
    });

    if (!settings.enabled || !settings.visible) {
      console.log('🎯 OriginMarkersRenderer: Skipping - not enabled or not visible');
      return;
    }

    const ctx = context.ctx;

    // 🎯 TYPE-SAFE: Get world transform από extended context
    const extendedContext = context as import('../core/UIRenderer').UIRenderContextWithWorld;
    if (!extendedContext.worldTransform) {
      console.warn('🎯 OriginMarkersRenderer: No world transform in context');
      return;
    }
    const transform = extendedContext.worldTransform;

    // Calculate screen position of world origin (0,0)
    // ✅ CORRECT: Use CoordinateTransforms.worldToScreen for ACTUAL world (0,0)
    const { CoordinateTransforms: CT } = require('../../core/CoordinateTransforms');
    const worldOrigin = { x: 0, y: 0 };
    const screenOrigin = CT.worldToScreen(worldOrigin, transform, viewport);
    const originScreenX = screenOrigin.x;
    const originScreenY = screenOrigin.y;

    // 🔍 DEBUG: Log values to compare with DxfRenderer/LayerRenderer
    console.log('🎯 OriginMarkersRenderer origin marker:', {
      worldOrigin,
      screenOrigin,
      transform: { scale: transform.scale, offsetX: transform.offsetX, offsetY: transform.offsetY },
      calculated: { originScreenX, originScreenY }
    });

    // Pixel snapping helper for crisp rendering
    const px = (v: number) => Math.round(v) + 0.5;

    ctx.save();

    // 🎯 RENDER AXIS LINES (always visible if enabled)
    if (settings.showAxisLines) {
      ctx.globalAlpha = settings.axisOpacity;
      ctx.strokeStyle = settings.axisColor;
      ctx.lineWidth = settings.axisLineWidth;

      ctx.beginPath();

      // X-Axis: Horizontal line across entire viewport (only if Y coord is visible)
      // ✅ ChatGPT-5: Apply pixel snapping for crisp rendering
      if (originScreenY >= 0 && originScreenY <= viewport.height) {
        const y = px(originScreenY);
        ctx.moveTo(0, y);
        ctx.lineTo(viewport.width, y);
      }

      // Y-Axis: Vertical line across entire viewport (only if X coord is visible)
      // ✅ ChatGPT-5: Apply pixel snapping for crisp rendering
      if (originScreenX >= 0 && originScreenX <= viewport.width) {
        const x = px(originScreenX);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, viewport.height);
      }

      ctx.stroke();

      // 🎯 AXIS LABELS (only if lines are visible)
      if (settings.showLabel) {
        ctx.fillStyle = settings.axisColor;
        ctx.font = UI_FONTS.MONOSPACE.LARGE; // 🏢 ADR-042: Centralized UI Font

        // X-Axis label (only if horizontal line is visible)
        if (originScreenY >= 0 && originScreenY <= viewport.height) {
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText('X', viewport.width - 10, originScreenY - 5);
        }

        // Y-Axis label (only if vertical line is visible)
        if (originScreenX >= 0 && originScreenX <= viewport.width) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText('Y', originScreenX + 5, 10);
        }
      }
    }

    // Check if origin crosshair should be visible
    const margin = settings.size + 50; // Extra margin για label
    if (originScreenX < -margin || originScreenX > viewport.width + margin ||
        originScreenY < -margin || originScreenY > viewport.height + margin) {
      ctx.restore();
      return; // Origin crosshair is not visible, but axis lines were already drawn
    }

    // 🎯 RENDER ORIGIN CROSSHAIR (on top of axis lines)
    ctx.globalAlpha = settings.opacity;
    ctx.strokeStyle = settings.color;
    ctx.lineWidth = settings.lineWidth;

    ctx.beginPath();

    // Draw crosshair at origin
    const markerSize = settings.size;

    // Horizontal line
    ctx.moveTo(originScreenX - markerSize, originScreenY);
    ctx.lineTo(originScreenX + markerSize, originScreenY);

    // Vertical line
    ctx.moveTo(originScreenX, originScreenY - markerSize);
    ctx.lineTo(originScreenX, originScreenY + markerSize);

    ctx.stroke();

    // Center dot για ακρίβεια
    if (settings.showCenter) {
      ctx.beginPath();
      ctx.arc(originScreenX, originScreenY, settings.centerRadius, 0, Math.PI * 2);
      ctx.fillStyle = settings.color;
      ctx.fill();
    }

    // Debug label
    if (settings.showLabel) {
      ctx.fillStyle = settings.color;
      ctx.font = UI_FONTS.MONOSPACE.NORMAL; // 🏢 ADR-042: Centralized UI Font
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Position label below and to the right
      const labelX = originScreenX + markerSize + 5;
      const labelY = originScreenY + 5;

      ctx.fillText('(0,0)', labelX, labelY);

      // Additional debug info
      ctx.font = UI_FONTS.MONOSPACE.SMALL; // 🏢 ADR-042: Centralized UI Font
      ctx.fillText(`Screen: (${originScreenX.toFixed(1)}, ${originScreenY.toFixed(1)})`, labelX, labelY + 15);
    }

    // 🎯 ORIGIN LABEL ENHANCEMENT
    if (settings.showAxisLines && settings.showLabel) {
      ctx.fillStyle = settings.axisColor;
      ctx.font = UI_FONTS.MONOSPACE.LARGE; // 🏢 ADR-042: Centralized UI Font
      ctx.globalAlpha = settings.axisOpacity;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('O', originScreenX - markerSize - 15, originScreenY);
    }

    ctx.restore();
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
