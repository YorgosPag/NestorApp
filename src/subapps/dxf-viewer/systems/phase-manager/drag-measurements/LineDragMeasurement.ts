/**
 * @fileoverview Line Drag Measurement Renderer
 * @description Live measurements for line entities during grip dragging
 * @author Enterprise Architecture Team
 * @date 2026-01-02
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO any, NO hardcoded values
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { LineEntity } from '../../../types/entities';
import type { DragMeasurementContext, MeasurementData } from '../types';
import { BaseDragMeasurementRenderer } from './BaseDragMeasurementRenderer';

/**
 * Line-specific drag measurement renderer
 * Displays distance during endpoint dragging
 */
export class LineDragMeasurement extends BaseDragMeasurementRenderer {
  constructor(context: DragMeasurementContext) {
    super(context);
  }

  /**
   * Render live measurements for line during grip drag
   *
   * @param entity - Line entity being modified
   * @param gripIndex - Index of grip being dragged (0=start, 1=end)
   * @param currentPos - Current cursor position in world coordinates
   */
  render(entity: LineEntity, gripIndex: number, currentPos: Point2D): void {
    const { start, end } = entity;

    // Calculate new endpoints based on which grip is being dragged
    const newStart = gripIndex === 0 ? currentPos : start;
    const newEnd = gripIndex === 1 ? currentPos : end;

    // Calculate new distance
    const distance = this.calculateDistance(newStart, newEnd);

    // Get screen position for measurement display
    const screenCurrentPos = this.worldToScreen(currentPos);

    // Define measurements to display
    const measurements: MeasurementData[] = [
      { label: 'Α', value: distance } // Απόσταση (Distance)
    ];

    // Render near the grip being dragged
    this.renderMeasurementsNearGrip(screenCurrentPos, measurements);
  }
}
