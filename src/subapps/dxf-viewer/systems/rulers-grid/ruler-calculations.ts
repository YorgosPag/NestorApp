/**
 * RULER CALCULATION UTILITIES
 * Tick generation, layout, settings validation, performance guards.
 *
 * @module systems/rulers-grid/ruler-calculations
 * @see utils.ts (barrel)
 */

import {
  RulerSettings,
  GridSettings,
  GridBounds,
  RulerTick,
  RulersLayoutInfo,
  RULERS_GRID_CONFIG,
} from './config';
import type { Point2D, ViewTransform } from './config';
import type { SnapResult } from './config';
import { AXIS_DETECTION, UI_POSITIONING } from '../../config/tolerance-config';
import { UnitConversion, GridCalculations } from './grid-calculations';

// ============================================================================
// RULER CALCULATIONS
// ============================================================================

export const RulerCalculations = {
  calculateTicks: (
    type: 'horizontal' | 'vertical',
    bounds: GridBounds,
    settings: RulerSettings,
    transform: ViewTransform,
    canvasRect: DOMRect
  ): RulerTick[] => {
    const ticks: RulerTick[] = [];
    const isHorizontal = type === 'horizontal';

    let start, end;
    if (isHorizontal) {
      start = 0;
      end = (canvasRect.width - (settings.vertical.width || 30)) / transform.scale - transform.offsetX;
    } else {
      start = 0;
      end = (canvasRect.height - (settings.horizontal.height || 30)) / transform.scale - transform.offsetY;
    }

    const expandedStart = Math.max(start, 0);
    const expandedEnd = Math.max(end, 0);

    const visibleRange = Math.abs(expandedEnd - expandedStart);
    const desiredTickCount = UI_POSITIONING.DESIRED_TICK_COUNT;

    const logicalSpacings = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let tickSpacing = visibleRange / desiredTickCount;
    tickSpacing = logicalSpacings.find(s => s >= tickSpacing) || logicalSpacings[logicalSpacings.length - 1];

    const minPixelSpacing = UI_POSITIONING.MIN_TICK_PIXEL_SPACING;
    while (tickSpacing * transform.scale < minPixelSpacing && tickSpacing < 1000) {
      const currentIndex = logicalSpacings.indexOf(tickSpacing);
      if (currentIndex < logicalSpacings.length - 1) {
        tickSpacing = logicalSpacings[currentIndex + 1];
      } else {
        break;
      }
    }

    const estimatedTicks = Math.abs(expandedEnd - expandedStart) / tickSpacing;
    if (estimatedTicks > RULERS_GRID_CONFIG.MAX_RULER_TICKS) {
      console.warn('Too many ruler ticks, skipping render');
      return ticks;
    }

    const startTick = 0;
    for (let pos = startTick; pos <= expandedEnd; pos += tickSpacing) {
      const isMajor = true;

      ticks.push({
        position: pos,
        type: isMajor ? 'major' : 'minor',
        length: isMajor ? settings[type].majorTickLength : settings[type].minorTickLength,
        label: isMajor ? UnitConversion.format(pos, settings.units, settings[type].precision) : undefined,
        value: pos
      });

      if (settings[type].showMinorTicks) {
        const minorSpacing = tickSpacing / 5;
        for (let i = 1; i < 5; i++) {
          const minorPos = pos + (i * minorSpacing);
          if (minorPos <= expandedEnd && minorPos < (startTick + Math.ceil((expandedEnd - startTick) / tickSpacing) * tickSpacing)) {
            ticks.push({
              position: minorPos,
              type: 'minor',
              length: settings[type].minorTickLength,
              value: minorPos
            });
          }
        }
      }
    }

    return ticks.sort((a, b) => a.position - b.position);
  },

  calculateLayout: (canvasRect: DOMRect, settings: RulerSettings): RulersLayoutInfo => {
    const hHeight = settings.horizontal.enabled ? settings.horizontal.height : 0;
    const vWidth = settings.vertical.enabled ? settings.vertical.width : 0;

    return {
      horizontalRulerRect: {
        x: vWidth,
        y: settings.horizontal.position === 'top' ? 0 : canvasRect.height - hHeight,
        width: canvasRect.width - vWidth,
        height: hHeight
      },
      verticalRulerRect: {
        x: settings.vertical.position === 'left' ? 0 : canvasRect.width - vWidth,
        y: hHeight,
        width: vWidth,
        height: canvasRect.height - hHeight
      },
      cornerRect: {
        x: settings.vertical.position === 'left' ? 0 : canvasRect.width - vWidth,
        y: settings.horizontal.position === 'top' ? 0 : canvasRect.height - hHeight,
        width: vWidth,
        height: hHeight
      },
      contentRect: {
        x: settings.vertical.position === 'left' ? vWidth : 0,
        y: settings.horizontal.position === 'top' ? hHeight : 0,
        width: canvasRect.width - vWidth,
        height: canvasRect.height - hHeight
      }
    };
  }
};

// ============================================================================
// SETTINGS VALIDATION
// ============================================================================

export const SettingsValidationUtils = {
  validateRulerSettings: (settings: RulerSettings): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (settings.horizontal.height < RULERS_GRID_CONFIG.MIN_RULER_HEIGHT ||
        settings.horizontal.height > RULERS_GRID_CONFIG.MAX_RULER_HEIGHT) {
      errors.push(`Horizontal ruler height must be between ${RULERS_GRID_CONFIG.MIN_RULER_HEIGHT} and ${RULERS_GRID_CONFIG.MAX_RULER_HEIGHT}`);
    }
    if (settings.vertical.width < RULERS_GRID_CONFIG.MIN_RULER_WIDTH ||
        settings.vertical.width > RULERS_GRID_CONFIG.MAX_RULER_WIDTH) {
      errors.push(`Vertical ruler width must be between ${RULERS_GRID_CONFIG.MIN_RULER_WIDTH} and ${RULERS_GRID_CONFIG.MAX_RULER_WIDTH}`);
    }
    if (settings.horizontal.precision < 0 || settings.horizontal.precision > 10) {
      errors.push('Horizontal ruler precision must be between 0 and 10');
    }
    if (settings.vertical.precision < 0 || settings.vertical.precision > 10) {
      errors.push('Vertical ruler precision must be between 0 and 10');
    }
    if (settings.snap.tolerance < RULERS_GRID_CONFIG.MIN_SNAP_TOLERANCE ||
        settings.snap.tolerance > RULERS_GRID_CONFIG.MAX_SNAP_TOLERANCE) {
      errors.push(`Snap tolerance must be between ${RULERS_GRID_CONFIG.MIN_SNAP_TOLERANCE} and ${RULERS_GRID_CONFIG.MAX_SNAP_TOLERANCE}`);
    }

    return { valid: errors.length === 0, errors };
  },

  validateGridSettings: (settings: GridSettings): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (settings.visual.step < RULERS_GRID_CONFIG.MIN_GRID_STEP ||
        settings.visual.step > RULERS_GRID_CONFIG.MAX_GRID_STEP) {
      errors.push(`Grid step must be between ${RULERS_GRID_CONFIG.MIN_GRID_STEP} and ${RULERS_GRID_CONFIG.MAX_GRID_STEP}`);
    }
    if (settings.visual.opacity < RULERS_GRID_CONFIG.MIN_OPACITY ||
        settings.visual.opacity > RULERS_GRID_CONFIG.MAX_OPACITY) {
      errors.push(`Grid opacity must be between ${RULERS_GRID_CONFIG.MIN_OPACITY} and ${RULERS_GRID_CONFIG.MAX_OPACITY}`);
    }
    const subDivisions = settings?.visual?.subDivisions || RULERS_GRID_CONFIG.DEFAULT_SUBDIVISIONS;
    if (subDivisions < 1 || subDivisions > 20) {
      errors.push('Grid subdivisions must be between 1 and 20');
    }
    if (settings.behavior.minGridSpacing < 1 || settings.behavior.minGridSpacing > 100) {
      errors.push('Min grid spacing must be between 1 and 100 pixels');
    }
    if (settings.behavior.maxGridSpacing < 10 || settings.behavior.maxGridSpacing > 500) {
      errors.push('Max grid spacing must be between 10 and 500 pixels');
    }

    return { valid: errors.length === 0, errors };
  }
};

// ============================================================================
// PERFORMANCE UTILITIES
// ============================================================================

export const PerformanceUtilities = {
  shouldRenderGrid: (transform: ViewTransform, settings: GridSettings): boolean => {
    const effectiveStep = GridCalculations.calculateAdaptiveSpacing(
      transform.scale, settings.visual.step, settings
    );
    const estimatedLines = (2000 / effectiveStep) * 2;
    return estimatedLines <= RULERS_GRID_CONFIG.MAX_GRID_LINES;
  },

  shouldRenderRulers: (_transform: ViewTransform, _settings: RulerSettings): boolean => {
    return _transform.scale > 0.1;
  },

  createThrottledRender: (renderFn: () => void): (() => void) => {
    let lastRender = 0;
    return () => {
      const now = Date.now();
      if (now - lastRender >= RULERS_GRID_CONFIG.RENDER_THROTTLE_MS) {
        renderFn();
        lastRender = now;
      }
    };
  }
};

// ============================================================================
// SNAPPING
// ============================================================================

export const RulersGridSnapping = {
  findSnapPoint: (
    _point: Point2D,
    _gridSettings: GridSettings,
    _rulerSettings: RulerSettings,
    _transform: ViewTransform
  ): SnapResult | null => {
    return null;
  },

  getSnapTolerance: (pixelTolerance: number, transform: ViewTransform): number => {
    return pixelTolerance / transform.scale;
  }
};
