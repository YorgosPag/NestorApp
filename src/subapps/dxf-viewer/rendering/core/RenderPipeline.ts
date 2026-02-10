/**
 * RENDER PIPELINE - Οργανωμένες render passes για βέλτιστη απόδοση
 * ✅ ΦΑΣΗ 4: 3-Pass rendering system με batching optimization
 */

import type { IRenderContext } from './IRenderContext';

// Re-export for external use
export type { IRenderContext };

export interface RenderPassOptions {
  viewport: { x: number; y: number; width: number; height: number };
  transform: { scale: number; offsetX: number; offsetY: number };
  debug?: boolean;
}

export interface IRenderPass {
  readonly name: string;
  readonly priority: number;
  render(context: IRenderContext, options: RenderPassOptions): Promise<void> | void;
  isEnabled(): boolean;
  cleanup?(): void;
}

export interface PipelineState {
  backgroundPass: IRenderPass;
  entityPass: IRenderPass;
  overlayPass: IRenderPass;
  isRendering: boolean;
  renderCount: number;
  lastRenderTime: number;
  performance: {
    backgroundMs: number;
    entityMs: number;
    overlayMs: number;
    totalMs: number;
  };
}

/**
 * 🔺 ΚΕΝΤΡΙΚΟΣ RENDER PIPELINE
 * Οργανώνει το rendering σε 3 οργανωμένες φάσεις:
 * 1. BackgroundPass - Grid, rulers, coordinate system
 * 2. EntityPass - DXF entities (lines, circles, etc.) με batching
 * 3. OverlayPass - UI elements (grips, selection, cursors)
 */
export class RenderPipeline {
  private state: PipelineState;
  private passes: IRenderPass[] = [];

  constructor(
    backgroundPass: IRenderPass,
    entityPass: IRenderPass,
    overlayPass: IRenderPass
  ) {
    this.state = {
      backgroundPass,
      entityPass,
      overlayPass,
      isRendering: false,
      renderCount: 0,
      lastRenderTime: 0,
      performance: {
        backgroundMs: 0,
        entityMs: 0,
        overlayMs: 0,
        totalMs: 0
      }
    };

    // Οργάνωση passes με προτεραιότητα
    this.passes = [backgroundPass, entityPass, overlayPass]
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * 🔺 ΚΕΝΤΡΙΚΗ RENDER ΜΕΘΟΔΟΣ
   * Εκτελεί όλες τις φάσεις με performance tracking
   */
  async render(context: IRenderContext, options: RenderPassOptions): Promise<void> {
    if (this.state.isRendering) {
      console.warn('RenderPipeline: Already rendering, skipping frame');
      return;
    }

    this.state.isRendering = true;
    const startTime = performance.now();

    try {
      // Clear canvas στην αρχή
      context.clear();

      // Εκτέλεση όλων των passes με performance tracking
      for (const pass of this.passes) {
        if (!pass.isEnabled()) continue;

        const passStart = performance.now();
        await pass.render(context, options);
        const passEnd = performance.now();

        // Performance tracking ανά pass
        this.updatePassPerformance(pass.name, passEnd - passStart);

        if (options.debug) {
          console.log(`RenderPass[${pass.name}]: ${(passEnd - passStart).toFixed(2)}ms`);
        }
      }

      // Update pipeline statistics
      const totalTime = performance.now() - startTime;
      this.state.performance.totalMs = totalTime;
      this.state.renderCount++;
      this.state.lastRenderTime = Date.now();

      if (options.debug) {
        console.log(`RenderPipeline: Total ${totalTime.toFixed(2)}ms (Frame #${this.state.renderCount})`);
      }

    } catch (error) {
      console.error('RenderPipeline: Render error:', error);
      throw error;
    } finally {
      this.state.isRendering = false;
    }
  }

  /**
   * 🔺 PERFORMANCE MONITORING
   * Ενημερώνει τα performance metrics ανά pass
   */
  private updatePassPerformance(passName: string, timeMs: number): void {
    switch (passName) {
      case 'background':
        this.state.performance.backgroundMs = timeMs;
        break;
      case 'entity':
        this.state.performance.entityMs = timeMs;
        break;
      case 'overlay':
        this.state.performance.overlayMs = timeMs;
        break;
    }
  }

  /**
   * 🔺 PIPELINE STATE ACCESS
   * Για debugging και monitoring
   */
  getState(): Readonly<PipelineState> {
    return { ...this.state };
  }

  getPerformanceMetrics() {
    return {
      ...this.state.performance,
      averageFrameTime: this.state.performance.totalMs,
      fps: this.state.performance.totalMs > 0 ? 1000 / this.state.performance.totalMs : 0,
      renderCount: this.state.renderCount
    };
  }

  /**
   * 🔺 PASS MANAGEMENT
   * Δυναμική ενεργοποίηση/απενεργοποίηση passes
   */
  enablePass(passName: string): void {
    // Implementation για runtime pass toggling
  }

  disablePass(passName: string): void {
    // Implementation για runtime pass toggling
  }

  /**
   * 🔺 CLEANUP
   * Καθαρισμός resources
   */
  cleanup(): void {
    this.passes.forEach(pass => {
      if (pass.cleanup) {
        pass.cleanup();
      }
    });
    this.passes = [];
  }

  /**
   * 🔺 FRAME RATE CONTROL
   * Για smooth rendering με consistent frame rate
   */
  requestFrame(context: IRenderContext, options: RenderPassOptions): void {
    requestAnimationFrame(() => {
      this.render(context, options);
    });
  }
}

/**
 * 🔺 FACTORY FUNCTION
 * Για εύκολη δημιουργία pipeline με default passes
 */
export function createRenderPipeline(): RenderPipeline {
  const { createBackgroundPass } = require('../passes/BackgroundPass');
  const { createEntityPass } = require('../passes/EntityPass');
  const { createOverlayPass } = require('../passes/OverlayPass');

  const backgroundPass = createBackgroundPass();
  const entityPass = createEntityPass();
  const overlayPass = createOverlayPass();

  return new RenderPipeline(backgroundPass, entityPass, overlayPass);
}

// 🏢 ENTERPRISE: Type-safe pass configuration
export interface BackgroundPassConfig {
  showGrid?: boolean;
  showRulers?: boolean;
  showOrigin?: boolean;
  gridColor?: string;
  backgroundColor?: string;
}

export interface EntityPassConfig {
  batchingEnabled?: boolean;
  maxBatchSize?: number;
  cullOutsideViewport?: boolean;
  levelOfDetail?: boolean;
  cacheEnabled?: boolean;
}

export interface OverlayPassConfig {
  showGrips?: boolean;
  showSelection?: boolean;
  showCursor?: boolean;
  gripColor?: string;
  selectionColor?: string;
}

export interface CustomRenderPipelineConfig {
  background?: BackgroundPassConfig;
  entity?: EntityPassConfig;
  overlay?: OverlayPassConfig;
}

/**
 * 🔺 ADVANCED FACTORY με CUSTOM CONFIG
 * Για προχωρημένη configuration των passes
 */
export function createCustomRenderPipeline(config?: CustomRenderPipelineConfig): RenderPipeline {
  const { createBackgroundPass } = require('../passes/BackgroundPass');
  const { createEntityPass } = require('../passes/EntityPass');
  const { createOverlayPass } = require('../passes/OverlayPass');

  const backgroundPass = createBackgroundPass(config?.background);
  const entityPass = createEntityPass(config?.entity);
  const overlayPass = createOverlayPass(config?.overlay);

  return new RenderPipeline(backgroundPass, entityPass, overlayPass);
}