/**
 * Shared Geometric Calculations
 * Κοινές γεωμετρικές υπολογιστικές μέθοδοι για όλα τα snap engines
 */

import type { Point2D } from '../../rendering/types/Types';
import { Entity, ExtendedSnapType } from '../extended-types';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { calculateDistance, rotatePoint } from '../../rendering/entities/shared/geometry-rendering-utils';

// Extended entity interfaces for proper typing
interface PolylineEntity extends Entity {
  vertices?: Point2D[];
  closed?: boolean;
}

interface RectangleEntity extends Entity {
  corner1?: Point2D;
  corner2?: Point2D;
  rotation?: number;
}

export interface IntersectionResult {
  point: Point2D;
  type: string;
}

export interface RectangleLine {
  start: Point2D;
  end: Point2D;
}

export class GeometricCalculations {
  
  // --------- DISTANCE CALCULATIONS ---------

  // Διαγράφηκε το περιττό wrapper calculateDistance - χρησιμοποιείστε απευθείας calculateDistance από geometry-rendering-utils

  static distanceSq(p1: Point2D, p2: Point2D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
  }

  static distancePointToLine(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
    // Use shared geometry-utils function to eliminate duplication
    return pointToLineDistance(point, lineStart, lineEnd);
  }

  // --------- ENTITY PROPERTY EXTRACTORS ---------

  static getEntityEndpoints(entity: Entity): Point2D[] {
    const endpoints: Point2D[] = [];
    const entityType = entity.type.toLowerCase();
    
    if (entityType === 'line') {
      if (entity.start) endpoints.push(entity.start);
      if (entity.end) endpoints.push(entity.end);
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      // Support both 'points' and 'vertices' properties
      const polylineEntity = entity as PolylineEntity;
      const points = entity.points || polylineEntity.vertices;
      const isClosed = polylineEntity.closed;
      
      if (points && points.length > 0) {
        if (isClosed) {
          // For closed polylines, all vertices are endpoints (corners)
          endpoints.push(...points);
        } else {
          // For open polylines, only first and last are endpoints
          endpoints.push(points[0]);
          if (points.length > 1) {
            endpoints.push(points[points.length - 1]);
          }
        }
      }
    } else if (entityType === 'arc') {
      if (entity.center && entity.radius && entity.startAngle !== undefined && entity.endAngle !== undefined) {
        const start = {
          x: entity.center.x + entity.radius * Math.cos(entity.startAngle),
          y: entity.center.y + entity.radius * Math.sin(entity.startAngle)
        };
        const end = {
          x: entity.center.x + entity.radius * Math.cos(entity.endAngle),
          y: entity.center.y + entity.radius * Math.sin(entity.endAngle)
        };
        endpoints.push(start, end);
      }
    } else if (entityType === 'rectangle') {
      const rectEntity = entity as RectangleEntity;
      if (rectEntity.corner1 && rectEntity.corner2) {
        const corners = GeometricCalculations.getRectangleCorners(rectEntity);
        endpoints.push(...corners);
      }
    }
    
    return endpoints;
  }

  static getEntityMidpoints(entity: Entity): Point2D[] {
    const midpoints: Point2D[] = [];
    const entityType = entity.type.toLowerCase();
    
    if (entityType === 'line') {
      if (entity.start && entity.end) {
        midpoints.push({
          x: (entity.start.x + entity.end.x) / 2,
          y: (entity.start.y + entity.end.y) / 2
        });
      }
    } else if (entityType === 'arc') {
      if (entity.center && entity.radius && entity.startAngle !== undefined && entity.endAngle !== undefined) {
        const midAngle = (entity.startAngle + entity.endAngle) / 2;
        midpoints.push({
          x: entity.center.x + entity.radius * Math.cos(midAngle),
          y: entity.center.y + entity.radius * Math.sin(midAngle)
        });
      }
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      // Support both 'points' and 'vertices' properties
      const polylineEntity = entity as PolylineEntity;
      const points = entity.points || polylineEntity.vertices;
      const isClosed = polylineEntity.closed;
      
      if (points && points.length >= 2) {
        // Calculate midpoint for each edge
        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1];
          const p2 = points[i];
          midpoints.push({
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
          });
        }
        
        // Add closing edge midpoint for closed polylines
        if (isClosed && points.length > 2) {
          const p1 = points[points.length - 1];
          const p2 = points[0];
          midpoints.push({
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
          });
        }
      }
    }
    
    return midpoints;
  }

  static getEntityMidpoint(entity: Entity): Point2D | null {
    const entityType = entity.type.toLowerCase();
    
    if (entityType === 'line') {
      if (entity.start && entity.end) {
        return {
          x: (entity.start.x + entity.end.x) / 2,
          y: (entity.start.y + entity.end.y) / 2
        };
      }
    } else if (entityType === 'arc') {
      if (entity.center && entity.radius && entity.startAngle !== undefined && entity.endAngle !== undefined) {
        const midAngle = (entity.startAngle + entity.endAngle) / 2;
        return {
          x: entity.center.x + entity.radius * Math.cos(midAngle),
          y: entity.center.y + entity.radius * Math.sin(midAngle)
        };
      }
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      // Support both 'points' and 'vertices' properties
      const polylineEntity = entity as PolylineEntity;
      const points = entity.points || polylineEntity.vertices;
      if (points && points.length >= 2) {
        const midIndex = Math.floor(points.length / 2);
        if (points.length % 2 === 1) {
          return points[midIndex];
        } else {
          const p1 = points[midIndex - 1];
          const p2 = points[midIndex];
          return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
          };
        }
      }
    }
    
    return null;
  }

  static getEntityCenter(entity: Entity): Point2D | null {
    const entityType = entity.type.toLowerCase();
    
    if (entityType === 'circle' || entityType === 'arc') {
      return entity.center || null;
    } else if (entityType === 'rectangle') {
      const rectEntity = entity as RectangleEntity;
      if (rectEntity.corner1 && rectEntity.corner2) {
        return {
          x: (rectEntity.corner1.x + rectEntity.corner2.x) / 2,
          y: (rectEntity.corner1.y + rectEntity.corner2.y) / 2
        };
      }
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      // For closed polylines with 4 vertices (squares/rectangles)
      const polylineEntity = entity as PolylineEntity;
      const points = entity.points || polylineEntity.vertices;
      const isClosed = polylineEntity.closed;
      
      if (points && points.length === 4 && isClosed) {
        // Calculate center of 4-vertex closed polyline (rectangle)
        let centerX = 0;
        let centerY = 0;
        for (const point of points) {
          centerX += point.x;
          centerY += point.y;
        }
        return {
          x: centerX / 4,
          y: centerY / 4
        };
      }
    }
    
    return null;
  }

  // --------- RECTANGLE UTILITIES ---------

  static getRectangleCorners(rectangle: RectangleEntity): Point2D[] {
    const { corner1, corner2, rotation = 0 } = rectangle;
    if (!corner1 || !corner2) return [];
    
    const corners = [
      { x: corner1.x, y: corner1.y },
      { x: corner2.x, y: corner1.y },
      { x: corner2.x, y: corner2.y },
      { x: corner1.x, y: corner2.y }
    ];
    
    if (rotation !== 0) {
      const center = {
        x: (corner1.x + corner2.x) / 2,
        y: (corner1.y + corner2.y) / 2
      };
      
      return corners.map(corner => GeometricCalculations.rotatePoint(corner, center, rotation));
    }
    
    return corners;
  }

  static getRectangleLines(rectangle: RectangleEntity): RectangleLine[] {
    const corners = GeometricCalculations.getRectangleCorners(rectangle);
    if (corners.length !== 4) return [];
    
    return [
      { start: corners[0], end: corners[1] },
      { start: corners[1], end: corners[2] },
      { start: corners[2], end: corners[3] },
      { start: corners[3], end: corners[0] }
    ];
  }

  static rotatePoint(point: Point2D, center: Point2D, angle: number): Point2D {
    return rotatePoint(point, center, angle);
  }

  // --------- LINE INTERSECTIONS ---------

  static getLineIntersection(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): Point2D | null {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;
    const x4 = p4.x, y4 = p4.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 1e-10) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
      };
    }

    return null;
  }

  static getLineCircleIntersections(lineStart: Point2D, lineEnd: Point2D, center: Point2D, radius: number): Point2D[] {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const fx = lineStart.x - center.x;
    const fy = lineStart.y - center.y;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - radius * radius;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return [];

    const discriminantSqrt = Math.sqrt(discriminant);
    const t1 = (-b - discriminantSqrt) / (2 * a);
    const t2 = (-b + discriminantSqrt) / (2 * a);

    const intersections: Point2D[] = [];

    if (t1 >= 0 && t1 <= 1) {
      intersections.push({
        x: lineStart.x + t1 * dx,
        y: lineStart.y + t1 * dy
      });
    }

    if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 1e-10) {
      intersections.push({
        x: lineStart.x + t2 * dx,
        y: lineStart.y + t2 * dy
      });
    }

    return intersections;
  }

  static getCircleIntersections(center1: Point2D, radius1: number, center2: Point2D, radius2: number): Point2D[] {
    const dx = center2.x - center1.x;
    const dy = center2.y - center1.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > radius1 + radius2 || d < Math.abs(radius1 - radius2) || d === 0) {
      return [];
    }

    const a = (radius1 * radius1 - radius2 * radius2 + d * d) / (2 * d);
    const h = Math.sqrt(radius1 * radius1 - a * a);

    const px = center1.x + a * (dx / d);
    const py = center1.y + a * (dy / d);

    if (Math.abs(h) < 1e-10) {
      return [{ x: px, y: py }];
    }

    return [
      {
        x: px + h * (-dy / d),
        y: py + h * (dx / d)
      },
      {
        x: px - h * (-dy / d),
        y: py - h * (dx / d)
      }
    ];
  }

  // --------- ENTITY PROXIMITY CHECKS ---------

  static isEntityNearPoint(entity: Entity, point: Point2D, radius: number): boolean {
    const entityType = entity.type.toLowerCase();
    
    if (entityType === 'line') {
      if (entity.start && entity.end) {
        return GeometricCalculations.distancePointToLine(point, entity.start, entity.end) <= radius;
      }
    } else if (entityType === 'circle') {
      if (entity.center && entity.radius) {
        const distanceToCenter = calculateDistance(point, entity.center);
        return Math.abs(distanceToCenter - entity.radius) <= radius;
      }
    } else if (entityType === 'rectangle') {
      const rectEntity = entity as RectangleEntity;
      if (rectEntity.corner1 && rectEntity.corner2) {
        const rectLines = GeometricCalculations.getRectangleLines(rectEntity);
        return rectLines.some(line => GeometricCalculations.distancePointToLine(point, line.start, line.end) <= radius);
      }
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      // Support both 'points' and 'vertices' properties
      const polylineEntity = entity as PolylineEntity;
      const points = entity.points || polylineEntity.vertices;
      if (points && points.length > 1) {
        for (let i = 1; i < points.length; i++) {
          const dist = GeometricCalculations.distancePointToLine(point, points[i-1], points[i]);
          if (dist <= radius) return true;
        }
        
        // Check closing edge for closed polylines
        const polylineEntity = entity as PolylineEntity;
        const isClosed = polylineEntity.closed;
        if (isClosed && points.length > 2) {
          const dist = GeometricCalculations.distancePointToLine(point, points[points.length - 1], points[0]);
          if (dist <= radius) return true;
        }
      }
    }
    
    return false;
  }
}