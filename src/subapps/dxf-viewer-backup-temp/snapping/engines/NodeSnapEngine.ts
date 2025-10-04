/**
 * Node Snap Engine
 * Υπεύθυνο για εύρεση snap points σε κόμβους (endpoints, vertices, centers)
 */

import type { Point2D } from '../../rendering/types/Types';
import { Entity, ExtendedSnapType } from '../extended-types';
import { BaseSnapEngine, SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { SpatialFactory } from '../../core/spatial';
import type { ISpatialIndex, SpatialBounds } from '../../core/spatial';
import { GeometricCalculations } from '../shared/GeometricCalculations';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { processRectangleSnapping } from './shared/snap-engine-utils';

export class NodeSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.NODE);
  }

  initialize(entities: Entity[]): void {

    // Build index with all significant nodes (endpoints, vertices, centers)
    this.spatialIndex.buildNodeIndex(
      entities,
      this.getAllNodePoints.bind(this)
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const candidates: SnapCandidate[] = [];
    const priority = 1; // Very high priority for nodes
    
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.NODE);
    
    // Get nearby nodes from spatial index
    const nearbyNodes = this.spatialIndex.getNearbyNodes(cursorPoint, radius);
    
    for (const node of nearbyNodes) {
      if (context.excludeEntityId && node.entityId === context.excludeEntityId) continue;
      
      const distance = calculateDistance(cursorPoint, node.point);
      
      if (distance <= radius) {
        const candidate = this.createCandidate(
          node.point,
          `Node (${node.type})`,
          distance,
          priority,
          node.entityId
        );
        
        candidates.push(candidate);
        
        if (candidates.length >= context.maxCandidates) break;
      }
    }

    return { candidates };
  }

  private getAllNodePoints(entity: Entity): Array<{point: Point2D, type: string}> {
    const nodes: Array<{point: Point2D, type: string}> = [];
    const entityType = entity.type.toLowerCase();
    
    if (entityType === 'line') {
      if (entity.start) nodes.push({point: entity.start, type: 'Start'});
      if (entity.end) nodes.push({point: entity.end, type: 'End'});
      
    } else if (entityType === 'circle') {
      if (entity.center) nodes.push({point: entity.center, type: 'Center'});
      
    } else if (entityType === 'arc') {
      if (entity.center) nodes.push({point: entity.center, type: 'Center'});
      
      // Arc endpoints
      if (entity.center && entity.radius && entity.startAngle !== undefined && entity.endAngle !== undefined) {
        const startPoint = {
          x: entity.center.x + entity.radius * Math.cos(entity.startAngle),
          y: entity.center.y + entity.radius * Math.sin(entity.startAngle)
        };
        const endPoint = {
          x: entity.center.x + entity.radius * Math.cos(entity.endAngle),
          y: entity.center.y + entity.radius * Math.sin(entity.endAngle)
        };
        nodes.push({point: startPoint, type: 'Arc Start'});
        nodes.push({point: endPoint, type: 'Arc End'});
      }
      
    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      const points = entity.points || ('vertices' in entity ? entity.vertices : undefined);
      const isClosed = 'closed' in entity ? entity.closed : false;
      
      if (points) {
        // All vertices are nodes
        points.forEach((point: Point2D, index: number) => {
          const nodeType = isClosed ? `Vertex ${index + 1}` : 
                          index === 0 ? 'Start' : 
                          index === points.length - 1 ? 'End' : 
                          `Vertex ${index + 1}`;
          nodes.push({point, type: nodeType});
        });
        
        // Add center for closed 4-vertex polylines (rectangles)
        if (isClosed && points.length === 4) {
          const center = {
            x: (points[0].x + points[1].x + points[2].x + points[3].x) / 4,
            y: (points[0].y + points[1].y + points[2].y + points[3].y) / 4
          };
          nodes.push({point: center, type: 'Center'});
        }
      }
      
    } else if (entityType === 'rectangle') {
      const rectEntity = entity as { corner1?: Point2D; corner2?: Point2D };
      processRectangleSnapping(rectEntity, (corner, index, type) => {
        nodes.push({point: corner, type});
      });
        
      // Rectangle center
      const center = {
        x: (rectEntity.corner1.x + rectEntity.corner2.x) / 2,
        y: (rectEntity.corner1.y + rectEntity.corner2.y) / 2
      };
      nodes.push({point: center, type: 'Center'});
      
    } else if (entityType === 'point') {
      if ('position' in entity && entity.position) {
        nodes.push({point: entity.position as Point2D, type: 'Point'});
      }
    }
    
    return nodes;
  }

  dispose(): void {
    this.spatialIndex.clear();
  }

  getStats(): {
    nodeCount: number;
    nodeChecks: number;
  } {
    return {
      nodeCount: this.spatialIndex.getNodeCount(),
      nodeChecks: 0 // Could add metrics
    };
  }
}