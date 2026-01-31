/**
 * @fileoverview Circle Drag Measurement Renderer
 * @description Live measurements for circle entities during grip dragging
 * @author Enterprise Architecture Team
 * @date 2026-01-02
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO any, NO hardcoded values
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { CircleEntity } from '../../../types/entities';
import type { DragMeasurementContext, MeasurementData } from '../types';
import { BaseDragMeasurementRenderer } from './BaseDragMeasurementRenderer';
// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../../../rendering/primitives/canvasPaths';

/**
 * Circle-specific drag measurement renderer
 * Displays radius, diameter, area, and circumference during radius grip dragging
 */
export class CircleDragMeasurement extends BaseDragMeasurementRenderer {
  constructor(context: DragMeasurementContext) {
    super(context);
  }

  /**
   * Render live measurements for circle during grip drag
   *
   * @param entity - Circle entity being modified
   * @param gripIndex - Index of grip being dragged
   * @param currentPos - Current cursor position in world coordinates
   */
  render(entity: CircleEntity, gripIndex: number, currentPos: Point2D): void {
    const { center } = entity;

    // Calculate new radius based on dragged position
    const newRadius = this.calculateDistance(center, currentPos);

    // Calculate derived measurements
    const diameter = newRadius * 2;
    const area = Math.PI * newRadius * newRadius;
    const circumference = TAU * newRadius;

    // Get screen position for measurement display
    const screenCurrentPos = this.worldToScreen(currentPos);

    // Define measurements to display (Greek labels)
    const measurements: MeasurementData[] = [
      { label: 'Ρ', value: newRadius },        // Ρadius (Ακτίνα)
      { label: 'Δ', value: diameter },         // Διάμετρος
      { label: 'Ε', value: area },             // Εμβαδόν (Area)
      { label: 'Περ', value: circumference }   // Περίμετρος (Circumference)
    ];

    // Render near the grip being dragged
    this.renderMeasurementsNearGrip(screenCurrentPos, measurements);
  }
}
