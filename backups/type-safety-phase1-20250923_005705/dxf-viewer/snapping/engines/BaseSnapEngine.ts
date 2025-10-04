import type { Point2D } from '../../systems/rulers-grid/config';
import type { EntityModel } from '../../types';
import { calculateDistance } from '../../utils/renderers/shared/geometry-rendering-utils';

export interface SnapResult {
  point: Point2D;
  distance: number;
  snapType: string;
}

export abstract class BaseSnapEngine {
  protected transform: { scale: number } = { scale: 1 };
  
  setTransform(transform: { scale: number }) {
    this.transform = transform;
  }

  abstract snap(mousePoint: Point2D, entities: EntityModel[], tolerance: number): SnapResult | null;
  
  protected calculateDistance(p1: Point2D, p2: Point2D): number {
    return calculateDistance(p1, p2); // Use shared utility
  }

  protected worldToScreen(point: Point2D): Point2D {
    return {
      x: point.x * this.transform.scale,
      y: point.y * this.transform.scale
    };
  }

  protected screenToWorld(point: Point2D): Point2D {
    return {
      x: point.x / this.transform.scale,
      y: point.y / this.transform.scale
    };
  }

  protected isPointNearEntity(point: Point2D, entity: EntityModel, tolerance: number): boolean {
    // Basic implementation - can be overridden
    if (!entity.vertices && !entity.start && !entity.center) return false;
    
    const vertices = entity.vertices as Point2D[] || 
      (entity.start && entity.end ? [entity.start, entity.end] : []) ||
      (entity.center ? [entity.center] : []);
      
    return vertices.some(vertex => 
      this.calculateDistance(point, vertex) <= tolerance
    );
  }

  protected getEntityVertices(entity: EntityModel): Point2D[] {
    if (entity.vertices) return entity.vertices as Point2D[];
    if (entity.start && entity.end) return [entity.start, entity.end];
    if (entity.center) return [entity.center];
    return [];
  }
}