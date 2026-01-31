/**
 * Extension Snap Engine
 * Υπεύθυνο για εύρεση snap points σε επεκτάσεις γραμμών
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import type { PolylineEntity, LWPolylineEntity } from '../../types/entities';
import { ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { filterValidEntities, isWithinTolerance } from './shared/snap-engine-utils';
import { CoordinateUtils } from '../../systems/constraints/utils';
import { getNearestPointOnLine, getLineParameter } from '../../rendering/entities/shared/geometry-utils';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';

export class ExtensionSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.EXTENSION);
  }

  initialize(entities: EntityModel[]): void {

  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const priority = 5; // Medium priority
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.EXTENSION);
    
    const candidates = this.processCandidateLoop(
      context.entities,
      context,
      cursorPoint,
      priority,
      (entity) => this.getExtensionPoints(entity as EntityModel, cursorPoint, radius * 2), // ✅ ENTERPRISE FIX: Type casting
      (type) => `Extension (${type})`
    );

    return { candidates };
  }

  private getExtensionPoints(entity: EntityModel, cursorPoint: Point2D, maxExtensionDistance: number): Array<{point: Point2D, type: string}> {
    const extensionPoints: Array<{point: Point2D, type: string}> = [];
    const entityType = entity.type.toLowerCase();
    
    if (entityType === 'line') {
      if ('start' in entity && 'end' in entity && entity.start && entity.end) {
        const lineExtensions = this.getLineExtensions(entity.start as Point2D, entity.end as Point2D, cursorPoint, maxExtensionDistance);
        extensionPoints.push(...lineExtensions.map(p => ({point: p, type: 'Line'})));
      }
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      // 🏢 ENTERPRISE: Proper type guard for polyline entities
      const polylineEntity = entity as PolylineEntity | LWPolylineEntity;
      const points = polylineEntity.vertices;
      const isClosed = polylineEntity.closed || false;

      if (points && points.length > 1 && !isClosed) {
        // Extend first and last segments of open polylines
        const firstSegmentExtensions = this.getLineExtensions(points[0], points[1], cursorPoint, maxExtensionDistance);
        const lastSegmentExtensions = this.getLineExtensions(points[points.length-2], points[points.length-1], cursorPoint, maxExtensionDistance);
        
        extensionPoints.push(...firstSegmentExtensions.map(p => ({point: p, type: 'Polyline Start'})));
        extensionPoints.push(...lastSegmentExtensions.map(p => ({point: p, type: 'Polyline End'})));
      }
    }
    
    return extensionPoints;
  }

  private getLineExtensions(lineStart: Point2D, lineEnd: Point2D, cursorPoint: Point2D, maxDistance: number): Point2D[] {
    const extensions: Point2D[] = [];

    // Calculate line direction vector
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    // 🏢 ADR-065: Use centralized distance calculation
    const lineLength = calculateDistance(lineStart, lineEnd);
    
    if (lineLength === 0) return extensions;
    
    // Normalized direction vector
    const dirX = dx / lineLength;
    const dirY = dy / lineLength;
    
    // Determine which end is closer to cursor for intelligent extension
    const distToStart = calculateDistance(cursorPoint, lineStart);
    const distToEnd = calculateDistance(cursorPoint, lineEnd);
    
    // Extension distances to try
    const extensionDistances = [25, 50, 100, 200, 300];
    
    for (const extDist of extensionDistances) {
      if (extDist > maxDistance) break;
      
      // Extend from start (backwards)
      const extStartPoint = {
        x: lineStart.x - dirX * extDist,
        y: lineStart.y - dirY * extDist
      };
      
      // Extend from end (forwards)
      const extEndPoint = {
        x: lineEnd.x + dirX * extDist,
        y: lineEnd.y + dirY * extDist
      };
      
      // Check if extensions are near cursor
      const distToExtStart = calculateDistance(cursorPoint, extStartPoint);
      const distToExtEnd = calculateDistance(cursorPoint, extEndPoint);
      
      if (distToExtStart <= maxDistance) {
        extensions.push(extStartPoint);
      }
      
      if (distToExtEnd <= maxDistance) {
        extensions.push(extEndPoint);
      }
    }
    
    // Also try projection of cursor onto infinite line
    const projectedPoint = CoordinateUtils.projectPointOnLine(cursorPoint, lineStart, lineEnd);
    if (projectedPoint && this.isPointBeyondLineSegment(projectedPoint, lineStart, lineEnd)) {
      const distToProjected = calculateDistance(cursorPoint, projectedPoint);
      if (distToProjected <= maxDistance) {
        extensions.push(projectedPoint);
      }
    }
    
    return extensions;
  }

  private isPointBeyondLineSegment(point: Point2D, lineStart: Point2D, lineEnd: Point2D): boolean {
    // Check if point is beyond the line segment (extension)
    // Use shared geometry utils for consistency
    const distance = pointToLineDistance(point, lineStart, lineEnd);
    
    // Calculate parameter to check if beyond segment using shared utility
    const param = getLineParameter(point, lineStart, lineEnd);
    
    // Point is beyond if param < 0 or param > 1
    return param < 0 || param > 1;
  }

  dispose(): void {
    // Nothing to dispose
  }

  getStats(): {
    extensionChecks: number;
  } {
    return {
      extensionChecks: 0 // Could add metrics
    };
  }
}