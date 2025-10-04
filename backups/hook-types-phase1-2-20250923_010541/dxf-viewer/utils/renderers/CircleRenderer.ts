/**
 * Circle Entity Renderer (Fixed scope issues)
 * Handles rendering of circle entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../../types/renderer';
import type { Point2D } from '../../systems/rulers-grid/config';
import { HoverManager } from '../hover';
import { createGripsFromPoints } from './shared/grip-utils';
import { renderCircleAreaText } from './shared/circle-text-utils';
import { renderSplitLineWithGap, renderContinuousLine, renderLineWithTextCheck } from './shared/line-rendering-utils';
import { renderDistanceTextPhaseAware } from './shared/phase-text-utils';
import { UI_COLORS } from '../../config/color-config';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';

export class CircleRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (entity.type !== 'circle') return;
    
    const center = entity.center as Point2D;
    const radius = entity.radius as number;
    
    if (!center || !radius) return;

    // Use universal 3-phase rendering template
    this.renderWithPhases(
      entity,
      options,
      // Geometry rendering
      () => this.renderCircleGeometry(center, radius, entity, options),
      // Measurements rendering
      () => this.renderCircleMeasurements(center, radius, entity, options),
      // ΔΙΑΓΡΑΜΜΕΝΟ: Yellow dots rendering - αφαιρέθηκε
      () => {} // Κενή function
    );
  }

  private renderCircleGeometry(center: Point2D, radius: number, entity: EntityModel, options: RenderOptions): void {
    const screenCenter = this.worldToScreen(center);
    const screenRadius = radius * this.transform.scale;

    // Draw circle perimeter
    this.ctx.beginPath();
    this.ctx.arc(screenCenter.x, screenCenter.y, screenRadius, 0, Math.PI * 2);
    this.ctx.stroke();

    // For preview phase, draw the radius/diameter line (the missing blue dashed line!)
    if (options.preview) {
      // 🎯 Έλεγχος αν οι γραμμές είναι ενεργοποιημένες για radius/diameter
      if (!this.shouldRenderLines(entity, options)) {
        return; // Δεν σχεδιάζουμε γραμμές ακτίνας/διαμέτρου
      }

      const isDiameterMode = (entity as any)?.diameterMode === true;
      const isTwoPointDiameter = (entity as any)?.twoPointDiameter === true;

      if (isTwoPointDiameter || isDiameterMode) {
        // Draw diameter line with split for distance text
        const leftPoint = this.worldToScreen({ x: center.x - radius, y: center.y });
        const rightPoint = this.worldToScreen({ x: center.x + radius, y: center.y });

        // 🎯 Χρήση κεντρικοποιημένης split line για διάμετρο
        if (this.shouldRenderSplitLine(entity, options)) {
          renderLineWithTextCheck(this.ctx, leftPoint, rightPoint);
        } else {
          renderContinuousLine(this.ctx, leftPoint, rightPoint);
        }
      } else {
        // Draw radius line with split for distance text
        const radiusEndPoint = this.worldToScreen({ x: center.x + radius, y: center.y });

        // 🎯 Χρήση κεντρικοποιημένης split line για ακτίνα
        if (this.shouldRenderSplitLine(entity, options)) {
          renderLineWithTextCheck(this.ctx, screenCenter, radiusEndPoint);
        } else {
          renderContinuousLine(this.ctx, screenCenter, radiusEndPoint);
        }
      }
    }
  }

  private renderCircleMeasurements(center: Point2D, radius: number, entity: EntityModel, options: RenderOptions): void {
    const screenCenter = this.worldToScreen(center);
    const screenRadius = radius * this.transform.scale;
    
    // Calculate measurements
    const area = Math.PI * radius * radius;
    const circumference = 2 * Math.PI * radius;
    
    // Render measurements with centralized styling
    this.ctx.save();
    this.applyDimensionTextStyle(); // Use centralized fuchsia color and styling
    
    renderCircleAreaText(this.ctx, screenCenter, screenRadius, area, circumference);
    
    this.ctx.restore();
    
    // Add radius/diameter indicators based on mode with phase-aware positioning
    const isDiameterMode = (entity as any)?.diameterMode === true;
    const isTwoPointDiameter = (entity as any)?.twoPointDiameter === true;
    
    if (isTwoPointDiameter || isDiameterMode) {
      // Diameter line endpoints for phase-aware positioning
      const { leftPoint, rightPoint, screenLeft, screenRight } = this.calculateDiameterPoints(center, radius);
      const diameter = radius * 2;
      const label = isTwoPointDiameter 
        ? `Διάμετρος: ${diameter.toFixed(2)} (2P)` 
        : `D: ${diameter.toFixed(2)}`;
      
      // 🎯 Phase-aware text positioning - inline for preview, offset for measurements
      this.renderDistanceTextPhaseAware(leftPoint, rightPoint, screenLeft, screenRight, entity, options);
    } else {
      // Radius line from center to edge for phase-aware positioning
      const radiusEndPoint = { x: center.x + radius, y: center.y };
      const screenRadiusEnd = this.worldToScreen(radiusEndPoint);
      
      // 🎯 Phase-aware text positioning - inline for preview, offset for measurements
      this.renderDistanceTextPhaseAware(center, radiusEndPoint, screenCenter, screenRadiusEnd, entity, options);
    }
  }

  // ΔΙΑΓΡΑΜΜΕΝΗ FUNCTION: renderCircleYellowDots - αφαιρέθηκε για εξάλειψη κίτρινων grips

  getGrips(entity: EntityModel): GripInfo[] {
    if (entity.type !== 'circle') return [];
    
    const grips: GripInfo[] = [];
    const center = entity.center as Point2D;
    const radius = entity.radius as number;
    
    if (!center || !radius) return grips;
    
    // Center grip
    grips.push({
      entityId: entity.id,
      gripType: 'center',
      gripIndex: 0,
      position: center,
      state: 'cold'
    });
    
    // Quadrant grips (4 cardinal points)
    const quadrants: Point2D[] = [
      { x: center.x + radius, y: center.y },     // East
      { x: center.x, y: center.y + radius },     // North
      { x: center.x - radius, y: center.y },     // West
      { x: center.x, y: center.y - radius }      // South
    ];
    
    return createGripsFromPoints(entity.id, quadrants);
  }

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (entity.type !== 'circle') return false;
    
    const center = entity.center as Point2D;
    const radius = entity.radius as number;
    
    if (!center || !radius) return false;
    
    // Calculate distance from point to center
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if point is on the circle's perimeter (within tolerance)
    const diff = Math.abs(distance - radius);
    
    // Convert tolerance to world units
    const worldTolerance = tolerance / this.transform.scale;
    
    return diff <= worldTolerance;
  }

  private renderPreviewCircleWithMeasurements(center: Point2D, radius: number, entity: EntityModel): void {
    // Setup preview style (blue dashed line like line preview)
    this.setupStyle(entity, { preview: true });
    
    const screenCenter = this.worldToScreen(center);
    const screenRadius = radius * this.transform.scale;
    
    // Draw the circle
    this.ctx.beginPath();
    this.ctx.arc(screenCenter.x, screenCenter.y, screenRadius, 0, Math.PI * 2);
    this.ctx.stroke();
    
    const isDiameterMode = (entity as any)?.diameterMode === true;
    const isTwoPointDiameter = (entity as any)?.twoPointDiameter === true;
    
    if (isTwoPointDiameter) {
      // Draw diameter line with gap for measurements - για 2P diameter mode
      // Εμφάνιση της γραμμής διαμέτρου που συνδέει τα δύο αρχικά σημεία
      const { leftPoint, rightPoint, screenLeft, screenRight } = this.calculateDiameterPoints(center, radius);
      
      // Draw diameter line
      renderContinuousLine(this.ctx, screenLeft, screenRight);
      
      // ΔΙΑΓΡΑΜΜΕΝΟ: Draw endpoint indicators για τα δύο σημεία της διαμέτρου
      // this.renderYellowEndpointDots(screenLeft, screenRight);
      
      // Render diameter label
      const diameter = radius * 2;
      const labelX = screenCenter.x;
      const labelY = screenCenter.y - 25; // Πάνω από το κέντρο
      const label = `Διάμετρος: ${diameter.toFixed(2)} (2P)`;
      // Use centralized styling instead of hardcoded green
      this.ctx.save();
      this.applyDimensionTextStyle();
      renderStyledTextWithOverride(this.ctx, label, labelX, labelY);
      this.ctx.restore();
      
    } else if (isDiameterMode) {
      // ✅ ΔΙΑΜΕΤΡΟΣ MODE: Χωρίς κοπή στη μέση + κίτρινες μπαλίτσες στα άκρα
      const { leftPoint, rightPoint, screenLeft, screenRight } = this.calculateDiameterPoints(center, radius);
      
      // Draw continuous diameter line (χωρίς κοπή)
      renderContinuousLine(this.ctx, screenLeft, screenRight);
      
      // ΔΙΑΓΡΑΜΜΕΝΟ: Draw yellow dots στα άκρα της διαμέτρου
      // this.renderYellowEndpointDots(screenLeft, screenRight);
      
      // Render diameter label (πάνω από τη γραμμή)
      const labelX = screenCenter.x;
      const labelY = screenCenter.y - 25; // Move above line to avoid collision
      const label = `D: ${(radius * 2).toFixed(2)}`;
      // Use centralized styling instead of hardcoded green
      this.ctx.save();
      this.applyDimensionTextStyle();
      renderStyledTextWithOverride(this.ctx, label, labelX, labelY);
      this.ctx.restore();
      
    } else {
      // ✅ ΑΚΤΙΝΑ MODE: Κίτρινη μπαλίτσα στο κέντρο + κίτρινη μπαλίτσα στον κέρσορα
      const radiusEndPoint = { x: center.x + radius, y: center.y };
      const screenRadiusEnd = this.worldToScreen(radiusEndPoint);
      
      // Calculate gap for radius text
      const textGap = Math.max(20, Math.min(60, 30 * this.transform.scale));
      const radiusLength = screenRadius;
      const gapStart = screenCenter.x + (radiusLength - textGap) / 2;
      const gapEnd = screenCenter.x + (radiusLength + textGap) / 2;
      
      // Draw split radius line
      this.ctx.beginPath();
      this.ctx.moveTo(screenCenter.x, screenCenter.y);
      this.ctx.lineTo(gapStart, screenCenter.y);
      this.ctx.stroke();
      
      this.ctx.beginPath();
      this.ctx.moveTo(gapEnd, screenCenter.y);
      this.ctx.lineTo(screenRadiusEnd.x, screenRadiusEnd.y);
      this.ctx.stroke();
      
      // ⚠️ ΠΡΟΣΩΡΙΝΑ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ ΓΙΑ TESTING κίτρινων grips
      // Draw yellow dots: κέντρο + άκρο ακτίνας (κέρσορας)
      // const pointRadius = 4;
      // this.ctx.fillStyle = UI_COLORS.MEASUREMENT_POINTS; // Κίτρινο για τα σημεία
      //
      // // Κίτρινη μπαλίτσα στο κέντρο
      // this.ctx.beginPath();
      // this.ctx.arc(screenCenter.x, screenCenter.y, pointRadius, 0, Math.PI * 2);
      // this.ctx.fill();
      //
      // // Κίτρινη μπαλίτσα στον κέρσορα (άκρο ακτίνας)
      // this.ctx.beginPath();
      // this.ctx.arc(screenRadiusEnd.x, screenRadiusEnd.y, pointRadius, 0, Math.PI * 2);
      // this.ctx.fill();
      
      // Render radius label in the gap
      const labelX = (gapStart + gapEnd) / 2;
      const labelY = screenCenter.y;
      const label = `R: ${radius.toFixed(2)}`;
      // Use centralized styling instead of hardcoded green
      this.ctx.save();
      this.applyDimensionTextStyle();
      renderStyledTextWithOverride(this.ctx, label, labelX, labelY);
      this.ctx.restore();
    }
    
    // Calculate and render area and circumference
    const area = Math.PI * radius * radius;
    const circumference = 2 * Math.PI * radius;
    
    // Render area and circumference labels with centralized styling
    this.ctx.save();
    this.applyDimensionTextStyle(); // Use centralized fuchsia color
    
    renderCircleAreaText(this.ctx, screenCenter, screenRadius, area, circumference);
    
    this.ctx.restore();
    
    // Cleanup style
    this.cleanupStyle();
  }


  // Helper methods to eliminate duplication
  private calculateDiameterPoints(center: Point2D, radius: number): { leftPoint: Point2D; rightPoint: Point2D; screenLeft: Point2D; screenRight: Point2D } {
    const leftPoint = { x: center.x - radius, y: center.y };
    const rightPoint = { x: center.x + radius, y: center.y };
    const screenLeft = this.worldToScreen(leftPoint);
    const screenRight = this.worldToScreen(rightPoint);
    return { leftPoint, rightPoint, screenLeft, screenRight };
  }

  // ΔΙΑΓΡΑΜΜΕΝΗ FUNCTION: renderYellowEndpointDots - αφαιρέθηκε για εξάλειψη κίτρινων grips


  private renderLabel(x: number, y: number, text: string, color: string): void {
    this.ctx.save();
    
    // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ font styling
    this.ctx.fillStyle = color;
    this.ctx.font = `${this.getBaseFontSize()}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    // Draw text
    renderStyledTextWithOverride(this.ctx, text, x, y);
    
    this.ctx.restore();
  }
}