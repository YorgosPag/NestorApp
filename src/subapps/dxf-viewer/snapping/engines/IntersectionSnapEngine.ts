/**
 * Intersection Snap Engine
 * Υπεύθυνο για εύρεση intersection snap points μεταξύ entities
 *
 * 🏢 ENTERPRISE CENTRALIZATION (2025-01-05):
 * - Uses centralized Entity types from types/entities.ts
 * - Uses type guards for safe property access
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate, type Entity } from '../extended-types';
import type { SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { BaseSnapEngine } from '../shared/BaseSnapEngine';
import type { IntersectionResult } from '../shared/GeometricCalculations';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { getPolylineSegments } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ENTERPRISE: Import centralized entity types and type guards
import type {
  LineEntity,
  PolylineEntity,
  LWPolylineEntity,
  CircleEntity,
  ArcEntity,
  RectangleEntity
} from '../../types/entities';
import {
  isLineEntity,
  isPolylineEntity,
  isLWPolylineEntity,
  isCircleEntity,
  isArcEntity,
  isRectangleEntity
} from '../../types/entities';

export class IntersectionSnapEngine extends BaseSnapEngine {
  constructor() {
    super(ExtendedSnapType.INTERSECTION);
  }

  initialize(entities: EntityModel[]): void {
    // Δεν χρειάζεται ειδική indexing για intersections
    // Χρησιμοποιούμε on-the-fly calculation με spatial filtering
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const candidates: SnapCandidate[] = [];
    const priority = 0; // Highest priority for intersections
    
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.INTERSECTION);
    
    // Εύρεση των intersections κοντά στο cursor
    const intersections = this.findIntersections(cursorPoint, radius * 2, context);
    
    for (const intersection of intersections) {
      const distance = calculateDistance(cursorPoint, intersection.point);
      
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

    // Φιλτράρισμα nearby entities (simple approach - όλα τα visible entities)
    const nearbyEntities = context.entities.filter(entity => {
      if (!entity.visible) return false;
      if (entity.id === context.excludeEntityId) return false;
      // Check if entity is near cursor point
      return GeometricCalculations.isEntityNearPoint(entity, cursorPoint, radius * 2);
    });
    
    // Έλεγχος όλων των ζευγαριών entities για intersections
    for (let i = 0; i < nearbyEntities.length; i++) {
      for (let j = i + 1; j < nearbyEntities.length; j++) {
        const entity1 = nearbyEntities[i];
        const entity2 = nearbyEntities[j];
        
        const entityIntersections = this.calculateIntersections(entity1, entity2);
        
        // Φιλτράρισμα intersections που είναι κοντά στο cursor
        for (const intersection of entityIntersections) {
          const distance = calculateDistance(cursorPoint, intersection.point);
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
  // 🏢 ENTERPRISE: Using specific entity types for type safety

  private lineLineIntersection(line1: Entity, line2: Entity): IntersectionResult[] {
    // 🏢 ENTERPRISE: Type guard for LineEntity
    if (!isLineEntity(line1) || !isLineEntity(line2)) return [];

    const intersection = GeometricCalculations.getLineIntersection(
      line1.start, line1.end,
      line2.start, line2.end
    );

    return intersection ? [{ point: intersection, type: 'Line-Line' }] : [];
  }

  private lineCircleIntersection(line: Entity, circle: Entity): IntersectionResult[] {
    // 🏢 ENTERPRISE: Type guards for LineEntity and CircleEntity/ArcEntity
    if (!isLineEntity(line)) return [];
    if (!isCircleEntity(circle) && !isArcEntity(circle)) return [];

    const circleData = circle as CircleEntity | ArcEntity;
    const intersections = GeometricCalculations.getLineCircleIntersections(
      line.start, line.end,
      circleData.center, circleData.radius
    );

    return intersections.map(point => ({ point, type: 'Line-Circle' }));
  }

  private circleCircleIntersection(circle1: Entity, circle2: Entity): IntersectionResult[] {
    // 🏢 ENTERPRISE: Type guards for CircleEntity/ArcEntity
    const isCircle1 = isCircleEntity(circle1) || isArcEntity(circle1);
    const isCircle2 = isCircleEntity(circle2) || isArcEntity(circle2);
    if (!isCircle1 || !isCircle2) return [];

    const c1 = circle1 as CircleEntity | ArcEntity;
    const c2 = circle2 as CircleEntity | ArcEntity;
    const intersections = GeometricCalculations.getCircleIntersections(
      c1.center, c1.radius,
      c2.center, c2.radius
    );

    return intersections.map(point => ({ point, type: 'Circle-Circle' }));
  }

  private polylineLineIntersection(polyline: Entity, line: Entity): IntersectionResult[] {
    // 🏢 ENTERPRISE: Type guards for PolylineEntity and LineEntity
    if (!isLineEntity(line)) return [];

    // Support both polyline and lwpolyline
    let vertices: Point2D[] | undefined;
    let isClosed = false;

    if (isPolylineEntity(polyline)) {
      vertices = polyline.vertices;
      isClosed = polyline.closed || false;
    } else if (isLWPolylineEntity(polyline)) {
      vertices = polyline.vertices;
      isClosed = polyline.closed || false;
    }

    if (!vertices || vertices.length < 2) return [];

    const intersections: IntersectionResult[] = [];

    for (let i = 1; i < vertices.length; i++) {
      const intersection = GeometricCalculations.getLineIntersection(
        vertices[i-1], vertices[i],
        line.start, line.end
      );

      if (intersection) {
        intersections.push({ point: intersection, type: 'Polyline-Line' });
      }
    }

    // Check closing edge for closed polylines
    if (isClosed && vertices.length > 2) {
      const intersection = GeometricCalculations.getLineIntersection(
        vertices[vertices.length - 1], vertices[0],
        line.start, line.end
      );

      if (intersection) {
        intersections.push({ point: intersection, type: 'Polyline-Line' });
      }
    }

    return intersections;
  }

  private polylinePolylineIntersection(poly1: Entity, poly2: Entity): IntersectionResult[] {
    // 🏢 ENTERPRISE: Type guards for polyline entities
    const getVertices = (entity: Entity): { vertices: Point2D[] | undefined; closed: boolean } => {
      if (isPolylineEntity(entity)) return { vertices: entity.vertices, closed: entity.closed || false };
      if (isLWPolylineEntity(entity)) return { vertices: entity.vertices, closed: entity.closed || false };
      return { vertices: undefined, closed: false };
    };

    const p1 = getVertices(poly1);
    const p2 = getVertices(poly2);
    if (!p1.vertices || !p2.vertices) return [];

    const intersections: IntersectionResult[] = [];

    const segments1 = getPolylineSegments(p1.vertices, p1.closed);
    const segments2 = getPolylineSegments(p2.vertices, p2.closed);

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
    // 🏢 ENTERPRISE: Type guards for polyline and circle entities
    let vertices: Point2D[] | undefined;
    let isClosed = false;

    if (isPolylineEntity(polyline)) {
      vertices = polyline.vertices;
      isClosed = polyline.closed || false;
    } else if (isLWPolylineEntity(polyline)) {
      vertices = polyline.vertices;
      isClosed = polyline.closed || false;
    }

    if (!vertices) return [];
    if (!isCircleEntity(circle) && !isArcEntity(circle)) return [];

    const circleData = circle as CircleEntity | ArcEntity;
    const intersections: IntersectionResult[] = [];

    const segments = getPolylineSegments(vertices, isClosed);

    // Check intersection between each polyline segment and the circle
    for (const segment of segments) {
      const lineIntersections = GeometricCalculations.getLineCircleIntersections(
        segment.start, segment.end,
        circleData.center, circleData.radius
      );

      for (const intersection of lineIntersections) {
        intersections.push({ point: intersection, type: 'Polyline-Circle' });
      }
    }

    return intersections;
  }

  private rectangleLineIntersection(rectangle: Entity, line: Entity): IntersectionResult[] {
    // 🏢 ENTERPRISE: Type guards for rectangle and line entities
    if (!isLineEntity(line)) return [];
    if (!isRectangleEntity(rectangle)) return [];

    const rectLines = GeometricCalculations.getRectangleLines(rectangle);
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
    // 🏢 ENTERPRISE: Type guards for rectangle and circle entities
    if (!isRectangleEntity(rectangle)) return [];
    if (!isCircleEntity(circle) && !isArcEntity(circle)) return [];

    const circleData = circle as CircleEntity | ArcEntity;
    const rectLines = GeometricCalculations.getRectangleLines(rectangle);
    const intersections: IntersectionResult[] = [];

    for (const rectLine of rectLines) {
      const lineIntersections = GeometricCalculations.getLineCircleIntersections(
        rectLine.start, rectLine.end,
        circleData.center, circleData.radius
      );

      for (const intersection of lineIntersections) {
        intersections.push({ point: intersection, type: 'Rectangle-Circle' });
      }
    }

    return intersections;
  }

  private rectanglePolylineIntersection(rectangle: Entity, polyline: Entity): IntersectionResult[] {
    // 🏢 ENTERPRISE: Type guards for rectangle and polyline entities
    if (!isRectangleEntity(rectangle)) return [];

    let vertices: Point2D[] | undefined;
    if (isPolylineEntity(polyline)) {
      vertices = polyline.vertices;
    } else if (isLWPolylineEntity(polyline)) {
      vertices = polyline.vertices;
    }

    if (!vertices || vertices.length < 2) return [];

    const rectLines = GeometricCalculations.getRectangleLines(rectangle);
    const intersections: IntersectionResult[] = [];

    for (const rectLine of rectLines) {
      for (let i = 1; i < vertices.length; i++) {
        const intersection = GeometricCalculations.getLineIntersection(
          rectLine.start, rectLine.end,
          vertices[i-1], vertices[i]
        );

        if (intersection) {
          intersections.push({ point: intersection, type: 'Rectangle-Polyline' });
        }
      }
    }

    return intersections;
  }

  private rectangleRectangleIntersection(rect1: Entity, rect2: Entity): IntersectionResult[] {
    // 🏢 ENTERPRISE: Type guards for rectangle entities
    if (!isRectangleEntity(rect1) || !isRectangleEntity(rect2)) return [];

    const rect1Lines = GeometricCalculations.getRectangleLines(rect1);
    const rect2Lines = GeometricCalculations.getRectangleLines(rect2);
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
    // No resources to clean up for IntersectionSnapEngine
  }

  getStats(): {
    intersectionCalculations: number;
  } {
    return {
      intersectionCalculations: 0 // Θα προσθέσουμε metrics αργότερα
    };
  }
}