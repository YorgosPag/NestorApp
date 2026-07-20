/**
 * GRID CALCULATION UTILITIES
 * Grid line generation, unit conversion, adaptive spacing.
 *
 * @module systems/rulers-grid/grid-calculations
 * @see utils.ts (barrel)
 */

import {
  GridSettings,
  UnitType,
  GridBounds,
  GridLine,
  RULERS_GRID_CONFIG,
} from './config';
import type { ViewTransform } from './config';
import { AXIS_DETECTION } from '../../config/tolerance-config';
import { clamp01 } from '../../rendering/entities/shared/geometry-utils';
import { formatLengthMm } from '../../config/display-length-format';
// 🪜 ADR-681 §5.7: major emphasis is DERIVED from minor, never set beside it.
import { deriveMajorGridWeight } from '../../config/grid-emphasis';

// ============================================================================
// HELPERS (private to this module)
// ============================================================================

function createGridLine(
  position: number,
  orientation: 'horizontal' | 'vertical',
  isAxis: boolean,
  settings: GridSettings
): GridLine {
  if (isAxis) {
    return {
      type: 'axis' as const,
      position,
      orientation,
      opacity: 1.0,
      weight: settings.visual.axesWeight,
      color: settings.visual.axesColor
    };
  } else {
    return {
      type: 'major' as const,
      position,
      orientation,
      opacity: settings.visual.opacity,
      weight: deriveMajorGridWeight(settings.visual.minorGridWeight),
      color: settings.visual.majorGridColor || settings.visual.color
    };
  }
}

function createMinorLines(
  basePosition: number,
  subStep: number,
  maxPosition: number,
  orientation: 'horizontal' | 'vertical',
  settings: GridSettings
): GridLine[] {
  const lines: GridLine[] = [];
  const subDivisions = settings?.visual?.subDivisions || RULERS_GRID_CONFIG.DEFAULT_SUBDIVISIONS;
  if (subDivisions > 1) {
    for (let i = 1; i < subDivisions; i++) {
      const subPosition = basePosition + (i * subStep);
      if (subPosition <= maxPosition) {
        lines.push({
          type: 'minor',
          position: subPosition,
          orientation,
          opacity: settings.visual.opacity * 0.5,
          weight: settings.visual.minorGridWeight,
          color: settings.visual.minorGridColor
        });
      }
    }
  }
  return lines;
}

// ============================================================================
// UNIT CONVERSION
// ============================================================================

export const UnitConversion = {
  convert: (value: number, fromUnit: UnitType, toUnit: UnitType): number => {
    if (fromUnit === toUnit) return value;
    const fromFactor = RULERS_GRID_CONFIG.UNIT_CONVERSIONS[fromUnit];
    const toFactor = RULERS_GRID_CONFIG.UNIT_CONVERSIONS[toUnit];
    return (value * fromFactor) / toFactor;
  },

  /**
   * @deprecated Display formatting is now the SSoT `formatLengthMm` (ADR-462):
   * ONE unit source of truth (the status-bar selector) + locale-aware separator,
   * exactly like Revit/AutoCAD where ruler + dimensions + measurements all follow
   * one project unit. This thin adapter delegates to it and IGNORES the legacy
   * `units`/`precision` args so every ruler tick follows the live display unit.
   * `value` is a canonical-mm world coordinate.
   */
  format: (value: number, _units?: UnitType, _precision?: number): string => {
    return formatLengthMm(value);
  },

  getStepForUnit: (units: UnitType, baseStep: number = 10): number => {
    switch (units) {
      case 'mm': return baseStep;
      case 'cm': return baseStep / 10;
      case 'm': return baseStep / 1000;
      case 'inches': return baseStep / 25.4;
      case 'feet': return baseStep / 304.8;
      default: return baseStep;
    }
  }
};

// ============================================================================
// GRID CALCULATIONS
// ============================================================================

export const GridCalculations = {
  calculateAdaptiveSpacing: (
    scale: number,
    baseStep: number,
    settings: GridSettings
  ): number => {
    if (!settings.behavior.adaptiveGrid) return baseStep;

    let currentStep = baseStep;
    const subDivisions = settings?.visual?.subDivisions || RULERS_GRID_CONFIG.DEFAULT_SUBDIVISIONS;

    while (currentStep * scale < settings.behavior.minGridSpacing) {
      currentStep *= subDivisions;
    }
    while (currentStep * scale > settings.behavior.maxGridSpacing) {
      currentStep /= subDivisions;
    }

    return currentStep;
  },

  /**
   * 🌊 ADAPTIVE GRID cascade levels — REMOVED 2026-07-20.
   *
   * This was a SECOND, never-called implementation of the cascade that the
   * live renderer already does in `rendering/ui/grid/grid-adaptive.ts`
   * (`computeAdaptiveLevels`). Only this dead copy kept the cascade window
   * distinct from the fade window; the live one derived both from the fade
   * threshold, which is what produced the over-dense grid. The correct
   * semantics were moved INTO the live path rather than kept as a twin
   * (CLAUDE.md N.18).
   *
   * Both windows have since been retired as independent quantities entirely:
   * the live path derives the band top AND the cross-fade from the single
   * `minGridSpacing` anchor (ADR-681 §5, MAXON/C4D model).
   *
   * @see ../../rendering/ui/grid/grid-adaptive.ts — the single owner
   */

  calculateVisibleBounds: (
    transform: ViewTransform,
    canvasRect: DOMRect,
    gridStep: number
  ): GridBounds => {
    const topLeft = {
      x: -transform.offsetX,
      y: (canvasRect.height / transform.scale) - transform.offsetY
    };
    const bottomRight = {
      x: (canvasRect.width / transform.scale) - transform.offsetX,
      y: -transform.offsetY
    };

    const subStep = gridStep / 5;

    return {
      minX: Math.floor(topLeft.x / gridStep) * gridStep,
      maxX: Math.ceil(bottomRight.x / gridStep) * gridStep,
      minY: Math.floor(bottomRight.y / gridStep) * gridStep,
      maxY: Math.ceil(topLeft.y / gridStep) * gridStep,
      gridStep,
      subStep
    };
  },

  generateGridLines: (
    bounds: GridBounds,
    settings: GridSettings,
    _transform: ViewTransform
  ): GridLine[] => {
    const lines: GridLine[] = [];
    const { minX, maxX, minY, maxY, gridStep, subStep } = bounds;

    const estimatedLines = ((maxX - minX) / gridStep) + ((maxY - minY) / gridStep);
    if (estimatedLines > RULERS_GRID_CONFIG.MAX_GRID_LINES) {
      console.warn('Too many grid lines, skipping render');
      return lines;
    }

    for (let x = minX; x <= maxX; x += gridStep) {
      const isAxis = Math.abs(x) < AXIS_DETECTION.ZERO_THRESHOLD;
      if (isAxis && settings.visual.showAxes) {
        lines.push(createGridLine(x, 'vertical', true, settings));
      } else {
        lines.push(createGridLine(x, 'vertical', false, settings));
      }
      lines.push(...createMinorLines(x, subStep, maxX, 'vertical', settings));
    }

    for (let y = minY; y <= maxY; y += gridStep) {
      const isAxis = Math.abs(y) < AXIS_DETECTION.ZERO_THRESHOLD;
      if (isAxis && settings.visual.showAxes) {
        lines.push(createGridLine(y, 'horizontal', true, settings));
      } else {
        lines.push(createGridLine(y, 'horizontal', false, settings));
      }
      lines.push(...createMinorLines(y, subStep, maxY, 'horizontal', settings));
    }

    return lines;
  },

  getEffectiveOpacity: (
    baseOpacity: number,
    transform: ViewTransform,
    settings: GridSettings
  ): number => {
    if (!settings.behavior.fadeAtDistance) return baseOpacity;
    const scaleFactor = clamp01(transform.scale / 10);
    const fadeMultiplier = Math.max(settings.behavior.fadeThreshold, scaleFactor);
    return baseOpacity * fadeMultiplier;
  }
};
