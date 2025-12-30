/**
 * Angle Measurement Entity Renderer
 * Handles rendering of angle measurement entities with green dots, arc, and angle display
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, RenderOptions } from '../types/Types';
import type { GripInfo } from '../types/Types';
import type { Point2D } from '../types/Types';
import { pointToLineDistance } from './shared/geometry-utils';
import { extractAngleMeasurementPoints } from './shared';
import { renderStyledTextWithOverride } from '../../hooks/useTextPreviewStyle';

export class AngleMeasurementRenderer extends BaseEntityRenderer {
  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (entity.type !== 'angle-measurement') return;
    
    const angleMeasurement = extractAngleMeasurementPoints(entity);
    if (!angleMeasurement) return;
    
    const { vertex, point1, point2, angle } = angleMeasurement;
    
    const screenVertex = this.worldToScreen(vertex);
    const screenPoint1 = this.worldToScreen(point1);
    const screenPoint2 = this.worldToScreen(point2);
    
    // 🔺 Χρήση 3-phase system όπως όλες οι άλλες οντότητες
    this.renderWithPhases(
      entity,
      options,
      // Geometry rendering
      () => this.renderAngleGeometry(vertex, point1, point2, screenVertex, screenPoint1, screenPoint2, options, entity),
      // Measurements rendering (arc + text + distance labels for both lines)
      () => this.renderAngleMeasurements(vertex, point1, point2, angle, entity, options),
      // Dots rendering (centralized color)
      () => this.renderAngleDots([screenVertex, screenPoint1, screenPoint2])
    );
  }
  
  private renderAngleGeometry(vertex: Point2D, point1: Point2D, point2: Point2D, screenVertex: Point2D, screenPoint1: Point2D, screenPoint2: Point2D, options: RenderOptions, entity: EntityModel): void {
    // 🔺 Έλεγχος αν οι γραμμές είναι ενεργοποιημένες
    if (!this.shouldRenderLines(entity, options)) {
      return; // Δεν σχεδιάζουμε καθόλου γραμμές
    }

    // 🔺 Χρήση κεντρικοποιημένης λογικής split line
    if (this.shouldRenderSplitLine(entity, options)) {
      // Κατά την προεπισκόπηση, χρήση κεντρικοποιημένης split line με distance text
      this.renderSplitLineWithGap(screenVertex, screenPoint1, entity, options);
      this.renderSplitLineWithGap(screenVertex, screenPoint2, entity, options);
    } else {
      // Final measurement, draw simple lines without distances
      this.ctx.beginPath();
      this.ctx.moveTo(screenVertex.x, screenVertex.y);
      this.ctx.lineTo(screenPoint1.x, screenPoint1.y);
      this.ctx.moveTo(screenVertex.x, screenVertex.y);
      this.ctx.lineTo(screenPoint2.x, screenPoint2.y);
      this.ctx.stroke();
    }
  }
  
  private renderAngleMeasurements(vertex: Point2D, point1: Point2D, point2: Point2D, angle: number, entity: EntityModel, options: RenderOptions): void {
    const screenVertex = this.worldToScreen(vertex);
    const screenPoint1 = this.worldToScreen(point1);
    const screenPoint2 = this.worldToScreen(point2);
    
    // 🔺 Προσθήκη distance labels για τις δύο γραμμές της γωνίας (με phase-aware positioning)
    this.renderDistanceTextPhaseAware(vertex, point1, screenVertex, screenPoint1, entity, options);
    this.renderDistanceTextPhaseAware(vertex, point2, screenVertex, screenPoint2, entity, options);
    
    // 🔺 Χρήση ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΗΣ μεθόδου για τόξα (πορτοκαλί, διακεκομμένα)
    const arcRadius = 40; // Screen pixels - μεγαλύτερη τιμή
    const angle1 = Math.atan2(point1.y - vertex.y, point1.x - vertex.x);
    const angle2 = Math.atan2(point2.y - vertex.y, point2.x - vertex.x);
    
    // Χρήση κεντρικοποιημένης μεθόδου για αυτόματο εσωτερικό τόξο
    // Μετατροπή από screen pixels σε world coordinates
    const arcRadiusWorld = arcRadius / this.transform.scale;
    this.drawCentralizedArc(vertex.x, vertex.y, arcRadiusWorld, angle1, angle2);
    
    // Draw angle text
    this.drawAngleText(screenVertex, screenPoint1, screenPoint2, angle);
  }
  
  private renderAngleDots(points: Point2D[]): void {
    // 🔺 ΚΕΝΤΡΙΚΟΠΟΙΗΜΈΝΟ ΧΡΏΜΑ - το fillStyle έχει ήδη οριστεί από το renderWithPhases
    // ⚡ NUCLEAR: ANGLE MEASUREMENT DOTS ELIMINATED
  }




  private drawAngleText(vertex: Point2D, point1: Point2D, point2: Point2D, angleDegrees: number): void {
    this.ctx.save();
    this.applyDimensionTextStyle(); // Use centralized fuchsia color and styling
    
    // Calculate text position (midway between the two arms, offset from vertex)
    const angle1 = Math.atan2(point1.y - vertex.y, point1.x - vertex.x);
    const angle2 = Math.atan2(point2.y - vertex.y, point2.x - vertex.x);
    
    // Calculate bisector angle
    let bisectorAngle = (angle1 + angle2) / 2;
    
    // Handle angle wrapping
    let angleDiff = angle2 - angle1;
    if (angleDiff > Math.PI) {
      bisectorAngle += Math.PI;
    } else if (angleDiff < -Math.PI) {
      bisectorAngle -= Math.PI;
    }
    
    // Text offset from vertex
    const textDistance = 50 / this.transform.scale;
    const screenTextDistance = textDistance * this.transform.scale;
    
    const textX = vertex.x + Math.cos(bisectorAngle) * screenTextDistance;
    const textY = vertex.y + Math.sin(bisectorAngle) * screenTextDistance;
    
    // Format angle text
    const angleText = `${angleDegrees.toFixed(1)}°`;
    
    // Center the text
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    renderStyledTextWithOverride(this.ctx, angleText, textX, textY);
    
    this.ctx.restore();
  }

  getGrips(entity: EntityModel): GripInfo[] {
    if (entity.type !== 'angle-measurement') return [];

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

  hitTest(entity: EntityModel, point: Point2D, tolerance: number): boolean {
    if (entity.type !== 'angle-measurement') return false;

    const angleMeasurement = extractAngleMeasurementPoints(entity);
    if (!angleMeasurement) return false;

    // Simple tolerance-based hit testing για angle measurement
    const { vertex, point1, point2 } = angleMeasurement;
    const distance1 = Math.sqrt(Math.pow(point.x - vertex.x, 2) + Math.pow(point.y - vertex.y, 2));
    const distance2 = Math.sqrt(Math.pow(point.x - point1.x, 2) + Math.pow(point.y - point1.y, 2));
    const distance3 = Math.sqrt(Math.pow(point.x - point2.x, 2) + Math.pow(point.y - point2.y, 2));

    return distance1 <= tolerance || distance2 <= tolerance || distance3 <= tolerance;
  }

}