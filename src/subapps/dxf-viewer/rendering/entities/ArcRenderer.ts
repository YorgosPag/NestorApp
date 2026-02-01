/**
 * Arc Entity Renderer
 * Handles rendering of arc entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
// 🏢 ADR-099: HoverManager import removed - ArcRenderer has no hover rendering
import {
  renderDotAtPoint,
  createArcGripPattern,
  hitTestArcEntity
} from './shared';
import { validateArcEntity } from './shared/entity-validation-utils';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';
// 🏢 ADR-058: Centralized Canvas Primitives
import { addArcPath } from '../primitives/canvasPaths';
// 🏢 ADR-090: Centralized Number Formatting
import { formatDistance, formatAngle } from './shared/distance-label-utils';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
import { degToRad, radToDeg } from './shared/geometry-utils';
// 🏢 ADR-074: Centralized Point On Circle
import { pointOnCircle } from './shared/geometry-rendering-utils';
// 🏢 ADR-091: Centralized Text Label Offsets, ADR-124: Dot Radius
import { TEXT_LABEL_OFFSETS, RENDER_GEOMETRY } from '../../config/text-rendering-config';

export class ArcRenderer extends BaseEntityRenderer {
  private validateArc(entity: EntityModel) {
    // 🔺 Χρήση κεντρικοποιημένης validation - μείωση διπλότυπου κώδικα
    // 🏢 ENTERPRISE: validateArcEntity accepts EntityModel directly
    return validateArcEntity(entity);
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    const arcData = this.validateArc(entity);
    if (!arcData) return;

    // 🔺 Χρήση 3-phase system όπως όλες οι άλλες οντότητες
    this.renderWithPhases(
      entity,
      options,
      // Geometry rendering - pass counterclockwise flag
      () => this.renderArcGeometry(arcData.center, arcData.radius, arcData.startAngle, arcData.endAngle, arcData.counterclockwise),
      // Measurements rendering
      () => this.renderArcMeasurements(arcData.center, arcData.radius, arcData.startAngle, arcData.endAngle),
      // Yellow dots rendering
      () => this.renderArcYellowDots(arcData.center, arcData.radius, arcData.startAngle, arcData.endAngle)
    );
  }

  private renderArcGeometry(center: Point2D, radius: number, startAngle: number, endAngle: number, counterclockwise: boolean): void {
    // 🔍 DEBUG: Log arc rendering parameters
    console.log('🎯 ArcRenderer.renderArcGeometry:', {
      startAngle,
      endAngle,
      counterclockwise,
      center
    });

    // 🏢 ADR-067: Use centralized angle conversion
    const startRad = degToRad(startAngle);
    const endRad = degToRad(endAngle);

    // 🏢 FIX (2026-01-31): Use direct arc drawing like CircleRenderer
    // Don't use drawCentralizedArc() which applies orange dashed style for angle indicators
    // The phase-based styling is already applied by renderWithPhases()
    const screenCenter = this.worldToScreen(center);
    const screenRadius = radius * this.transform.scale;

    // 🎯 CRITICAL: Y-axis inversion fix!
    // World coords: Y+ is UP, angles are counterclockwise from East
    // Screen coords: Y+ is DOWN, angles are clockwise from East
    // Solution: Negate angles and flip direction to compensate for Y-inversion
    const screenStartRad = -startRad;
    const screenEndRad = -endRad;
    // Flip counterclockwise because of Y-axis inversion
    const screenCounterclockwise = !counterclockwise;

    // 🔍 DEBUG: Log screen values
    console.log('🎯 ArcRenderer screen values:', {
      screenStartRad: radToDeg(screenStartRad),
      screenEndRad: radToDeg(screenEndRad),
      screenCounterclockwise
    });

    // 🏢 ADR-058: Use centralized canvas primitives
    this.ctx.beginPath();
    addArcPath(this.ctx, screenCenter, screenRadius, screenStartRad, screenEndRad, screenCounterclockwise);
    this.ctx.stroke();
  }

  private renderArcMeasurements(center: Point2D, radius: number, startAngle: number, endAngle: number): void {
    const screenCenter = this.worldToScreen(center);
    
    // Calculate arc measurements
    const arcAngle = Math.abs(endAngle - startAngle);
    // 🏢 ADR-067: Use centralized angle conversion
    const arcLength = degToRad(arcAngle) * radius;
    
    this.ctx.save();
    this.applyCenterMeasurementTextStyle();
    // 🏢 ADR-090: Centralized number formatting
    // 🏢 ADR-091: Χρήση κεντρικοποιημένων text label offsets
    renderStyledTextWithOverride(this.ctx, `R: ${formatDistance(radius)}`, screenCenter.x, screenCenter.y - TEXT_LABEL_OFFSETS.MULTI_LINE_OUTER);
    renderStyledTextWithOverride(this.ctx, formatAngle(arcAngle, 1), screenCenter.x, screenCenter.y - TEXT_LABEL_OFFSETS.TWO_LINE);
    renderStyledTextWithOverride(this.ctx, `L: ${formatDistance(arcLength)}`, screenCenter.x, screenCenter.y + TEXT_LABEL_OFFSETS.TWO_LINE);
    this.ctx.restore();
  }

  private renderArcYellowDots(center: Point2D, radius: number, startAngle: number, endAngle: number): void {
    // 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ ΧΡΏΜΑ - το fillStyle έχει ήδη οριστεί από το renderWithPhases
    // 🏢 ADR-124: Centralized dot radius
    const dotRadius = RENDER_GEOMETRY.DOT_RADIUS;

    // 🏢 ADR-067: Use centralized angle conversion
    const startRad = degToRad(startAngle);
    const endRad = degToRad(endAngle);
    
    // Center dot
    renderDotAtPoint(this.ctx, this.worldToScreen, center, dotRadius);
    
    // Start point dot
    // 🏢 ADR-074: Use centralized pointOnCircle
    const startPoint = pointOnCircle(center, radius, startRad);
    const screenStartPoint = this.worldToScreen(startPoint);
    // ⚡ NUCLEAR: ARC ENDPOINT DOTS ELIMINATED
  }

  getGrips(entity: EntityModel): GripInfo[] {
    const arcData = this.validateArc(entity);
    if (!arcData) return [];
    
    const { center, radius, startAngle, endAngle } = arcData;

    // 🏢 ADR-067: Use centralized angle conversion
    const startRad = degToRad(startAngle);
    const endRad = degToRad(endAngle);
    const midRad = (startRad + endRad) / 2;
    
    // Calculate grip positions
    // 🏢 ADR-074: Use centralized pointOnCircle
    const startPoint = pointOnCircle(center, radius, startRad);
    const endPoint = pointOnCircle(center, radius, endRad);
    const midPoint = pointOnCircle(center, radius, midRad);
    
    // 🔺 Χρήση κεντρικοποιημένου arc grip pattern - μείωση διπλότυπου κώδικα
    return createArcGripPattern(entity.id, center, startPoint, endPoint, midPoint);
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    const arcData = this.validateArc(entity);
    if (!arcData) return false;

    // Use centralized arc hit test
    return hitTestArcEntity(
      point,
      arcData.center,
      arcData.radius,
      arcData.startAngle,
      arcData.endAngle,
      tolerance,
      this.transform
    );
  }

}