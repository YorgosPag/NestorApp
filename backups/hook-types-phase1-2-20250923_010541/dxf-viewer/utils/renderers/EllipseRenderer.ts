/**
 * Ellipse Entity Renderer
 * Handles rendering of ellipse entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../../types/renderer';
import type { Point2D } from '../../systems/rulers-grid/config';
import { HoverManager } from '../hover';
import { renderDotAtPoint, renderDotsAtPoints } from './shared/dot-rendering-utils';
import { createGripsFromPoints } from './shared/grip-utils';
import { validateEllipseEntity } from './shared/entity-validation-utils';
import { applyRenderingTransform } from './shared/geometry-rendering-utils';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';

export class EllipseRenderer extends BaseEntityRenderer {
  // Helper method to calculate axis endpoints (eliminates duplication)
  private calculateAxisEndpoints(center: Point2D, majorAxis: number, minorAxis: number, rotation: number): {
    majorPoints: Point2D[];
    minorPoints: Point2D[];
  } {
    const rotRad = (rotation * Math.PI) / 180;
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
    
    // 🎯 Χρήση 3-phase system όπως όλες οι άλλες οντότητες
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
    this.ctx.rotate((rotation * Math.PI) / 180);
    
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, screenMajor, screenMinor, 0, 0, Math.PI * 2);
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
    // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
    renderStyledTextWithOverride(this.ctx, `Ma: ${majorAxis.toFixed(2)}`, screenCenter.x, screenCenter.y - 30);
    renderStyledTextWithOverride(this.ctx, `Mi: ${minorAxis.toFixed(2)}`, screenCenter.x, screenCenter.y - 10);
    renderStyledTextWithOverride(this.ctx, `Ε: ${area.toFixed(2)}`, screenCenter.x, screenCenter.y + 10);
    renderStyledTextWithOverride(this.ctx, `Περ: ${perimeter.toFixed(2)}`, screenCenter.x, screenCenter.y + 30);
    this.ctx.restore();
  }

  private renderEllipseYellowDots(center: Point2D, majorAxis: number, minorAxis: number, rotation: number): void {
    // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ ΧΡΏΜΑ - το fillStyle έχει ήδη οριστεί από το renderWithPhases
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
    grips.push({
      entityId: entity.id,
      gripType: 'center',
      gripIndex: 0,
      position: center,
      state: 'cold'
    });
    
    // Use helper method to calculate grip positions on ellipse
    const { majorPoints, minorPoints } = this.calculateAxisEndpoints(center, majorAxis, minorAxis, rotation);
    
    return createGripsFromPoints(entity.id, [...majorPoints, ...minorPoints]);
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    const ellipseData = validateEllipseEntity(entity);
    if (!ellipseData) return false;
    
    const { center, majorAxis, minorAxis, rotation } = ellipseData;
    
    // Transform point to ellipse coordinate system
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const rotRad = -(rotation * Math.PI) / 180;
    const cosRot = Math.cos(rotRad);
    const sinRot = Math.sin(rotRad);
    
    const localX = dx * cosRot - dy * sinRot;
    const localY = dx * sinRot + dy * cosRot;
    
    // Check if point is on ellipse perimeter
    const ellipseValue = (localX * localX) / (majorAxis * majorAxis) +
                        (localY * localY) / (minorAxis * minorAxis);
    
    const worldTolerance = tolerance / this.transform.scale;
    const toleranceRatio = worldTolerance / Math.min(majorAxis, minorAxis);
    
    return Math.abs(ellipseValue - 1) <= toleranceRatio;
  }
}