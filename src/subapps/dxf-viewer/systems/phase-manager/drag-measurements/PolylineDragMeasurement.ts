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
// 🏢 ADR-145: Centralized MIN_POLY_POINTS constant
import { MIN_POLY_POINTS } from '../../../config/tolerance-config';
// 🏢 ADR-557 follow-up: closed-polygon area/perimeter/centroid SSoT (shared with
// committed/preview/hover). Reuse the trio calculator ONLY — this renderer keeps its
// own MeasurementData/renderMeasurementsAtCenter contract (no SSoT painter here).
import { computePolygonAreaMetrics } from '../../../rendering/entities/shared/polygon-measurement-label';

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

    // 🏢 ADR-557 follow-up: length + area + centroid from the ONE SSoT. Thread the
    // ACTUAL closed flag so open polylines keep the open length and only closed ones
    // now include the closing edge (fixes the prior omit-closing-edge length bug).
    const closed = entity.closed ?? false;
    const metrics = computePolygonAreaMetrics(newVertices, closed);

    // Show area only for closed polylines with enough points (🏢 ADR-145: MIN_POLY_POINTS).
    const showArea = closed && newVertices.length >= MIN_POLY_POINTS && metrics.area > 0;

    // Define measurements to display (same labels/order/units as before).
    const measurements: MeasurementData[] = [
      { label: 'L', value: metrics.perimeter }
    ];

    if (showArea) {
      measurements.push({ label: 'A', value: metrics.area });
    }

    // Area-weighted centroid (SSoT) for label placement.
    this.renderMeasurementsAtCenter(metrics.centroid, measurements);
  }
}
