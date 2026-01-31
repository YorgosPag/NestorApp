/**
 * Ellipse Entity Renderer
 * Handles rendering of ellipse entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
// 🏢 ADR-099: HoverManager import removed - EllipseRenderer has no hover rendering
import { renderDotAtPoint, renderDotsAtPoints } from './shared/dot-rendering-utils';
import { createGripsFromPoints, createCenterGrip } from './shared/grip-utils';
import { validateEllipseEntity } from './shared/entity-validation-utils';
import { applyRenderingTransform } from './shared/geometry-rendering-utils';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';
// 🏢 ADR-058: Centralized Canvas Primitives
import { TAU } from '../primitives/canvasPaths';
// 🏢 ADR-067: Centralized Radians/Degrees Conversion
import { degToRad } from './shared/geometry-utils';
// 🏢 ADR-090: Centralized Number Formatting
import { formatDistance } from './shared/distance-label-utils';
// 🏢 ADR-091: Centralized Text Label Offsets
import { TEXT_LABEL_OFFSETS } from '../../config/text-rendering-config';

export class EllipseRenderer extends BaseEntityRenderer {
  // Helper method to calculate axis endpoints (eliminates duplication)
  private calculateAxisEndpoints(center: Point2D, majorAxis: number, minorAxis: number, rotation: number): {
    majorPoints: Point2D[];
    minorPoints: Point2D[];
  } {
    // 🏢 ADR-067: Use centralized angle conversion
    const rotRad = degToRad(rotation);
    const cosRot = Math.cos(rotRad);
    const sinRot = Math.sin(rotRad);
    
    const majorPoints = [
      {
        x: center.x + majorAxis * cosRot,
        y: center.y + majorAxis * sinRot
      },
      {
        x: center.x - majorAxis * cosRot,
        y: center.y - majorAxis * sinRot
      }
    ];
    
    const minorPoints = [
      {
        x: center.x - minorAxis * sinRot,
        y: center.y + minorAxis * cosRot
      },
      {
        x: center.x + minorAxis * sinRot,
        y: center.y - minorAxis * cosRot
      }
    ];
    
    return { majorPoints, minorPoints };
  }


  render(entity: EntityModel, options: RenderOptions = {}): void {
    const ellipseData = validateEllipseEntity(entity);
    if (!ellipseData) return;

    const { center, majorAxis, minorAxis, rotation } = ellipseData;

    // 🔺 Χρήση 3-phase system όπως όλες οι άλλες οντότητες
    this.renderWithPhases(
      entity,
      options,
      // Geometry rendering
      () => this.renderEllipseGeometry(center, majorAxis, minorAxis, rotation),
      // Measurements rendering
      () => this.renderEllipseMeasurements(center, majorAxis, minorAxis),
      // Yellow dots rendering
      () => this.renderEllipseYellowDots(center, majorAxis, minorAxis, rotation)
    );
  }

  private renderEllipseGeometry(center: Point2D, majorAxis: number, minorAxis: number, rotation: number): void {
    const screenCenter = this.worldToScreen(center);
    const screenMajor = majorAxis * this.transform.scale;
    const screenMinor = minorAxis * this.transform.scale;
    
    this.ctx.save();
    this.ctx.translate(screenCenter.x, screenCenter.y);
    // 🏢 ADR-067: Use centralized angle conversion
    this.ctx.rotate(degToRad(rotation));
    
    // 🏢 ADR-058: Use centralized TAU constant
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, screenMajor, screenMinor, 0, 0, TAU);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  private renderEllipseMeasurements(center: Point2D, majorAxis: number, minorAxis: number): void {
    const screenCenter = this.worldToScreen(center);
    
    // Calculate ellipse measurements
    const area = Math.PI * majorAxis * minorAxis;
    const perimeter = Math.PI * (3 * (majorAxis + minorAxis) - 
      Math.sqrt((3 * majorAxis + minorAxis) * (majorAxis + 3 * minorAxis)));
    
    this.ctx.save();
    this.applyCenterMeasurementTextStyle();
    // 🏢 ADR-091: Χρήση κεντρικοποιημένων text label offsets
    renderStyledTextWithOverride(this.ctx, `Ma: ${formatDistance(majorAxis)}`, screenCenter.x, screenCenter.y - TEXT_LABEL_OFFSETS.MULTI_LINE_OUTER);
    renderStyledTextWithOverride(this.ctx, `Mi: ${formatDistance(minorAxis)}`, screenCenter.x, screenCenter.y - TEXT_LABEL_OFFSETS.TWO_LINE);
    renderStyledTextWithOverride(this.ctx, `Ε: ${formatDistance(area)}`, screenCenter.x, screenCenter.y + TEXT_LABEL_OFFSETS.TWO_LINE);
    renderStyledTextWithOverride(this.ctx, `Περ: ${formatDistance(perimeter)}`, screenCenter.x, screenCenter.y + TEXT_LABEL_OFFSETS.MULTI_LINE_OUTER);
    this.ctx.restore();
  }

  private renderEllipseYellowDots(center: Point2D, majorAxis: number, minorAxis: number, rotation: number): void {
    // 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ ΧΡΏΜΑ - το fillStyle έχει ήδη οριστεί από το renderWithPhases
    const dotRadius = 4;
    
    // Center dot
    renderDotAtPoint(this.ctx, this.worldToScreen, center, dotRadius);
    
    // Use helper method to get axis endpoints
    const { majorPoints, minorPoints } = this.calculateAxisEndpoints(center, majorAxis, minorAxis, rotation);
    
    // Draw dots at all axis endpoints
    renderDotsAtPoints(this.ctx, this.worldToScreen, [...majorPoints, ...minorPoints], dotRadius);
  }

  getGrips(entity: EntityModel): GripInfo[] {
    const ellipseData = validateEllipseEntity(entity);
    if (!ellipseData) return [];
    
    const grips: GripInfo[] = [];
    const { center, majorAxis, minorAxis, rotation } = ellipseData;
    
    // Center grip
    grips.push(createCenterGrip(entity.id, center, 0));
    
    // Use helper method to calculate grip positions on ellipse
    const { majorPoints, minorPoints } = this.calculateAxisEndpoints(center, majorAxis, minorAxis, rotation);
    
    return createGripsFromPoints(entity.id, [...majorPoints, ...minorPoints]);
  }

  // ✅ ENTERPRISE FIX: Implement required abstract method
  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    const ellipseData = validateEllipseEntity(entity);
    if (!ellipseData) return false;

    const { center, majorAxis, minorAxis } = ellipseData;

    // Simple distance-based hit test to ellipse center
    const distance = Math.sqrt(
      Math.pow(point.x - center.x, 2) +
      Math.pow(point.y - center.y, 2)
    );

    // Check if point is within ellipse bounds (approximation)
    const maxRadius = Math.max(majorAxis, minorAxis);
    return distance <= maxRadius + tolerance;
  }

}