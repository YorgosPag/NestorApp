/**
 * UI RENDERER COMPOSITE - Central orchestrator για UI rendering
 * ✅ ΦΑΣΗ 6: Unified UI rendering με batching και optimization
 */

import type { Viewport } from '../../types/Types';
import type {
  UIRenderer,
  UIRenderContext,
  UIElementSettings,
  UIRenderOptions,
  UIRenderMetrics,
  UIRendererFactory
} from './UIRenderer';
import { createUIRenderContext, DEFAULT_UI_TRANSFORM } from './UIRenderContext';

/**
 * 🔺 UI RENDERER REGISTRY ENTRY
 * Metadata για registered UI renderers
 */
interface UIRendererEntry {
  readonly factory: UIRendererFactory;
  readonly priority: number; // Lower number = higher priority
  readonly category: UICategory;
}

/**
 * 🔺 UI CATEGORIES
 * Grouping για different types of UI elements
 */
export type UICategory =
  | 'background'   // Grid, rulers
  | 'interaction'  // Cursors, crosshairs
  | 'feedback'     // Snap indicators, selection
  | 'overlay';     // Text, measurements

/**
 * 🔺 UI RENDERER COMPOSITE
 * Central orchestrator που manages όλα τα UI renderers
 */
export class UIRendererComposite {
  private ctx: CanvasRenderingContext2D;
  private renderers = new Map<string, UIRenderer>();
  private registry = new Map<string, UIRendererEntry>();
  private metrics: UIRenderMetrics[] = [];
  private options: UIRenderOptions;

  constructor(
    ctx: CanvasRenderingContext2D,
    options: Partial<UIRenderOptions> = {}
  ) {
    this.ctx = ctx;
    this.options = {
      enableBatching: true,
      enableCaching: true,
      enableMetrics: false,
      debugMode: false,
      ...options
    };
  }

  /**
   * Register νέος UI renderer
   */
  register(
    type: string,
    factory: UIRendererFactory,
    priority: number = 100,
    category: UICategory = 'overlay'
  ): void {
    this.registry.set(type, { factory, priority, category });
  }

  /**
   * Unregister UI renderer
   */
  unregister(type: string): void {
    const renderer = this.renderers.get(type);
    if (renderer?.cleanup) {
      renderer.cleanup();
    }
    this.renderers.delete(type);
    this.registry.delete(type);
  }

  /**
   * 🔺 MAIN RENDER METHOD
   * Renders όλα τα UI elements με proper ordering και batching
   */
  render(
    viewport: Viewport,
    settings: Map<string, UIElementSettings>,
    options: Partial<UIRenderOptions> = {},
    worldTransform?: any // 🎯 OPTIONAL: World transform για debug overlays (Origin Markers)
  ): void {
    const startTime = performance.now();
    const renderOptions = { ...this.options, ...options };

    // Create UI render context
    const uiContext = createUIRenderContext(
      this.ctx,
      viewport,
      DEFAULT_UI_TRANSFORM
    );

    // 🎯 EXTEND CONTEXT: Add world transform για debug overlays (Origin Markers)
    if (worldTransform) {
      (uiContext as any).worldTransform = worldTransform;
    }

    // Clear metrics if enabled
    if (renderOptions.enableMetrics) {
      this.metrics = [];
    }

    // Get sorted renderers by priority and category
    const sortedRenderers = this.getSortedRenderers();

    // Render by category για proper layering
    const categories: UICategory[] = ['background', 'interaction', 'feedback', 'overlay'];

    for (const category of categories) {
      if (renderOptions.enableBatching) {
        this.ctx.save();
      }

      for (const [type, renderer] of sortedRenderers) {
        const entry = this.registry.get(type);
        if (!entry || entry.category !== category) continue;

        const elementSettings = settings.get(type);
        if (!elementSettings?.enabled || !elementSettings?.visible) continue;

        try {
          const renderStart = performance.now();

          // Apply element-specific settings
          this.applyElementSettings(elementSettings);

          // Render the element
          renderer.render(uiContext, viewport, elementSettings);

          // Collect metrics
          if (renderOptions.enableMetrics) {
            const renderTime = performance.now() - renderStart;
            const elementMetrics = renderer.getMetrics?.() || {
              renderTime,
              drawCalls: 1,
              primitiveCount: 1
            };
            this.metrics.push(elementMetrics);
          }

        } catch (error) {
          console.error(`UI Renderer error [${type}]:`, error);
        }
      }

      if (renderOptions.enableBatching) {
        this.ctx.restore();
      }
    }

    // Debug information
    if (renderOptions.debugMode) {
      this.renderDebugInfo(viewport, performance.now() - startTime);
    }
  }

  /**
   * Get UI renderer instance (lazy creation)
   */
  private getRenderer(type: string, context: UIRenderContext): UIRenderer {
    if (!this.renderers.has(type)) {
      const entry = this.registry.get(type);
      if (!entry) {
        throw new Error(`UI Renderer not registered: ${type}`);
      }
      this.renderers.set(type, entry.factory(context));
    }
    return this.renderers.get(type)!;
  }

  /**
   * Get sorted renderers by priority
   */
  private getSortedRenderers(): [string, UIRenderer][] {
    const context = createUIRenderContext(this.ctx, { width: 0, height: 0 });

    return Array.from(this.registry.entries())
      .sort((a, b) => a[1].priority - b[1].priority)
      .map(([type]) => [type, this.getRenderer(type, context)]);
  }

  /**
   * Apply element-specific rendering settings
   */
  private applyElementSettings(settings: UIElementSettings): void {
    this.ctx.globalAlpha = settings.opacity;
    // Additional settings can be applied here
  }

  /**
   * Render debug information
   */
  private renderDebugInfo(viewport: Viewport, totalTime: number): void {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(10, 10, 200, 60);
    this.ctx.fillStyle = 'white';
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`UI Render: ${totalTime.toFixed(2)}ms`, 15, 25);
    this.ctx.fillText(`Renderers: ${this.renderers.size}`, 15, 40);
    this.ctx.fillText(`Metrics: ${this.metrics.length}`, 15, 55);
    this.ctx.restore();
  }

  /**
   * Get performance metrics
   */
  getMetrics(): UIRenderMetrics[] {
    return [...this.metrics];
  }

  /**
   * Clear all cached renderers
   */
  clearCache(): void {
    for (const renderer of this.renderers.values()) {
      if (renderer.cleanup) {
        renderer.cleanup();
      }
    }
    this.renderers.clear();
  }
}