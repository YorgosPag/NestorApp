/**
 * Nearest Snap Engine
 * Υπεύθυνο για εύρεση του κοντινότερου σημείου σε οποιαδήποτε entity
 */

import type { Point2D } from '../../rendering/types/Types';
import { Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { getNearestPointOnLine } from '../../rendering/entities/shared/geometry-utils';

export class NearestSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.NEAREST);
  }

  initialize(entities: Entity[]): void {

  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const candidates: SnapCandidate[] = [];
    const priority = 8; // Low priority - fallback option
    
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.NEAREST);
    let closestPoint: Point2D | null = null;
    let closestDistance = Infinity;
    let closestEntity: Entity | null = null;
    
    // Guard against non-iterable entities
    if (!Array.isArray(context.entities)) {
      console.warn('[NearestSnapEngine] entities is not an array:', typeof context.entities, context.entities);
      return { candidates };
    }
    
    // Find the nearest point on any entity
    for (const entity of context.entities) {
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;
      if (!entity.visible) continue;
      
      const nearestPoint = this.getNearestPointOnEntity(entity, cursorPoint);
      if (nearestPoint) {
        const distance = calculateDistance(cursorPoint, nearestPoint);
        
        if (distance < closestDistance && distance <= radius) {
          closestDistance = distance;
          closestPoint = nearestPoint;
          closestEntity = entity;
        }
      }
    }
    
    if (closestPoint && closestEntity) {
      const candidate = this.createCandidate(
        closestPoint,
        'Nearest',
        closestDistance,
        priority,
        closestEntity.id
      );
      
      candidates.push(candidate);
    }

    return { candidates };
  }

  private getNearestPointOnEntity(entity: Entity, point: Point2D): Point2D | null {
    const entityType = entity.type.toLowerCase();
    
    if (entityType === 'line') {
      if (entity.start && entity.end) {
        return getNearestPointOnLine(point, entity.start, entity.end);
      }
    } else if (entityType === 'circle') {
      if (entity.center && entity.radius) {
        return this.getNearestPointOnCircle(point, entity.center, entity.radius);
      }
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      const points = (entity.points || ('vertices' in entity ? entity.vertices : undefined)) as Point2D[] | undefined;
      if (points && points.length > 1) {
        const isClosed = 'closed' in entity ? entity.closed : false;
        return this.getNearestPointOnPolyline(point, points, isClosed);
      }
    }
    
    return null;
  }

  // Using centralized geometry utility - eliminates duplication

  private getNearestPointOnCircle(point: Point2D, center: Point2D, radius: number): Point2D {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) {
      // Point is at center, return any point on circle
      return { x: center.x + radius, y: center.y };
    }
    
    // Normalize and scale to radius
    const scale = radius / distance;
    return {
      x: center.x + dx * scale,
      y: center.y + dy * scale
    };
  }

  private getNearestPointOnPolyline(point: Point2D, points: Point2D[], closed: boolean): Point2D | null {
    let nearestPoint: Point2D | null = null;
    let nearestDistance = Infinity;
    
    // Check all line segments
    for (let i = 1; i < points.length; i++) {
      const segmentNearest = getNearestPointOnLine(point, points[i-1], points[i]);
      const distance = calculateDistance(point, segmentNearest);
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPoint = segmentNearest;
      }
    }
    
    // Check closing segment for closed polylines
    if (closed && points.length > 2) {
      const segmentNearest = getNearestPointOnLine(point, points[points.length-1], points[0]);
      const distance = calculateDistance(point, segmentNearest);
      
      if (distance < nearestDistance) {
        nearestPoint = segmentNearest;
      }
    }
    
    return nearestPoint;
  }

  dispose(): void {
    // Nothing to dispose
  }

  getStats(): {
    nearestCalculations: number;
  } {
    return {
      nearestCalculations: 0 // Could add metrics
    };
  }
}