/**
 * RULERS/GRID SYSTEM UTILITIES
 * Utility functions for rulers and grid calculations and operations
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_RULERS_GRID = false;

import {
  RulerSettings,
  GridSettings,
  UnitType,
  GridBounds,
  SnapResult,
  RulerTick,
  GridLine,
  RulersLayoutInfo,
  RULERS_GRID_CONFIG,
  COORDINATE_LAYOUT
} from './config';
import type { Point2D, ViewTransform } from './config';
import { UI_COLORS } from '../../config/color-config';
// 🏢 ADR-044: Centralized Line Widths
// 🏢 ADR-091: Centralized UI Fonts (buildUIFont for dynamic sizes)
// 🏢 ADR-107: Centralized UI Size Defaults
import { RENDER_LINE_WIDTHS, buildUIFont, UI_SIZE_DEFAULTS } from '../../config/text-rendering-config';
// 🏢 ADR-079: Centralized Axis Detection Constants
import { AXIS_DETECTION } from '../../config/tolerance-config';
// 🏢 ADR: Centralized Clamp Function
// 🏢 ADR-XXX: Centralized Angular Constants
import { clamp01, RIGHT_ANGLE } from '../../rendering/entities/shared/geometry-utils';

// Helper function to generate grid line (eliminates code duplication)
function createGridLine(
  position: number,
  orientation: 'horizontal' | 'vertical',
  isAxis: boolean,
  settings: GridSettings
): GridLine {

  if (isAxis) {
    const axisLine: GridLine = {
      type: 'axis' as const,
      position,
      orientation,
      opacity: 1.0,
      weight: settings.visual.axesWeight,
      color: settings.visual.axesColor
    };

    return axisLine;
  } else {
    const majorLine: GridLine = {
      type: 'major' as const,
      position,
      orientation,
      opacity: settings.visual.opacity,
      weight: settings.visual.majorGridWeight,
      color: settings.visual.majorGridColor || settings.visual.color // Fallback στο color αν δεν υπάρχει majorGridColor
    };

    return majorLine;
  }
}

// Helper function to generate minor subdivision lines
function createMinorLines(
  basePosition: number,
  subStep: number,
  maxPosition: number,
  orientation: 'horizontal' | 'vertical',
  settings: GridSettings
): GridLine[] {
  const lines: GridLine[] = [];
  
  // 🏢 ADR-110: Use centralized subdivisions fallback
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

// ===== UNIT CONVERSION UTILITIES =====
export const UnitConversion = {
  /**
   * Converts value from one unit to another
   */
  convert: (value: number, fromUnit: UnitType, toUnit: UnitType): number => {
    if (fromUnit === toUnit) return value;
    
    const fromFactor = RULERS_GRID_CONFIG.UNIT_CONVERSIONS[fromUnit];
    const toFactor = RULERS_GRID_CONFIG.UNIT_CONVERSIONS[toUnit];
    
    return (value * fromFactor) / toFactor;
  },

  /**
   * Formats a value with appropriate precision for the unit
   */
  format: (value: number, units: UnitType, precision?: number): string => {
    const defaultPrecision = units === 'mm' ? 1 : units === 'cm' ? 2 : units === 'm' ? 3 : 2;
    const actualPrecision = precision ?? defaultPrecision;
    
    const formatted = value.toFixed(actualPrecision);
    return `${formatted}${units}`;
  },

  /**
   * Gets appropriate step size for unit
   */
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

// ===== GRID CALCULATION UTILITIES =====
export const GridCalculations = {
  /**
   * Calculates adaptive grid spacing based on zoom level
   */
  calculateAdaptiveSpacing: (
    scale: number,
    baseStep: number,
    settings: GridSettings
  ): number => {
    if (!settings.behavior.adaptiveGrid) {
      return baseStep;
    }
    
    let currentStep = baseStep;
    // 🏢 ADR-110: Use centralized subdivisions fallback
    const subDivisions = settings?.visual?.subDivisions || RULERS_GRID_CONFIG.DEFAULT_SUBDIVISIONS;

    // Increase step size when too dense
    while (currentStep * scale < settings.behavior.minGridSpacing) {
      currentStep *= subDivisions;
    }
    
    // Decrease step size when too sparse
    while (currentStep * scale > settings.behavior.maxGridSpacing) {
      currentStep /= subDivisions;
    }
    
    return currentStep;
  },

  /**
   * Calculates visible grid boundaries in world coordinates
   */
  calculateVisibleBounds: (
    transform: ViewTransform,
    canvasRect: DOMRect,
    gridStep: number
  ): GridBounds => {

    // Convert screen corners to world coordinates
    const topLeft = {
      x: -transform.offsetX,
      y: (canvasRect.height / transform.scale) - transform.offsetY
    };
    const bottomRight = {
      x: (canvasRect.width / transform.scale) - transform.offsetX,
      y: -transform.offsetY
    };

    const subStep = gridStep / 5; // Default subdivision

    const bounds = {
      minX: Math.floor(topLeft.x / gridStep) * gridStep,
      maxX: Math.ceil(bottomRight.x / gridStep) * gridStep,
      minY: Math.floor(bottomRight.y / gridStep) * gridStep,
      maxY: Math.ceil(topLeft.y / gridStep) * gridStep,
      gridStep,
      subStep
    };

    return bounds;
  },

  /**
   * Generates grid lines for rendering
   */
  generateGridLines: (
    bounds: GridBounds,
    settings: GridSettings,
    transform: ViewTransform
  ): GridLine[] => {

    const lines: GridLine[] = [];
    const { minX, maxX, minY, maxY, gridStep, subStep } = bounds;

    // Performance check
    const estimatedLines = ((maxX - minX) / gridStep) + ((maxY - minY) / gridStep);
    if (estimatedLines > RULERS_GRID_CONFIG.MAX_GRID_LINES) {
      console.warn('Too many grid lines, skipping render');
      return lines;
    }

    // Vertical lines
    for (let x = minX; x <= maxX; x += gridStep) {
      // 🏢 ADR-079: Use centralized zero threshold
      const isAxis = Math.abs(x) < AXIS_DETECTION.ZERO_THRESHOLD;
      const isOrigin = isAxis;
      
      if (isAxis && settings.visual.showAxes) {
        lines.push(createGridLine(x, 'vertical', true, settings));
      } else {
        lines.push(createGridLine(x, 'vertical', false, settings));
      }

      // Minor subdivision lines
      lines.push(...createMinorLines(x, subStep, maxX, 'vertical', settings));
    }

    // Horizontal lines
    for (let y = minY; y <= maxY; y += gridStep) {
      // 🏢 ADR-079: Use centralized zero threshold
      const isAxis = Math.abs(y) < AXIS_DETECTION.ZERO_THRESHOLD;
      
      if (isAxis && settings.visual.showAxes) {
        lines.push(createGridLine(y, 'horizontal', true, settings));
      } else {
        lines.push(createGridLine(y, 'horizontal', false, settings));
      }

      // Minor subdivision lines
      lines.push(...createMinorLines(y, subStep, maxY, 'horizontal', settings));
    }

    return lines;
  },

  /**
   * Gets effective opacity based on distance and settings
   */
  getEffectiveOpacity: (
    baseOpacity: number,
    transform: ViewTransform,
    settings: GridSettings
  ): number => {
    if (!settings.behavior.fadeAtDistance) {
      return baseOpacity;
    }

    const scaleFactor = clamp01(transform.scale / 10);
    const fadeMultiplier = Math.max(settings.behavior.fadeThreshold, scaleFactor);
    
    return baseOpacity * fadeMultiplier;
  }
};

// ===== RULER CALCULATION UTILITIES =====
export const RulerCalculations = {
  /**
   * Calculates ruler tick positions and labels
   */
  calculateTicks: (
    type: 'horizontal' | 'vertical',
    bounds: GridBounds,
    settings: RulerSettings,
    transform: ViewTransform,
    canvasRect: DOMRect
  ): RulerTick[] => {

    const ticks: RulerTick[] = [];
    const isHorizontal = type === 'horizontal';
    
    // ✅ CALCULATE RULER BOUNDS BASED ON FULL RULER LENGTH, NOT JUST VISIBLE AREA
    // Υπολογισμός πλήρους εύρους χάρακα με βάση το μέγεθος του canvas
    let start, end;
    if (isHorizontal) {
      // Οριζόντιος χάρακας: από 0 μέχρι τέρμα δεξιά του canvas
      start = 0;
      end = (canvasRect.width - (settings.vertical.width || 30)) / transform.scale - transform.offsetX;
    } else {
      // Κάθετος χάρακας: από 0 μέχρι τέρμα πάνω του canvas  
      start = 0;
      end = (canvasRect.height - (settings.horizontal.height || 30)) / transform.scale - transform.offsetY;
    }

    // ✅ ENSURE 0 IS ALWAYS INCLUDED BUT ONLY POSITIVE VALUES - User wants only positive axis values
    // Οριζόντιος χάρακας: μόνο δεξιά από 0,0 (θετικές X τιμές)
    // Κάθετος χάρακας: μόνο πάνω από 0,0 (θετικές Y τιμές)
    const expandedStart = Math.max(start, 0); // Ποτέ μικρότερο από 0
    const expandedEnd = Math.max(end, 0); // Πάντα τουλάχιστον μέχρι το 0

    // Calculate tick spacing - βελτιωμένη λογική για καλύτερη κατανομή
    const baseSpacing = UnitConversion.getStepForUnit(settings.units, 1);
    
    // Υπολογισμός tick spacing με βάση το εύρος που είναι ορατό στο χάρακα
    const visibleRange = Math.abs(expandedEnd - expandedStart);
    const desiredTickCount = 8; // Στόχος: περίπου 8-10 major ticks σε όλο το μήκος του χάρακα
    
    // Εξασφάλισε λογικές τιμές (π.χ. 1, 2, 5, 10, 20, 50, 100...)
    const logicalSpacings = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let tickSpacing = visibleRange / desiredTickCount;
    
    // Βρες την πιο κοντινή λογική τιμή
    tickSpacing = logicalSpacings.find(s => s >= tickSpacing) || logicalSpacings[logicalSpacings.length - 1];
    
    // Εξασφάλισε ότι το spacing δεν είναι πολύ μικρό στο screen (ελάχιστο 15 pixels)
    const minPixelSpacing = 15;
    while (tickSpacing * transform.scale < minPixelSpacing && tickSpacing < 1000) {
      const currentIndex = logicalSpacings.indexOf(tickSpacing);
      if (currentIndex < logicalSpacings.length - 1) {
        tickSpacing = logicalSpacings[currentIndex + 1];
      } else {
        break;
      }
    }

    // Performance check using expanded range
    const estimatedTicks = Math.abs(expandedEnd - expandedStart) / tickSpacing;
    if (estimatedTicks > RULERS_GRID_CONFIG.MAX_RULER_TICKS) {
      console.warn('Too many ruler ticks, skipping render');
      return ticks;
    }

    // Generate major ticks starting from 0 and going to the positive direction only
    const startTick = 0; // Πάντα ξεκινάμε από το 0
    for (let pos = startTick; pos <= expandedEnd; pos += tickSpacing) {
      // Κάνε όλα τα κύρια ticks major για καλύτερη κατανομή labels
      const isMajor = true; // Αφού υπολογίσαμε ήδη το καλύτερο spacing, όλα είναι major
      // 🏢 ADR-079: Use centralized zero threshold
      const isZero = Math.abs(pos) < AXIS_DETECTION.ZERO_THRESHOLD;
      
      // ✅ ALWAYS SHOW ZERO - User wants 0-0 visible at bottom-left
      // if (isZero && !settings[type].showZero) continue; // DISABLED - Always show zero
      
      if (isZero) {

      }

      ticks.push({
        position: pos,
        type: isMajor ? 'major' : 'minor',
        length: isMajor ? settings[type].majorTickLength : settings[type].minorTickLength,
        label: isMajor ? UnitConversion.format(pos, settings.units, settings[type].precision) : undefined,
        value: pos
      });

      // Generate minor ticks if enabled - προσθέτουμε minor ticks μεταξύ των major
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

    const sortedTicks = ticks.sort((a, b) => a.position - b.position);

    return sortedTicks;
  },

  /**
   * Gets layout information for rulers
   */
  calculateLayout: (canvasRect: DOMRect, settings: RulerSettings): RulersLayoutInfo => {

    const hHeight = settings.horizontal.enabled ? settings.horizontal.height : 0;
    const vWidth = settings.vertical.enabled ? settings.vertical.width : 0;

    const layout = {
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

    return layout;
  }
};

// ===== SETTINGS VALIDATION UTILITIES =====
export const SettingsValidationUtils = {
  /**
   * Validates ruler settings
   */
  validateRulerSettings: (settings: RulerSettings): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate dimensions
    if (settings.horizontal.height < RULERS_GRID_CONFIG.MIN_RULER_HEIGHT || 
        settings.horizontal.height > RULERS_GRID_CONFIG.MAX_RULER_HEIGHT) {
      errors.push(`Horizontal ruler height must be between ${RULERS_GRID_CONFIG.MIN_RULER_HEIGHT} and ${RULERS_GRID_CONFIG.MAX_RULER_HEIGHT}`);
    }

    if (settings.vertical.width < RULERS_GRID_CONFIG.MIN_RULER_WIDTH || 
        settings.vertical.width > RULERS_GRID_CONFIG.MAX_RULER_WIDTH) {
      errors.push(`Vertical ruler width must be between ${RULERS_GRID_CONFIG.MIN_RULER_WIDTH} and ${RULERS_GRID_CONFIG.MAX_RULER_WIDTH}`);
    }

    // Validate precision
    if (settings.horizontal.precision < 0 || settings.horizontal.precision > 10) {
      errors.push('Horizontal ruler precision must be between 0 and 10');
    }

    if (settings.vertical.precision < 0 || settings.vertical.precision > 10) {
      errors.push('Vertical ruler precision must be between 0 and 10');
    }

    // Validate snap tolerance
    if (settings.snap.tolerance < RULERS_GRID_CONFIG.MIN_SNAP_TOLERANCE ||
        settings.snap.tolerance > RULERS_GRID_CONFIG.MAX_SNAP_TOLERANCE) {
      errors.push(`Snap tolerance must be between ${RULERS_GRID_CONFIG.MIN_SNAP_TOLERANCE} and ${RULERS_GRID_CONFIG.MAX_SNAP_TOLERANCE}`);
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * Validates grid settings
   */
  validateGridSettings: (settings: GridSettings): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate step size
    if (settings.visual.step < RULERS_GRID_CONFIG.MIN_GRID_STEP ||
        settings.visual.step > RULERS_GRID_CONFIG.MAX_GRID_STEP) {
      errors.push(`Grid step must be between ${RULERS_GRID_CONFIG.MIN_GRID_STEP} and ${RULERS_GRID_CONFIG.MAX_GRID_STEP}`);
    }

    // Validate opacity
    if (settings.visual.opacity < RULERS_GRID_CONFIG.MIN_OPACITY ||
        settings.visual.opacity > RULERS_GRID_CONFIG.MAX_OPACITY) {
      errors.push(`Grid opacity must be between ${RULERS_GRID_CONFIG.MIN_OPACITY} and ${RULERS_GRID_CONFIG.MAX_OPACITY}`);
    }

    // Validate subdivisions
    // 🏢 ADR-110: Use centralized subdivisions fallback
    const subDivisions = settings?.visual?.subDivisions || RULERS_GRID_CONFIG.DEFAULT_SUBDIVISIONS;
    if (subDivisions < 1 || subDivisions > 20) {
      errors.push('Grid subdivisions must be between 1 and 20');
    }

    // Validate behavior settings
    if (settings.behavior.minGridSpacing < 1 || settings.behavior.minGridSpacing > 100) {
      errors.push('Min grid spacing must be between 1 and 100 pixels');
    }

    if (settings.behavior.maxGridSpacing < 10 || settings.behavior.maxGridSpacing > 500) {
      errors.push('Max grid spacing must be between 10 and 500 pixels');
    }

    return { valid: errors.length === 0, errors };
  }
};

// ===== PERFORMANCE UTILITIES =====
export const PerformanceUtilities = {
  /**
   * Determines if grid should be rendered based on performance
   */
  shouldRenderGrid: (transform: ViewTransform, settings: GridSettings): boolean => {
    const effectiveStep = GridCalculations.calculateAdaptiveSpacing(
      transform.scale,
      settings.visual.step,
      settings
    );
    
    const estimatedLines = (2000 / effectiveStep) * 2; // Rough estimate
    return estimatedLines <= RULERS_GRID_CONFIG.MAX_GRID_LINES;
  },

  /**
   * Determines if rulers should be rendered
   */
  shouldRenderRulers: (transform: ViewTransform, settings: RulerSettings): boolean => {
    return transform.scale > 0.1; // Don't render when too zoomed out
  },

  /**
   * Gets throttled render function
   */
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

// ===== RENDERING UTILITIES =====
export const RulersGridRendering = {
  /**
   * Renders grid lines on canvas
   */
  renderGridLines: (
    ctx: CanvasRenderingContext2D,
    lines: GridLine[],
    transform: ViewTransform
  ) => {

    ctx.save();
    
    lines.forEach((line, index) => {
      ctx.strokeStyle = line.color || UI_COLORS.GRID_MAJOR; // Χρησιμοποιεί το χρώμα της γραμμής ή γκρι fallback
      ctx.lineWidth = line.weight;
      ctx.globalAlpha = line.opacity;
      
      if (index === 0) {

      }
      
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

  /**
   * Renders ruler ticks and labels
   */
  renderRuler: (
    ctx: CanvasRenderingContext2D,
    ticks: RulerTick[],
    settings: RulerSettings['horizontal'] | RulerSettings['vertical'],
    type: 'horizontal' | 'vertical',
    transform: ViewTransform
  ) => {

    ctx.save();
    // Χρησιμοποιεί τα χρώματα από τις ρυθμίσεις
    ctx.strokeStyle = settings.tickColor || settings.color || UI_COLORS.RULER_DARK_GRAY;
    ctx.fillStyle = settings.textColor || settings.color || UI_COLORS.RULER_TEXT_GRAY;
    ctx.font = buildUIFont(settings.fontSize || UI_SIZE_DEFAULTS.RULER_FONT_SIZE, settings.fontFamily || 'monospace');
    ctx.lineWidth = RENDER_LINE_WIDTHS.RULER_TICK; // 🏢 ADR-044
    
    // Βελτιωμένη λογική για ομοιόμορφη κατανομή labels
    const shouldShowLabel = (tick: RulerTick, ticks: RulerTick[], type: string, scale: number) => {
      // Πάντα δείχνε το 0
      // 🏢 ADR-079: Use centralized zero threshold
      if (Math.abs(tick.position) < AXIS_DETECTION.ZERO_THRESHOLD) return true;
      
      // Μόνο major ticks έχουν labels
      if (tick.type !== 'major') return false;
      
      // Εκτίμηση του tick spacing από τα υπάρχοντα ticks
      const majorTicks = ticks.filter(t => t.type === 'major').sort((a, b) => a.position - b.position);
      if (majorTicks.length < 2) return true;
      
      const estimatedSpacing = Math.abs(majorTicks[1].position - majorTicks[0].position);
      const tickSpacingPixels = estimatedSpacing * scale;
      
      // Αν το spacing είναι αρκετά μεγάλο, δείξε όλα τα major labels
      if (tickSpacingPixels >= 35) {
        return true; // Αρκετό spacing, δείξε όλα
      }
      
      // Αν το spacing είναι μικρό, δείξε labels με κανονικό διάστημα
      const labelSpacingMultiplier = Math.ceil(35 / tickSpacingPixels);
      const normalizedPosition = Math.round(tick.position / estimatedSpacing);
      
      // Δείξε κάθε Nth label ώστε να έχουμε ελάχιστη απόσταση 35 pixels
      return normalizedPosition % labelSpacingMultiplier === 0;
    };
    
    const safeTransform = transform || { offsetY: 0, offsetX: 0, scale: 1 };

    ticks.forEach(tick => {
      // ✅ Check if tick lines should be visible
      const shouldDrawTickLine = (tick.type === 'major' && settings.showMajorTicks !== false) ||
                                (tick.type === 'minor' && settings.showMinorTicks !== false);
      
      // Draw tick lines only if they should be visible
      if (shouldDrawTickLine) {
        ctx.beginPath();
        
        // ✅ Set stroke color based on tick type
        if (tick.type === 'major') {
          ctx.strokeStyle = settings.majorTickColor || settings.tickColor || UI_COLORS.RULER_DARK_GRAY;
        } else if (tick.type === 'minor') {
          ctx.strokeStyle = settings.minorTickColor || UI_COLORS.RULER_LIGHT_GRAY;
        } else {
          // Fallback to original tickColor
          ctx.strokeStyle = settings.tickColor || settings.color || UI_COLORS.RULER_DARK_GRAY;
        }
      }
      
      if (type === 'horizontal') {
        const screenX = (tick.position + safeTransform.offsetX) * safeTransform.scale;
        const horizontalSettings = settings as RulerSettings['horizontal'];

        // Draw tick line only if it should be visible
        if (shouldDrawTickLine) {

          ctx.moveTo(screenX, ctx.canvas.height - horizontalSettings.height);
          ctx.lineTo(screenX, ctx.canvas.height - horizontalSettings.height + tick.length);
        }
        
        if (tick.label && shouldShowLabel(tick, ticks, 'horizontal', safeTransform.scale) && (settings.showLabels || settings.showUnits)) {
          // Split rendering for numbers and units with different fonts and positioning
          let numbersText = '';
          let unitsText = '';
          
          // Extract numbers and units
          const unitsMatch = tick.label.match(/[a-zA-Z]+$/);
          numbersText = tick.label.replace(/[a-zA-Z]+$/, '');
          unitsText = unitsMatch ? unitsMatch[0] : '';
          
          let totalWidth = 0;
          
          // Calculate text widths for proper centering
          if (settings.showLabels && numbersText) {
            ctx.font = buildUIFont(settings.fontSize || UI_SIZE_DEFAULTS.RULER_FONT_SIZE, settings.fontFamily || 'monospace');
            totalWidth += ctx.measureText(numbersText).width;
          }
          if (settings.showUnits && unitsText) {
            ctx.font = buildUIFont(settings.unitsFontSize || UI_SIZE_DEFAULTS.RULER_UNITS_FONT_SIZE, settings.fontFamily || 'monospace');
            totalWidth += ctx.measureText(unitsText).width;
          }
          
          let currentX = screenX - totalWidth / 2;
          
          // Render numbers (text labels) - positioned at bottom of ruler
          if (settings.showLabels && numbersText) {
            ctx.font = buildUIFont(settings.fontSize || UI_SIZE_DEFAULTS.RULER_FONT_SIZE, settings.fontFamily || 'monospace');

            ctx.fillText(numbersText, currentX, ctx.canvas.height - 3);
            currentX += ctx.measureText(numbersText).width;
          }
          
          // Render units - positioned at bottom of ruler  
          if (settings.showUnits && unitsText) {
            ctx.save();
            ctx.font = buildUIFont(settings.unitsFontSize || UI_SIZE_DEFAULTS.RULER_UNITS_FONT_SIZE, settings.fontFamily || 'monospace');
            ctx.fillStyle = settings.unitsColor || settings.textColor || UI_COLORS.RULER_TEXT_GRAY;

            ctx.fillText(unitsText, currentX, ctx.canvas.height - 3);
            ctx.restore();
          }
        }
      } else {
        // ✅ FIXED Y-COORDINATE CALCULATION - Use proper coordinate transformation
        // For vertical rulers, we need to convert world coordinates to screen coordinates
        const worldY = tick.position;
        const { bottom } = COORDINATE_LAYOUT.MARGINS;
        const verticalSettings = settings as RulerSettings['vertical'];

        const y = ctx.canvas.height - bottom - (worldY + safeTransform.offsetY) * safeTransform.scale;

        // Draw tick line only if it should be visible
        if (shouldDrawTickLine) {

          ctx.moveTo(verticalSettings.width - tick.length, y);
          ctx.lineTo(verticalSettings.width, y);
        }
        
        if (tick.label && shouldShowLabel(tick, ticks, 'vertical', safeTransform.scale) && (settings.showLabels || settings.showUnits)) {
          // COPY OF HORIZONTAL RULER LOGIC, ROTATED 90° RIGHT
          let numbersText = '';
          let unitsText = '';
          
          // Extract numbers and units (same as horizontal)
          const unitsMatch = tick.label.match(/[a-zA-Z]+$/);
          numbersText = tick.label.replace(/[a-zA-Z]+$/, '');
          unitsText = unitsMatch ? unitsMatch[0] : '';
          
          let totalWidth = 0;
          
          // Calculate text widths for proper centering (same as horizontal)
          if (settings.showLabels && numbersText) {
            ctx.font = buildUIFont(settings.fontSize || UI_SIZE_DEFAULTS.RULER_FONT_SIZE, settings.fontFamily || 'monospace');
            totalWidth += ctx.measureText(numbersText).width;
          }
          if (settings.showUnits && unitsText) {
            ctx.font = buildUIFont(settings.unitsFontSize || UI_SIZE_DEFAULTS.RULER_UNITS_FONT_SIZE, settings.fontFamily || 'monospace');
            totalWidth += ctx.measureText(unitsText).width;
          }
          
          // ΚΕΝΤΡΩΣΗ: Το κέντρο του συνολικού κειμένου στοιχισμένο με τη γραμμή του tick
          // Υπολογισμός συνολικού πλάτους (όπως στον οριζόντιο χάρακα)
          let totalTextWidth = totalWidth; // Ήδη υπολογισμένο παραπάνω
          
          // Αρχίζω από το κέντρο του tick, μείον το μισό του συνολικού πλάτους
          let currentY = y - totalTextWidth / 2; // ΚΕΝΤΡΑΡΙΣΜΑ (όπως στον οριζόντιο)

          // Render units ΠΡΩΤΑ (θα εμφανιστούν κάτω μετά την περιστροφή)
          if (settings.showUnits && unitsText) {
            ctx.font = buildUIFont(settings.unitsFontSize || UI_SIZE_DEFAULTS.RULER_UNITS_FONT_SIZE, settings.fontFamily || 'monospace');

            // 🏢 ADR-XXX: Use centralized RIGHT_ANGLE constant (90° = π/2)
            ctx.save();
            ctx.translate(3, currentY);
            ctx.rotate(-RIGHT_ANGLE);
            ctx.textBaseline = 'top';
            ctx.textAlign = 'end';
            ctx.fillStyle = settings.unitsColor || settings.textColor || UI_COLORS.RULER_TEXT_GRAY;
            ctx.fillText(unitsText, 0, 0);
            ctx.restore();
            currentY += ctx.measureText(unitsText).width; // Μετακίνηση για τα numbers
          }

          // Render numbers ΜΕΤΑ (θα εμφανιστούν πάνω μετά την περιστροφή)
          if (settings.showLabels && numbersText) {
            ctx.font = buildUIFont(settings.fontSize || UI_SIZE_DEFAULTS.RULER_FONT_SIZE, settings.fontFamily || 'monospace');

            // 🏢 ADR-XXX: Use centralized RIGHT_ANGLE constant (90° = π/2)
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
      
      // Only stroke if tick lines should be drawn
      if (shouldDrawTickLine) {
        ctx.stroke(); // ✅ ENABLED - Ruler strokes now visible

      }
    });
    
    ctx.restore();
  }
};

// ===== RULERS GRID CALCULATION UTILITIES =====
export const RulersGridCalculations = {
  ...GridCalculations,
  ...RulerCalculations,
  
  /**
   * Alias for calculateVisibleBounds
   */
  calculateVisibleBounds: GridCalculations.calculateVisibleBounds,
  
  /**
   * Alias for generateGridLines
   */
  generateGridLines: GridCalculations.generateGridLines,
  
  /**
   * Alias for calculateTicks
   */
  calculateTicks: RulerCalculations.calculateTicks,
  
  /**
   * Alias for calculateLayout
   */
  calculateLayout: RulerCalculations.calculateLayout
};

// ===== SNAPPING UTILITIES =====
export const RulersGridSnapping = {
  /**
   * Finds snap points for ruler and grid snapping
   */
  findSnapPoint: (
    point: Point2D,
    gridSettings: GridSettings,
    rulerSettings: RulerSettings,
    transform: ViewTransform
  ): SnapResult | null => {
    // TODO: Implement proper snapping logic
    return null;
  },

  /**
   * Gets snap tolerance in world coordinates
   */
  getSnapTolerance: (
    pixelTolerance: number,
    transform: ViewTransform
  ): number => {
    return pixelTolerance / transform.scale;
  }
};

// ===== COMBINED UTILITY EXPORT =====
export const RulersGridUtils = {
  ...UnitConversion,
  ...GridCalculations,
  ...RulerCalculations,
  ...SettingsValidationUtils,
  ...PerformanceUtilities
};