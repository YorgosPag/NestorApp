/**
 * Extension Snap Engine
 * Υπεύθυνο για εύρεση snap points σε επεκτάσεις γραμμών
 */

import { Point2D, Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { filterValidEntities, isWithinTolerance } from './shared/snap-engine-utils';
import { CoordinateUtils } from '../../systems/constraints/utils';
import { getNearestPointOnLine, getLineParameter } from '../../utils/geometry-utils';
import { pointToLineDistance } from '../../utils/geometry-utils';

export class ExtensionSnapEngine extends BaseSnapEngine {

  constructor() {
    super(ExtendedSnapType.EXTENSION);
  }

  initialize(entities: Entity[]): void {
    console.log('🎯 ExtensionSnapEngine: Initialize with', entities.length, 'entities');
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const priority = 5; // Medium priority
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.EXTENSION);
    
    const candidates = this.processCandidateLoop(
      context.entities,
      context,
      cursorPoint,
      priority,
      (entity) => this.getExtensionPoints(entity, cursorPoint, radius * 2),
      (type) => `Extension (${type})`
    );

    return { candidates };
  }

  private getExtensionPoints(entity: Entity, cursorPoint: Point2D, maxExtensionDistance: number): Array<{point: Point2D, type: string}> {
    const extensionPoints: Array<{point: Point2D, type: string}> = [];
    const entityType = entity.type.toLowerCase();
    
    if (entityType === 'line') {
      if (entity.start && entity.end) {
        const lineExtensions = this.getLineExtensions(entity.start, entity.end, cursorPoint, maxExtensionDistance);
        extensionPoints.push(...lineExtensions.map(p => ({point: p, type: 'Line'})));
      }
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      const points = entity.points || (entity as any).vertices;
      const isClosed = (entity as any).closed;
      
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
    const lineLength = Math.sqrt(dx * dx + dy * dy);
    
    if (lineLength === 0) return extensions;
    
    // Normalized direction vector
    const dirX = dx / lineLength;
    const dirY = dy / lineLength;
    
    // Determine which end is closer to cursor for intelligent extension
    const distToStart = GeometricCalculations.calculateDistance(cursorPoint, lineStart);
    const distToEnd = GeometricCalculations.calculateDistance(cursorPoint, lineEnd);
    
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
      const distToExtStart = GeometricCalculations.calculateDistance(cursorPoint, extStartPoint);
      const distToExtEnd = GeometricCalculations.calculateDistance(cursorPoint, extEndPoint);
      
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
      const distToProjected = GeometricCalculations.calculateDistance(cursorPoint, projectedPoint);
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