/**
 * CANVAS EVENT SYSTEM - Centralized event handling
 * ✅ ΦΑΣΗ 7: Unified event system που αντικαθιστά canvas-v2/shared/events.ts
 */

// 🏢 ENTERPRISE: Type-safe canvas event interface
export interface CanvasEvent {
  readonly type: string;
  readonly timestamp: number;
  readonly canvasId?: string;
  readonly data?: unknown;
}

export interface TransformChangeEvent extends CanvasEvent {
  readonly type: 'transform:change';
  readonly transform: {
    scale: number;
    offsetX: number;
    offsetY: number;
  };
  readonly viewport: {
    width: number;
    height: number;
  };
}

export interface MouseEvent extends CanvasEvent {
  readonly type: 'mouse:move' | 'mouse:click' | 'mouse:down' | 'mouse:up';
  readonly position: {
    screen: { x: number; y: number };
    world: { x: number; y: number };
  };
  readonly button?: number;
}

export interface RenderEvent extends CanvasEvent {
  readonly type: 'render:start' | 'render:complete' | 'canvas:render' | 'canvas:rendered';
  readonly canvasCount?: number;
  readonly renderTime?: number;
  readonly totalTime?: number;
}

// 🏢 ENTERPRISE: Type-safe event callback with unknown default
export type EventCallback<T = unknown> = (event: T) => void;

/**
 * 🔺 CENTRALIZED CANVAS EVENT SYSTEM
 * Αντικαθιστά το canvas-v2/shared/events.ts
 * Provides unified event handling για όλα τα canvas instances
 */
export class CanvasEventSystem {
  private listeners = new Map<string, Set<EventCallback>>();
  private eventHistory: CanvasEvent[] = [];
  private maxHistorySize = 1000;
  private debugMode = false;

  /**
   * Subscribe σε event type
   */
  subscribe<T extends CanvasEvent = CanvasEvent>(
    eventType: string,
    callback: EventCallback<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(callback);

    if (this.debugMode) {
      console.log(`🎧 Event subscription: ${eventType}`);
    }

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(eventType);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(eventType);
        }
      }

      if (this.debugMode) {
        console.log(`🔇 Event unsubscription: ${eventType}`);
      }
    };
  }

  /**
   * Emit event με automatic timestamping
   * 🏢 ENTERPRISE: Type-safe emit with unknown default
   */
  emit<T = unknown>(eventType: string, data: T, canvasId?: string): void {
    const event: CanvasEvent = {
      type: eventType,
      timestamp: performance.now(),
      canvasId,
      data
    };

    // Add to history
    this.addToHistory(event);

    const eventListeners = this.listeners.get(eventType);
    if (eventListeners && eventListeners.size > 0) {
      if (this.debugMode) {
        console.log(`📡 Event emit: ${eventType}`, event);
      }

      eventListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`❌ Error in event listener for ${eventType}:`, error);
        }
      });
    } else if (this.debugMode) {
      console.log(`📡 Event emit (no listeners): ${eventType}`, event);
    }
  }

  /**
   * Emit transform change event με typed data
   */
  emitTransformChange(
    transform: { scale: number; offsetX: number; offsetY: number },
    viewport: { width: number; height: number },
    canvasId?: string
  ): void {
    this.emit('transform:change', { transform, viewport }, canvasId);
  }

  /**
   * Emit mouse event με typed data
   */
  emitMouseEvent(
    type: 'mouse:move' | 'mouse:click' | 'mouse:down' | 'mouse:up',
    position: { screen: { x: number; y: number }; world: { x: number; y: number } },
    canvasId?: string,
    button?: number
  ): void {
    this.emit(type, { position, button }, canvasId);
  }

  /**
   * Subscribe to transform changes (convenience method)
   */
  subscribeToTransformChanges(
    callback: EventCallback<TransformChangeEvent>
  ): () => void {
    return this.subscribe('transform:change', callback);
  }

  /**
   * Subscribe to mouse events (convenience method)
   */
  subscribeToMouseEvents(
    callback: EventCallback<MouseEvent>
  ): () => void {
    const unsubscribers = [
      this.subscribe('mouse:move', callback),
      this.subscribe('mouse:click', callback),
      this.subscribe('mouse:down', callback),
      this.subscribe('mouse:up', callback)
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }

  /**
   * Subscribe to render events (convenience method)
   */
  subscribeToRenderEvents(
    callback: EventCallback<RenderEvent>
  ): () => void {
    const unsubscribers = [
      this.subscribe('render:start', callback),
      this.subscribe('render:complete', callback),
      this.subscribe('canvas:render', callback),
      this.subscribe('canvas:rendered', callback)
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }

  /**
   * Get event history για debugging
   */
  getEventHistory(eventType?: string, limit?: number): CanvasEvent[] {
    let events = eventType
      ? this.eventHistory.filter(event => event.type === eventType)
      : this.eventHistory;

    if (limit) {
      events = events.slice(-limit);
    }

    return events;
  }

  /**
   * Get active event listeners count
   */
  getListenerCount(): number {
    let total = 0;
    this.listeners.forEach(listeners => total += listeners.size);
    return total;
  }

  /**
   * Get listener count για specific event type
   */
  getListenerCountForEvent(eventType: string): number {
    return this.listeners.get(eventType)?.size || 0;
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Clear όλα τα events και listeners
   */
  clear(): void {
    this.listeners.clear();
    this.eventHistory = [];

    if (this.debugMode) {
      console.log('🧹 Event system cleared');
    }
  }

  /**
   * Add event to history με size limit
   */
  private addToHistory(event: CanvasEvent): void {
    this.eventHistory.push(event);

    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): CanvasEventMetrics {
    return {
      totalListeners: this.getListenerCount(),
      eventTypes: Array.from(this.listeners.keys()),
      historySize: this.eventHistory.length,
      maxHistorySize: this.maxHistorySize,
      debugMode: this.debugMode
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clear();
  }
}

// 🏢 ENTERPRISE: Type-safe metrics structure (moved outside class)
export interface CanvasEventMetrics {
  totalListeners: number;
  eventTypes: string[];
  historySize: number;
  maxHistorySize: number;
  debugMode: boolean;
}

// Global instance για convenience
export const globalCanvasEventSystem = new CanvasEventSystem();

// Convenience exports για backward compatibility
export const canvasEventBus = globalCanvasEventSystem;
export const subscribeToTransformChanges = (callback: EventCallback<TransformChangeEvent>) =>
  globalCanvasEventSystem.subscribeToTransformChanges(callback);

// Canvas events constants
export const CANVAS_EVENTS = {
  TRANSFORM_CHANGE: 'transform:change',
  MOUSE_MOVE: 'mouse:move',
  MOUSE_CLICK: 'mouse:click',
  MOUSE_DOWN: 'mouse:down',
  MOUSE_UP: 'mouse:up',
  RENDER_START: 'render:start',
  RENDER_COMPLETE: 'render:complete',
  CANVAS_RENDER: 'canvas:render',
  CANVAS_RENDERED: 'canvas:rendered',
  CANVAS_REGISTERED: 'canvas:registered',
  CANVAS_UNREGISTERED: 'canvas:unregistered'
} as const;