/**
 * LAYER GRID & RULER RENDERER — Standalone functions for grid + deprecated ruler rendering
 * ADR-065: Extracted from LayerRenderer.ts for SRP compliance
 */

import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type { GridSettings, RulerSettings } from './layer-types';
import { COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-042/044/091/107: Centralized rendering constants
import { RENDER_LINE_WIDTHS, buildUIFont, UI_SIZE_DEFAULTS } from '../../config/text-rendering-config';
// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../../rendering/primitives/canvasPaths';
// 🏢 ADR-XXX: Centralized Angular Constants
import { RIGHT_ANGLE } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-148: Centralized Ruler Grid Tick Spacing
import { RULER_CONFIG } from '../../config/tolerance-config';
// 🏢 ADR-127: Centralized Ruler Dimensions
import { RULERS_GRID_CONFIG } from '../../systems/rulers-grid/config';

/**
 * Render grid (lines or dots style)
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
  settings: GridSettings
): void {
  ctx.save();

  ctx.strokeStyle = settings.color;
  ctx.globalAlpha = settings.opacity;
  ctx.lineWidth = RENDER_LINE_WIDTHS.THIN;

  const gridSize = settings.size * transform.scale;

  if (gridSize < 5) {
    ctx.restore();
    return;
  }

  if (settings.style === 'lines') {
    ctx.beginPath();

    // Vertical lines
    const startX = (transform.offsetX % gridSize);
    for (let x = startX; x <= viewport.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, viewport.height);
    }

    // Horizontal lines — UNIFIED WITH COORDINATETRANSFORMS
    const baseY = viewport.height - COORDINATE_LAYOUT.MARGINS.top;
    const startY = ((baseY - transform.offsetY) % gridSize);
    for (let y = startY; y <= viewport.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(viewport.width, y);
    }

    ctx.stroke();
  } else {
    // Grid dots — UNIFIED WITH COORDINATETRANSFORMS
    ctx.fillStyle = settings.color || UI_COLORS.BLACK;

    const startX = (transform.offsetX % gridSize);
    const baseY = viewport.height - COORDINATE_LAYOUT.MARGINS.top;
    const startY = ((baseY - transform.offsetY) % gridSize);

    for (let x = startX; x <= viewport.width; x += gridSize) {
      for (let y = startY; y <= viewport.height; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, TAU);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

/**
 * @deprecated Use RulerRenderer from rendering/ui/ruler/ instead
 * Render rulers (horizontal + vertical)
 */
export function renderRulers(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
  settings: RulerSettings
): void {
  // 🏢 ADR-127: Use centralized ruler dimensions
  const rulerHeight = settings.height ?? RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT;
  const rulerWidth = settings.width ?? RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH;
  const horizontalRulerY = viewport.height - rulerHeight;

  ctx.save();

  // Background
  if (settings.showBackground !== false) {
    ctx.fillStyle = settings.backgroundColor ?? UI_COLORS.WHITE;
    ctx.fillRect(0, horizontalRulerY, viewport.width, rulerHeight);
    ctx.fillRect(0, 0, rulerWidth, viewport.height);
  }

  // Text styling
  ctx.fillStyle = settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
  ctx.font = buildUIFont(settings.fontSize ?? UI_SIZE_DEFAULTS.RULER_FONT_SIZE, 'arial');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Bottom horizontal ruler
  renderHorizontalRuler(ctx, transform, viewport, settings, rulerHeight, horizontalRulerY);

  // Left ruler (vertical)
  renderVerticalRuler(ctx, transform, viewport, settings, rulerWidth);

  ctx.restore();
}

/**
 * Render horizontal ruler with advanced settings
 */
function renderHorizontalRuler(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
  settings: RulerSettings,
  rulerHeight: number,
  yPosition: number = 0
): void {
  // 🏢 ADR-148: Use centralized major tick spacing
  const step = RULER_CONFIG.MAJOR_TICK_SPACING * transform.scale;
  if (step < 20) return;

  const startX = -(transform.offsetX % step);
  const majorTickLength = settings.majorTickLength ?? UI_SIZE_DEFAULTS.MAJOR_TICK_LENGTH;
  const minorTickLength = settings.minorTickLength ?? 5;

  for (let x = startX; x <= viewport.width; x += step) {
    const worldX = (x - transform.offsetX) / transform.scale;

    // Major ticks
    if (settings.showMajorTicks !== false) {
      ctx.strokeStyle = settings.majorTickColor ?? settings.color ?? UI_COLORS.BLACK;
      ctx.beginPath();
      ctx.moveTo(x, yPosition + rulerHeight - majorTickLength);
      ctx.lineTo(x, yPosition + rulerHeight);
      ctx.stroke();
    }

    // Labels
    if (settings.showLabels !== false) {
      const numberText = worldX.toFixed(0);

      ctx.fillStyle = settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
      ctx.font = buildUIFont(settings.fontSize ?? UI_SIZE_DEFAULTS.RULER_FONT_SIZE, 'arial');
      ctx.fillText(numberText, x, yPosition + rulerHeight / 2);

      // Units
      if (settings.showUnits !== false) {
        const numberWidth = ctx.measureText(numberText).width;
        ctx.fillStyle = settings.unitsColor ?? settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
        ctx.font = buildUIFont(settings.unitsFontSize ?? settings.fontSize ?? UI_SIZE_DEFAULTS.RULER_UNITS_FONT_SIZE, 'arial');
        ctx.fillText(settings.unit ?? '', x + numberWidth / 2 + 5, yPosition + rulerHeight / 2);
      }
    }

    // Minor ticks (1/5 of major step)
    if (settings.showMinorTicks !== false && step > 50) {
      const minorStep = step / 5;
      for (let i = 1; i < 5; i++) {
        const minorX = x + (i * minorStep);
        if (minorX <= viewport.width) {
          ctx.strokeStyle = settings.minorTickColor ?? settings.color ?? UI_COLORS.BLACK;
          ctx.beginPath();
          ctx.moveTo(minorX, yPosition + rulerHeight - minorTickLength);
          ctx.lineTo(minorX, yPosition + rulerHeight);
          ctx.stroke();
        }
      }
    }
  }
}

/**
 * Render vertical ruler with advanced settings
 */
function renderVerticalRuler(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
  settings: RulerSettings,
  rulerWidth: number
): void {
  // 🏢 ADR-148: Use centralized major tick spacing
  const step = RULER_CONFIG.MAJOR_TICK_SPACING * transform.scale;
  if (step < 20) return;

  // UNIFIED WITH COORDINATETRANSFORMS
  const baseY = viewport.height - COORDINATE_LAYOUT.MARGINS.top;
  const startY = ((baseY - transform.offsetY) % step);
  const majorTickLength = settings.majorTickLength ?? UI_SIZE_DEFAULTS.MAJOR_TICK_LENGTH;
  const minorTickLength = settings.minorTickLength ?? 5;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let y = startY + rulerWidth; y <= viewport.height; y += step) {
    const worldY = ((baseY - y + transform.offsetY) / transform.scale);

    // Major ticks
    if (settings.showMajorTicks !== false) {
      ctx.strokeStyle = settings.majorTickColor ?? settings.color ?? UI_COLORS.BLACK;
      ctx.beginPath();
      ctx.moveTo(rulerWidth - majorTickLength, y);
      ctx.lineTo(rulerWidth, y);
      ctx.stroke();
    }

    // Labels
    if (settings.showLabels !== false) {
      const numberText = worldY.toFixed(0);

      // 🏢 ADR-XXX: Use centralized RIGHT_ANGLE constant
      ctx.save();
      ctx.translate(rulerWidth / 2, y);
      ctx.rotate(-RIGHT_ANGLE);

      ctx.fillStyle = settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
      ctx.font = buildUIFont(settings.fontSize ?? UI_SIZE_DEFAULTS.RULER_FONT_SIZE, 'arial');
      ctx.fillText(numberText, 0, 0);

      // Units
      if (settings.showUnits !== false) {
        const numberWidth = ctx.measureText(numberText).width;
        ctx.fillStyle = settings.unitsColor ?? settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
        ctx.font = buildUIFont(settings.unitsFontSize ?? settings.fontSize ?? UI_SIZE_DEFAULTS.RULER_UNITS_FONT_SIZE, 'arial');
        ctx.fillText(settings.unit ?? '', numberWidth / 2 + 5, 0);
      }

      ctx.restore();
    }

    // Minor ticks (1/5 of major step)
    if (settings.showMinorTicks !== false && step > 50) {
      const minorStep = step / 5;
      for (let i = 1; i < 5; i++) {
        const minorY = y + (i * minorStep);
        if (minorY <= viewport.height) {
          ctx.strokeStyle = settings.minorTickColor ?? settings.color ?? UI_COLORS.BLACK;
          ctx.beginPath();
          ctx.moveTo(rulerWidth - minorTickLength, minorY);
          ctx.lineTo(rulerWidth, minorY);
          ctx.stroke();
        }
      }
    }
  }

  ctx.restore();
}
