/**
 * Spatial Index για γρήγορη αναζήτηση nearby entities
 * Χρησιμοποιεί grid-based indexing για βελτιστοποιημένες αναζητήσεις
 */

import { Point2D, Entity } from '../extended-types';

export interface EndpointReference {
  point: Point2D;
  entity: Entity;
}

export interface MidpointReference {
  point: Point2D;
  entity: Entity;
}

export interface CenterReference {
  point: Point2D;
  entity: Entity;
}

export class SpatialIndex {
  private gridSize = 100;
  private endpointIndex = new Map<string, EndpointReference[]>();
  private midpointIndex = new Map<string, MidpointReference[]>();
  private centerIndex = new Map<string, CenterReference[]>();

  // --------- INDEXING METHODS ---------

  buildEndpointIndex(entities: Entity[], getEndpoints: (entity: Entity) => Point2D[]): void {
    this.endpointIndex.clear();
    
    for (const entity of entities) {
      if (!entity.visible) continue;
      
      const endpoints = getEndpoints(entity);
      for (const endpoint of endpoints) {
        const key = this.getGridKey(endpoint);
        const existing = this.endpointIndex.get(key);
        if (existing) {
          existing.push({ point: endpoint, entity });
        } else {
          this.endpointIndex.set(key, [{ point: endpoint, entity }]);
        }
      }
    }
  }

  buildMidpointIndex(entities: Entity[], getMidpoints: (entity: Entity) => Point2D[]): void {
    this.midpointIndex.clear();
    
    for (const entity of entities) {
      if (!entity.visible) continue;
      
      const midpoints = getMidpoints(entity);
      for (const midpoint of midpoints) {
        const key = this.getGridKey(midpoint);
        const existing = this.midpointIndex.get(key);
        if (existing) {
          existing.push({ point: midpoint, entity });
        } else {
          this.midpointIndex.set(key, [{ point: midpoint, entity }]);
        }
      }
    }
  }

  buildCenterIndex(entities: Entity[], getCenter: (entity: Entity) => Point2D | null): void {
    this.centerIndex.clear();
    
    for (const entity of entities) {
      if (!entity.visible) continue;
      
      const center = getCenter(entity);
      if (center) {
        const key = this.getGridKey(center);
        const existing = this.centerIndex.get(key);
        if (existing) {
          existing.push({ point: center, entity });
        } else {
          this.centerIndex.set(key, [{ point: center, entity }]);
        }
      }
    }
  }

  // --------- QUERY METHODS ---------

  queryNearbyEndpoints(center: Point2D, radius: number): EndpointReference[] {
    return this.queryNearby(center, radius, this.endpointIndex);
  }

  queryNearbyMidpoints(center: Point2D, radius: number): MidpointReference[] {
    return this.queryNearby(center, radius, this.midpointIndex);
  }

  queryNearbyCenters(center: Point2D, radius: number): CenterReference[] {
    return this.queryNearby(center, radius, this.centerIndex);
  }

  getNearbyEntitiesForIntersection(center: Point2D, radius: number, entities: Entity[], isEntityNear: (entity: Entity, point: Point2D, radius: number) => boolean, excludeEntityId?: string): Entity[] {
    const nearby: Entity[] = [];
    
    for (const entity of entities) {
      if (excludeEntityId && entity.id === excludeEntityId) continue;
      if (!entity.visible) continue;
      
      if (isEntityNear(entity, center, radius)) {
        nearby.push(entity);
      }
    }
    
    return nearby;
  }

  // --------- PRIVATE HELPERS ---------

  private getGridKey(point: Point2D): string {
    const x = Math.floor(point.x / this.gridSize);
    const y = Math.floor(point.y / this.gridSize);
    return `${x},${y}`;
  }

  private queryNearby<T extends { point: Point2D; entity: Entity }>(
    center: Point2D, 
    radius: number, 
    index: Map<string, T[]>
  ): T[] {
    const results: T[] = [];
    const radiusSq = radius * radius;
    
    // Υπολογισμός των grid cells που καλύπτονται από τον κύκλο
    const minX = Math.floor((center.x - radius) / this.gridSize);
    const maxX = Math.floor((center.x + radius) / this.gridSize);
    const minY = Math.floor((center.y - radius) / this.gridSize);
    const maxY = Math.floor((center.y + radius) / this.gridSize);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        const cellEntries = index.get(key);
        
        if (cellEntries) {
          for (const entry of cellEntries) {
            const dx = entry.point.x - center.x;
            const dy = entry.point.y - center.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq <= radiusSq) {
              results.push(entry);
            }
          }
        }
      }
    }
    
    return results;
  }

  // --------- UTILITY METHODS ---------

  clear(): void {
    this.endpointIndex.clear();
    this.midpointIndex.clear();
    this.centerIndex.clear();
  }

  getStats(): {
    endpointCount: number;
    midpointCount: number;
    centerCount: number;
    gridCells: number;
  } {
    let endpointCount = 0;
    let midpointCount = 0;
    let centerCount = 0;
    
    this.endpointIndex.forEach(refs => {
      endpointCount += refs.length;
    });
    
    this.midpointIndex.forEach(refs => {
      midpointCount += refs.length;
    });
    
    this.centerIndex.forEach(refs => {
      centerCount += refs.length;
    });
    
    const totalGridCells = this.endpointIndex.size + this.midpointIndex.size + this.centerIndex.size;
    
    return {
      endpointCount,
      midpointCount,
      centerCount,
      gridCells: totalGridCells
    };
  }
}