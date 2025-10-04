/**
 * Intersection Snap Engine
 * Υπεύθυνο για εύρεση intersection snap points μεταξύ entities
 */

import { Point2D, Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { SpatialIndex } from '../shared/SpatialIndex';
import { GeometricCalculations, IntersectionResult } from '../shared/GeometricCalculations';
import { getPolylineSegments } from '../../utils/renderers/shared/geometry-rendering-utils';

export class IntersectionSnapEngine extends BaseSnapEngine {
  private spatialIndex = new SpatialIndex();

  constructor() {
    super(ExtendedSnapType.INTERSECTION);
  }

  initialize(entities: Entity[]): void {
    // Δεν χρειάζεται ειδική indexing για intersections
    // Χρησιμοποιούμε on-the-fly calculation με spatial filtering
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const candidates: any[] = [];
    const priority = 0; // Highest priority for intersections
    
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.INTERSECTION);
    
    // Εύρεση των intersections κοντά στο cursor
    const intersections = this.findIntersections(cursorPoint, radius * 2, context);
    
    for (const intersection of intersections) {
      const distance = GeometricCalculations.calculateDistance(cursorPoint, intersection.point);
      
      if (distance <= radius) {
        const candidate = this.createCandidate(
          intersection.point,
          `Intersection (${intersection.type})`,
          distance,
          priority,
          intersection.entity1?.id
        );
        
        candidates.push(candidate);
        
        if (candidates.length >= context.maxCandidates) break;
      }
    }

    return { candidates };
  }

  private findIntersections(cursorPoint: Point2D, radius: number, context: SnapEngineContext): Array<IntersectionResult & { entity1: Entity; entity2: Entity }> {
    const intersections: Array<IntersectionResult & { entity1: Entity; entity2: Entity }> = [];
    
    // Γρήγορη εύρεση nearby entities
    const nearbyEntities = this.spatialIndex.getNearbyEntitiesForIntersection(
      cursorPoint,
      radius,
      context.entities,
      GeometricCalculations.isEntityNearPoint,
      context.excludeEntityId
    );
    
    // Έλεγχος όλων των ζευγαριών entities για intersections
    for (let i = 0; i < nearbyEntities.length; i++) {
      for (let j = i + 1; j < nearbyEntities.length; j++) {
        const entity1 = nearbyEntities[i];
        const entity2 = nearbyEntities[j];
        
        const entityIntersections = this.calculateIntersections(entity1, entity2);
        
        // Φιλτράρισμα intersections που είναι κοντά στο cursor
        for (const intersection of entityIntersections) {
          const distance = GeometricCalculations.calculateDistance(cursorPoint, intersection.point);
          if (distance <= radius * 1.5) { // Ελαφρά μεγαλύτερη απόσταση
            intersections.push({
              ...intersection,
              entity1,
              entity2
            });
          }
        }
      }
    }
    
    return intersections;
  }

  private calculateIntersections(entity1: Entity, entity2: Entity): IntersectionResult[] {
    const type1 = entity1.type.toLowerCase();
    const type2 = entity2.type.toLowerCase();
    
    // Line - Line intersection
    if (type1 === 'line' && type2 === 'line') {
      return this.lineLineIntersection(entity1, entity2);
    }
    
    // Line - Circle intersection
    if ((type1 === 'line' && type2 === 'circle') || (type1 === 'circle' && type2 === 'line')) {
      const line = type1 === 'line' ? entity1 : entity2;
      const circle = type1 === 'circle' ? entity1 : entity2;
      return this.lineCircleIntersection(line, circle);
    }
    
    // Circle - Circle intersection
    if (type1 === 'circle' && type2 === 'circle') {
      return this.circleCircleIntersection(entity1, entity2);
    }
    
    // Polyline intersections
    if ((type1 === 'polyline' || type1 === 'lwpolyline') && type2 === 'line') {
      return this.polylineLineIntersection(entity1, entity2);
    }
    if (type1 === 'line' && (type2 === 'polyline' || type2 === 'lwpolyline')) {
      return this.polylineLineIntersection(entity2, entity1);
    }
    
    // Polyline - Circle intersection
    if ((type1 === 'polyline' || type1 === 'lwpolyline') && type2 === 'circle') {
      return this.polylineCircleIntersection(entity1, entity2);
    }
    if (type1 === 'circle' && (type2 === 'polyline' || type2 === 'lwpolyline')) {
      return this.polylineCircleIntersection(entity2, entity1);
    }
    
    // Polyline - Polyline intersection
    if ((type1 === 'polyline' || type1 === 'lwpolyline') && (type2 === 'polyline' || type2 === 'lwpolyline')) {
      return this.polylinePolylineIntersection(entity1, entity2);
    }
    
    // Rectangle intersections
    if (type1 === 'rectangle' && type2 === 'line') {
      return this.rectangleLineIntersection(entity1, entity2);
    }
    if (type1 === 'line' && type2 === 'rectangle') {
      return this.rectangleLineIntersection(entity2, entity1);
    }
    
    if (type1 === 'rectangle' && type2 === 'circle') {
      return this.rectangleCircleIntersection(entity1, entity2);
    }
    if (type1 === 'circle' && type2 === 'rectangle') {
      return this.rectangleCircleIntersection(entity2, entity1);
    }
    
    if ((type1 === 'rectangle' && (type2 === 'polyline' || type2 === 'lwpolyline')) ||
        ((type1 === 'polyline' || type1 === 'lwpolyline') && type2 === 'rectangle')) {
      const rectangle = type1 === 'rectangle' ? entity1 : entity2;
      const polyline = type1 === 'rectangle' ? entity2 : entity1;
      return this.rectanglePolylineIntersection(rectangle, polyline);
    }
    
    if (type1 === 'rectangle' && type2 === 'rectangle') {
      return this.rectangleRectangleIntersection(entity1, entity2);
    }
    
    return [];
  }

  // --------- INTERSECTION CALCULATION METHODS ---------

  private lineLineIntersection(line1: Entity, line2: Entity): IntersectionResult[] {
    if (!line1.start || !line1.end || !line2.start || !line2.end) return [];
    
    const intersection = GeometricCalculations.getLineIntersection(
      line1.start, line1.end,
      line2.start, line2.end
    );
    
    return intersection ? [{ point: intersection, type: 'Line-Line' }] : [];
  }

  private lineCircleIntersection(line: Entity, circle: Entity): IntersectionResult[] {
    if (!line.start || !line.end || !circle.center || !circle.radius) return [];
    
    const intersections = GeometricCalculations.getLineCircleIntersections(
      line.start, line.end,
      circle.center, circle.radius
    );
    
    return intersections.map(point => ({ point, type: 'Line-Circle' }));
  }

  private circleCircleIntersection(circle1: Entity, circle2: Entity): IntersectionResult[] {
    if (!circle1.center || !circle1.radius || !circle2.center || !circle2.radius) return [];
    
    const intersections = GeometricCalculations.getCircleIntersections(
      circle1.center, circle1.radius,
      circle2.center, circle2.radius
    );
    
    return intersections.map(point => ({ point, type: 'Circle-Circle' }));
  }

  private polylineLineIntersection(polyline: Entity, line: Entity): IntersectionResult[] {
    // Support both 'points' and 'vertices' properties
    const points = polyline.points || (polyline as any).vertices;
    if (!points || !line.start || !line.end) return [];
    
    const intersections: IntersectionResult[] = [];
    
    for (let i = 1; i < points.length; i++) {
      const intersection = GeometricCalculations.getLineIntersection(
        points[i-1], points[i],
        line.start, line.end
      );
      
      if (intersection) {
        intersections.push({ point: intersection, type: 'Polyline-Line' });
      }
    }
    
    // Check closing edge for closed polylines
    const isClosed = (polyline as any).closed;
    if (isClosed && points.length > 2) {
      const intersection = GeometricCalculations.getLineIntersection(
        points[points.length - 1], points[0],
        line.start, line.end
      );
      
      if (intersection) {
        intersections.push({ point: intersection, type: 'Polyline-Line' });
      }
    }
    
    return intersections;
  }

  private polylinePolylineIntersection(poly1: Entity, poly2: Entity): IntersectionResult[] {
    // Support both 'points' and 'vertices' properties
    const points1 = poly1.points || (poly1 as any).vertices;
    const points2 = poly2.points || (poly2 as any).vertices;
    if (!points1 || !points2) return [];
    
    const intersections: IntersectionResult[] = [];
    
    const segments1 = getPolylineSegments(points1, (poly1 as any).closed);
    const segments2 = getPolylineSegments(points2, (poly2 as any).closed);
    
    // Check intersection between all segment pairs
    for (const seg1 of segments1) {
      for (const seg2 of segments2) {
        const intersection = GeometricCalculations.getLineIntersection(
          seg1.start, seg1.end,
          seg2.start, seg2.end
        );
        
        if (intersection) {
          intersections.push({ point: intersection, type: 'Polyline-Polyline' });
        }
      }
    }
    
    return intersections;
  }

  private polylineCircleIntersection(polyline: Entity, circle: Entity): IntersectionResult[] {
    // Support both 'points' and 'vertices' properties
    const points = polyline.points || (polyline as any).vertices;
    if (!points || !circle.center || !circle.radius) return [];
    
    const intersections: IntersectionResult[] = [];
    
    // Debug logging (occasional)
    const shouldLog = Math.random() < 0.01;
    if (shouldLog) {
      console.log('🎯 IntersectionSnapEngine: Checking polyline-circle intersection', {
        polylinePoints: points.length,
        circleCenter: circle.center,
        circleRadius: circle.radius,
        isClosed: (polyline as any).closed
      });
    }
    
    const segments = getPolylineSegments(points, (polyline as any).closed);
    
    // Check intersection between each polyline segment and the circle
    for (const segment of segments) {
      const lineIntersections = GeometricCalculations.getLineCircleIntersections(
        segment.start, segment.end,
        circle.center, circle.radius
      );
      
      for (const intersection of lineIntersections) {
        intersections.push({ point: intersection, type: 'Polyline-Circle' });
      }
    }
    
    if (shouldLog && intersections.length > 0) {
      console.log('🎯 IntersectionSnapEngine: Found polyline-circle intersections:', intersections.length);
    }
    
    return intersections;
  }

  private rectangleLineIntersection(rectangle: Entity, line: Entity): IntersectionResult[] {
    if (!line.start || !line.end) return [];
    
    const rectLines = GeometricCalculations.getRectangleLines(rectangle as any);
    const intersections: IntersectionResult[] = [];
    
    for (const rectLine of rectLines) {
      const intersection = GeometricCalculations.getLineIntersection(
        line.start, line.end,
        rectLine.start, rectLine.end
      );
      
      if (intersection) {
        intersections.push({ point: intersection, type: 'Rectangle-Line' });
      }
    }
    
    return intersections;
  }

  private rectangleCircleIntersection(rectangle: Entity, circle: Entity): IntersectionResult[] {
    if (!circle.center || !circle.radius) return [];
    
    const rectLines = GeometricCalculations.getRectangleLines(rectangle as any);
    const intersections: IntersectionResult[] = [];
    
    for (const rectLine of rectLines) {
      const lineIntersections = GeometricCalculations.getLineCircleIntersections(
        rectLine.start, rectLine.end,
        circle.center, circle.radius
      );
      
      for (const intersection of lineIntersections) {
        intersections.push({ point: intersection, type: 'Rectangle-Circle' });
      }
    }
    
    return intersections;
  }

  private rectanglePolylineIntersection(rectangle: Entity, polyline: Entity): IntersectionResult[] {
    if (!polyline.points || polyline.points.length < 2) return [];
    
    const rectLines = GeometricCalculations.getRectangleLines(rectangle as any);
    const intersections: IntersectionResult[] = [];
    
    for (const rectLine of rectLines) {
      for (let i = 1; i < polyline.points.length; i++) {
        const intersection = GeometricCalculations.getLineIntersection(
          rectLine.start, rectLine.end,
          polyline.points[i-1], polyline.points[i]
        );
        
        if (intersection) {
          intersections.push({ point: intersection, type: 'Rectangle-Polyline' });
        }
      }
    }
    
    return intersections;
  }

  private rectangleRectangleIntersection(rect1: Entity, rect2: Entity): IntersectionResult[] {
    const rect1Lines = GeometricCalculations.getRectangleLines(rect1 as any);
    const rect2Lines = GeometricCalculations.getRectangleLines(rect2 as any);
    const intersections: IntersectionResult[] = [];
    
    for (const line1 of rect1Lines) {
      for (const line2 of rect2Lines) {
        const intersection = GeometricCalculations.getLineIntersection(
          line1.start, line1.end,
          line2.start, line2.end
        );
        
        if (intersection) {
          intersections.push({ point: intersection, type: 'Rectangle-Rectangle' });
        }
      }
    }
    
    return intersections;
  }

  dispose(): void {
    this.spatialIndex.clear();
  }

  getStats(): {
    intersectionCalculations: number;
  } {
    return {
      intersectionCalculations: 0 // Θα προσθέσουμε metrics αργότερα
    };
  }
}