/**
 * 🖼️ CANVAS MANAGER - Unified canvas lifecycle management
 * ✅ ΦΑΣΗ 7: Central orchestrator για όλα τα canvas instances
 *
 * ⚠️  ΠΡΙΝ ΔΗΜΙΟΥΡΓΗΣΕΙΣ ΝΕΟ CANVAS INSTANCE:
 * 📖 Architecture Guide: src/subapps/dxf-viewer/centralized_systems.md
 * 🔍 Section: "Canvas Management" - Χρησιμοποίησε το CanvasManager
 *
 * 🏢 ENTERPRISE PATTERN: Centralized canvas lifecycle με memory management
 *
 * @example
 * // ✅ ΣΩΣΤΑ - Μέσω CanvasManager
 * const canvas = canvasManager.createCanvas('layer', config);
 *
 * // ❌ ΛΑΘΟΣ - Direct canvas creation
 * const canvas = document.createElement('canvas'); // Bypass manager
 */

import type { CanvasConfig } from '../../types/Types';
import type { CanvasEventSystem } from './CanvasEventSystem';
import type { CanvasSettings } from './CanvasSettings';
import { CanvasUtils } from '../utils/CanvasUtils';

export interface CanvasInstance {
  readonly id: string;
  readonly type: 'dxf' | 'layer' | 'overlay';
  readonly element: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  readonly config: CanvasConfig;
  readonly zIndex: number;
  isActive: boolean;
  lastRenderTime: number;
}

export interface CanvasManagerOptions {
  enableCoordination: boolean;
  enableMetrics: boolean;
  maxCanvasInstances: number;
  sharedResources: boolean;
}

/**
 * 🔺 UNIFIED CANVAS MANAGER
 * Central coordinator για όλα τα canvas instances
 * Αντικαθιστά scattered canvas management logic
 */
export class CanvasManager {
  private canvases = new Map<string, CanvasInstance>();
  private eventSystem: CanvasEventSystem;
  private settings: CanvasSettings;
  private options: CanvasManagerOptions;
  private renderQueue: Set<string> = new Set();
  private isRendering = false;

  constructor(
    eventSystem: CanvasEventSystem,
    settings: CanvasSettings,
    options: Partial<CanvasManagerOptions> = {}
  ) {
    this.eventSystem = eventSystem;
    this.settings = settings;
    this.options = {
      enableCoordination: true,
      enableMetrics: true,
      maxCanvasInstances: 10,
      sharedResources: true,
      ...options
    };
  }

  /**
   * Register νέο canvas instance
   */
  registerCanvas(
    id: string,
    type: 'dxf' | 'layer' | 'overlay',
    element: HTMLCanvasElement,
    config: CanvasConfig,
    zIndex: number = 1
  ): CanvasInstance {
    if (this.canvases.has(id)) {
      throw new Error(`Canvas with id '${id}' already registered`);
    }

    if (this.canvases.size >= this.options.maxCanvasInstances) {
      throw new Error(`Maximum canvas instances (${this.options.maxCanvasInstances}) exceeded`);
    }

    const context = CanvasUtils.setupCanvasContext(element, config);

    const instance: CanvasInstance = {
      id,
      type,
      element,
      context,
      config,
      zIndex,
      isActive: true,
      lastRenderTime: 0
    };

    this.canvases.set(id, instance);

    // Emit registration event
    this.eventSystem.emit('canvas:registered', { id, type, zIndex });

    return instance;
  }

  /**
   * Unregister canvas instance
   */
  unregisterCanvas(id: string): void {
    const instance = this.canvases.get(id);
    if (!instance) return;

    // Cleanup resources
    this.cleanupCanvasInstance(instance);
    this.canvases.delete(id);
    this.renderQueue.delete(id);

    // Emit unregistration event
    this.eventSystem.emit('canvas:unregistered', { id });
  }

  /**
   * Get canvas instance by ID
   */
  getCanvas(id: string): CanvasInstance | null {
    return this.canvases.get(id) || null;
  }

  /**
   * Get όλα τα active canvas instances
   */
  getActiveCanvases(): CanvasInstance[] {
    return Array.from(this.canvases.values()).filter(canvas => canvas.isActive);
  }

  /**
   * Get canvases by type
   */
  getCanvasesByType(type: 'dxf' | 'layer' | 'overlay'): CanvasInstance[] {
    return Array.from(this.canvases.values()).filter(canvas => canvas.type === type);
  }

  /**
   * Schedule render για specific canvas
   */
  scheduleRender(canvasId: string): void {
    this.renderQueue.add(canvasId);

    if (!this.isRendering && this.options.enableCoordination) {
      requestAnimationFrame(() => this.processRenderQueue());
    }
  }

  /**
   * Schedule render για όλα τα canvases
   */
  scheduleRenderAll(): void {
    this.canvases.forEach((_, id) => this.renderQueue.add(id));

    if (!this.isRendering && this.options.enableCoordination) {
      requestAnimationFrame(() => this.processRenderQueue());
    }
  }

  /**
   * Process render queue με coordination
   */
  private async processRenderQueue(): Promise<void> {
    if (this.isRendering || this.renderQueue.size === 0) return;

    this.isRendering = true;
    const startTime = performance.now();

    try {
      // Sort canvases by zIndex για proper layering
      const canvasesToRender = Array.from(this.renderQueue)
        .map(id => this.canvases.get(id))
        .filter(Boolean)
        .sort((a, b) => a!.zIndex - b!.zIndex);

      // Clear render queue
      this.renderQueue.clear();

      // Emit render start event
      this.eventSystem.emit('render:start', {
        canvasCount: canvasesToRender.length,
        timestamp: startTime
      });

      // Process each canvas
      for (const canvas of canvasesToRender) {
        if (!canvas || !canvas.isActive) continue;

        try {
          const renderStart = performance.now();

          // Emit individual canvas render event
          this.eventSystem.emit('canvas:render', {
            canvasId: canvas.id,
            type: canvas.type
          });

          canvas.lastRenderTime = renderStart;

          if (this.options.enableMetrics) {
            const renderTime = performance.now() - renderStart;
            this.eventSystem.emit('canvas:rendered', {
              canvasId: canvas.id,
              renderTime,
              timestamp: renderStart
            });
          }

        } catch (error) {
          console.error(`Canvas render error [${canvas.id}]:`, error);
        }
      }

      // Emit render complete event
      const totalTime = performance.now() - startTime;
      this.eventSystem.emit('render:complete', {
        canvasCount: canvasesToRender.length,
        totalTime,
        timestamp: startTime
      });

    } finally {
      this.isRendering = false;
    }
  }


  /**
   * Cleanup canvas instance resources
   */
  private cleanupCanvasInstance(instance: CanvasInstance): void {
    // Clear canvas
    const rect = instance.element.getBoundingClientRect();
    instance.context.clearRect(0, 0, rect.width, rect.height);

    // Reset transform
    instance.context.setTransform(1, 0, 0, 1, 0, 0);
  }

  /**
   * Get rendering metrics
   */
  getMetrics(): any {
    return {
      totalCanvases: this.canvases.size,
      activeCanvases: this.getActiveCanvases().length,
      queuedRenders: this.renderQueue.size,
      isRendering: this.isRendering,
      canvasesByType: {
        dxf: this.getCanvasesByType('dxf').length,
        layer: this.getCanvasesByType('layer').length,
        overlay: this.getCanvasesByType('overlay').length
      }
    };
  }

  /**
   * Cleanup όλα τα canvas instances
   */
  cleanup(): void {
    this.canvases.forEach(instance => this.cleanupCanvasInstance(instance));
    this.canvases.clear();
    this.renderQueue.clear();
    this.isRendering = false;
  }
}