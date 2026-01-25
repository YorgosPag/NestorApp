/**
 * 🏢 ENTERPRISE: IMMEDIATE POSITION STORE
 *
 * Singleton store για synchronous cursor position updates.
 * Bypasses React state για zero-latency crosshair rendering κατά τη διάρκεια pan.
 *
 * @module ImmediatePositionStore
 * @version 2.0.0 - Direct Render Callback (2026-01-25)
 * @since 2026-01-25
 *
 * 🎯 PROBLEM SOLVED:
 * - React useReducer creates 1-2 frame delay for position updates
 * - During pan, crosshair lagged behind canvas movement
 * - UnifiedFrameScheduler RAF loop adds another frame of delay
 *
 * 🏆 SOLUTION:
 * - Direct ref-based position storage (no React re-render needed)
 * - DIRECT RENDER CALLBACK: CrosshairOverlay registers a render function
 * - On position change, we call the render function IMMEDIATELY (no RAF wait)
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';

type PositionListener = (position: Point2D | null) => void;
type DirectRenderCallback = (position: Point2D | null) => void;

class ImmediatePositionStoreClass {
  private position: Point2D | null = null;
  private listeners: Set<PositionListener> = new Set();
  // 🚀 DIRECT RENDER: Callback για immediate crosshair render (no RAF)
  private directRenderCallback: DirectRenderCallback | null = null;

  // 🏢 PAN LOCK (2026-01-25): Lock crosshair to WORLD position during pan
  private isPanning = false;
  private lockedWorldPosition: Point2D | null = null;
  private currentTransform: ViewTransform | null = null;
  private currentViewport: Viewport | null = null;

  // 🔍 DEBUG: Track call count
  private debugCallCount = 0;

  /**
   * 🚀 IMMEDIATE UPDATE: Sets position without React re-render
   * Called from mouse move handlers for zero-latency updates
   */
  setPosition(pos: Point2D | null): void {
    // Skip if position unchanged (performance optimization)
    if (this.position?.x === pos?.x && this.position?.y === pos?.y) {
      return;
    }

    this.position = pos ? { x: pos.x, y: pos.y } : null;

    // 🔍 DEBUG: Log every 30th call to avoid console spam
    this.debugCallCount++;
    if (this.debugCallCount % 30 === 0) {
      console.log('🎯 ImmediatePositionStore.setPosition:', {
        pos: this.position,
        hasDirectRender: !!this.directRenderCallback,
        callCount: this.debugCallCount
      });
    }

    // 🚀 DIRECT RENDER: Call crosshair render IMMEDIATELY (no RAF wait!)
    if (this.directRenderCallback) {
      try {
        this.directRenderCallback(this.position);
      } catch (error) {
        console.error('ImmediatePositionStore direct render error:', error);
      }
    }

    // Notify all listeners immediately (synchronous)
    this.listeners.forEach(listener => {
      try {
        listener(this.position);
      } catch (error) {
        console.error('ImmediatePositionStore listener error:', error);
      }
    });
  }

  /**
   * 🚀 REGISTER DIRECT RENDER: Register crosshair render callback
   * This is called IMMEDIATELY when position changes (no RAF delay)
   */
  registerDirectRender(callback: DirectRenderCallback): () => void {
    this.directRenderCallback = callback;
    return () => {
      if (this.directRenderCallback === callback) {
        this.directRenderCallback = null;
      }
    };
  }

  // ============================================================================
  // 🏢 PAN LOCK SYSTEM (2026-01-25)
  // Lock crosshair to WORLD position during pan so it moves with the canvas
  // ============================================================================

  /**
   * 🏢 START PAN: Lock crosshair to current WORLD position
   * Called when middle button is pressed
   */
  startPan(worldPosition: Point2D, transform: ViewTransform, viewport: Viewport): void {
    this.isPanning = true;
    this.lockedWorldPosition = { ...worldPosition };
    this.currentTransform = { ...transform };
    this.currentViewport = { ...viewport };

    console.log('🔒 PAN LOCK: Started', {
      lockedWorldPosition: this.lockedWorldPosition,
      transform: this.currentTransform
    });
  }

  /**
   * 🏢 UPDATE TRANSFORM: Update transform during pan (for world→screen conversion)
   * Called on every mouse move during pan
   */
  updateTransform(transform: ViewTransform): void {
    if (!this.isPanning) return;

    this.currentTransform = { ...transform };

    // 🚀 IMMEDIATE: Recalculate screen position from locked world position
    if (this.lockedWorldPosition && this.currentViewport) {
      const screenPos = CoordinateTransforms.worldToScreen(
        this.lockedWorldPosition,
        this.currentTransform,
        this.currentViewport
      );

      // Call direct render with the NEW screen position (derived from locked world)
      if (this.directRenderCallback) {
        this.directRenderCallback(screenPos);
      }
    }
  }

  /**
   * 🏢 END PAN: Unlock crosshair, return to normal screen-following behavior
   * Called when middle button is released
   */
  endPan(): void {
    console.log('🔓 PAN LOCK: Ended');
    this.isPanning = false;
    this.lockedWorldPosition = null;
    // Keep transform/viewport for reference
  }

  /**
   * 🏢 SET PANNING: Simple flag update (for pan-aware rendering in CrosshairOverlay)
   * Called from useCentralizedMouseHandlers when pan starts/stops
   */
  setPanning(panning: boolean): void {
    this.isPanning = panning;
  }

  /**
   * 🏢 IS PANNING: Check if currently in pan mode
   */
  getIsPanning(): boolean {
    return this.isPanning;
  }

  /**
   * 🔍 GET POSITION: Returns current position without subscription
   */
  getPosition(): Point2D | null {
    return this.position;
  }

  /**
   * 📡 SUBSCRIBE: Add listener for position changes
   * Returns unsubscribe function
   */
  subscribe(listener: PositionListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 🧹 CLEAR: Reset position to null
   */
  clear(): void {
    this.setPosition(null);
  }
}

// ✅ SINGLETON EXPORT
export const ImmediatePositionStore = new ImmediatePositionStoreClass();

// ✅ CONVENIENCE FUNCTIONS
export function setImmediatePosition(pos: Point2D | null): void {
  ImmediatePositionStore.setPosition(pos);
}

export function getImmediatePosition(): Point2D | null {
  return ImmediatePositionStore.getPosition();
}

export function subscribeToImmediatePosition(listener: (position: Point2D | null) => void): () => void {
  return ImmediatePositionStore.subscribe(listener);
}

/**
 * 🚀 DIRECT RENDER REGISTRATION
 * Register a callback that will be called IMMEDIATELY when position changes
 * (no RAF delay - synchronous call from mouse event handler)
 */
export function registerDirectRender(callback: (position: Point2D | null) => void): () => void {
  return ImmediatePositionStore.registerDirectRender(callback);
}

// ============================================================================
// 🏢 PAN LOCK EXPORTS (2026-01-25)
// ============================================================================

/**
 * 🏢 START PAN: Lock crosshair to WORLD position
 */
export function startPanLock(worldPosition: Point2D, transform: ViewTransform, viewport: Viewport): void {
  ImmediatePositionStore.startPan(worldPosition, transform, viewport);
}

/**
 * 🏢 UPDATE TRANSFORM: Update transform during pan
 */
export function updatePanTransform(transform: ViewTransform): void {
  ImmediatePositionStore.updateTransform(transform);
}

/**
 * 🏢 END PAN: Unlock crosshair
 */
export function endPanLock(): void {
  ImmediatePositionStore.endPan();
}

/**
 * 🏢 IS PANNING: Check if in pan mode
 */
export function isPanning(): boolean {
  return ImmediatePositionStore.getIsPanning();
}

/**
 * 🏢 SET PANNING: Update pan mode flag (for pan-aware CrosshairOverlay rendering)
 */
export function setPanning(panning: boolean): void {
  ImmediatePositionStore.setPanning(panning);
}
