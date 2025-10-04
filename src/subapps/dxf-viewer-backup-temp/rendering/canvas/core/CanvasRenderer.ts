/**
 * CANVAS RENDERER - Single rendering entry point
 * ✅ ΦΑΣΗ 7: Unified renderer που orchestrates όλα τα subsystems
 */

import type { EntityRendererComposite } from '../../core/EntityRendererComposite';
import type { UIRendererComposite } from '../../ui/core/UIRendererComposite';
import type { RenderPipeline } from '../../passes/RenderPipeline';
import type { CanvasInstance } from './CanvasManager';
import type { CanvasSettings, CanvasRenderSettings } from './CanvasSettings';
import type { CanvasEventSystem } from './CanvasEventSystem';
import type { Viewport } from '../../types/Types';
import { CanvasUtils } from '../utils/CanvasUtils';

export interface RenderContext {
  canvas: CanvasInstance;
  viewport: Viewport;
  transform: {
    scale: number;
    offsetX: number;
    offsetY: number;
  };
  settings: CanvasRenderSettings;
  timestamp: number;
}

export interface RenderOptions {
  enableBatching: boolean;
  enableMetrics: boolean;
  enableCaching: boolean;
  clearCanvas: boolean;
  debugMode: boolean;
}

export interface RenderResult {
  success: boolean;
  renderTime: number;
  entitiesRendered: number;
  uiElementsRendered: number;
  cacheHits: number;
  cacheMisses: number;
  errors: string[];
}

/**
 * 🔺 UNIFIED CANVAS RENDERER
 * Single entry point για όλο το rendering
 * Orchestrates EntityRenderer, UIRenderer, και RenderPipeline
 */
export class CanvasRenderer {
  private entityRenderer: EntityRendererComposite;
  private uiRenderer: UIRendererComposite;
  private renderPipeline: RenderPipeline;
  private canvasSettings: CanvasSettings;
  private eventSystem: CanvasEventSystem;
  private renderCount = 0;
  private lastRenderTime = 0;

  constructor(
    entityRenderer: EntityRendererComposite,
    uiRenderer: UIRendererComposite,
    renderPipeline: RenderPipeline,
    canvasSettings: CanvasSettings,
    eventSystem: CanvasEventSystem
  ) {
    this.entityRenderer = entityRenderer;
    this.uiRenderer = uiRenderer;
    this.renderPipeline = renderPipeline;
    this.canvasSettings = canvasSettings;
    this.eventSystem = eventSystem;
  }

  /**
   * Main render method - orchestrates όλο το rendering
   */
  async render(
    context: RenderContext,
    entities: any[] = [],
    options: Partial<RenderOptions> = {}
  ): Promise<RenderResult> {
    const startTime = performance.now();
    this.renderCount++;

    const renderOptions: RenderOptions = {
      enableBatching: true,
      enableMetrics: true,
      enableCaching: true,
      clearCanvas: true,
      debugMode: false,
      ...options
    };

    const result: RenderResult = {
      success: false,
      renderTime: 0,
      entitiesRendered: 0,
      uiElementsRendered: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: []
    };

    try {
      // Emit render start event
      this.eventSystem.emit('canvas:render:start', {
        canvasId: context.canvas.id,
        entityCount: entities.length,
        renderOptions
      });

      // Clear canvas if requested
      if (renderOptions.clearCanvas) {
        const backgroundColor = context.canvas.config.backgroundColor || 'transparent';
        CanvasUtils.clearCanvas(context.canvas.context, context.canvas.element, backgroundColor);
      }

      // Unified rendering approach vs legacy approach
      if (context.settings.useUnifiedRendering) {
        const unifiedResult = await this.renderUnified(context, entities, renderOptions);
        Object.assign(result, unifiedResult);
      } else {
        const legacyResult = await this.renderLegacy(context, entities, renderOptions);
        Object.assign(result, legacyResult);
      }

      result.success = true;

    } catch (error) {
      console.error('Canvas render error:', error);
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    // Calculate final metrics
    result.renderTime = performance.now() - startTime;
    this.lastRenderTime = result.renderTime;

    // Emit render complete event
    this.eventSystem.emit('canvas:render:complete', {
      canvasId: context.canvas.id,
      result
    });

    if (renderOptions.debugMode) {
      console.log('🎨 Canvas Render Result:', result);
    }

    return result;
  }

  /**
   * Unified rendering path μέσω RenderPipeline
   */
  private async renderUnified(
    context: RenderContext,
    entities: any[],
    options: RenderOptions
  ): Promise<Partial<RenderResult>> {
    const result: Partial<RenderResult> = {
      entitiesRendered: 0,
      uiElementsRendered: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    // Use RenderPipeline για coordinated rendering
    const pipelineResult = await this.renderPipeline.render(
      context.canvas.context,
      context.viewport,
      {
        entities,
        transform: context.transform,
        settings: context.settings,
        enableBatching: options.enableBatching,
        enableMetrics: options.enableMetrics,
        debugMode: options.debugMode
      }
    );

    // Aggregate results
    result.entitiesRendered = entities.length;
    result.uiElementsRendered = this.getUIElementCount(context.settings);

    if (options.enableMetrics && pipelineResult.metrics) {
      result.cacheHits = pipelineResult.metrics.cacheHits || 0;
      result.cacheMisses = pipelineResult.metrics.cacheMisses || 0;
    }

    return result;
  }

  /**
   * Legacy rendering path για backward compatibility
   */
  private async renderLegacy(
    context: RenderContext,
    entities: any[],
    options: RenderOptions
  ): Promise<Partial<RenderResult>> {
    const result: Partial<RenderResult> = {
      entitiesRendered: 0,
      uiElementsRendered: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    // 1. Render entities μέσω EntityRendererComposite
    if (entities.length > 0) {
      try {
        await this.entityRenderer.render(
          context.canvas.context,
          entities,
          context.viewport,
          context.transform,
          {
            enableBatching: options.enableBatching,
            enableCaching: options.enableCaching,
            debugMode: options.debugMode
          }
        );
        result.entitiesRendered = entities.length;
      } catch (error) {
        console.error('Entity rendering error:', error);
      }
    }

    // 2. Render UI elements μέσω UIRendererComposite
    try {
      const uiSettings = this.createUISettings(context.settings);
      const extendedViewport = {
        x: 0,
        y: 0,
        width: context.viewport.width,
        height: context.viewport.height
      };

      this.uiRenderer.render(extendedViewport, uiSettings, {
        enableBatching: options.enableBatching,
        enableMetrics: options.enableMetrics
      });

      result.uiElementsRendered = this.getUIElementCount(context.settings);
    } catch (error) {
      console.error('UI rendering error:', error);
    }

    return result;
  }

  /**
   * Create UI settings map για UIRendererComposite
   */
  private createUISettings(settings: CanvasRenderSettings): Map<string, any> {
    const uiSettings = new Map();

    // Add UI elements based on settings
    if (settings.crosshair?.enabled) {
      uiSettings.set('crosshair', settings.crosshair);
    }

    if (settings.cursor?.enabled) {
      uiSettings.set('cursor', settings.cursor);
    }

    if (settings.snap?.enabled) {
      uiSettings.set('snap', settings.snap);
    }

    if (settings.grid?.enabled) {
      uiSettings.set('grid', settings.grid);
    }

    if (settings.rulers?.enabled) {
      uiSettings.set('rulers', settings.rulers);
    }

    return uiSettings;
  }

  /**
   * Count active UI elements
   */
  private getUIElementCount(settings: CanvasRenderSettings): number {
    let count = 0;
    if (settings.crosshair?.enabled) count++;
    if (settings.cursor?.enabled) count++;
    if (settings.snap?.enabled) count++;
    if (settings.grid?.enabled) count++;
    if (settings.rulers?.enabled) count++;
    return count;
  }


  /**
   * Get rendering metrics
   */
  getMetrics(): any {
    return {
      renderCount: this.renderCount,
      lastRenderTime: this.lastRenderTime,
      entityRenderer: this.entityRenderer.getMetrics?.() || null,
      uiRenderer: this.uiRenderer.getMetrics?.() || null,
      renderPipeline: this.renderPipeline.getMetrics?.() || null
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.renderCount = 0;
    this.lastRenderTime = 0;
  }

  /**
   * Enable/disable unified rendering
   */
  enableUnifiedRendering(enabled: boolean = true): void {
    this.canvasSettings.enableUnifiedRendering(enabled);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Cleanup subsystems
    if (this.entityRenderer.cleanup) {
      this.entityRenderer.cleanup();
    }
    if (this.uiRenderer.cleanup) {
      this.uiRenderer.cleanup();
    }
    if (this.renderPipeline.cleanup) {
      this.renderPipeline.cleanup();
    }

    this.resetMetrics();
  }
}