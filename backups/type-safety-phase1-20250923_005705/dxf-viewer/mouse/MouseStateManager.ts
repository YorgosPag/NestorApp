/**
 * Central Mouse State Manager
 * Handles all mouse interactions with clear priority system
 */

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_MOUSE_STATE_MANAGER = false;

import { useRef, useCallback, useState } from 'react';
import type { Point2D } from '../types/scene';

// Mouse interaction modes with priority levels (higher = more priority)
export enum MouseMode {
  IDLE = 0,           // No active interaction
  HOVER = 1,          // Entity hover (measurements, highlight)
  PAN = 2,            // Canvas panning
  MARQUEE = 3,        // Selection marquee
  GRIP_DRAG = 4,      // Grip dragging (highest priority)
}

export interface MouseState {
  mode: MouseMode;
  position: Point2D | null;
  startPosition: Point2D | null;
  dragData: any; // Mode-specific data
  isPressed: boolean;
}

export interface MouseInteractionHandler {
  mode: MouseMode;
  priority: number;
  canActivate: (state: MouseState, point: Point2D, event?: any) => boolean;
  onActivate: (state: MouseState, point: Point2D, event?: any) => any;
  onMove: (state: MouseState, point: Point2D, event?: any) => boolean;
  onEnd: (state: MouseState, event?: any) => void;
  onCancel?: (state: MouseState) => void;
}

export class MouseStateManager {
  private state: MouseState;
  private handlers: Map<MouseMode, MouseInteractionHandler>;
  private subscribers: Set<(state: MouseState) => void>;

  constructor() {
    this.state = {
      mode: MouseMode.IDLE,
      position: null,
      startPosition: null,
      dragData: null,
      isPressed: false,
    };
    this.handlers = new Map();
    this.subscribers = new Set();
  }

  // Register interaction handlers
  registerHandler(handler: MouseInteractionHandler): void {
    this.handlers.set(handler.mode, handler);
    if (DEBUG_MOUSE_STATE_MANAGER) console.log(`🎯 [MouseStateManager] Registered handler for ${MouseMode[handler.mode]} mode`);
  }

  // Subscribe to state changes
  subscribe(callback: (state: MouseState) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // Get current state
  getState(): MouseState {
    return { ...this.state };
  }

  // Main mouse event handlers
  onMouseDown(point: Point2D, event?: any): boolean {
    if (DEBUG_MOUSE_STATE_MANAGER) console.log(`🎯 [MouseStateManager] MouseDown: ${point.x}, ${point.y} - Current mode: ${MouseMode[this.state.mode]}`);
    
    this.updateState({
      isPressed: true,
      startPosition: point,
      position: point,
    });

    // Try to activate highest priority handler that can handle this event
    const sortedHandlers = Array.from(this.handlers.values())
      .sort((a, b) => b.priority - a.priority); // Highest priority first

    for (const handler of sortedHandlers) {
      if (handler.canActivate(this.state, point, event)) {
        if (DEBUG_MOUSE_STATE_MANAGER) console.log(`🎯 [MouseStateManager] Activating ${MouseMode[handler.mode]} mode`);
        
        const dragData = handler.onActivate(this.state, point, event);
        this.updateState({
          mode: handler.mode,
          dragData,
        });
        
        this.notifySubscribers();
        return true;
      }
    }

    if (DEBUG_MOUSE_STATE_MANAGER) console.log(`🎯 [MouseStateManager] No handler activated, staying in ${MouseMode[this.state.mode]} mode`);
    this.notifySubscribers();
    return false;
  }

  onMouseMove(point: Point2D, event?: any): boolean {
    this.updateState({ position: point });

    const currentHandler = this.handlers.get(this.state.mode);
    if (currentHandler && this.state.isPressed) {
      // Active drag mode
      if (DEBUG_MOUSE_STATE_MANAGER) console.log(`🎯 [MouseStateManager] MouseMove: ${MouseMode[this.state.mode]} handling`);
      const handled = currentHandler.onMove(this.state, point, event);
      this.notifySubscribers();
      return handled;
    } else if (!this.state.isPressed) {
      // Hover mode - try hover handler
      const hoverHandler = this.handlers.get(MouseMode.HOVER);
      if (hoverHandler && hoverHandler.canActivate(this.state, point, event)) {
        const dragData = hoverHandler.onActivate(this.state, point, event);
        this.updateState({
          mode: MouseMode.HOVER,
          dragData,
        });
        this.notifySubscribers();
        return true;
      }
    }

    this.notifySubscribers();
    return false;
  }

  onMouseUp(event?: any): void {
    if (DEBUG_MOUSE_STATE_MANAGER) console.log(`🎯 [MouseStateManager] MouseUp: ${MouseMode[this.state.mode]} mode`);
    
    const currentHandler = this.handlers.get(this.state.mode);
    if (currentHandler && this.state.isPressed) {
      currentHandler.onEnd(this.state, event);
    }

    // Reset to idle state
    this.updateState({
      mode: MouseMode.IDLE,
      isPressed: false,
      startPosition: null,
      dragData: null,
    });

    this.notifySubscribers();
  }

  // Cancel current interaction (e.g., ESC key)
  cancel(): void {
    if (DEBUG_MOUSE_STATE_MANAGER) console.log(`🎯 [MouseStateManager] Canceling ${MouseMode[this.state.mode]} mode`);
    
    const currentHandler = this.handlers.get(this.state.mode);
    if (currentHandler?.onCancel) {
      currentHandler.onCancel(this.state);
    }

    this.updateState({
      mode: MouseMode.IDLE,
      isPressed: false,
      startPosition: null,
      dragData: null,
    });

    this.notifySubscribers();
  }

  // Force transition to specific mode (for special cases)
  forceMode(mode: MouseMode, dragData?: any): void {
    if (DEBUG_MOUSE_STATE_MANAGER) console.log(`🎯 [MouseStateManager] Force mode change: ${MouseMode[this.state.mode]} -> ${MouseMode[mode]}`);
    
    this.updateState({
      mode,
      dragData: dragData || null,
    });

    this.notifySubscribers();
  }

  private updateState(partial: Partial<MouseState>): void {
    this.state = { ...this.state, ...partial };
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.state));
  }
}

import React from 'react';

// React hook for using MouseStateManager
export function useMouseStateManager(): {
  state: MouseState;
  registerHandler: (handler: MouseInteractionHandler) => void;
  onMouseDown: (point: Point2D, event?: any) => boolean;
  onMouseMove: (point: Point2D, event?: any) => boolean;
  onMouseUp: (event?: any) => void;
  cancel: () => void;
  forceMode: (mode: MouseMode, dragData?: any) => void;
} {
  const managerRef = useRef<MouseStateManager>(new MouseStateManager());
  const [state, setState] = useState<MouseState>(managerRef.current.getState());

  // Subscribe to state changes
  React.useEffect(() => {
    const unsubscribe = managerRef.current.subscribe(setState);
    return unsubscribe;
  }, []);

  const registerHandler = useCallback((handler: MouseInteractionHandler) => {
    managerRef.current.registerHandler(handler);
  }, []);

  const onMouseDown = useCallback((point: Point2D, event?: any) => {
    return managerRef.current.onMouseDown(point, event);
  }, []);

  const onMouseMove = useCallback((point: Point2D, event?: any) => {
    return managerRef.current.onMouseMove(point, event);
  }, []);

  const onMouseUp = useCallback((event?: any) => {
    managerRef.current.onMouseUp(event);
  }, []);

  const cancel = useCallback(() => {
    managerRef.current.cancel();
  }, []);

  const forceMode = useCallback((mode: MouseMode, dragData?: any) => {
    managerRef.current.forceMode(mode, dragData);
  }, []);

  return {
    state,
    registerHandler,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    cancel,
    forceMode,
  };
}