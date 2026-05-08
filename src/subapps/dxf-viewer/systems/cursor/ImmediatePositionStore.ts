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
// 🏢 ADR-163: Canvas Layer Synchronization - Mark canvases dirty for synchronized render
// 🔧 FIX (2026-02-01): Use markSystemsDirty instead of markAllCanvasDirty
// to EXCLUDE preview-canvas - it's managed by PreviewRenderer.drawPreview() with immediate render
// Including preview-canvas here causes race condition where RAF frame renders with stale entity
import { markSystemsDirty } from '../../rendering/core/UnifiedFrameScheduler';

// 🏢 ENTERPRISE: Canvas IDs to mark dirty on cursor position change
// EXCLUDES 'preview-canvas' - managed by PreviewRenderer with immediate render
const CURSOR_SYNC_CANVAS_IDS = ['dxf-canvas', 'layer-canvas', 'crosshair-overlay'];

type PositionListener = (position: Point2D | null) => void;
type DirectRenderCallback = (position: Point2D | null) => void;

class ImmediatePositionStoreClass {
  private position: Point2D | null = null;
  private listeners: Set<PositionListener> = new Set();
  // 🚀 DIRECT RENDER: Callback για immediate crosshair render (no RAF)
  private directRenderCallback: DirectRenderCallback | null = null;

  // 🏢 World-coordinate companion store (2026-05-08): consumed by toolbar
  // coordinate display + tools that need world coords. Updated alongside
  // screen position from the throttled mouse handler.
  private worldPosition: Point2D | null = null;
  private worldListeners: Set<PositionListener> = new Set();

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

    // 🏢 ENTERPRISE (2026-01-26): Debug logging removed - mouse position updates are too frequent
    // Debug counter kept for potential future debugging needs
    this.debugCallCount++;

    // 🚀 DIRECT RENDER: Call crosshair render IMMEDIATELY (no RAF wait!)
    if (this.directRenderCallback) {
      try {
        this.directRenderCallback(this.position);
        // 🏢 ADR-163: Canvas Layer Synchronization Fix
        // 🔧 FIX (2026-02-01): Mark ONLY dxf/layer/crosshair canvases dirty
        // EXCLUDES preview-canvas to prevent RAF race condition:
        // - preview-canvas is managed by PreviewRenderer.drawPreview() with immediate render
        // - including it here caused preview to disappear during mouse movement
        markSystemsDirty(CURSOR_SYNC_CANVAS_IDS);
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
        // 🏢 ADR-163: Canvas Layer Synchronization Fix
        markSystemsDirty(CURSOR_SYNC_CANVAS_IDS);
      }
    }
  }

  /**
   * 🏢 END PAN: Unlock crosshair, return to normal screen-following behavior
   * Called when middle button is released
   */
  endPan(): void {
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

  // ─── World position channel (2026-05-08) ───────────────────────────────
  setWorldPosition(pos: Point2D | null): void {
    if (this.worldPosition?.x === pos?.x && this.worldPosition?.y === pos?.y) {
      return;
    }
    this.worldPosition = pos ? { x: pos.x, y: pos.y } : null;
    this.worldListeners.forEach((l) => {
      try { l(this.worldPosition); } catch (e) { console.error('worldPosition listener error:', e); }
    });
  }

  getWorldPosition(): Point2D | null {
    return this.worldPosition;
  }

  subscribeWorldPosition(listener: PositionListener): () => void {
    this.worldListeners.add(listener);
    return () => { this.worldListeners.delete(listener); };
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

// 🌍 World position convenience (2026-05-08)
export function setImmediateWorldPosition(pos: Point2D | null): void {
  ImmediatePositionStore.setWorldPosition(pos);
}

export function getImmediateWorldPosition(): Point2D | null {
  return ImmediatePositionStore.getWorldPosition();
}

export function subscribeToImmediateWorldPosition(
  listener: (position: Point2D | null) => void,
): () => void {
  return ImmediatePositionStore.subscribeWorldPosition(listener);
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
