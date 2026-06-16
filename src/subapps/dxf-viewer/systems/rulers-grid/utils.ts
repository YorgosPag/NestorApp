/**
 * RULERS/GRID SYSTEM UTILITIES — BARREL + GRID RENDERING
 *
 * Split into SRP modules (ADR-065):
 * - grid-calculations.ts — grid math, unit conversion
 * - ruler-calculations.ts — tick generation, validation, performance, snapping
 *
 * This file: grid rendering + aggregate re-exports.
 *
 * ⚠️ `RulersGridRendering.renderRuler` removed 2026-06-16 (ADR-462 Follow-up 3):
 * it was the THIRD (dead) ruler renderer — drawn by no one (`useRenderingCalculations.
 * renderRulers`, its only caller, was itself never invoked). The single VISIBLE ruler
 * renderer is `rendering/ui/ruler/RulerRenderer.ts`. Tick MATH (`ruler-calculations`,
 * `calculateRulerTicks`) is kept — it is calculation, not a duplicate renderer.
 */

import {
  GridLine,
} from './config';
import type { ViewTransform } from './config';
import { UI_COLORS } from '../../config/color-config';

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
} from './ruler-calculations';

// ============================================================================
// GRID RENDERING UTILITIES
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
