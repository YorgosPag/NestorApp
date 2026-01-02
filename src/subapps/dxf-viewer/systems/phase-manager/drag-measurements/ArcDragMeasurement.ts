/**
 * @fileoverview Arc Drag Measurement Renderer
 * @description Live measurements for arc entities during grip dragging
 * @author Enterprise Architecture Team
 * @date 2026-01-02
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO any, NO hardcoded values
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { ArcEntity } from '../../../types/entities';
import type { DragMeasurementContext, MeasurementData } from '../types';
import { BaseDragMeasurementRenderer } from './BaseDragMeasurementRenderer';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/** Conversion factor from radians to degrees */
const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * Arc-specific drag measurement renderer
 * Displays radius, angle, and arc length during grip dragging
 */
export class ArcDragMeasurement extends BaseDragMeasurementRenderer {
  constructor(context: DragMeasurementContext) {
    super(context);
  }

  /**
   * Render live measurements for arc during grip drag
   *
   * @param entity - Arc entity being modified
   * @param gripIndex - Index of grip being dragged (0=center, 1=start, 2=end, 3=radius)
   * @param currentPos - Current cursor position in world coordinates
   */
  render(entity: ArcEntity, gripIndex: number, currentPos: Point2D): void {
    const { center, radius, startAngle, endAngle } = entity;

    if (!center || !radius) return;

    // Center grip doesn't change measurements
    if (gripIndex === 0) return;

    // Calculate new values based on grip being dragged
    const { newRadius, newStartAngle, newEndAngle } = this.calculateNewValues(
      center,
      radius,
      startAngle,
      endAngle,
      gripIndex,
      currentPos
    );

    // Calculate derived measurements
    const arcAngle = Math.abs(newEndAngle - newStartAngle);
    const arcLength = (arcAngle * Math.PI / RADIANS_TO_DEGREES) * newRadius;

    // Define measurements to display
    const measurements: MeasurementData[] = [
      { label: 'R', value: newRadius },
      { label: '∠', value: arcAngle, unit: '°' },
      { label: 'L', value: arcLength }
    ];

    // Render at center position
    this.renderMeasurementsAtCenter(center, measurements);
  }

  /**
   * Calculate new arc values based on which grip is being dragged
   */
  private calculateNewValues(
    center: Point2D,
    radius: number,
    startAngle: number,
    endAngle: number,
    gripIndex: number,
    currentPos: Point2D
  ): { newRadius: number; newStartAngle: number; newEndAngle: number } {
    let newRadius = radius;
    let newStartAngle = startAngle;
    let newEndAngle = endAngle;

    const dx = currentPos.x - center.x;
    const dy = currentPos.y - center.y;
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * RADIANS_TO_DEGREES;

    switch (gripIndex) {
      case 1: // Start point grip
        newRadius = distanceFromCenter;
        newStartAngle = angle;
        break;
      case 2: // End point grip
        newRadius = distanceFromCenter;
        newEndAngle = angle;
        break;
      case 3: // Radius grip - only changes radius
        newRadius = distanceFromCenter;
        break;
    }

    return { newRadius, newStartAngle, newEndAngle };
  }
}
