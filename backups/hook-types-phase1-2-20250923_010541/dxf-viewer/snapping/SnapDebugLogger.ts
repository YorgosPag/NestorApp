/**
 * SnapDebugLogger
 * Debug logging and statistics for snap engine
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SNAP_DEBUG_LOGGER = false;

import type { Point2D, Entity } from './extended-types';
import type { SnapEngineCore } from './SnapEngineCore';

export class SnapDebugLogger {
  private lastCursorPosition: Point2D | null = null;
  private lastLogTime = 0;

  constructor(private engine: SnapEngineCore) {}

  logInitialization(entities: Entity[]): void {
    // Guard against non-iterable entities
    if (!Array.isArray(entities)) {
      if (DEBUG_SNAP_DEBUG_LOGGER) console.warn('[SnapDebugLogger] entities is not an array:', typeof entities, entities);
      return;
    }

    // Debug logging για rectangle entities
    const rectangleEntities = entities.filter(e => e.type.toLowerCase() === 'rectangle');
    if (rectangleEntities.length > 0) {
      if (DEBUG_SNAP_DEBUG_LOGGER) console.log('🟦 ProSnapEngineV2: Found rectangle entities:', rectangleEntities.length);
      rectangleEntities.slice(0, 2).forEach((entity, i) => {
        if (DEBUG_SNAP_DEBUG_LOGGER) console.log(`🟦 Rectangle ${i}:`, {
          id: entity.id,
          type: entity.type,
          corner1: (entity as any).corner1,
          corner2: (entity as any).corner2,
          visible: entity.visible
        });
      });
    } else {
      if (DEBUG_SNAP_DEBUG_LOGGER) console.log('🟦 ProSnapEngineV2: No rectangle entities found in', entities.length, 'total entities');

      // Log entity types για debug
      const entityTypes = entities.reduce((types, entity) => {
        types[entity.type] = (types[entity.type] || 0) + 1;
        return types;
      }, {} as Record<string, number>);
      if (DEBUG_SNAP_DEBUG_LOGGER) console.log('🟦 Available entity types:', entityTypes);

      // Log polylines info
      const polylines = entities.filter(e => e.type.toLowerCase() === 'polyline');
      if (polylines.length > 0) {
        if (DEBUG_SNAP_DEBUG_LOGGER) console.log('🟦 Polylines found:', polylines.length);
        polylines.slice(0, 2).forEach((entity, i) => {
          const vertices = (entity as any).vertices;
          const closed = (entity as any).closed;
          if (DEBUG_SNAP_DEBUG_LOGGER) console.log(`🟦 Polyline ${i}:`, {
            id: entity.id,
            verticesCount: vertices?.length || 0,
            closed,
            vertices: vertices?.slice(0, 2) // Show first 2 vertices
          });
        });
      }
    }
  }

  logFindSnapPoint(cursorPoint: Point2D): void {
    this.lastCursorPosition = cursorPoint;
    
    // Minimal logging for debugging
    const now = Date.now();
    if (now - this.lastLogTime > 500) { // Log every 500ms
      this.logDebugInfo(cursorPoint);
      this.lastLogTime = now;
    }

    // Debug logging only occasionally
    if (now - this.lastLogTime > 2000) {
      const settings = this.engine.getSettings();
      if (DEBUG_SNAP_DEBUG_LOGGER) console.log('🎯 ProSnapEngineV2: findSnapPoint called', {
        cursorPoint,
        enabled: settings.enabled,
        enabledTypes: Array.from(settings.enabledTypes)
      });
    }
  }

  logSnapResult(result: any): void {
    // Debug log snap results
    if (result.found && result.snapPoint) {
      if (DEBUG_SNAP_DEBUG_LOGGER) console.log('✅ ProSnapEngineV2: Snap found!', {
        type: result.snapPoint.type,
        description: result.snapPoint.description,
        distance: result.snapPoint.distance,
        point: result.snapPoint.point
      });
    }
  }

  logViewportSet(hasViewport: boolean): void {
    if (DEBUG_SNAP_DEBUG_LOGGER) console.log('🎯 ProSnapEngineV2: setViewport called', hasViewport);
  }

  getStats(): any {
    const orchestratorStats = this.engine.getOrchestrator().getStats();
    const settings = this.engine.getSettings();
    const viewport = this.engine.getViewport();
    
    return {
      version: '2.0.0',
      architecture: 'modular',
      settings: {
        enabled: settings.enabled,
        snapDistance: settings.snapDistance,
        enabledTypes: Array.from(settings.enabledTypes),
        showSnapMarkers: settings.showSnapMarkers,
        showSnapTooltips: settings.showSnapTooltips,
        autoMode: settings.autoMode,
        tabCycling: settings.tabCycling
      },
      orchestrator: orchestratorStats,
      performance: {
        lastCursorPosition: this.lastCursorPosition,
        viewport: {
          hasViewport: !!viewport,
          scale: viewport?.scale ?? null
        }
      }
    };
  }

  private logDebugInfo(cursorPoint: Point2D): void {
    if (process.env.NODE_ENV === 'development') {
      const stats = this.getStats();
      if (DEBUG_SNAP_DEBUG_LOGGER) console.debug('[ProSnapEngineV2] Debug Info:', {
        cursor: cursorPoint,
        enabledTypes: stats.settings.enabledTypes,
        totalEntities: stats.orchestrator.totalEntities
      });
    }
  }

  dispose(): void {
    this.lastCursorPosition = null;
  }
}