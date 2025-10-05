/**
 * Unified Event Bus - Type-safe centralized event coordination
 * Replaces scattered window.addEventListener/CustomEvent patterns
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';

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
    entity: Record<string, unknown>;
    tool: string;
  };
  'drawing:cancelled': {
    tool: string;
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
  };
  'overlay:polygon-update': {
    regionId: string;
    newVertices: Point2D[];
  };
  'dxf.highlightByIds': {
    mode: string;
    ids: string[];
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

    // Backward compatibility - also dispatch as CustomEvent
    const customEvent = new CustomEvent(eventType, { detail: payload });
    window.dispatchEvent(customEvent);
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
    eventHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      eventHandlers.delete(handler);
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