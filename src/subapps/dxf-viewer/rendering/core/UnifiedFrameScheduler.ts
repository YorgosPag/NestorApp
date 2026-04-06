/**
 * Unified Frame Scheduler — Enterprise RAF Orchestrator
 * Pattern: Autodesk Revit / Adobe Illustrator / Bentley MicroStation
 * ADR-065 SRP split: 973 lines -> 4 files (types, one-shot, api, main)
 */

import { dlog, dwarn, derr } from '../../debug';
import { OneShotScheduler } from './OneShotScheduler';
import type {
  RenderPriority, RenderCallback, DirtyCheckFn,
  RenderSystem, FrameMetrics, SchedulerConfig,
} from './frame-scheduler-types';
import { DEFAULT_CONFIG, FRAME_TIME_60FPS, FPS_SAMPLE_SIZE } from './frame-scheduler-types';

// Re-export everything from types and API for backward compatibility
export type { RenderPriority, RenderCallback, DirtyCheckFn, RenderSystem, FrameMetrics, SchedulerConfig };
export { RENDER_PRIORITIES } from './frame-scheduler-types';
export {
  useFrameScheduler,
  registerRenderCallback,
  markAllCanvasDirty,
  markSystemDirty,
  markSystemsDirty,
  forceImmediateRenderAll,
} from './frame-scheduler-api';

class UnifiedFrameSchedulerImpl {
  private static instance: UnifiedFrameSchedulerImpl | null = null;

  private systems: Map<string, RenderSystem> = new Map();
  private config: SchedulerConfig = { ...DEFAULT_CONFIG };
  private isRunning = false;
  private rafId: number | null = null;

  private lastFrameTime = 0;
  private frameNumber = 0;
  private fpsHistory: number[] = [];
  private isFirstFrame = true;

  // ADR-163: Immediate render debounce
  private immediateRenderFrame = -1;

  private currentMetrics: FrameMetrics = this.createEmptyMetrics();
  private frameListeners: Set<(metrics: FrameMetrics) => void> = new Set();

  // Composition: One-shot scheduling delegated to OneShotScheduler
  private oneShot: OneShotScheduler;

  private constructor() {
    this.oneShot = new OneShotScheduler(this.config);
  }

  static getInstance(): UnifiedFrameSchedulerImpl {
    if (!UnifiedFrameSchedulerImpl.instance) {
      UnifiedFrameSchedulerImpl.instance = new UnifiedFrameSchedulerImpl();
    }
    return UnifiedFrameSchedulerImpl.instance;
  }

  // ===== SYSTEM REGISTRATION =====

  register(
    id: string, name: string, priority: RenderPriority,
    render: RenderCallback, isDirty?: DirtyCheckFn
  ): () => void {
    if (this.systems.has(id)) {
      dwarn('FrameScheduler', `System "${id}" already registered, replacing...`);
    }

    this.systems.set(id, {
      id, name, priority, render, isDirty,
      enabled: true, forceDirty: false,
      metrics: { lastRenderTime: 0, averageRenderTime: 0, renderCount: 0, skipCount: 0 },
    });

    if (this.config.debug) dlog('FrameScheduler', `Registered: ${name} (priority: ${priority})`);
    if (this.systems.size === 1 && !this.isRunning) this.start();
    return () => this.unregister(id);
  }

  unregister(id: string): void {
    const system = this.systems.get(id);
    if (system) {
      this.systems.delete(id);
      if (this.config.debug) dlog('FrameScheduler', `Unregistered: ${system.name}`);
    }
    if (this.systems.size === 0 && this.isRunning) this.stop();
  }

  setEnabled(id: string, enabled: boolean): void {
    const system = this.systems.get(id);
    if (system) system.enabled = enabled;
  }

  // ===== DIRTY FLAGGING (ADR-156) =====

  markDirty(id: string): void {
    const system = this.systems.get(id);
    if (system) {
      system.forceDirty = true;
      if (this.config.debug) dlog('FrameScheduler', `markDirty: ${system.name}`);
    }
  }

  markAllCanvasDirty(): void {
    const ids = ['dxf-canvas', 'layer-canvas', 'preview-canvas', 'crosshair-overlay'];
    for (const id of ids) {
      const system = this.systems.get(id);
      if (system) system.forceDirty = true;
    }
    if (this.config.debug) dlog('FrameScheduler', `markAllCanvasDirty: ${ids.length} systems`);
  }

  markSystemsDirty(systemIds: string[]): void {
    for (const id of systemIds) {
      const system = this.systems.get(id);
      if (system) system.forceDirty = true;
    }
    if (this.config.debug) dlog('FrameScheduler', `markSystemsDirty: ${systemIds.join(', ')}`);
  }

  /**
   * ADR-163: Force SYNCHRONOUS render of all canvas layers.
   * Debounced: only one immediate render per frame.
   */
  forceImmediateRenderAll(): void {
    if (this.immediateRenderFrame === this.frameNumber) return;
    this.immediateRenderFrame = this.frameNumber;

    const ids = ['dxf-canvas', 'layer-canvas', 'preview-canvas'];
    for (const id of ids) {
      const system = this.systems.get(id);
      if (system && system.enabled) {
        try {
          system.render(0, this.frameNumber);
          system.forceDirty = false;
        } catch (error) {
          derr('FrameScheduler', `forceImmediateRenderAll error in ${id}:`, error);
        }
      }
    }
  }

  // ===== ONE-SHOT SCHEDULING (delegated) =====

  scheduleOnce(id: string, callback: () => void): void {
    this.oneShot.schedule(id, callback);
  }

  scheduleOnceDelayed(id: string, callback: () => void, delayMs: number): () => void {
    return this.oneShot.scheduleDelayed(id, callback, delayMs);
  }

  cancelOnce(id: string): boolean {
    return this.oneShot.cancel(id);
  }

  // ===== SCHEDULER CONTROL =====

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.frameNumber = 0;
    this.fpsHistory = [];
    this.isFirstFrame = true;
    if (this.config.debug) dlog('FrameScheduler', 'Started');
    this.scheduleFrame();
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.config.debug) dlog('FrameScheduler', 'Stopped');
  }

  configure(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
    this.oneShot.setConfig(this.config);
  }

  // ===== FRAME LOOP =====

  private scheduleFrame(): void {
    if (!this.isRunning) return;
    this.rafId = requestAnimationFrame((ts) => this.processFrame(ts));
  }

  private processFrame(timestamp: number): void {
    if (!this.isRunning) return;

    const frameStartTime = performance.now();
    const deltaTime = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    // Throttling: skip if too fast (except first frame)
    if (this.config.enableThrottling && !this.isFirstFrame && deltaTime < FRAME_TIME_60FPS * 0.5) {
      this.frameNumber++;
      this.scheduleFrame();
      return;
    }
    this.isFirstFrame = false;

    const systemMetrics = new Map<string, { renderTime: number; skipped: boolean }>();
    let renderedCount = 0;
    let skippedCount = 0;

    const sortedSystems = Array.from(this.systems.values())
      .filter((s) => s.enabled)
      .sort((a, b) => a.priority - b.priority);

    // ADR-156 + ADR-163: Canvas synchronization pre-check
    // preview-canvas excluded from sync group (managed independently by PreviewRenderer)
    const canvasIds = ['dxf-canvas', 'layer-canvas', 'crosshair-overlay'];
    const immediateSyncedIds = ['dxf-canvas', 'layer-canvas'];
    const wasImmediateRenderedThisFrame = this.immediateRenderFrame === this.frameNumber;

    let anyCanvasNeedsRender = false;
    for (const system of sortedSystems) {
      if (canvasIds.includes(system.id)) {
        if (wasImmediateRenderedThisFrame && immediateSyncedIds.includes(system.id)) continue;
        if (system.forceDirty || !system.isDirty || system.isDirty()) {
          anyCanvasNeedsRender = true;
          break;
        }
      }
    }

    if (anyCanvasNeedsRender) {
      for (const id of canvasIds) {
        if (wasImmediateRenderedThisFrame && immediateSyncedIds.includes(id)) continue;
        const system = this.systems.get(id);
        if (system && !system.forceDirty) system.forceDirty = true;
      }
    }

    // Render each system
    for (const system of sortedSystems) {
      const shouldRender = system.forceDirty || !system.isDirty || system.isDirty();
      if (system.forceDirty) system.forceDirty = false;

      if (shouldRender) {
        const renderStart = performance.now();
        try { system.render(deltaTime, this.frameNumber); }
        catch (error) { derr('FrameScheduler', `Error in ${system.name}:`, error); }

        const renderTime = performance.now() - renderStart;
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

    // FPS calculation
    const fps = deltaTime > 0 ? 1000 / deltaTime : 60;
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > FPS_SAMPLE_SIZE) this.fpsHistory.shift();
    const averageFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
    const totalFrameTime = performance.now() - frameStartTime;

    // Metrics collection
    if (this.config.collectMetrics) {
      this.currentMetrics = {
        frameNumber: this.frameNumber, deltaTime, fps, averageFps,
        systemCount: this.systems.size, renderedCount, skippedCount,
        totalFrameTime, systemMetrics,
      };
      for (const listener of this.frameListeners) {
        try { listener(this.currentMetrics); }
        catch (error) { derr('FrameScheduler', 'Error in frame listener:', error); }
      }
    }

    if (this.config.debug && this.frameNumber % 60 === 0) {
      dlog('FrameScheduler',
        `Frame ${this.frameNumber}: ${renderedCount}/${sortedSystems.length} rendered, ` +
        `${skippedCount} skipped, ${totalFrameTime.toFixed(2)}ms, ${averageFps.toFixed(1)} FPS`
      );
    }

    this.frameNumber++;
    this.scheduleFrame();
  }

  // ===== METRICS & ACCESSORS =====

  getMetrics(): FrameMetrics { return { ...this.currentMetrics }; }

  onFrame(listener: (metrics: FrameMetrics) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  getSystems(): ReadonlyMap<string, Readonly<RenderSystem>> { return this.systems; }
  getSystem(id: string): Readonly<RenderSystem> | undefined { return this.systems.get(id); }
  get running(): boolean { return this.isRunning; }
  get currentFrame(): number { return this.frameNumber; }

  private createEmptyMetrics(): FrameMetrics {
    return {
      frameNumber: 0, deltaTime: 0, fps: 0, averageFps: 0,
      systemCount: 0, renderedCount: 0, skippedCount: 0,
      totalFrameTime: 0, systemMetrics: new Map(),
    };
  }

  resetMetrics(): void {
    this.frameNumber = 0;
    this.fpsHistory = [];
    this.currentMetrics = this.createEmptyMetrics();
    for (const system of this.systems.values()) {
      system.metrics = { lastRenderTime: 0, averageRenderTime: 0, renderCount: 0, skipCount: 0 };
    }
  }

  destroy(): void {
    this.stop();
    this.systems.clear();
    this.frameListeners.clear();
    this.oneShot.destroy();
    UnifiedFrameSchedulerImpl.instance = null;
  }
}

/** Singleton Frame Scheduler instance */
export const UnifiedFrameScheduler = UnifiedFrameSchedulerImpl.getInstance();
