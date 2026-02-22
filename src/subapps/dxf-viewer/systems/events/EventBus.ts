/**
 * Unified Event Bus - Type-safe centralized event coordination
 * Replaces scattered window.addEventListener/CustomEvent patterns
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity, SceneModel } from '../../types/scene';
import type { GridGuide, GridGroup } from '../../ai-assistant/grid-types';

// Event type definitions - centralized and type-safe
export interface DrawingEventMap {
  'dynamic-input-coordinate-submit': {
    tool: string;
    coordinates: Point2D;
    secondPoint?: Point2D;
    length?: number;
    angle?: number;
    action: string;
  };
  'overlay:canvas-click': {
    point: Point2D;
  };
  'level-panel:tool-change': string; // tool name
  'drawing:tool-activated': {
    tool: string;
    previousTool: string;
  };
  'drawing:entity-created': {
    entity: AnySceneEntity;
    tool: string;
  };
  'drawing:cancelled': {
    tool: string;
  };
  // 🏢 ENTERPRISE (2026-01-27): Drawing completion event - ADR-040 Preview Canvas Integration
  // Pattern: Autodesk AutoCAD - Command completion notification
  // Emitted when a drawing operation completes (e.g., 2nd click on line/measure-distance)
  // Consumers (PreviewCanvas) listen to clear preview immediately
  // 🔧 FIX (2026-01-31): Added entity and updatedScene to avoid stale closure issue
  'drawing:complete': {
    tool: string;
    entityId: string;
    entity?: AnySceneEntity; // The created entity
    updatedScene?: SceneModel; // The updated scene with the new entity
    levelId?: string; // The level ID where entity was added
  };
  // 🔧 PHASE 3: Additional events from DxfViewerContent
  'dxf-zoom-changed': {
    transform: {
      scale: number;
      offsetX: number;
      offsetY: number;
    };
  };
  'level-panel:layering-activate': {
    levelId: string;
    source?: string; // 'overlay-click' | 'card' | undefined
  };
  'canvas-fit-to-view': {
    source?: string; // 'middle-double-click' | 'keyboard' | 'auto' | undefined
    viewport?: { width: number; height: number };
  };
  'overlay:polygon-update': {
    regionId: string;
    newVertices: Point2D[];
  };
  'dxf.highlightByIds': {
    mode: string;
    ids: string[];
  };
  // 🎯 POLYGON DRAWING EVENTS (2026-01-24): Communication between CanvasSection and DraggableOverlayToolbar
  'overlay:draft-polygon-update': {
    pointCount: number;
    canSave: boolean; // true if >= 3 points
  };
  'overlay:save-polygon': void; // Signal to save the current draft polygon
  'overlay:cancel-polygon': void; // Signal to cancel the current draft polygon
  // 🏢 ENTERPRISE (2026-01-26): Toolbar delete command - ADR-032
  'toolbar:delete': void; // Signal to delete selected grips/overlays with undo support

  // 🏢 ADR-189: Grid & Guide System events (activated when Grid System is implemented)
  'grid:guide-added': { guide: GridGuide };
  'grid:guide-removed': { guideId: string };
  'grid:guide-moved': { guideId: string; newOffset: number };
  'grid:guide-rotated': { guideId: string; angleDeg: number };
  'grid:all-guides-rotated': { angleDeg: number; pivot: { x: number; y: number } };
  'grid:guide-group-rotated': { guideIds: readonly string[]; angleDeg: number; pivot: { x: number; y: number } };
  'grid:guides-equalized': { guideIds: readonly string[]; spacing: number };
  'grid:polar-array-created': { center: { x: number; y: number }; count: number; angleIncrement: number };
  'grid:group-created': { group: GridGroup };
  'grid:snap-toggled': { enabled: boolean };
  // 🏢 ADR-189 §4.13: Guide panel → canvas highlight communication
  'grid:guide-panel-highlight': { guideId: string | null };
  // 🏢 ADR-189 §4.13: Construction point panel → canvas highlight communication
  'grid:point-panel-highlight': { pointId: string | null };

  // 🏢 ADR-055: Entity Creation Event Bus Pattern (Enterprise Architecture)
  // Pattern: Autodesk/Bentley - Event-driven entity creation with Command History integration
  // useUnifiedDrawing emits this event - EntityCreationManager handles saving
  'entity:create-request': {
    entity: AnySceneEntity;
    toolType: string;
    requestId: string;
    targetLevelId?: string; // Optional - if not provided, uses currentLevelId
  };
  // Confirmation event after entity is successfully created
  'entity:created-confirmed': {
    entity: AnySceneEntity;
    levelId: string;
    commandId?: string; // For undo/redo tracking
  };
  // 🏢 ENTERPRISE (2026-01-31): Circle TTT completion event
  // Emitted when incircle is calculated from 3 selected lines
  'circle-ttt:completed': {
    circle: Record<string, unknown>;
    selectedLines: Array<{
      entityId: string;
      entityType: string;
      start: { x: number; y: number };
      end: { x: number; y: number };
      segmentIndex?: number;
    }>;
  };
  // 🏢 ENTERPRISE (2026-01-31): Line Perpendicular completion event - ADR-060
  // Emitted when perpendicular line is created from reference line
  'line-perpendicular:completed': {
    line: Record<string, unknown>;
    referenceEntity: {
      entityId: string;
      entityType: string;
      start: { x: number; y: number };
      end: { x: number; y: number };
      segmentIndex?: number;
    };
    throughPoint: { x: number; y: number };
  };
  // 🏢 ENTERPRISE (2026-01-31): Line Parallel completion event - ADR-060
  // Emitted when parallel line is created from reference line
  'line-parallel:completed': {
    line: Record<string, unknown>;
    referenceEntity: {
      entityId: string;
      entityType: string;
      start: { x: number; y: number };
      end: { x: number; y: number };
      segmentIndex?: number;
    };
    offsetPoint: { x: number; y: number };
  };
}

export type DrawingEventType = keyof DrawingEventMap;
export type DrawingEventPayload<T extends DrawingEventType> = DrawingEventMap[T];

type EventHandler<T extends DrawingEventType> = (payload: DrawingEventPayload<T>) => void;

/**
 * Singleton Event Bus for centralized event coordination
 */
class EventBusCore {
  private static instance: EventBusCore;
  private handlers: Map<DrawingEventType, Set<EventHandler<DrawingEventType>>> = new Map();

  static getInstance(): EventBusCore {
    if (!EventBusCore.instance) {
      EventBusCore.instance = new EventBusCore();
    }
    return EventBusCore.instance;
  }

  private constructor() {}

  /**
   * Emit type-safe event
   */
  emit<T extends DrawingEventType>(
    eventType: T,
    payload: DrawingEventPayload<T>
  ): void {

    const eventHandlers = this.handlers.get(eventType);
    if (eventHandlers) {
      eventHandlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`❌ EventBus handler error for ${eventType}:`, error);
        }
      });
    }

  }

  /**
   * Subscribe to type-safe events
   */
  on<T extends DrawingEventType>(
    eventType: T,
    handler: EventHandler<T>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const eventHandlers = this.handlers.get(eventType)!;
    eventHandlers.add(handler as EventHandler<keyof DrawingEventMap>);

    // Return unsubscribe function
    return () => {
      eventHandlers.delete(handler as EventHandler<keyof DrawingEventMap>);
      if (eventHandlers.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  /**
   * Remove all handlers for event type
   */
  off<T extends DrawingEventType>(eventType: T): void {
    this.handlers.delete(eventType);

  }

  /**
   * Clear all event handlers
   */
  clear(): void {
    this.handlers.clear();

  }

  /**
   * Debug: List active event types
   */
  getActiveEvents(): DrawingEventType[] {
    return Array.from(this.handlers.keys());
  }
}

// Singleton instance
export const EventBus = EventBusCore.getInstance();

/**
 * React hook for type-safe event bus usage
 */
export function useEventBus() {
  const handlersRef = useRef<(() => void)[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handlersRef.current.forEach(cleanup => cleanup());
      handlersRef.current = [];
    };
  }, []);

  const emit = useCallback(<T extends DrawingEventType>(
    eventType: T,
    payload: DrawingEventPayload<T>
  ) => {
    EventBus.emit(eventType, payload);
  }, []);

  const on = useCallback(<T extends DrawingEventType>(
    eventType: T,
    handler: EventHandler<T>
  ) => {
    const cleanup = EventBus.on(eventType, handler);
    handlersRef.current.push(cleanup);
    return cleanup;
  }, []);

  const off = useCallback(<T extends DrawingEventType>(eventType: T) => {
    EventBus.off(eventType);
  }, []);

  return { emit, on, off };
}
