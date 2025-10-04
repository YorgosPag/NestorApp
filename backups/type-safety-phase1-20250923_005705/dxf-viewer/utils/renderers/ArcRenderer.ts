/**
 * Arc Entity Renderer
 * Handles rendering of arc entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../../types/renderer';
import type { Point2D } from '../../systems/rulers-grid/config';
import { HoverManager } from '../hover';
import {
  validateArcEntity,
  renderDotAtPoint,
  createArcGripPattern,
  hitTestArcEntity
} from './shared';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';

export class ArcRenderer extends BaseEntityRenderer {
  private validateArc(entity: EntityModel) {
    // 🎯 Χρήση κεντρικοποιημένης validation - μείωση διπλότυπου κώδικα
    return validateArcEntity(entity);
  }

  render(entity: EntityModel, options: RenderOptions = {}): void {
    const arcData = this.validateArc(entity);
    if (!arcData) return;
    
    // 🎯 Χρήση 3-phase system όπως όλες οι άλλες οντότητες
    this.renderWithPhases(
      entity,
      options,
      // Geometry rendering
      () => this.renderArcGeometry(arcData.center, arcData.radius, arcData.startAngle, arcData.endAngle),
      // Measurements rendering  
      () => this.renderArcMeasurements(arcData.center, arcData.radius, arcData.startAngle, arcData.endAngle),
      // Yellow dots rendering
      () => this.renderArcYellowDots(arcData.center, arcData.radius, arcData.startAngle, arcData.endAngle)
    );
  }

  private renderArcGeometry(center: Point2D, radius: number, startAngle: number, endAngle: number): void {
    // Convert angles from degrees to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    // 🎯 Χρήση κεντρικοποιημένης μεθόδου - περνάμε world radius (η μέθοδος κάνει τη μετατροπή)
    this.drawCentralizedArc(center.x, center.y, radius, startRad, endRad);
  }

  private renderArcMeasurements(center: Point2D, radius: number, startAngle: number, endAngle: number): void {
    const screenCenter = this.worldToScreen(center);
    
    // Calculate arc measurements
    const arcAngle = Math.abs(endAngle - startAngle);
    const arcLength = (arcAngle * Math.PI / 180) * radius;
    
    this.ctx.save();
    this.applyCenterMeasurementTextStyle();
    // Χρήση δυναμικού styling με πλήρη υποστήριξη decorations
    renderStyledTextWithOverride(this.ctx, `R: ${radius.toFixed(2)}`, screenCenter.x, screenCenter.y - 30);
    renderStyledTextWithOverride(this.ctx, `∠: ${arcAngle.toFixed(1)}°`, screenCenter.x, screenCenter.y - 10);
    renderStyledTextWithOverride(this.ctx, `L: ${arcLength.toFixed(2)}`, screenCenter.x, screenCenter.y + 10);
    this.ctx.restore();
  }

  private renderArcYellowDots(center: Point2D, radius: number, startAngle: number, endAngle: number): void {
    // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ ΧΡΏΜΑ - το fillStyle έχει ήδη οριστεί από το renderWithPhases
    const dotRadius = 4;
    
    // Convert angles from degrees to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    // Center dot
    renderDotAtPoint(this.ctx, this.worldToScreen, center, dotRadius);
    
    // Start point dot
    const startPoint: Point2D = {
      x: center.x + radius * Math.cos(startRad),
      y: center.y + radius * Math.sin(startRad)
    };
    const screenStartPoint = this.worldToScreen(startPoint);
    // ⚡ NUCLEAR: ARC ENDPOINT DOTS ELIMINATED
  }

  getGrips(entity: EntityModel): GripInfo[] {
    const arcData = this.validateArc(entity);
    if (!arcData) return [];
    
    const { center, radius, startAngle, endAngle } = arcData;
    
    // Convert angles from degrees to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const midRad = (startRad + endRad) / 2;
    
    // Calculate grip positions
    const startPoint: Point2D = {
      x: center.x + radius * Math.cos(startRad),
      y: center.y + radius * Math.sin(startRad)
    };
    
    const endPoint: Point2D = {
      x: center.x + radius * Math.cos(endRad),
      y: center.y + radius * Math.sin(endRad)
    };
    
    const midPoint: Point2D = {
      x: center.x + radius * Math.cos(midRad),
      y: center.y + radius * Math.sin(midRad)
    };
    
    // 🎯 Χρήση κεντρικοποιημένου arc grip pattern - μείωση διπλότυπου κώδικα
    return createArcGripPattern(entity.id, center, startPoint, endPoint, midPoint);
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    const arcData = this.validateArc(entity);
    if (!arcData) return false;
    
    const { center, radius, startAngle, endAngle } = arcData;
    
    // 🎯 Χρήση κεντρικοποιημένου arc hit test - μείωση διπλότυπου κώδικα
    return hitTestArcEntity(point, center, radius, startAngle, endAngle, tolerance, this.transform);
  }
}