/**
 * Smart Bounds Manager - Intelligent fit-to-view με bounds tracking
 * Κάνει fitToView() μόνο όταν αλλάζουν τα bounds, όχι σε κάθε setScene
 */

import { dlog, dwarn } from './OptimizedLogger';
import { calculateLineBounds } from './renderers/shared/geometry-rendering-utils';

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

interface Entity {
  id: string;
  type: string;
  [key: string]: any;
}

interface Scene {
  entities: Entity[];
  version?: number;
  [key: string]: any;
}

export class SmartBoundsManager {
  private lastBoundsHash: string | null = null;
  private lastBounds: BoundingBox | null = null;
  private sceneBoundsVersion = 0;
  private pendingFitToView = false;
  private rafId: number | null = null;

  static getCircleBounds(center: Point2D, radius: number) {
    return {
      minX: center.x - radius,
      minY: center.y - radius,
      maxX: center.x + radius,
      maxY: center.y + radius,
    };
  }

  constructor() {
    dlog('�� SmartBoundsManager created');
  }

  // ═══ BOUNDS CALCULATION ═══

  calculateSceneBounds(scene: Scene): BoundingBox | null {
    if (!scene?.entities || scene.entities.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasValidBounds = false;

    for (const entity of scene.entities) {
      try {
        const entityBounds = this.getEntityBounds(entity);
        if (entityBounds) {
          minX = Math.min(minX, entityBounds.minX);
          minY = Math.min(minY, entityBounds.minY);
          maxX = Math.max(maxX, entityBounds.maxX);
          maxY = Math.max(maxY, entityBounds.maxY);
          hasValidBounds = true;
        }
      } catch (error) {
        dwarn('Error calculating bounds for entity:', entity.id, error);
      }
    }

    if (!hasValidBounds) {
      return null;
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private getEntityBounds(entity: Entity): BoundingBox | null {
    switch (entity.type) {
      case 'line':
        if (entity.start && entity.end) {
          const bounds = calculateLineBounds(entity.start, entity.end);
          return {
            ...bounds,
            width: Math.abs(entity.end.x - entity.start.x),
            height: Math.abs(entity.end.y - entity.start.y)
          };
        }
        break;

      case 'circle':
        if (entity.center && entity.radius) {
          const bounds = SmartBoundsManager.getCircleBounds(entity.center, entity.radius);
          return {
            ...bounds,
            width: entity.radius * 2,
            height: entity.radius * 2
          };
        }
        break;

      case 'arc':
        if (entity.center && entity.radius) {
          // Simplified: use full circle bounds για τώρα
          return {
            minX: entity.center.x - entity.radius,
            minY: entity.center.y - entity.radius,
            maxX: entity.center.x + entity.radius,
            maxY: entity.center.y + entity.radius,
            width: entity.radius * 2,
            height: entity.radius * 2
          };
        }
        break;

      case 'polyline':
        if (entity.vertices && entity.vertices.length > 0) {
          let minX = Infinity, minY = Infinity;
          let maxX = -Infinity, maxY = -Infinity;

          for (const vertex of entity.vertices) {
            if (vertex.x != null && vertex.y != null) {
              minX = Math.min(minX, vertex.x);
              minY = Math.min(minY, vertex.y);
              maxX = Math.max(maxX, vertex.x);
              maxY = Math.max(maxY, vertex.y);
            }
          }

          if (minX !== Infinity) {
            return {
              minX, minY, maxX, maxY,
              width: maxX - minX,
              height: maxY - minY
            };
          }
        }
        break;

      default:
        // Generic fallback για unknown entity types
        if (entity.bounds) {
          return entity.bounds;
        }
    }

    return null;
  }

  // ═══ BOUNDS TRACKING ═══

  generateBoundsHash(bounds: BoundingBox): string {
    // Precision to avoid micro-differences
    const precision = 100; // 2 decimal places
    return [
      Math.round(bounds.minX * precision),
      Math.round(bounds.minY * precision),
      Math.round(bounds.maxX * precision),
      Math.round(bounds.maxY * precision)
    ].join('_');
  }

  boundsChanged(scene: Scene): boolean {
    const currentBounds = this.calculateSceneBounds(scene);
    
    if (!currentBounds && !this.lastBounds) {
      return false; // Both null, no change
    }
    
    if (!currentBounds || !this.lastBounds) {
      return true; // One is null, the other isn't
    }

    const currentHash = this.generateBoundsHash(currentBounds);
    const boundsChanged = currentHash !== this.lastBoundsHash;

    if (boundsChanged) {
      this.lastBounds = currentBounds;
      this.lastBoundsHash = currentHash;
      this.sceneBoundsVersion++;
      dlog('🎯 Scene bounds changed:', currentHash, '(v' + this.sceneBoundsVersion + ')');
    }

    return boundsChanged;
  }

  // ═══ SMART FIT-TO-VIEW ═══

  shouldFitToView(scene: Scene, force = false): boolean {
    if (force) {
      dlog('�� Forced fit-to-view requested');
      return true;
    }

    return this.boundsChanged(scene);
  }

  requestFitToView(renderer: any, scene: Scene, force = false): void {
    if (!this.shouldFitToView(scene, force)) {
      dlog('🎯 Skipping fit-to-view - bounds unchanged');
      return;
    }

    // Cancel any pending fit-to-view
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.pendingFitToView) {
      dlog('🎯 Fit-to-view already pending');
      return;
    }

    this.pendingFitToView = true;

    // Schedule after next paint για σωστό timing
    this.rafId = requestAnimationFrame(() => {
      this.rafId = requestAnimationFrame(() => {
        try {
          if (renderer && typeof renderer.fitToView === 'function') {
            renderer.fitToView();
            dlog('�� Fit-to-view executed (bounds v' + this.sceneBoundsVersion + ')');
          } else {
            dwarn('Renderer does not have fitToView method');
          }
        } catch (error) {
          dwarn('Error in fit-to-view:', error);
        } finally {
          this.pendingFitToView = false;
          this.rafId = null;
        }
      });
    });
  }

  // ═══ IMMEDIATE FIT-TO-VIEW (για import) ═══

  fitToViewImmediate(renderer: any, scene: Scene): void {
    try {
      // Force bounds calculation
      this.boundsChanged(scene);
      
      if (renderer && typeof renderer.fitToView === 'function') {
        renderer.fitToView();
        dlog('🎯 Immediate fit-to-view executed');
      }
    } catch (error) {
      dwarn('Error in immediate fit-to-view:', error);
    }
  }

  // ═══ STATUS & DEBUG ═══

  getStats() {
    return {
      sceneBoundsVersion: this.sceneBoundsVersion,
      lastBoundsHash: this.lastBoundsHash?.slice(0, 8) || 'none',
      pendingFitToView: this.pendingFitToView,
      lastBounds: this.lastBounds ? {
        width: this.lastBounds.width.toFixed(1),
        height: this.lastBounds.height.toFixed(1)
      } : null
    };
  }

  reset(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    this.lastBoundsHash = null;
    this.lastBounds = null;
    this.sceneBoundsVersion = 0;
    this.pendingFitToView = false;
    
    dlog('🎯 SmartBoundsManager reset');
  }

  dispose(): void {
    this.reset();
    dlog('🎯 SmartBoundsManager disposed');
  }
}

// ═══ SINGLETON INSTANCE ═══
export const smartBoundsManager = new SmartBoundsManager();

// ═══ CONVENIENCE FUNCTIONS ═══

export function shouldFitToView(scene: Scene, force = false): boolean {
  return smartBoundsManager.shouldFitToView(scene, force);
}

export function requestSmartFitToView(renderer: any, scene: Scene, force = false): void {
  smartBoundsManager.requestFitToView(renderer, scene, force);
}

export function fitToViewOnImport(renderer: any, scene: Scene): void {
  smartBoundsManager.fitToViewImmediate(renderer, scene);
}

export function getBoundsStats() {
  return smartBoundsManager.getStats();
}
