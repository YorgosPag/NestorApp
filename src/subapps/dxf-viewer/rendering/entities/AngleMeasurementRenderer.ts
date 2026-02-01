/**
 * Angle Measurement Entity Renderer
 * 🏢 ENTERPRISE REFACTORING (2026-01-27): Phase-Aware Unified Rendering
 *
 * Pattern: AutoCAD/BricsCAD - Consistent rendering across preview/normal/selected phases
 * - Preview phase: Green lines, fuchsia angle text, white distance labels, grips visible
 * - Normal phase: Entity color lines, fuchsia angle text, white distance labels, no grips
 * - Selected phase: Orange highlight, all measurements visible, grips visible
 *
 * ✅ Uses ONLY centralized methods from BaseEntityRenderer:
 *    - renderWithPhases (template method)
 *    - PhaseManager (phase detection)
 *    - renderDistanceTextPhaseAware (distance labels)
 *    - shouldRenderSplitLine (split line detection)
 *    - renderSplitLineWithGap (split line rendering)
 *    - drawCentralizedArc (arc rendering)
 *    - applyDimensionTextStyle (fuchsia text)
 *    - renderGrips (grip rendering - automatic via renderWithPhases)
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, RenderOptions, GripInfo, Point2D } from '../types/Types';
import type { Entity } from '../../types/entities';
// 🏢 ADR-102: Centralized Entity Type Guards
import { isAngleMeasurementEntity } from '../../types/entities';
// 🏢 ADR-065: Centralized Distance, ADR-066: Centralized Angle
// 🏢 ADR-073: Centralized Bisector Angle
// 🏢 ADR-077: Centralized TAU Constant
import { extractAngleMeasurementPoints, calculateDistance, calculateAngle } from './shared';
// 🏢 ADR-134: Centralized Angle Difference Normalization
import { bisectorAngle, normalizeAngleDiff } from './shared/geometry-utils';
// 🏢 ADR-090: Centralized Number Formatting
import { formatAngle } from './shared/distance-label-utils';
// 🏢 ADR-140: Centralized Angle Measurement Visualization Constants
import { RENDER_GEOMETRY } from '../../config/text-rendering-config';

export class AngleMeasurementRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    // 🏢 ADR-102: Use centralized type guard
    if (!isAngleMeasurementEntity(entity as Entity)) return;

    const angleMeasurement = extractAngleMeasurementPoints(entity);
    if (!angleMeasurement) return;

    const { vertex, point1, point2, angle } = angleMeasurement;

    // 🏢 ENTERPRISE: Use unified 3-phase rendering system
    this.renderWithPhases(
      entity,
      options,
      // Phase 1: Geometry rendering (lines with phase-aware colors)
      () => this.renderAngleGeometry(vertex, point1, point2, entity, options),
      // Phase 2: Measurements rendering (arc + angle text + distance labels)
      () => this.renderAngleMeasurements(vertex, point1, point2, angle, entity, options),
      // Phase 3: Yellow dots (disabled for angle measurements)
      undefined
    );
  }

  /**
   * 🏢 ENTERPRISE: Phase-aware geometry rendering
   * Uses centralized split line logic for consistent preview/normal behavior
   */
  private renderAngleGeometry(
    vertex: Point2D,
    point1: Point2D,
    point2: Point2D,
    entity: EntityModel,
    options: RenderOptions
  ): void {
    // Check if lines are enabled (respects line style settings)
    if (!this.shouldRenderLines(entity, options)) {
      return;
    }

    const screenVertex = this.worldToScreen(vertex);
    const screenPoint1 = this.worldToScreen(point1);
    const screenPoint2 = this.worldToScreen(point2);

    // 🏢 ENTERPRISE: Use centralized split line logic
    // Preview phase: Split lines with gaps for distance text (via PhaseManager)
    // Normal phase: Solid lines without gaps
    if (this.shouldRenderSplitLine(entity, options)) {
      this.renderSplitLineWithGap(screenVertex, screenPoint1, entity, options);
      this.renderSplitLineWithGap(screenVertex, screenPoint2, entity, options);
    } else {
      // Normal/Selected phase: Simple solid lines with entity color
      this.ctx.beginPath();
      this.ctx.moveTo(screenVertex.x, screenVertex.y);
      this.ctx.lineTo(screenPoint1.x, screenPoint1.y);
      this.ctx.moveTo(screenVertex.x, screenVertex.y);
      this.ctx.lineTo(screenPoint2.x, screenPoint2.y);
      this.ctx.stroke();
    }
  }

  /**
   * 🏢 ENTERPRISE: Unified measurements rendering
   * Uses centralized methods for arc, angle text, and distance labels
   */
  private renderAngleMeasurements(
    vertex: Point2D,
    point1: Point2D,
    point2: Point2D,
    angle: number,
    entity: EntityModel,
    options: RenderOptions
  ): void {
    const screenVertex = this.worldToScreen(vertex);
    const screenPoint1 = this.worldToScreen(point1);
    const screenPoint2 = this.worldToScreen(point2);

    // 🏢 ENTERPRISE: Phase-aware distance labels (centralized)
    // Preview: Inline positioning (on the line)
    // Normal/Selected: Offset positioning (beside the line)
    this.renderDistanceTextPhaseAware(vertex, point1, screenVertex, screenPoint1, entity, options);
    this.renderDistanceTextPhaseAware(vertex, point2, screenVertex, screenPoint2, entity, options);

    // 🏢 ENTERPRISE: Centralized INTERNAL arc rendering (orange dashed arc)
    // 🎯 FIX: Χρήση drawInternalAngleArc για σωστά ΕΣΩΤΕΡΙΚΑ τόξα (dot product logic)
    // 🏢 ADR-140: Use centralized angle measurement constants
    const arcRadius = RENDER_GEOMETRY.ANGLE_ARC_RADIUS;

    // Convert to world coordinates for consistent appearance at all zoom levels
    const arcRadiusWorld = arcRadius / this.transform.scale;
    this.drawInternalAngleArc(vertex, point1, point2, arcRadiusWorld);

    // 🏢 ENTERPRISE: Centralized angle text rendering (fuchsia)
    this.drawAngleText(screenVertex, screenPoint1, screenPoint2, angle);
  }

  /**
   * 🏢 ENTERPRISE: Centralized angle text rendering
   * Uses applyDimensionTextStyle for consistent fuchsia color
   * Positions text on EXTERIOR bisector (CAD standard)
   */
  private drawAngleText(
    vertex: Point2D,
    point1: Point2D,
    point2: Point2D,
    angleDegrees: number
  ): void {
    this.ctx.save();

    // 🏢 ENTERPRISE: Use centralized dimension text style (fuchsia color)
    this.applyDimensionTextStyle();

    // Calculate text position (exterior bisector for CAD compliance)
    // 🏢 ADR-066: Use centralized angle calculation
    const angle1 = calculateAngle(vertex, point1);
    const angle2 = calculateAngle(vertex, point2);

    // 🏢 ADR-073: Use centralized bisector angle calculation
    let bisectorAngleValue = bisectorAngle(angle1, angle2);

    // 🏢 ADR-134: Use centralized angle difference normalization
    const angleDiff = normalizeAngleDiff(angle2 - angle1);

    // If angle is > 180°, flip bisector to exterior
    if (Math.abs(angleDiff) > Math.PI) {
      bisectorAngleValue += Math.PI;
    }

    // Text offset from vertex (screen pixels for consistent appearance)
    // 🏢 ADR-140: Use centralized angle measurement constants
    const textDistance = RENDER_GEOMETRY.ANGLE_TEXT_DISTANCE;
    const textX = vertex.x + Math.cos(bisectorAngleValue) * textDistance;
    const textY = vertex.y + Math.sin(bisectorAngleValue) * textDistance;

    // Format and render angle text
    const angleText = formatAngle(angleDegrees, 1);

    // 🏢 ENTERPRISE: Use fillText directly to preserve fuchsia color
    // (renderStyledTextWithOverride would override with white text style)
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(angleText, textX, textY);

    this.ctx.restore();
  }

  /**
   * 🏢 ENTERPRISE: Grip positions for angle measurement
   * Returns 3 grips: vertex (center), point1, point2
   */
  getGrips(entity: EntityModel): GripInfo[] {
    // 🏢 ADR-102: Use centralized type guard
    if (!isAngleMeasurementEntity(entity as Entity)) return [];

    const angleMeasurement = extractAngleMeasurementPoints(entity);
    if (!angleMeasurement) return [];

    const { vertex, point1, point2 } = angleMeasurement;

    return [
      {
        id: `${entity.id}-vertex`,
        entityId: entity.id,
        type: 'center',
        position: vertex,
        isVisible: true
      },
      {
        id: `${entity.id}-point1`,
        entityId: entity.id,
        type: 'vertex',
        position: point1,
        isVisible: true
      },
      {
        id: `${entity.id}-point2`,
        entityId: entity.id,
        type: 'vertex',
        position: point2,
        isVisible: true
      }
    ];
  }

  /**
   * 🏢 ENTERPRISE: Hit test for angle measurement selection
   * Tests proximity to vertex, point1, and point2
   */
  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    // 🏢 ADR-102: Use centralized type guard
    if (!isAngleMeasurementEntity(entity as Entity)) return false;

    const angleMeasurement = extractAngleMeasurementPoints(entity);
    if (!angleMeasurement) return false;

    const { vertex, point1, point2 } = angleMeasurement;

    // 🏢 ADR-065: Use centralized distance calculation
    const distance1 = calculateDistance(point, vertex);
    const distance2 = calculateDistance(point, point1);
    const distance3 = calculateDistance(point, point2);

    return distance1 <= tolerance || distance2 <= tolerance || distance3 <= tolerance;
  }
}
