/**
 * RULERS/GRID SYSTEM UTILITIES — BARREL + RENDERING
 *
 * Split into SRP modules (ADR-065):
 * - grid-calculations.ts — grid math, unit conversion
 * - ruler-calculations.ts — tick generation, validation, performance, snapping
 *
 * This file: rendering + aggregate re-exports.
 */

import {
  RulerSettings,
  GridLine,
  RulerTick,
  RULERS_GRID_CONFIG,
  COORDINATE_LAYOUT
} from './config';
import type { ViewTransform } from './config';
import { UI_COLORS } from '../../config/color-config';
import { RENDER_LINE_WIDTHS, buildUIFont, UI_SIZE_DEFAULTS } from '../../config/text-rendering-config';
import { AXIS_DETECTION } from '../../config/tolerance-config';
import { RIGHT_ANGLE } from '../../rendering/entities/shared/geometry-utils';

// ============================================================================
// RE-EXPORTS from split modules
// ============================================================================

export { UnitConversion, GridCalculations } from './grid-calculations';
export {
  RulerCalculations,
  SettingsValidationUtils,
  PerformanceUtilities,
  RulersGridSnapping,
} from './ruler-calculations';

import { UnitConversion, GridCalculations } from './grid-calculations';
import {
  RulerCalculations,
  SettingsValidationUtils,
  PerformanceUtilities,
  RulersGridSnapping,
} from './ruler-calculations';

// ============================================================================
// RENDERING UTILITIES
// ============================================================================

export const RulersGridRendering = {
  renderGridLines: (
    ctx: CanvasRenderingContext2D,
    lines: GridLine[],
    transform: ViewTransform
  ) => {
    ctx.save();

    lines.forEach((line) => {
      ctx.strokeStyle = line.color || UI_COLORS.GRID_MAJOR;
      ctx.lineWidth = line.weight;
      ctx.globalAlpha = line.opacity;

      ctx.beginPath();
      if (line.orientation === 'vertical') {
        const screenX = (line.position + transform.offsetX) * transform.scale;
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, ctx.canvas.height);
      } else {
        const screenY = ctx.canvas.height - ((line.position + transform.offsetY) * transform.scale);
        ctx.moveTo(0, screenY);
        ctx.lineTo(ctx.canvas.width, screenY);
      }
      ctx.stroke();
    });

    ctx.restore();
  },

  renderRuler: (
    ctx: CanvasRenderingContext2D,
    ticks: RulerTick[],
    settings: RulerSettings['horizontal'] | RulerSettings['vertical'],
    type: 'horizontal' | 'vertical',
    transform: ViewTransform
  ) => {
    ctx.save();
    ctx.strokeStyle = settings.tickColor || settings.color || UI_COLORS.RULER_DARK_GRAY;
    ctx.fillStyle = settings.textColor || settings.color || UI_COLORS.RULER_TEXT_GRAY;
    ctx.font = buildUIFont(settings.fontSize || UI_SIZE_DEFAULTS.RULER_FONT_SIZE, settings.fontFamily || 'monospace');
    ctx.lineWidth = RENDER_LINE_WIDTHS.RULER_TICK;

    const shouldShowLabel = (tick: RulerTick, allTicks: RulerTick[], _type: string, scale: number) => {
      if (Math.abs(tick.position) < AXIS_DETECTION.ZERO_THRESHOLD) return true;
      if (tick.type !== 'major') return false;

      const majorTicks = allTicks.filter(t => t.type === 'major').sort((a, b) => a.position - b.position);
      if (majorTicks.length < 2) return true;

      const estimatedSpacing = Math.abs(majorTicks[1].position - majorTicks[0].position);
      const tickSpacingPixels = estimatedSpacing * scale;

      if (tickSpacingPixels >= 35) return true;

      const labelSpacingMultiplier = Math.ceil(35 / tickSpacingPixels);
      const normalizedPosition = Math.round(tick.position / estimatedSpacing);
      return normalizedPosition % labelSpacingMultiplier === 0;
    };

    const safeTransform = transform || { offsetY: 0, offsetX: 0, scale: 1 };

    ticks.forEach(tick => {
      const shouldDrawTickLine = (tick.type === 'major' && settings.showMajorTicks !== false) ||
                                (tick.type === 'minor' && settings.showMinorTicks !== false);

      if (shouldDrawTickLine) {
        ctx.beginPath();
        if (tick.type === 'major') {
          ctx.strokeStyle = settings.majorTickColor || settings.tickColor || UI_COLORS.RULER_DARK_GRAY;
        } else if (tick.type === 'minor') {
          ctx.strokeStyle = settings.minorTickColor || UI_COLORS.RULER_LIGHT_GRAY;
        } else {
          ctx.strokeStyle = settings.tickColor || settings.color || UI_COLORS.RULER_DARK_GRAY;
        }
      }

      if (type === 'horizontal') {
        const screenX = (tick.position + safeTransform.offsetX) * safeTransform.scale;
        const horizontalSettings = settings as RulerSettings['horizontal'];

        if (shouldDrawTickLine) {
          ctx.moveTo(screenX, ctx.canvas.height - horizontalSettings.height);
          ctx.lineTo(screenX, ctx.canvas.height - horizontalSettings.height + tick.length);
        }

        if (tick.label && shouldShowLabel(tick, ticks, 'horizontal', safeTransform.scale) && (settings.showLabels || settings.showUnits)) {
          const unitsMatch = tick.label.match(/[a-zA-Z]+$/);
          const numbersText = tick.label.replace(/[a-zA-Z]+$/, '');
          const unitsText = unitsMatch ? unitsMatch[0] : '';

          let totalWidth = 0;

          if (settings.showLabels && numbersText) {
            ctx.font = buildUIFont(settings.fontSize || UI_SIZE_DEFAULTS.RULER_FONT_SIZE, settings.fontFamily || 'monospace');
            totalWidth += ctx.measureText(numbersText).width;
          }
          if (settings.showUnits && unitsText) {
            ctx.font = buildUIFont(settings.unitsFontSize || UI_SIZE_DEFAULTS.RULER_UNITS_FONT_SIZE, settings.fontFamily || 'monospace');
            totalWidth += ctx.measureText(unitsText).width;
          }

          let currentX = screenX - totalWidth / 2;

          if (settings.showLabels && numbersText) {
            ctx.font = buildUIFont(settings.fontSize || UI_SIZE_DEFAULTS.RULER_FONT_SIZE, settings.fontFamily || 'monospace');
            ctx.fillText(numbersText, currentX, ctx.canvas.height - 3);
            currentX += ctx.measureText(numbersText).width;
          }

          if (settings.showUnits && unitsText) {
            ctx.save();
            ctx.font = buildUIFont(settings.unitsFontSize || UI_SIZE_DEFAULTS.RULER_UNITS_FONT_SIZE, settings.fontFamily || 'monospace');
            ctx.fillStyle = settings.unitsColor || settings.textColor || UI_COLORS.RULER_TEXT_GRAY;
            ctx.fillText(unitsText, currentX, ctx.canvas.height - 3);
            ctx.restore();
          }
        }
      } else {
        const worldY = tick.position;
        const { bottom } = COORDINATE_LAYOUT.MARGINS;
        const verticalSettings = settings as RulerSettings['vertical'];
        const y = ctx.canvas.height - bottom - (worldY + safeTransform.offsetY) * safeTransform.scale;

        if (shouldDrawTickLine) {
          ctx.moveTo(verticalSettings.width - tick.length, y);
          ctx.lineTo(verticalSettings.width, y);
        }

        if (tick.label && shouldShowLabel(tick, ticks, 'vertical', safeTransform.scale) && (settings.showLabels || settings.showUnits)) {
          const unitsMatch = tick.label.match(/[a-zA-Z]+$/);
          const numbersText = tick.label.replace(/[a-zA-Z]+$/, '');
          const unitsText = unitsMatch ? unitsMatch[0] : '';

          let totalWidth = 0;

          if (settings.showLabels && numbersText) {
            ctx.font = buildUIFont(settings.fontSize || UI_SIZE_DEFAULTS.RULER_FONT_SIZE, settings.fontFamily || 'monospace');
            totalWidth += ctx.measureText(numbersText).width;
          }
          if (settings.showUnits && unitsText) {
            ctx.font = buildUIFont(settings.unitsFontSize || UI_SIZE_DEFAULTS.RULER_UNITS_FONT_SIZE, settings.fontFamily || 'monospace');
            totalWidth += ctx.measureText(unitsText).width;
          }

          let currentY = y - totalWidth / 2;

          if (settings.showUnits && unitsText) {
            ctx.font = buildUIFont(settings.unitsFontSize || UI_SIZE_DEFAULTS.RULER_UNITS_FONT_SIZE, settings.fontFamily || 'monospace');
            ctx.save();
            ctx.translate(3, currentY);
            ctx.rotate(-RIGHT_ANGLE);
            ctx.textBaseline = 'top';
            ctx.textAlign = 'end';
            ctx.fillStyle = settings.unitsColor || settings.textColor || UI_COLORS.RULER_TEXT_GRAY;
            ctx.fillText(unitsText, 0, 0);
            ctx.restore();
            currentY += ctx.measureText(unitsText).width;
          }

          if (settings.showLabels && numbersText) {
            ctx.font = buildUIFont(settings.fontSize || UI_SIZE_DEFAULTS.RULER_FONT_SIZE, settings.fontFamily || 'monospace');
            ctx.save();
            ctx.translate(3, currentY);
            ctx.rotate(-RIGHT_ANGLE);
            ctx.textBaseline = 'top';
            ctx.textAlign = 'end';
            ctx.fillText(numbersText, 0, 0);
            ctx.restore();
          }
        }
      }

      if (shouldDrawTickLine) {
        ctx.stroke();
      }
    });

    ctx.restore();
  }
};

// ============================================================================
// AGGREGATE EXPORTS (backward compatibility)
// ============================================================================

export const RulersGridCalculations = {
  ...GridCalculations,
  ...RulerCalculations,
  calculateVisibleBounds: GridCalculations.calculateVisibleBounds,
  generateGridLines: GridCalculations.generateGridLines,
  calculateTicks: RulerCalculations.calculateTicks,
  calculateLayout: RulerCalculations.calculateLayout
};

export const RulersGridUtils = {
  ...UnitConversion,
  ...GridCalculations,
  ...RulerCalculations,
  ...SettingsValidationUtils,
  ...PerformanceUtilities
};
