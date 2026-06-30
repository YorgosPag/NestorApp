/**
 * Circle Entity Renderer (Fixed scope issues)
 * Handles rendering of circle entities
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, GripInfo, RenderOptions } from '../types/Types';
import type { Point2D } from '../types/Types';
// 🏢 ADR-102: Centralized Entity Type Guards
import { type CircleEntity } from '../../types/entities';
// 🏢 ADR-165: Centralized Entity Validation
import { validateCircleEntity } from './shared/entity-validation-utils';

// ✅ ENTERPRISE: Extended circle entity interface για mode-specific properties
interface ExtendedCircleEntity extends CircleEntity {
  diameterMode?: boolean;
  twoPointDiameter?: boolean;
}

// 🏢 ADR-102: Duplicate type guard REMOVED - using centralized isCircleEntity from types/entities.ts
// 🏢 ADR-099: HoverManager import removed - CircleRenderer has no hover rendering
import { createQuadrantGrips } from './shared/grip-utils';
// 🏢 ADR-058: Centralized Canvas Primitives
// 🏢 ADR-077: Centralized TAU Constant
import { addCirclePath, TAU } from '../primitives/canvasPaths';
import { renderCircleAreaText } from './shared/circle-text-utils';
import { renderContinuousLine, renderLineWithTextCheck } from './shared/line-rendering-utils';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';
// 🏢 ADR-091: Centralized UI Fonts, ADR-124: Centralized Label Offsets
import { buildUIFont, TEXT_LABEL_OFFSETS } from '../../config/text-rendering-config';
// 🏢 ADR-090: Centralized Number Formatting
// 🏢 ADR-462: display-unit SSoT — diameter/radius follow the status-bar unit selector
import { formatLengthForDisplay } from '../../config/display-length-format';
// 🏢 ADR-124: Centralized Text Gap Calculation
import { calculateTextGap } from './shared/geometry-rendering-utils';
// 🏢 ADR-109: Centralized Distance Calculation
import { calculateDistance } from './shared/geometry-rendering-utils';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';

export class CircleRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    // 🏢 ADR-165: Use centralized entity validation
    const circleData = validateCircleEntity(entity);
    if (!circleData) return;
    const { center, radius } = circleData;

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
    // 🏢 ADR-058: Use centralized canvas primitives
    this.ctx.beginPath();
    addCirclePath(this.ctx, screenCenter, screenRadius);
    this.ctx.stroke();

    // For preview phase, draw the radius/diameter line (the missing blue dashed line!)
    if (options.preview) {
      // 🔺 Έλεγχος αν οι γραμμές είναι ενεργοποιημένες για radius/diameter
      if (!this.shouldRenderLines(entity, options)) {
        return; // Δεν σχεδιάζουμε γραμμές ακτίνας/διαμέτρου
      }

      const extendedEntity = entity as ExtendedCircleEntity;
      const isDiameterMode = extendedEntity.diameterMode === true;
      const isTwoPointDiameter = extendedEntity.twoPointDiameter === true;

      if (isTwoPointDiameter || isDiameterMode) {
        // Draw diameter line with split for distance text
        const leftPoint = this.worldToScreen({ x: center.x - radius, y: center.y });
        const rightPoint = this.worldToScreen({ x: center.x + radius, y: center.y });

        // 🔺 Χρήση κεντρικοποιημένης split line για διάμετρο
        if (this.shouldRenderSplitLine(entity, options)) {
          renderLineWithTextCheck(this.ctx, leftPoint, rightPoint);
        } else {
          renderContinuousLine(this.ctx, leftPoint, rightPoint);
        }
      } else {
        // Draw radius line with split for distance text
        const radiusEndPoint = this.worldToScreen({ x: center.x + radius, y: center.y });

        // 🔺 Χρήση κεντρικοποιημένης split line για ακτίνα
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
    const circumference = TAU * radius;
    
    // Render measurements with centralized styling
    this.ctx.save();
    this.applyDimensionTextStyle(); // Use centralized fuchsia color and styling
    
    renderCircleAreaText(this.ctx, screenCenter, screenRadius, area, circumference);
    
    this.ctx.restore();
    
    // Add radius/diameter indicators based on mode with phase-aware positioning
    const extendedEntity = entity as ExtendedCircleEntity;
    const isDiameterMode = extendedEntity.diameterMode === true;
    const isTwoPointDiameter = extendedEntity.twoPointDiameter === true;
    
    if (isTwoPointDiameter || isDiameterMode) {
      // Diameter line endpoints for phase-aware positioning
      const { leftPoint, rightPoint, screenLeft, screenRight } = this.calculateDiameterPoints(center, radius);
      const diameter = radius * 2;
      // 🏢 ADR-090: Centralized number formatting
      const label = isTwoPointDiameter
        ? `Διάμετρος: ${formatLengthForDisplay(diameter)} (2P)`
        : `D: ${formatLengthForDisplay(diameter)}`;
      
      // 🔺 Phase-aware text positioning - inline for preview, offset for measurements
      this.renderDistanceTextPhaseAware(leftPoint, rightPoint, screenLeft, screenRight, entity, options);
    } else {
      // Radius line from center to edge for phase-aware positioning
      const radiusEndPoint = { x: center.x + radius, y: center.y };
      const screenRadiusEnd = this.worldToScreen(radiusEndPoint);
      
      // 🔺 Phase-aware text positioning - inline for preview, offset for measurements
      this.renderDistanceTextPhaseAware(center, radiusEndPoint, screenCenter, screenRadiusEnd, entity, options);
    }
  }

  // ΔΙΑΓΡΑΜΜΕΝΗ FUNCTION: renderCircleYellowDots - αφαιρέθηκε για εξάλειψη κίτρινων grips

  getGrips(entity: EntityModel): GripInfo[] {
    // 🏢 ADR-165: Use centralized entity validation
    const circleData = validateCircleEntity(entity);
    if (!circleData) return [];
    const { center, radius } = circleData;
    const grips: GripInfo[] = [];
    
    // Center grip
    grips.push({
      id: `${entity.id}-center-0`,
      entityId: entity.id,
      type: 'center',
      gripType: 'center',        // Backward compatibility
      gripIndex: 0,
      position: center,
      isVisible: true
    });
    
    // Quadrant grips (4 cardinal points)
    const quadrants: Point2D[] = [
      { x: center.x + radius, y: center.y },     // East
      { x: center.x, y: center.y + radius },     // North
      { x: center.x - radius, y: center.y },     // West
      { x: center.x, y: center.y - radius }      // South
    ];
    
    // ADR-559 — cardinal points are QUADRANT grips (gated by «Εμφάνιση Quadrants»), not vertices.
    grips.push(...createQuadrantGrips(entity.id, quadrants));
    return grips;
  }

  // ✅ ENTERPRISE: Required abstract method implementation
  // 🏢 ADR-105: Use centralized fallback tolerance
  hitTest(entity: EntityModel, point: Point2D, tolerance: number = TOLERANCE_CONFIG.HIT_TEST_FALLBACK): boolean {
    // 🏢 ADR-165: Use centralized entity validation
    const circleData = validateCircleEntity(entity);
    if (!circleData) return false;
    const { center, radius } = circleData;

    // Distance from point to circle center
    // 🏢 ADR-109: Use centralized distance calculation
    const distance = calculateDistance(point, center);

    // Hit test: point is near the circle circumference (within tolerance)
    return Math.abs(distance - radius) <= tolerance;
  }

  private renderPreviewCircleWithMeasurements(center: Point2D, radius: number, entity: EntityModel): void {
    // Setup preview style (blue dashed line like line preview)
    this.setupStyle(entity, { preview: true });
    
    const screenCenter = this.worldToScreen(center);
    const screenRadius = radius * this.transform.scale;
    
    // Draw the circle
    // 🏢 ADR-058: Use centralized canvas primitives
    this.ctx.beginPath();
    addCirclePath(this.ctx, screenCenter, screenRadius);
    this.ctx.stroke();
    
    const extendedEntity = entity as ExtendedCircleEntity;
    const isDiameterMode = extendedEntity.diameterMode === true;
    const isTwoPointDiameter = extendedEntity.twoPointDiameter === true;
    
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
      // 🏢 ADR-124: Centralized circle label offset
      const labelY = screenCenter.y - TEXT_LABEL_OFFSETS.CIRCLE_LABEL; // Πάνω από το κέντρο
      // 🏢 ADR-090: Centralized number formatting
      const label = `Διάμετρος: ${formatLengthForDisplay(diameter)} (2P)`;
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
      // 🏢 ADR-124: Centralized circle label offset
      const labelY = screenCenter.y - TEXT_LABEL_OFFSETS.CIRCLE_LABEL; // Move above line to avoid collision
      // 🏢 ADR-090: Centralized number formatting
      const label = `D: ${formatLengthForDisplay(radius * 2)}`;
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
      // 🏢 ADR-124: Centralized text gap calculation
      const textGap = calculateTextGap(this.transform.scale);
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
      // 🏢 ADR-090: Centralized number formatting
      const label = `R: ${formatLengthForDisplay(radius)}`;
      // Use centralized styling instead of hardcoded green
      this.ctx.save();
      this.applyDimensionTextStyle();
      renderStyledTextWithOverride(this.ctx, label, labelX, labelY);
      this.ctx.restore();
    }
    
    // Calculate and render area and circumference
    const area = Math.PI * radius * radius;
    const circumference = TAU * radius;
    
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
    
    // 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ font styling
    this.ctx.fillStyle = color;
    this.ctx.font = buildUIFont(this.getBaseFontSize(), 'arial');
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    // Draw text
    renderStyledTextWithOverride(this.ctx, text, x, y);
    
    this.ctx.restore();
  }
}