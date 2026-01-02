/**
 * @fileoverview Polyline Drag Measurement Renderer
 * @description Live measurements for polyline entities during grip dragging
 * @author Enterprise Architecture Team
 * @date 2026-01-02
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards - NO any, NO hardcoded values
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { PolylineEntity } from '../../../types/entities';
import type { DragMeasurementContext, MeasurementData } from '../types';
import { BaseDragMeasurementRenderer } from './BaseDragMeasurementRenderer';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/** Minimum vertices required for area calculation */
const MIN_VERTICES_FOR_AREA = 3;

/**
 * Polyline-specific drag measurement renderer
 * Displays total length and area (for closed polylines) during grip dragging
 */
export class PolylineDragMeasurement extends BaseDragMeasurementRenderer {
  constructor(context: DragMeasurementContext) {
    super(context);
  }

  /**
   * Render live measurements for polyline during grip drag
   *
   * @param entity - Polyline entity being modified
   * @param gripIndex - Index of vertex grip being dragged
   * @param currentPos - Current cursor position in world coordinates
   */
  render(entity: PolylineEntity, gripIndex: number, currentPos: Point2D): void {
    const vertices = entity.vertices || [];

    if (vertices.length < 2 || gripIndex >= vertices.length) return;

    // Create new vertices array with dragged vertex updated
    const newVertices = [...vertices];
    newVertices[gripIndex] = currentPos;

    // Calculate total length
    const totalLength = this.calculateTotalLength(newVertices);

    // Calculate area if closed
    const area = entity.closed && newVertices.length >= MIN_VERTICES_FOR_AREA
      ? this.calculatePolygonArea(newVertices)
      : 0;

    // Define measurements to display
    const measurements: MeasurementData[] = [
      { label: 'L', value: totalLength }
    ];

    if (area > 0) {
      measurements.push({ label: 'A', value: area });
    }

    // Calculate center for measurement display
    const center = this.calculateCentroid(newVertices);
    this.renderMeasurementsAtCenter(center, measurements);
  }

  /**
   * Calculate total length of polyline segments
   */
  private calculateTotalLength(vertices: Point2D[]): number {
    let totalLength = 0;

    for (let i = 0; i < vertices.length - 1; i++) {
      totalLength += this.calculateDistance(vertices[i], vertices[i + 1]);
    }

    return totalLength;
  }

  /**
   * Calculate polygon area using the Shoelace formula
   * Only valid for closed polylines with 3+ vertices
   */
  private calculatePolygonArea(vertices: Point2D[]): number {
    let area = 0;

    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }

    return Math.abs(area) / 2;
  }

  /**
   * Calculate centroid of vertex set for measurement positioning
   */
  private calculateCentroid(vertices: Point2D[]): Point2D {
    const sumX = vertices.reduce((sum, v) => sum + v.x, 0);
    const sumY = vertices.reduce((sum, v) => sum + v.y, 0);

    return {
      x: sumX / vertices.length,
      y: sumY / vertices.length
    };
  }
}
