/**
 * Node Snap Engine
 * Υπεύθυνο για εύρεση snap points σε κόμβους (endpoints, vertices, centers)
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import type { SnapEngineContext, SnapEngineResult } from '../shared/BaseSnapEngine';
import { BaseSnapEngine } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import { pointOnCircle } from '../../rendering/entities/shared/geometry-rendering-utils';
import { processRectangleSnapping } from './shared/snap-engine-utils';
// 🏢 ADR-149: Centralized Snap Engine Priorities
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';

export class NodeSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.NODE);
  }

  initialize(entities: EntityModel[]): void {
    // ✅ CENTRALIZED: Use base class method for spatial index initialization
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      (entity) => this.getAllNodePoints(entity).map(n => n.point),
      'node'
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) {
      return { candidates: [] };
    }

    const candidates: SnapCandidate[] = [];
    // 🏢 ADR-149: Use centralized snap engine priorities
    const priority = SNAP_ENGINE_PRIORITIES.NODE;

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.NODE);

    // Query nodes using standard spatial query
    const nearbyNodes = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, 'endpoint')
    );

    for (const result of nearbyNodes) {
      const { point, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      const distance = result.distance;

      if (distance <= radius) {
        const candidate = this.createCandidate(
          point,
          `Node`,
          distance,
          priority,
          entity.id
        );
        
        candidates.push(candidate);
        
        if (candidates.length >= context.maxCandidates) break;
      }
    }

    return { candidates };
  }

  private getAllNodePoints(entity: EntityModel): Array<{point: Point2D, type: string}> {
    const nodes: Array<{point: Point2D, type: string}> = [];
    const entityType = entity.type.toLowerCase();

    // ✅ ENTERPRISE PATTERN: Type guards instead of 'as any'
    if (entityType === 'line') {
      if ('start' in entity && entity.start) {
        nodes.push({point: entity.start as Point2D, type: 'Start'});
      }
      if ('end' in entity && entity.end) {
        nodes.push({point: entity.end as Point2D, type: 'End'});
      }

    } else if (entityType === 'circle') {
      if ('center' in entity && entity.center) {
        nodes.push({point: entity.center as Point2D, type: 'Center'});
      }

    } else if (entityType === 'arc') {
      if ('center' in entity && entity.center) {
        nodes.push({point: entity.center as Point2D, type: 'Center'});
      }

      // Arc endpoints - Type guard pattern για arc properties
      if ('center' in entity && 'radius' in entity && 'startAngle' in entity && 'endAngle' in entity &&
          entity.center && typeof entity.radius === 'number' &&
          typeof entity.startAngle === 'number' && typeof entity.endAngle === 'number') {
        const center = entity.center as Point2D;
        const radius = entity.radius as number;
        const startAngle = entity.startAngle as number;
        const endAngle = entity.endAngle as number;

        // 🏢 ADR-074: Use centralized pointOnCircle
        const startPoint = pointOnCircle(center, radius, startAngle);
        const endPoint = pointOnCircle(center, radius, endAngle);
        nodes.push({point: startPoint, type: 'Arc Start'});
        nodes.push({point: endPoint, type: 'Arc End'});
      }

    } else if (entityType === 'polyline' || entityType === 'lwpolyline') {
      // ✅ ENTERPRISE PATTERN: Type guards αντί για 'as any'
      const points = ('points' in entity ? entity.points :
                     'vertices' in entity ? entity.vertices : undefined) as Point2D[] | undefined;
      const isClosed = ('closed' in entity && typeof entity.closed === 'boolean') ? entity.closed : false;
      
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
      // ✅ ENTERPRISE PATTERN: Type guards για rectangle properties
      if ('corner1' in entity && 'corner2' in entity && entity.corner1 && entity.corner2) {
        const corner1 = entity.corner1 as Point2D;
        const corner2 = entity.corner2 as Point2D;

        // 🏢 ENTERPRISE: Create LegacyRectangleEntity with required properties
        processRectangleSnapping({ id: entity.id, type: entity.type, corner1, corner2 }, (corner, index, type) => {
          nodes.push({point: corner, type});
        });

        // Rectangle center
        const center = {
          x: (corner1.x + corner2.x) / 2,
          y: (corner1.y + corner2.y) / 2
        };
        nodes.push({point: center, type: 'Center'});
      }
      
    } else if (entityType === 'point') {
      if ('position' in entity && entity.position) {
        nodes.push({point: entity.position as Point2D, type: 'Point'});
      }
    }
    
    return nodes;
  }

  dispose(): void {
    if (this.spatialIndex) {
      this.spatialIndex.clear();
    }
  }

  getStats(): {
    nodeCount: number;
    nodeChecks: number;
  } {
    return {
      nodeCount: 0, // ✅ ENTERPRISE FIX: ISpatialIndex doesn't have getNodeCount method
      nodeChecks: 0 // Could add metrics
    };
  }
}
