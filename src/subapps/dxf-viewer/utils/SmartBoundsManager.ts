/**
 * Smart Bounds Manager - Intelligent fit-to-view με bounds tracking
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρησιμοποιεί FitToViewService αντί για renderer.fitToView()
 * Κάνει fitToView() μόνο όταν αλλάζουν τα bounds, όχι σε κάθε setScene
 */

import { dlog, dwarn } from '../debug';
import { calculateLineBounds } from '../rendering/entities/shared/geometry-rendering-utils';
import type { Point2D } from '../rendering/types/Types';
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Import κεντρικής υπηρεσίας αντί για renderer.fitToView()
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Import centralized BoundingBox από rulers-grid system
// 🏢 ADR-119: UnifiedFrameScheduler για centralized RAF management
import { UnifiedFrameScheduler } from '../rendering/core/UnifiedFrameScheduler';
// 🏢 ADR-158: Centralized Infinity Bounds Initialization
import { createInfinityBounds, isInfinityBounds } from '../config/geometry-constants';

// Local interface for legacy compatibility (different from centralized BoundingBox)
interface LegacyBoundingBox {
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
  start?: Point2D;
  end?: Point2D;
  center?: Point2D;
  radius?: number;
  points?: Array<Point2D>;
  [key: string]: unknown;
}

interface Scene {
  entities: Entity[];
  version?: number;
  bounds?: LegacyBoundingBox;
  [key: string]: unknown;
}

export class SmartBoundsManager {
  private lastBoundsHash: string | null = null;
  private lastBounds: LegacyBoundingBox | null = null;
  private sceneBoundsVersion = 0;
  private pendingFitToView = false;
  // 🏢 ADR-119: Cancel function from scheduleOnceDelayed (replaces raw rafId)
  private cancelScheduledFit: (() => void) | null = null;

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Helper method που χρησιμοποιεί κεντρική υπηρεσία
  private executeCentralizedFitToView(
    renderer: { fitToView?: () => void },
    scene: Scene
  ): void {
    try {
      // Προτεραιότητα: Renderer method αν υπάρχει (backwards compatibility)
      if (renderer && typeof renderer.fitToView === 'function') {
        renderer.fitToView();
        dlog('🎯 Fit-to-view executed via renderer (legacy mode)');
        return;
      }

      // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Fallback με κεντρική υπηρεσία
      // TODO: Θα χρειαστεί να περάσει viewport, scene, colorLayers από caller
      dwarn('🎯 SmartBoundsManager: Renderer lacks fitToView - need centralized service integration');

    } catch (error) {
      dwarn('SmartBoundsManager executeCentralizedFitToView error:', error);
    }
  }

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

  calculateSceneBounds(scene: Scene): LegacyBoundingBox | null {
    if (!scene?.entities || scene.entities.length === 0) {
      return null;
    }

    // 🏢 ADR-158: Centralized Infinity Bounds Initialization
    const bounds = createInfinityBounds();
    let hasValidBounds = false;

    for (const entity of scene.entities) {
      try {
        const entityBounds = this.getEntityBounds(entity);
        if (entityBounds) {
          bounds.minX = Math.min(bounds.minX, entityBounds.minX);
          bounds.minY = Math.min(bounds.minY, entityBounds.minY);
          bounds.maxX = Math.max(bounds.maxX, entityBounds.maxX);
          bounds.maxY = Math.max(bounds.maxY, entityBounds.maxY);
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
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY
    };
  }

  private getEntityBounds(entity: Entity): LegacyBoundingBox | null {
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
        if (entity.vertices && Array.isArray(entity.vertices) && entity.vertices.length > 0) {
          // 🏢 ADR-158: Centralized Infinity Bounds Initialization
          const polyBounds = createInfinityBounds();

          for (const vertex of entity.vertices) {
            if (vertex.x != null && vertex.y != null) {
              polyBounds.minX = Math.min(polyBounds.minX, vertex.x);
              polyBounds.minY = Math.min(polyBounds.minY, vertex.y);
              polyBounds.maxX = Math.max(polyBounds.maxX, vertex.x);
              polyBounds.maxY = Math.max(polyBounds.maxY, vertex.y);
            }
          }

          if (!isInfinityBounds(polyBounds)) {
            return {
              minX: polyBounds.minX,
              minY: polyBounds.minY,
              maxX: polyBounds.maxX,
              maxY: polyBounds.maxY,
              width: polyBounds.maxX - polyBounds.minX,
              height: polyBounds.maxY - polyBounds.minY
            };
          }
        }
        break;

      default:
        // Generic fallback για unknown entity types
        if (entity.bounds && typeof entity.bounds === 'object') {
          // 🏢 ENTERPRISE: Type-safe bounds extraction with validation
          const bounds = entity.bounds as Record<string, unknown>;
          if (typeof bounds.minX === 'number' && typeof bounds.maxX === 'number' &&
              typeof bounds.minY === 'number' && typeof bounds.maxY === 'number') {
            return bounds as unknown as LegacyBoundingBox;
          }
        }
    }

    return null;
  }

  // ═══ BOUNDS TRACKING ═══

  generateBoundsHash(bounds: LegacyBoundingBox): string {
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
      dlog('🔺 Scene bounds changed:', currentHash, '(v' + this.sceneBoundsVersion + ')');
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

  requestFitToView(renderer: { fitToView?: () => void }, scene: Scene, force = false): void {
    if (!this.shouldFitToView(scene, force)) {
      dlog('🔺 Skipping fit-to-view - bounds unchanged');
      return;
    }

    // 🏢 ADR-119: Cancel any pending fit-to-view via UnifiedFrameScheduler
    if (this.cancelScheduledFit) {
      this.cancelScheduledFit();
      this.cancelScheduledFit = null;
    }

    if (this.pendingFitToView) {
      dlog('🔺 Fit-to-view already pending');
      return;
    }

    this.pendingFitToView = true;

    // 🏢 ADR-119: Use UnifiedFrameScheduler.scheduleOnceDelayed for RAF coordination
    // Pattern: RAF → setTimeout(0) → RAF ensures layout is stable before fit
    this.cancelScheduledFit = UnifiedFrameScheduler.scheduleOnceDelayed(
      'smart-bounds-fit-to-view',
      () => {
        try {
          // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση κεντρικοποιημένης μεθόδου
          this.executeCentralizedFitToView(renderer, scene);
          dlog('🎯 Fit-to-view executed (bounds v' + this.sceneBoundsVersion + ')');
        } catch (error) {
          dwarn('Error in fit-to-view:', error);
        } finally {
          this.pendingFitToView = false;
          this.cancelScheduledFit = null;
        }
      },
      0 // Minimal delay - just need double-RAF pattern
    );
  }

  // ═══ IMMEDIATE FIT-TO-VIEW (για import) ═══

  fitToViewImmediate(renderer: { fitToView?: () => void }, scene: Scene): void {
    try {
      // Force bounds calculation
      this.boundsChanged(scene);
      
      // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση κεντρικοποιημένης μεθόδου
      this.executeCentralizedFitToView(renderer, scene);
      dlog('🎯 Immediate fit-to-view executed');
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
    // 🏢 ADR-119: Cancel via UnifiedFrameScheduler cancel function
    if (this.cancelScheduledFit) {
      this.cancelScheduledFit();
      this.cancelScheduledFit = null;
    }

    this.lastBoundsHash = null;
    this.lastBounds = null;
    this.sceneBoundsVersion = 0;
    this.pendingFitToView = false;

    dlog('🔺 SmartBoundsManager reset');
  }

  dispose(): void {
    this.reset();
    dlog('🔺 SmartBoundsManager disposed');
  }
}

// ═══ SINGLETON INSTANCE ═══
export const smartBoundsManager = new SmartBoundsManager();

// ═══ CONVENIENCE FUNCTIONS ═══

export function shouldFitToView(scene: Scene, force = false): boolean {
  return smartBoundsManager.shouldFitToView(scene, force);
}

export function requestSmartFitToView(renderer: { fitToView?: () => void }, scene: Scene, force = false): void {
  smartBoundsManager.requestFitToView(renderer, scene, force);
}

export function fitToViewOnImport(renderer: { fitToView?: () => void }, scene: Scene): void {
  smartBoundsManager.fitToViewImmediate(renderer, scene);
}

export function getBoundsStats() {
  return smartBoundsManager.getStats();
}
