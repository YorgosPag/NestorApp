/**
 * SnapDebugLogger
 * Debug logging and statistics for snap engine
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SNAP_DEBUG_LOGGER = false;

import type { Point2D } from '../../rendering/types/Types';
import type { Entity, ProSnapResult, SnapEngineStats } from '../../snapping/extended-types';
import type { SnapEngineCore } from '../../snapping/SnapEngineCore';

// Extended entity interfaces for proper typing
interface PolylineEntity extends Entity {
  vertices?: Point2D[];
  closed?: boolean;
}

interface RectangleEntity extends Entity {
  corner1?: Point2D;
  corner2?: Point2D;
}

interface SnapDebugStats {
  version: string;
  architecture: string;
  settings: {
    enabled: boolean;
    snapDistance: number;
    enabledTypes: string[];
    showSnapMarkers: boolean;
    showSnapTooltips: boolean;
    autoMode: boolean;
    tabCycling: boolean;
  };
  orchestrator: SnapEngineStats;
  performance: {
    lastCursorPosition: Point2D | null;
    viewport: {
      hasViewport: boolean;
      scale: number | null;
    };
  };
}

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

      rectangleEntities.slice(0, 2).forEach((entity, i) => {

      });
    } else {

      // Log entity types για debug
      const entityTypes = entities.reduce((types, entity) => {
        types[entity.type] = (types[entity.type] || 0) + 1;
        return types;
      }, {} as Record<string, number>);

      // Log polylines info
      const polylines = entities.filter(e => e.type.toLowerCase() === 'polyline');
      if (polylines.length > 0) {

        polylines.slice(0, 2).forEach((entity, i) => {
          const polylineEntity = entity as PolylineEntity;
          const vertices = polylineEntity.vertices;
          const closed = polylineEntity.closed;

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

    }
  }

  logSnapResult(result: ProSnapResult): void {
    // Debug log snap results
    if (result.found && result.snapPoint) {

    }
  }

  logViewportSet(hasViewport: boolean): void {

  }

  getStats(): SnapDebugStats {
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