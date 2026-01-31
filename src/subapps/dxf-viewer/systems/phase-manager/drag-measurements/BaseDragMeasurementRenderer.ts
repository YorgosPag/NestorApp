/**
 * @fileoverview Base Drag Measurement Renderer
 * @description Abstract base class for entity-specific drag measurement renderers
 * Provides common utilities and interface for live measurement display during grip dragging
 * @author Enterprise Architecture Team
 * @date 2026-01-02
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO any, NO hardcoded values
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { DragMeasurementContext, MeasurementData, CanvasBounds } from '../types';
import { UI_COLORS } from '../../../config/color-config';
import { renderStyledTextWithOverride } from '../../../hooks/useTextPreviewStyle';
import {
  calculateMeasurementPosition,
  calculateLineYOffset,
  getCanvasBounds,
  POSITIONING_CONFIG
} from '../positioning/MeasurementPositioning';
// 🏢 ADR-065: Centralized Distance Calculation
// 🏢 ADR-066: Centralized Angle Calculation
import { calculateDistance as centralizedCalculateDistance, calculateAngle as centralizedCalculateAngle } from '../../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
import { radToDeg } from '../../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-090: Centralized Number Formatting
import { formatDistance, formatAngle } from '../../../rendering/entities/shared/distance-label-utils';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/** Font configuration for measurement text */
const MEASUREMENT_FONT = '12px Arial';

/** Color for live measurement display */
const MEASUREMENT_COLOR = UI_COLORS.SELECTED_RED;

// ============================================================================
// ABSTRACT BASE CLASS
// ============================================================================

/**
 * Abstract base class for drag measurement renderers
 * Each entity type extends this to provide specific measurement logic
 */
export abstract class BaseDragMeasurementRenderer {
  protected ctx: CanvasRenderingContext2D;
  protected worldToScreen: (point: Point2D) => Point2D;
  protected canvasBounds: CanvasBounds;

  constructor(context: DragMeasurementContext) {
    this.ctx = context.ctx;
    this.worldToScreen = context.worldToScreen;
    this.canvasBounds = context.canvasBounds;
  }

  // ==========================================================================
  // PROTECTED UTILITY METHODS (Available to subclasses)
  // ==========================================================================

  /**
   * Render multiple measurement lines at an intelligently positioned location
   * Uses smart positioning to avoid canvas edges
   *
   * @param screenGripPos - Screen position of the grip being dragged
   * @param measurements - Array of measurement data to display
   */
  protected renderMeasurementsNearGrip(
    screenGripPos: Point2D,
    measurements: MeasurementData[]
  ): void {
    if (measurements.length === 0) return;

    // Calculate optimal position using centralized positioning logic
    const position = calculateMeasurementPosition(
      screenGripPos,
      this.canvasBounds,
      measurements.length
    );

    this.ctx.save();
    this.ctx.fillStyle = MEASUREMENT_COLOR;
    this.ctx.font = MEASUREMENT_FONT;
    this.ctx.textAlign = position.textAlign;
    this.ctx.textBaseline = 'middle';

    // Render each measurement line
    measurements.forEach((measurement, index) => {
      const yPos = calculateLineYOffset(position.y, index, measurements.length);
      const text = this.formatMeasurement(measurement);
      renderStyledTextWithOverride(this.ctx, text, position.x, yPos);
    });

    this.ctx.restore();
  }

  /**
   * Render measurements at a center position (for circular entities)
   *
   * @param worldCenter - Center point in world coordinates
   * @param measurements - Array of measurement data to display
   */
  protected renderMeasurementsAtCenter(
    worldCenter: Point2D,
    measurements: MeasurementData[]
  ): void {
    if (measurements.length === 0) return;

    const screenCenter = this.worldToScreen(worldCenter);

    this.ctx.save();
    this.ctx.fillStyle = UI_COLORS.WHITE; // White for center-based measurements
    this.ctx.font = MEASUREMENT_FONT;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    measurements.forEach((measurement, index) => {
      const yOffset = screenCenter.y - (measurements.length - 1 - index) * POSITIONING_CONFIG.LINE_HEIGHT;
      const text = this.formatMeasurement(measurement);
      renderStyledTextWithOverride(this.ctx, text, screenCenter.x, yOffset);
    });

    this.ctx.restore();
  }

  /**
   * Format a measurement for display
   * 🏢 ADR-090: Centralized number formatting
   *
   * @param measurement - Measurement data object
   * @returns Formatted string for display
   */
  protected formatMeasurement(measurement: MeasurementData): string {
    const unit = measurement.unit || '';
    // Use centralized formatting based on unit type
    if (unit === '°') {
      // Angle formatting (includes the ° symbol)
      return `${measurement.label}: ${formatAngle(measurement.value, 1)}`;
    } else {
      // Distance/length formatting
      return `${measurement.label}: ${formatDistance(measurement.value)}${unit}`;
    }
  }

  /**
   * Calculate distance between two points
   * 🏢 ADR-065: Delegates to centralized calculateDistance
   */
  protected calculateDistance(p1: Point2D, p2: Point2D): number {
    return centralizedCalculateDistance(p1, p2);
  }

  /**
   * Calculate angle in degrees from center to point
   * 🏢 ADR-066: Delegates to centralized calculateAngle
   * 🏢 ADR-067: Uses centralized radToDeg conversion
   */
  protected calculateAngle(center: Point2D, point: Point2D): number {
    return radToDeg(centralizedCalculateAngle(center, point));
  }

  /**
   * Update canvas bounds (call when canvas resizes)
   */
  updateCanvasBounds(bounds: CanvasBounds): void {
    this.canvasBounds = bounds;
  }
}

// ============================================================================
// CONFIGURATION EXPORTS
// ============================================================================

export const MEASUREMENT_DISPLAY_CONFIG = {
  FONT: MEASUREMENT_FONT,
  COLOR: MEASUREMENT_COLOR
} as const;
