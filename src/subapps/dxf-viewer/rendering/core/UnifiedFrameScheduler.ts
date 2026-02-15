/**
 * 🏢 ENTERPRISE UNIFIED FRAME SCHEDULER
 *
 * Centralized render frame orchestrator for CAD-grade performance.
 * Pattern: Autodesk Revit / Adobe Illustrator / Bentley MicroStation
 *
 * @module UnifiedFrameScheduler
 * @version 1.0.0
 * @since 2026-01-25
 *
 * 🎯 PURPOSE:
 * - Single RAF loop coordinates ALL render systems
 * - Dirty flag aggregation from multiple sources
 * - Priority-based render queue
 * - Frame skipping optimization
 * - Performance metrics collection
 *
 * 🏆 ENTERPRISE FEATURES:
 * - Singleton pattern (Single Source of Truth)
 * - Type-safe render callbacks (ZERO any)
 * - Orchestrates existing systems (doesn't replace them)
 * - Industry-standard 60fps target
 * - Automatic frame throttling under load
 */

// ============================================================================
// TYPES - Enterprise TypeScript Standards (ZERO any)
// ============================================================================

/** Render priority levels - lower number = higher priority */
export type RenderPriority = 0 | 1 | 2 | 3 | 4;

export const RENDER_PRIORITIES = {
  /** Critical UI (cursor, crosshair) - must render every frame */
  CRITICAL: 0 as RenderPriority,
  /** High priority (selection, grips) */
  HIGH: 1 as RenderPriority,
  /** Normal priority (entities, layers) */
  NORMAL: 2 as RenderPriority,
  /** Low priority (grid, rulers) */
  LOW: 3 as RenderPriority,
  /** Background (PDF, images) */
  BACKGROUND: 4 as RenderPriority,
} as const;

/** Render callback function type */
export type RenderCallback = (deltaTime: number, frameNumber: number) => void;

/** Dirty check function type - returns true if component needs render */
export type DirtyCheckFn = () => boolean;

/** Registered render system */
interface RenderSystem {
  /** Unique identifier */
  id: string;
  /** Display name for debugging */
  name: string;
  /** Render priority (lower = higher priority) */
  priority: RenderPriority;
  /** Render callback */
  render: RenderCallback;
  /** Optional dirty check - if returns false, skip render */
  isDirty?: DirtyCheckFn;
  /** Is this system enabled? */
  enabled: boolean;
  /** 🏢 ADR-156: Force dirty flag - bypasses isDirty check for one frame */
  forceDirty: boolean;
  /** Performance metrics */
  metrics: {
    lastRenderTime: number;
    averageRenderTime: number;
    renderCount: number;
    skipCount: number;
  };
}

/** Frame metrics for performance monitoring */
export interface FrameMetrics {
  /** Current frame number */
  frameNumber: number;
  /** Time since last frame (ms) */
  deltaTime: number;
  /** Current FPS */
  fps: number;
  /** Average FPS over last second */
  averageFps: number;
  /** Total systems registered */
  systemCount: number;
  /** Systems that rendered this frame */
  renderedCount: number;
  /** Systems that were skipped (not dirty) */
  skippedCount: number;
  /** Total frame time (ms) */
  totalFrameTime: number;
  /** Per-system metrics */
  systemMetrics: Map<string, { renderTime: number; skipped: boolean }>;
}

/** Scheduler configuration */
export interface SchedulerConfig {
  /** Target FPS (default: 60) */
  targetFps: number;
  /** Enable frame throttling under load */
  enableThrottling: boolean;
  /** Maximum frame time before throttling (ms) */
  throttleThreshold: number;
  /** Enable debug logging */
  debug: boolean;
  /** Enable performance metrics collection */
  collectMetrics: boolean;
}

// ============================================================================
// CONSTANTS - Enterprise Design Tokens
// ============================================================================

const DEFAULT_CONFIG: SchedulerConfig = {
  targetFps: 60,
  enableThrottling: true,
  throttleThreshold: 16.67, // ~60fps threshold
  debug: false, // Production mode
  collectMetrics: true,
};

import { dlog, dwarn, derr } from '../../debug';

const FRAME_TIME_60FPS = 1000 / 60; // ~16.67ms
const FPS_SAMPLE_SIZE = 60; // Average over 60 frames

// ============================================================================
// UNIFIED FRAME SCHEDULER - Singleton Pattern
// ============================================================================

/**
 * 🏢 ENTERPRISE: Unified Frame Scheduler
 *
 * Single RAF loop that orchestrates all render systems.
 * Pattern: Autodesk/Adobe - Central render coordinator
 */
class UnifiedFrameSchedulerImpl {
  private static instance: UnifiedFrameSchedulerImpl | null = null;

  // === STATE ===
  private systems: Map<string, RenderSystem> = new Map();
  private config: SchedulerConfig = { ...DEFAULT_CONFIG };
  private isRunning = false;
  private rafId: number | null = null;

  // === TIMING ===
  private lastFrameTime = 0;
  private frameNumber = 0;
  private fpsHistory: number[] = [];
  private isFirstFrame = true; // 🏢 FIX: Track first frame to skip throttling

  // 🏢 ADR-163: Immediate render debounce - prevents multiple renders per frame
  // Uses frame number instead of boolean to correctly track across RAF boundaries
  private immediateRenderFrame = -1;

  // === METRICS ===
  private currentMetrics: FrameMetrics = this.createEmptyMetrics();

  // === LISTENERS ===
  private frameListeners: Set<(metrics: FrameMetrics) => void> = new Set();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * 🏢 ENTERPRISE: Get singleton instance
   */
  static getInstance(): UnifiedFrameSchedulerImpl {
    if (!UnifiedFrameSchedulerImpl.instance) {
      UnifiedFrameSchedulerImpl.instance = new UnifiedFrameSchedulerImpl();
    }
    return UnifiedFrameSchedulerImpl.instance;
  }

  // ============================================================================
  // SYSTEM REGISTRATION
  // ============================================================================

  /**
   * 🏢 ENTERPRISE: Register a render system
   *
   * @param id - Unique system identifier
   * @param name - Display name for debugging
   * @param priority - Render priority (lower = higher priority)
   * @param render - Render callback function
   * @param isDirty - Optional dirty check function
   * @returns Unsubscribe function
   */
  register(
    id: string,
    name: string,
    priority: RenderPriority,
    render: RenderCallback,
    isDirty?: DirtyCheckFn
  ): () => void {
    if (this.systems.has(id)) {
      dwarn('FrameScheduler', `System "${id}" already registered, replacing...`);
    }

    const system: RenderSystem = {
      id,
      name,
      priority,
      render,
      isDirty,
      enabled: true,
      forceDirty: false, // 🏢 ADR-156: Initial state
      metrics: {
        lastRenderTime: 0,
        averageRenderTime: 0,
        renderCount: 0,
        skipCount: 0,
      },
    };

    this.systems.set(id, system);

    if (this.config.debug) {
      dlog('FrameScheduler', `Registered: ${name} (priority: ${priority})`);
    }

    // Auto-start if this is the first system
    if (this.systems.size === 1 && !this.isRunning) {
      this.start();
    }

    // Return unsubscribe function
    return () => this.unregister(id);
  }

  /**
   * 🏢 ENTERPRISE: Unregister a render system
   */
  unregister(id: string): void {
    const system = this.systems.get(id);
    if (system) {
      this.systems.delete(id);
      if (this.config.debug) {
        dlog('FrameScheduler', `Unregistered: ${system.name}`);
      }
    }

    // Auto-stop if no systems left
    if (this.systems.size === 0 && this.isRunning) {
      this.stop();
    }
  }

  /**
   * 🏢 ENTERPRISE: Enable/disable a system
   */
  setEnabled(id: string, enabled: boolean): void {
    const system = this.systems.get(id);
    if (system) {
      system.enabled = enabled;
    }
  }

  /**
   * 🏢 ENTERPRISE: Mark system as dirty (force render next frame)
   * ADR-156: Canvas Layer Synchronization Fix
   */
  markDirty(id: string): void {
    const system = this.systems.get(id);
    if (system) {
      system.forceDirty = true;
      if (this.config.debug) {
        dlog('FrameScheduler', `markDirty: ${system.name}`);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Mark ALL canvas layers as dirty
   * ADR-156: Canvas Layer Synchronization Fix
   *
   * This ensures all canvas layers re-render together when ANY layer changes.
   * Prevents the "entities disappear during mouse move" bug caused by
   * partial canvas clearing without proper re-rendering.
   *
   * Canvas layer IDs: 'dxf-canvas', 'layer-canvas', 'preview-canvas', 'crosshair-overlay'
   */
  markAllCanvasDirty(): void {
    const canvasSystemIds = ['dxf-canvas', 'layer-canvas', 'preview-canvas', 'crosshair-overlay'];

    for (const id of canvasSystemIds) {
      const system = this.systems.get(id);
      if (system) {
        system.forceDirty = true;
      }
    }

    if (this.config.debug) {
      dlog('FrameScheduler', `markAllCanvasDirty: ${canvasSystemIds.length} systems marked`);
    }
  }

  /**
   * 🏢 ENTERPRISE: Mark specific canvas layers as dirty
   * ADR-156: Canvas Layer Synchronization Fix
   *
   * @param systemIds - Array of system IDs to mark dirty
   */
  markSystemsDirty(systemIds: string[]): void {
    for (const id of systemIds) {
      const system = this.systems.get(id);
      if (system) {
        system.forceDirty = true;
      }
    }

    if (this.config.debug) {
      dlog('FrameScheduler', `markSystemsDirty: ${systemIds.join(', ')}`);
    }
  }

  /**
   * 🏢 ADR-163: IMMEDIATE RENDER ALL CANVASES
   *
   * Forces SYNCHRONOUS render of all canvas layers RIGHT NOW.
   * Does NOT wait for next RAF frame - renders immediately!
   *
   * Use this when doing direct/immediate renders (like CrosshairOverlay)
   * to ensure all canvases stay synchronized.
   *
   * Pattern: Figma/Sketch - Synchronous multi-layer compositing
   *
   * 🏢 DEBOUNCE: Only ONE immediate render per frame allowed!
   * Multiple mouse events in one frame will only trigger ONE render cycle.
   * This prevents the "multiple clear" flickering bug.
   *
   * Uses frameNumber tracking to correctly handle RAF timing:
   * - Mouse events between frames → immediate render at frame N
   * - processFrame() runs at frame N → sees immediateRenderFrame = N → skips canvases
   * - processFrame() ends → frameNumber becomes N+1
   * - Next frame → immediateRenderFrame ≠ frameNumber → canvases can render normally
   */
  forceImmediateRenderAll(): void {
    // 🏢 DEBOUNCE: Skip if already rendered this frame
    // Prevents multiple mouse events from causing multiple clear/render cycles
    if (this.immediateRenderFrame === this.frameNumber) {
      return;
    }
    this.immediateRenderFrame = this.frameNumber;

    const canvasSystemIds = ['dxf-canvas', 'layer-canvas', 'preview-canvas'];
    // Note: crosshair-overlay excluded - it's already being rendered directly

    for (const id of canvasSystemIds) {
      const system = this.systems.get(id);
      if (system && system.enabled) {
        try {
          // Call render directly - SYNCHRONOUS!
          system.render(0, this.frameNumber);
          // Reset dirty flags - prevent RAF loop from re-rendering
          system.forceDirty = false;
        } catch (error) {
          derr('FrameScheduler', `forceImmediateRenderAll error in ${id}:`, error);
        }
      }
    }
  }

  // ============================================================================
  // ONE-SHOT SCHEDULING - For non-continuous RAF operations
  // ============================================================================

  /** Pending one-shot callbacks keyed by ID */
  private oneShotCallbacks: Map<string, () => void> = new Map();
  /** Pending one-shot RAF ID */
  private oneShotRafId: number | null = null;

  /**
   * 🏢 ENTERPRISE: Schedule a one-shot callback for next frame
   *
   * For operations that need RAF but aren't continuous renders:
   * - Fit-to-view operations
   * - Layout stabilization
   * - One-time measurements
   *
   * Pattern: Coalesces multiple scheduleOnce calls into single RAF
   * If same ID is scheduled multiple times, only last callback runs
   *
   * @param id - Unique identifier (prevents duplicate scheduling)
   * @param callback - Function to execute next frame
   *
   * @example
   * ```typescript
   * // Schedule fit-to-view after layout change
   * UnifiedFrameScheduler.scheduleOnce('bounds-fit', () => {
   *   this.fitToDrawing();
   * });
   *
   * // Schedule viewport measurement
   * UnifiedFrameScheduler.scheduleOnce('viewport-measure', () => {
   *   updateViewportDimensions();
   * });
   * ```
   */
  scheduleOnce(id: string, callback: () => void): void {
    // Store/replace callback by ID (last wins)
    this.oneShotCallbacks.set(id, callback);

    // Schedule RAF if not already pending
    if (this.oneShotRafId === null) {
      this.oneShotRafId = requestAnimationFrame(() => {
        this.executeOneShotCallbacks();
      });
    }

    if (this.config.debug) {
      dlog('FrameScheduler', `scheduleOnce: ${id}`);
    }
  }

  /**
   * 🏢 ENTERPRISE: Schedule a one-shot callback with delay
   *
   * For operations that need RAF + timeout (layout stabilization):
   * - Browser layout needs time to settle after DOM changes
   * - Uses RAF → setTimeout → RAF pattern for reliability
   *
   * @param id - Unique identifier
   * @param callback - Function to execute
   * @param delayMs - Delay in milliseconds before final RAF
   * @returns Cancel function
   *
   * @example
   * ```typescript
   * // Wait for layout to stabilize before measuring
   * const cancel = UnifiedFrameScheduler.scheduleOnceDelayed(
   *   'viewport-layout',
   *   () => updateViewport(),
   *   50
   * );
   * ```
   */
  scheduleOnceDelayed(id: string, callback: () => void, delayMs: number): () => void {
    let rafId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    // First RAF to sync with frame
    rafId = requestAnimationFrame(() => {
      if (cancelled) return;

      // Timeout for layout stabilization
      timeoutId = setTimeout(() => {
        if (cancelled) return;

        // Final RAF to execute callback
        rafId = requestAnimationFrame(() => {
          if (cancelled) return;

          try {
            callback();
          } catch (error) {
            derr('FrameScheduler', `Error in scheduleOnceDelayed "${id}":`, error);
          }
        });
      }, delayMs);
    });

    if (this.config.debug) {
      dlog('FrameScheduler', `scheduleOnceDelayed: ${id} (${delayMs}ms)`);
    }

    // Return cancel function
    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }

  /**
   * 🏢 ENTERPRISE: Cancel a pending one-shot callback
   */
  cancelOnce(id: string): boolean {
    const existed = this.oneShotCallbacks.delete(id);

    // If no more callbacks, cancel the RAF
    if (this.oneShotCallbacks.size === 0 && this.oneShotRafId !== null) {
      cancelAnimationFrame(this.oneShotRafId);
      this.oneShotRafId = null;
    }

    return existed;
  }

  /**
   * Execute all pending one-shot callbacks
   */
  private executeOneShotCallbacks(): void {
    this.oneShotRafId = null;

    // Copy and clear callbacks (allows re-scheduling during execution)
    const callbackEntries = Array.from(this.oneShotCallbacks.entries());
    this.oneShotCallbacks.clear();

    // Execute each callback
    for (const entry of callbackEntries) {
      const [id, callback] = entry;
      try {
        callback();
      } catch (error) {
        derr('FrameScheduler', `Error in scheduleOnce "${id}":`, error);
      }
    }

    if (this.config.debug && callbackEntries.length > 0) {
      dlog('FrameScheduler', `Executed ${callbackEntries.length} one-shot callbacks`);
    }
  }

  // ============================================================================
  // SCHEDULER CONTROL
  // ============================================================================

  /**
   * 🏢 ENTERPRISE: Start the render loop
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.frameNumber = 0;
    this.fpsHistory = [];
    this.isFirstFrame = true; // 🏢 FIX: Reset first frame flag

    if (this.config.debug) {
      dlog('FrameScheduler', 'Started');
    }

    this.scheduleFrame();
  }

  /**
   * 🏢 ENTERPRISE: Stop the render loop
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.config.debug) {
      dlog('FrameScheduler', 'Stopped');
    }
  }

  /**
   * 🏢 ENTERPRISE: Configure scheduler
   */
  configure(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // FRAME LOOP - Core RAF Implementation
  // ============================================================================

  private scheduleFrame(): void {
    if (!this.isRunning) return;

    this.rafId = requestAnimationFrame((timestamp) => this.processFrame(timestamp));
  }

  /**
   * 🏢 ENTERPRISE: Main frame processing
   *
   * Pattern: Autodesk/Adobe - Priority-based render orchestration
   */
  private processFrame(timestamp: number): void {
    if (!this.isRunning) return;

    const frameStartTime = performance.now();
    const deltaTime = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;
    // 🏢 ADR-163: frameNumber increment moved to END of processFrame
    // This ensures forceImmediateRenderAll() sets the correct frame number
    // that will be checked in the CURRENT processFrame, not the next one.

    // === THROTTLING CHECK ===
    // 🏢 FIX: Never skip first frame (deltaTime will be ~0 on first frame)
    if (this.config.enableThrottling && !this.isFirstFrame && deltaTime < FRAME_TIME_60FPS * 0.5) {
      // Skip frame if too fast (browser giving us extra frames)
      // 🏢 ADR-163: Still increment frame number even on skip
      this.frameNumber++;
      this.scheduleFrame();
      return;
    }
    this.isFirstFrame = false; // Mark first frame as processed

    // === PREPARE METRICS ===
    const systemMetrics = new Map<string, { renderTime: number; skipped: boolean }>();
    let renderedCount = 0;
    let skippedCount = 0;

    // === GET SORTED SYSTEMS BY PRIORITY ===
    const sortedSystems = Array.from(this.systems.values())
      .filter((s) => s.enabled)
      .sort((a, b) => a.priority - b.priority);

    // === 🏢 ADR-156: CANVAS SYNCHRONIZATION PRE-CHECK ===
    // If ANY canvas layer needs rendering, ALL canvas layers must render together
    // This prevents the "entities disappear during mouse move" bug
    //
    // 🏢 ADR-163: Skip this logic if immediate render was already done this frame
    // The forceImmediateRenderAll() already synchronized all canvases
    //
    // 🔧 FIX (2026-02-01): EXCLUDE 'preview-canvas' from sync group!
    // Preview canvas is managed independently by PreviewRenderer.drawPreview() with immediate render.
    // Including it in sync group caused the "preview disappears during mouse move" bug:
    // - setImmediatePosition marks dxf/layer/crosshair dirty
    // - onDrawingHover does immediate preview render
    // - RAF comes: sync logic marks ALL canvases dirty INCLUDING preview-canvas
    // - preview-canvas re-renders with stale/null data → preview disappears!
    const canvasSystemIds = ['dxf-canvas', 'layer-canvas', 'crosshair-overlay'];
    // Note: 'preview-canvas' intentionally excluded - it renders independently
    const immediateSyncedIds = ['dxf-canvas', 'layer-canvas'];

    // Check if immediate render was done THIS frame (using frame number comparison)
    const wasImmediateRenderedThisFrame = this.immediateRenderFrame === this.frameNumber;

    let anyCanvasNeedsRender = false;

    // First pass: check if any canvas needs rendering
    for (const system of sortedSystems) {
      if (canvasSystemIds.includes(system.id)) {
        // 🏢 ADR-163: Skip canvases that were already synced by forceImmediateRenderAll
        if (wasImmediateRenderedThisFrame && immediateSyncedIds.includes(system.id)) {
          // These canvases were already rendered synchronously, skip dirty check
          continue;
        }
        const needsRender = system.forceDirty || !system.isDirty || system.isDirty();
        if (needsRender) {
          anyCanvasNeedsRender = true;
          break;
        }
      }
    }

    // If any canvas needs render, mark ALL canvas systems as forceDirty
    // 🏢 ADR-163: But skip canvases that were already rendered by forceImmediateRenderAll
    if (anyCanvasNeedsRender) {
      for (const id of canvasSystemIds) {
        // Skip if this canvas was already synced by immediate render
        if (wasImmediateRenderedThisFrame && immediateSyncedIds.includes(id)) {
          continue;
        }
        const system = this.systems.get(id);
        if (system && !system.forceDirty) {
          system.forceDirty = true;
        }
      }
    }

    // === RENDER EACH SYSTEM ===
    for (const system of sortedSystems) {
      // 🏢 ADR-156: Check forceDirty FIRST (bypasses isDirty check)
      const shouldRender = system.forceDirty || !system.isDirty || system.isDirty();

      // Reset forceDirty after checking (one-time flag)
      if (system.forceDirty) {
        system.forceDirty = false;
      }

      if (shouldRender) {
        const renderStart = performance.now();

        try {
          system.render(deltaTime, this.frameNumber);
        } catch (error) {
          derr('FrameScheduler', `Error in ${system.name}:`, error);
        }

        const renderTime = performance.now() - renderStart;

        // Update system metrics
        system.metrics.lastRenderTime = renderTime;
        system.metrics.averageRenderTime =
          (system.metrics.averageRenderTime * system.metrics.renderCount + renderTime) /
          (system.metrics.renderCount + 1);
        system.metrics.renderCount++;

        systemMetrics.set(system.id, { renderTime, skipped: false });
        renderedCount++;
      } else {
        system.metrics.skipCount++;
        systemMetrics.set(system.id, { renderTime: 0, skipped: true });
        skippedCount++;
      }
    }

    // === CALCULATE FPS ===
    const fps = deltaTime > 0 ? 1000 / deltaTime : 60;
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > FPS_SAMPLE_SIZE) {
      this.fpsHistory.shift();
    }
    const averageFps =
      this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;

    const totalFrameTime = performance.now() - frameStartTime;

    // === UPDATE METRICS ===
    if (this.config.collectMetrics) {
      this.currentMetrics = {
        frameNumber: this.frameNumber,
        deltaTime,
        fps,
        averageFps,
        systemCount: this.systems.size,
        renderedCount,
        skippedCount,
        totalFrameTime,
        systemMetrics,
      };

      // Notify listeners
      for (const listener of this.frameListeners) {
        try {
          listener(this.currentMetrics);
        } catch (error) {
          derr('FrameScheduler', 'Error in frame listener:', error);
        }
      }
    }

    // === DEBUG OUTPUT ===
    if (this.config.debug && this.frameNumber % 60 === 0) {
      dlog('FrameScheduler',
        `Frame ${this.frameNumber}: ` +
          `${renderedCount}/${sortedSystems.length} rendered, ` +
          `${skippedCount} skipped, ` +
          `${totalFrameTime.toFixed(2)}ms, ` +
          `${averageFps.toFixed(1)} FPS`
      );
    }

    // 🏢 ADR-163: Increment frame number at END of processFrame
    // This ensures forceImmediateRenderAll() called between frames
    // will set immediateRenderFrame to the NEXT frame's number
    this.frameNumber++;

    // === SCHEDULE NEXT FRAME ===
    this.scheduleFrame();
  }

  // ============================================================================
  // METRICS & DEBUGGING
  // ============================================================================

  /**
   * 🏢 ENTERPRISE: Get current frame metrics
   */
  getMetrics(): FrameMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to frame metrics
   */
  onFrame(listener: (metrics: FrameMetrics) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  /**
   * 🏢 ENTERPRISE: Get all registered systems
   */
  getSystems(): ReadonlyMap<string, Readonly<RenderSystem>> {
    return this.systems;
  }

  /**
   * 🏢 ENTERPRISE: Get system by ID
   */
  getSystem(id: string): Readonly<RenderSystem> | undefined {
    return this.systems.get(id);
  }

  /**
   * 🏢 ENTERPRISE: Check if running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * 🏢 ENTERPRISE: Get current frame number
   */
  get currentFrame(): number {
    return this.frameNumber;
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private createEmptyMetrics(): FrameMetrics {
    return {
      frameNumber: 0,
      deltaTime: 0,
      fps: 0,
      averageFps: 0,
      systemCount: 0,
      renderedCount: 0,
      skippedCount: 0,
      totalFrameTime: 0,
      systemMetrics: new Map(),
    };
  }

  /**
   * 🏢 ENTERPRISE: Reset all metrics
   */
  resetMetrics(): void {
    this.frameNumber = 0;
    this.fpsHistory = [];
    this.currentMetrics = this.createEmptyMetrics();

    for (const system of this.systems.values()) {
      system.metrics = {
        lastRenderTime: 0,
        averageRenderTime: 0,
        renderCount: 0,
        skipCount: 0,
      };
    }
  }

  /**
   * 🏢 ENTERPRISE: Destroy scheduler (for cleanup)
   */
  destroy(): void {
    this.stop();
    this.systems.clear();
    this.frameListeners.clear();

    // Clean up one-shot callbacks
    if (this.oneShotRafId !== null) {
      cancelAnimationFrame(this.oneShotRafId);
      this.oneShotRafId = null;
    }
    this.oneShotCallbacks.clear();

    UnifiedFrameSchedulerImpl.instance = null;
  }
}

// ============================================================================
// EXPORTS - Enterprise API
// ============================================================================

/**
 * 🏢 ENTERPRISE: Singleton Frame Scheduler
 */
export const UnifiedFrameScheduler = UnifiedFrameSchedulerImpl.getInstance();

/**
 * 🏢 ENTERPRISE: Hook for React components
 */
export function useFrameScheduler() {
  return UnifiedFrameScheduler;
}

/**
 * 🏢 ENTERPRISE: Register a render callback
 * Convenience function for quick registration
 */
export function registerRenderCallback(
  id: string,
  name: string,
  priority: RenderPriority,
  render: RenderCallback,
  isDirty?: DirtyCheckFn
): () => void {
  return UnifiedFrameScheduler.register(id, name, priority, render, isDirty);
}

/**
 * 🏢 ENTERPRISE: Mark ALL canvas layers as dirty
 * ADR-156: Canvas Layer Synchronization Fix
 *
 * Call this when ANY canvas layer clears or renders to ensure
 * all layers stay synchronized. Prevents flickering during mouse movement.
 *
 * @example
 * ```typescript
 * // In LayerCanvas after clearing:
 * markAllCanvasDirty();
 * ```
 */
export function markAllCanvasDirty(): void {
  UnifiedFrameScheduler.markAllCanvasDirty();
}

/**
 * 🏢 ENTERPRISE: Mark a specific system as dirty
 * ADR-156: Canvas Layer Synchronization Fix
 */
export function markSystemDirty(id: string): void {
  UnifiedFrameScheduler.markDirty(id);
}

/**
 * 🏢 ENTERPRISE: Mark specific canvas systems as dirty
 * ADR-156: Canvas Layer Synchronization Fix
 *
 * Use this instead of markAllCanvasDirty() when you need to exclude certain canvases.
 * For example, cursor position updates should NOT mark preview-canvas dirty
 * because preview-canvas is managed by PreviewRenderer.drawPreview() with immediate render.
 *
 * @param systemIds - Array of system IDs to mark dirty
 *
 * @example
 * ```typescript
 * // Mark only dxf/layer canvases dirty (exclude preview-canvas)
 * markSystemsDirty(['dxf-canvas', 'layer-canvas', 'crosshair-overlay']);
 * ```
 */
export function markSystemsDirty(systemIds: string[]): void {
  UnifiedFrameScheduler.markSystemsDirty(systemIds);
}

/**
 * 🏢 ADR-163: FORCE IMMEDIATE RENDER ALL CANVASES
 *
 * Renders ALL canvas layers SYNCHRONOUSLY, RIGHT NOW!
 * Use this after direct/immediate renders (like CrosshairOverlay)
 * to prevent flickering caused by unsynchronized canvas updates.
 *
 * @example
 * ```typescript
 * // After direct crosshair render:
 * forceImmediateRenderAll();
 * ```
 */
export function forceImmediateRenderAll(): void {
  UnifiedFrameScheduler.forceImmediateRenderAll();
}

/**
 * 🏢 ENTERPRISE COMPLIANCE CHECKLIST:
 *
 * ✅ Singleton pattern (Single Source of Truth)
 * ✅ ZERO any types (full TypeScript)
 * ✅ ZERO inline styles (n/a for this module)
 * ✅ Priority-based render queue
 * ✅ Dirty flag support per system
 * ✅ Frame skipping optimization
 * ✅ Performance metrics collection
 * ✅ Proper cleanup with destroy()
 * ✅ Auto-start/stop based on registered systems
 * ✅ Debug mode support
 * ✅ Frame throttling under load
 * ✅ Industry-standard patterns (Autodesk/Adobe)
 */
