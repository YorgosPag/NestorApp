/**
 * @fileoverview Rectangle Drag Measurement Renderer
 * @description Live measurements for rectangle entities during grip dragging
 * @author Enterprise Architecture Team
 * @date 2026-01-02
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO any, NO hardcoded values
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { RectangleEntity } from '../../../types/entities';
import type { DragMeasurementContext, MeasurementData } from '../types';
import { BaseDragMeasurementRenderer } from './BaseDragMeasurementRenderer';
import { createRectangleVertices } from '../../selection/shared/selection-duplicate-utils';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/** Number of corner grips in a rectangle */
const CORNER_GRIP_COUNT = 4;

/**
 * Rectangle-specific drag measurement renderer
 * Displays width, height, area, and perimeter during grip dragging
 * Handles both corner grips (0-3) and edge grips (4-7)
 */
export class RectangleDragMeasurement extends BaseDragMeasurementRenderer {
  constructor(context: DragMeasurementContext) {
    super(context);
  }

  /**
   * Render live measurements for rectangle during grip drag
   *
   * @param entity - Rectangle entity being modified
   * @param gripIndex - Index of grip being dragged (0-3: corners, 4-7: edges)
   * @param currentPos - Current cursor position in world coordinates
   */
  render(entity: RectangleEntity, gripIndex: number, currentPos: Point2D): void {
    // Get current vertices
    const vertices = createRectangleVertices(
      { x: entity.x, y: entity.y },
      { x: entity.x + entity.width, y: entity.y + entity.height }
    );

    if (vertices.length < CORNER_GRIP_COUNT) return;

    // Calculate new vertices based on which grip is being dragged
    const newVertices = this.calculateNewVertices(vertices, gripIndex, currentPos);

    // Calculate dimensions from new vertices
    const width = Math.abs(newVertices[1].x - newVertices[0].x);
    const height = Math.abs(newVertices[2].y - newVertices[1].y);
    const area = width * height;
    const perimeter = 2 * (width + height);

    // Get screen position for measurement display
    const screenCurrentPos = this.worldToScreen(currentPos);

    // Define measurements to display (Greek labels)
    const measurements: MeasurementData[] = [
      { label: 'Π', value: width },      // Πλάτος (Width)
      { label: 'Υ', value: height },     // Ύψος (Height)
      { label: 'Ε', value: area },       // Εμβαδόν (Area)
      { label: 'Περ', value: perimeter } // Περίμετρος (Perimeter)
    ];

    // Render near the grip being dragged
    this.renderMeasurementsNearGrip(screenCurrentPos, measurements);
  }

  /**
   * Calculate new vertices based on grip being dragged
   * Maintains rectangular shape by adjusting adjacent vertices
   */
  private calculateNewVertices(
    vertices: Point2D[],
    gripIndex: number,
    currentPos: Point2D
  ): Point2D[] {
    const newVertices = [...vertices];

    if (gripIndex < CORNER_GRIP_COUNT) {
      // Corner grip - update vertex and maintain rectangular shape
      this.updateCornerGrip(newVertices, gripIndex, currentPos);
    } else {
      // Edge grip - move entire edge
      this.updateEdgeGrip(newVertices, gripIndex - CORNER_GRIP_COUNT, currentPos);
    }

    return newVertices;
  }

  /**
   * Update vertices when a corner grip is dragged
   * Maintains rectangular shape by adjusting adjacent vertices
   */
  private updateCornerGrip(
    vertices: Point2D[],
    gripIndex: number,
    currentPos: Point2D
  ): void {
    vertices[gripIndex] = currentPos;

    switch (gripIndex) {
      case 0: // Top-left
        vertices[1] = { x: vertices[2].x, y: currentPos.y };
        vertices[3] = { x: currentPos.x, y: vertices[2].y };
        break;
      case 1: // Top-right
        vertices[0] = { x: vertices[3].x, y: currentPos.y };
        vertices[2] = { x: currentPos.x, y: vertices[3].y };
        break;
      case 2: // Bottom-right
        vertices[1] = { x: currentPos.x, y: vertices[0].y };
        vertices[3] = { x: vertices[0].x, y: currentPos.y };
        break;
      case 3: // Bottom-left
        vertices[0] = { x: currentPos.x, y: vertices[1].y };
        vertices[2] = { x: vertices[1].x, y: currentPos.y };
        break;
    }
  }

  /**
   * Update vertices when an edge grip is dragged
   * Moves the entire edge to the new position
   */
  private updateEdgeGrip(
    vertices: Point2D[],
    edgeIndex: number,
    currentPos: Point2D
  ): void {
    switch (edgeIndex) {
      case 0: // Top edge
        vertices[0].y = vertices[1].y = currentPos.y;
        break;
      case 1: // Right edge
        vertices[1].x = vertices[2].x = currentPos.x;
        break;
      case 2: // Bottom edge
        vertices[2].y = vertices[3].y = currentPos.y;
        break;
      case 3: // Left edge
        vertices[3].x = vertices[0].x = currentPos.x;
        break;
    }
  }
}
