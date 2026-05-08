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
      weight: settings.visual.majorGridWeight,
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

  format: (value: number, units: UnitType, precision?: number): string => {
    const defaultPrecision = units === 'mm' ? 1 : units === 'cm' ? 2 : units === 'm' ? 3 : 2;
    const actualPrecision = precision ?? defaultPrecision;
    const formatted = value.toFixed(actualPrecision);
    return `${formatted}${units}`;
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
   * 🌊 ADAPTIVE GRID — multi-level smooth fade.
   *
   * Returns the world-space minor + major step plus the screen-space opacity
   * factor for the minor level (in [0,1]). Used by GridRenderer to draw
   * minor + major in two passes with a continuous fade transition as the
   * user zooms — exactly the AutoCAD / Fusion 360 / OnShape / Figma /
   * Miro behaviour.
   *
   * Algorithm:
   *   1. Pick the largest `step` whose screen spacing fits the
   *      `[minGridSpacing, maxGridSpacing]` window — that's the MAJOR step
   *      (always at full opacity).
   *   2. The MINOR step is `majorStep / subDivisions`.
   *   3. The minor's screen spacing controls its opacity via smoothstep
   *      between `smoothFadeMinPx` and `smoothFadeMaxPx`. Below min the
   *      minor disappears entirely; above max it's fully visible. As the
   *      user zooms in, the minor fades up; when minor crosses above max
   *      and a new finer step would be needed, the algorithm cascades
   *      the major down, the previous minor becomes the new major (full
   *      opacity), and a finer minor enters at opacity 0 — perfectly
   *      continuous visually.
   */
  calculateAdaptiveLevels: (
    scale: number,
    baseStep: number,
    settings: GridSettings,
  ): {
    readonly minorStep: number;
    readonly majorStep: number;
    readonly minorOpacity: number;
    readonly minorScreenPx: number;
    readonly majorScreenPx: number;
  } => {
    const subDivisions = settings?.visual?.subDivisions || RULERS_GRID_CONFIG.DEFAULT_SUBDIVISIONS;
    const min = settings.behavior.minGridSpacing;
    const max = settings.behavior.maxGridSpacing;

    // 1. Find majorStep whose screen spacing fits [min, max].
    let majorStep = baseStep;
    while (majorStep * scale < min) majorStep *= subDivisions;
    while (majorStep * scale > max) majorStep /= subDivisions;

    // 2. Minor is one level finer.
    const minorStep = majorStep / subDivisions;
    const minorScreenPx = minorStep * scale;
    const majorScreenPx = majorStep * scale;

    // 3. Smoothstep opacity for minor.
    const fadeMin = settings.behavior.smoothFadeMinPx ?? 8;
    const fadeMax = settings.behavior.smoothFadeMaxPx ?? 32;
    const t = clamp01((minorScreenPx - fadeMin) / Math.max(0.001, fadeMax - fadeMin));
    const minorOpacity = settings.behavior.smoothFade === false
      ? (minorScreenPx >= min ? 1 : 0) // legacy discrete
      : t * t * (3 - 2 * t); // smoothstep

    return { minorStep, majorStep, minorOpacity, minorScreenPx, majorScreenPx };
  },

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
