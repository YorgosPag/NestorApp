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
import { pointsEqual } from '../../rendering/entities/shared/geometry-vector-utils';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// 🏢 ADR-163: Canvas Layer Synchronization - Mark canvases dirty for synchronized render
// 🔧 FIX (2026-02-01): Use markSystemsDirty instead of markAllCanvasDirty
// to EXCLUDE preview-canvas - it's managed by PreviewRenderer.drawPreview() with immediate render
// Including preview-canvas here causes race condition where RAF frame renders with stale entity
import { markSystemsDirty } from '../../rendering/core/UnifiedFrameScheduler';

// 🏢 ENTERPRISE: Canvas IDs to mark dirty on cursor position change
// EXCLUDES 'preview-canvas' - managed by PreviewRenderer with immediate render
//
// Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): 'dxf-canvas' removed from the
// cursor sync group. Cursor mousemove no longer invalidates the DXF entity
// bitmap cache (transform unchanged). Pan still invalidates dxf-canvas because
// the transform changes — see PAN_SYNC_CANVAS_IDS used by updateTransform().
//
// Phase E (ADR-040, 2026-06-04, cursor-lag Φ4): 'layer-canvas' removed too. The
// crosshair + cursor pickbox moved to the compositor <CrosshairOverlay> (driven
// by registerDirectRender below), and the live layer-canvas no longer draws any
// cursor-frequency content (snap → SnapIndicatorSubscriber; selection box →
// dxf-canvas; overlay-hover/draft → own `layers`-prop dirty path). So a plain
// mousemove must NOT force a full layer-canvas repaint. (ADR-040 Φ10: the dead
// 'crosshair-overlay' id — never a registered scheduler system, a no-op since
// Phase 2 — was removed; the compositor crosshair updates via registerDirectRender.)
// Pan still repaints layer-canvas via PAN_SYNC_CANVAS_IDS (transform changes).
const PAN_SYNC_CANVAS_IDS = ['dxf-canvas', 'layer-canvas'];

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

  // 🚀 ADR-040 cursor-lag Φ12 (2026-06-25): REALTIME effective-world channel.
  // The 60fps, synchronous, post-snap effective world cursor (== `moveWorldPos`
  // in mouse-handler-move: raw screen→world AFTER grip-snap + wall/column
  // face-corner projection overrides). This is the ONE source every ghost reads
  // synchronously — same value, same clock as the compositor crosshair, so the
  // move/grip ghost can never desync from the cursor regardless of snaps on/off.
  //
  // WHY a 3rd channel (not the `worldPosition` one above): `worldPosition` is
  // intentionally THROTTLED ~20fps (mouse-handler-move:148-164) because its
  // `useSyncExternalStore` subscribers (toolbar / guides / draft-polygon) would
  // otherwise re-render at 60fps. This channel is un-throttled + read imperatively
  // (NO useSyncExternalStore), so it carries the full 60fps stream with zero React
  // re-render cost. Ghosts consume it via a RAF-coalesced throttle (ADR-516).
  private realtimeWorld: Point2D | null = null;
  private realtimeWorldListeners: Set<PositionListener> = new Set();

  // 🏢 PAN LOCK (2026-01-25): Lock crosshair to WORLD position during pan
  private isPanning = false;
  private lockedWorldPosition: Point2D | null = null;
  private currentTransform: ViewTransform | null = null;
  private currentViewport: Viewport | null = null;

  // 🔍 DEBUG: Track call count
  private debugCallCount = 0;

  // Viewport-level cursor position (clientX/clientY) — correct for position:fixed overlays.
  // Single window listener feeds all consumers; avoids N scattered inline listeners.
  private clientPos: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener(
        'mousemove',
        (e: MouseEvent) => { this.clientPos = { x: e.clientX, y: e.clientY }; },
        { passive: true },
      );
    }
  }

  /**
   * 🚀 IMMEDIATE UPDATE: Sets position without React re-render
   * Called from mouse move handlers for zero-latency updates
   */
  setPosition(pos: Point2D | null): void {
    // Skip if position unchanged (performance optimization)
    if (pointsEqual(this.position, pos)) return;

    this.position = pos ? { x: pos.x, y: pos.y } : null;

    // 🏢 ENTERPRISE (2026-01-26): Debug logging removed - mouse position updates are too frequent
    // Debug counter kept for potential future debugging needs
    this.debugCallCount++;

    // 🚀 DIRECT RENDER: Call crosshair render IMMEDIATELY (no RAF wait!)
    // The compositor <CrosshairOverlay> moves the crosshair off-main-thread via
    // translate3d. Phase E (ADR-040, 2026-06-04): no canvas is marked dirty on a
    // plain cursor move — the layer-canvas has no cursor-frequency content left
    // (see PAN_SYNC_CANVAS_IDS comment above). This is the cursor-lag Φ4 win.
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
        // Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): include dxf-canvas in pan
        // because the transform changes invalidates the entity bitmap cache.
        markSystemsDirty(PAN_SYNC_CANVAS_IDS);
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
    if (pointsEqual(this.worldPosition, pos)) return;
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

  // ─── Realtime effective-world channel (ADR-040 Φ12, 2026-06-25) ─────────
  // Written EVERY mousemove (60fps) by the central handler with the final
  // `moveWorldPos`. Listeners fire SYNCHRONOUSLY inside the event (mirror
  // `setPosition`), so a ghost armed off this channel draws in the same frame
  // as the compositor crosshair.
  setRealtimeWorld(pos: Point2D | null): void {
    if (pointsEqual(this.realtimeWorld, pos)) return;
    this.realtimeWorld = pos ? { x: pos.x, y: pos.y } : null;
    this.realtimeWorldListeners.forEach((l) => {
      try { l(this.realtimeWorld); } catch (e) { console.error('realtimeWorld listener error:', e); }
    });
  }

  getRealtimeWorld(): Point2D | null {
    return this.realtimeWorld;
  }

  subscribeRealtimeWorld(listener: PositionListener): () => void {
    this.realtimeWorldListeners.add(listener);
    return () => { this.realtimeWorldListeners.delete(listener); };
  }

  /**
   * 🧹 CLEAR: Reset position to null
   */
  clear(): void {
    this.setPosition(null);
  }

  /** Returns last known viewport cursor position (clientX/clientY). Safe to call at event-time. */
  getClientPosition(): { x: number; y: number } {
    return this.clientPos;
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

// 🚀 Realtime effective-world cursor convenience (ADR-040 Φ12, 2026-06-25).
// The 60fps synchronous post-snap world cursor SSoT — read imperatively by every
// ghost preview (no useSyncExternalStore, no React re-render). NOT to be confused
// with `getImmediateWorldPosition()` above, which is the THROTTLED ~20fps React
// channel for the toolbar/guides.
export function setRealtimeWorldCursor(pos: Point2D | null): void {
  ImmediatePositionStore.setRealtimeWorld(pos);
}

export function getRealtimeWorldCursor(): Point2D | null {
  return ImmediatePositionStore.getRealtimeWorld();
}

export function subscribeRealtimeWorldCursor(
  listener: (position: Point2D | null) => void,
): () => void {
  return ImmediatePositionStore.subscribeRealtimeWorld(listener);
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

/** Last viewport cursor position (clientX/clientY). Correct for position:fixed overlays. */
export function getClientPosition(): { x: number; y: number } {
  return ImmediatePositionStore.getClientPosition();
}

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
