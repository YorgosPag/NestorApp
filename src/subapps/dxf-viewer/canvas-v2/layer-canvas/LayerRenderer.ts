/**
 * CANVAS V2 - LAYER RENDERER
 * ✅ ΦΑΣΗ 7: Ενοποιημένος με unified canvas system
 * ADR-065: Split into focused modules — this file keeps orchestration + re-exports
 */

import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type {
  ColorLayer,
  LayerRenderOptions,
  SnapSettings,
  GridSettings,
  RulerSettings,
  SelectionSettings
} from './layer-types';
import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';
import type { CursorSettings } from '../../systems/cursor/config';
// 🏢 ADR-151: Added worldToScreenSimple for simple transforms (no Y-inversion)
import { CoordinateTransforms, worldToScreenSimple } from '../../rendering/core/CoordinateTransforms';
import { UI_COLORS } from '../../config/color-config';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';

// ✅ ΦΑΣΗ 7: Import unified canvas system
import type { CanvasInstance } from '../../rendering/canvas/core/CanvasManager';
import type { CanvasEventSystem } from '../../rendering/canvas/core/CanvasEventSystem';
import type { CanvasSettings } from '../../rendering/canvas/core/CanvasSettings';
// 🏢 ENTERPRISE: Refresh cached bounds before render
import { canvasBoundsService } from '../../services/CanvasBoundsService';

import { LegacySnapAdapter } from '../../rendering/ui/snap/LegacySnapAdapter';
import { SelectionRenderer } from './selection/SelectionRenderer';
import { UIRendererComposite } from '../../rendering/ui/core/UIRendererComposite';
import { createUIRenderContext, DEFAULT_UI_TRANSFORM } from '../../rendering/ui/core/UIRenderContext';
import type { UIElementSettings, UIRenderMetrics } from '../../rendering/ui/core/UIRenderer';
// 🏢 ENTERPRISE: Centralized GripSettings type
import type { GripSettings } from '../../types/gripSettings';

// ===== ADR-065: Delegated modules =====
import { renderPolygonToCanvas } from './layer-polygon-renderer';
import { renderGrid, renderRulers } from './layer-grid-ruler-renderer';
import { createLayerUISettings } from './layer-ui-settings';

export class LayerRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private snapRenderer: LegacySnapAdapter;
  private selectionRenderer: SelectionRenderer;
  private debugged: boolean = false;
  private renderDebugShown: boolean = false;
  private lastDebugTime: number = 0;
  private debuggedCoords: boolean = false;

  // ✅ ΦΑΣΗ 6: Centralized UI Rendering System
  private uiComposite: UIRendererComposite;
  private useUnifiedRendering: boolean = false;

  // 🏢 ENTERPRISE: Centralized grip settings for rendering
  private currentGripSettings: GripSettings | null = null;

  // 🏢 ENTERPRISE: Store transform/viewport for real-time drag preview
  private transform: ViewTransform | null = null;
  private viewport: Viewport | null = null;

  // ✅ ΦΑΣΗ 7: Unified canvas system integration
  private canvasInstance?: CanvasInstance;
  private eventSystem?: CanvasEventSystem;
  private canvasSettings?: CanvasSettings;

  constructor(canvas: HTMLCanvasElement, canvasInstance?: CanvasInstance, eventSystem?: CanvasEventSystem, canvasSettings?: CanvasSettings) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context for Layer canvas');
    this.ctx = ctx;

    // ✅ ΦΑΣΗ 7: Store unified canvas system references
    this.canvasInstance = canvasInstance;
    this.eventSystem = eventSystem;
    this.canvasSettings = canvasSettings;

    // Legacy adapters for backward compatibility
    this.snapRenderer = new LegacySnapAdapter(ctx);
    this.selectionRenderer = new SelectionRenderer(ctx);

    // ✅ ΦΑΣΗ 6+7: Initialize centralized UI rendering system
    this.uiComposite = new UIRendererComposite(ctx, {
      enableBatching: canvasSettings?.getSetting('enableBatching') ?? true,
      enableMetrics: canvasSettings?.getSetting('enableMetrics') ?? true,
      enableCaching: canvasSettings?.getSetting('enableCaching') ?? false
    });

    this.initializeUIRenderers();

    // ✅ ΦΑΣΗ 7: Subscribe to unified canvas events
    if (this.eventSystem) {
      this.setupEventListeners();
    }
  }

  /**
   * ✅ ΦΑΣΗ 6: Initialize centralized UI renderers
   * LayerCanvas handles ONLY: Snap and Selection for overlay interactions
   */
  private initializeUIRenderers(): void {
    try {
      this.uiComposite.register('snap', () => new (require('../../rendering/ui/snap/SnapRenderer')).SnapRenderer(), 30, 'feedback');
      this.uiComposite.register('selection', () => this.selectionRenderer, 35, 'feedback');
    } catch (error) {
      console.error('🔥 LayerRenderer: Error initializing UI renderers:', error);
    }
  }

  /**
   * 🏢 ADR-151: Convert world coordinates to screen coordinates
   */
  private worldToScreen(point: Point2D, transform: ViewTransform, viewport: Viewport | null): Point2D {
    if (!viewport) {
      return worldToScreenSimple(point, transform);
    }
    return CoordinateTransforms.worldToScreen(point, transform, viewport);
  }

  /**
   * ✅ ΦΑΣΗ 7: Setup unified canvas event listeners
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) return;

    this.eventSystem.subscribe('canvas:render:start', (event) => {
      if (event.canvasId === this.canvasInstance?.id) {
        // Layer render start
      }
    });

    this.eventSystem.subscribe('canvas:render:complete', (event) => {
      if (event.canvasId === this.canvasInstance?.id) {
        // Layer render complete
      }
    });

    if (this.canvasSettings) {
      this.canvasSettings.subscribeToChanges((settings) => {
        this.uiComposite.updateOptions({
          enableBatching: settings.enableBatching,
          enableMetrics: settings.enableMetrics,
          enableCaching: settings.enableCaching
        });
      });
    }
  }

  /**
   * ✅ ΦΑΣΗ 7: Unified render method
   */
  render(
    layers: ColorLayer[],
    transform: ViewTransform,
    viewport: Viewport,
    crosshairSettings: CrosshairSettings,
    cursorSettings: CursorSettings,
    snapSettings: SnapSettings,
    gridSettings: GridSettings,
    rulerSettings: RulerSettings,
    selectionSettings: SelectionSettings,
    options: LayerRenderOptions
  ): void {
    // ✅ ΦΑΣΗ 7: Emit render start event
    if (this.eventSystem && this.canvasInstance) {
      this.eventSystem.emit('canvas:render:start', {
        canvasType: 'layer',
        layerCount: layers.length,
        options
      }, this.canvasInstance.id);
    }

    this.currentGripSettings = options.gripSettings ?? null;

    // 🏢 ENTERPRISE FIX: Use ACTUAL canvas dimensions, refresh BEFORE clearCanvas
    const canvasRect = canvasBoundsService.refreshBounds(this.canvas);
    const actualViewport: Viewport = { width: canvasRect.width, height: canvasRect.height };

    this.transform = transform;
    this.viewport = actualViewport;

    const startTime = performance.now();

    // Clear canvas using FRESH canvasRect dimensions
    this.ctx.clearRect(0, 0, canvasRect.width, canvasRect.height);

    this.ctx.save();

    const useUnified = this.canvasSettings?.getSetting('useUnifiedRendering') ?? this.useUnifiedRendering;

    if (useUnified) {
      // 🏢 SSoT FIX (2026-02-15): Use `viewport` parameter (container-based SSoT) for coordinate transforms
      this.renderUnified(layers, transform, viewport, crosshairSettings, cursorSettings,
                        snapSettings, gridSettings, rulerSettings, selectionSettings, options);
    } else {
      this.renderLegacy(layers, transform, viewport, crosshairSettings, cursorSettings,
                       snapSettings, gridSettings, rulerSettings, selectionSettings, options);
    }

    this.ctx.restore();

    // ✅ ΦΑΣΗ 7: Emit render complete event
    if (this.eventSystem && this.canvasInstance) {
      const renderTime = performance.now() - startTime;
      this.eventSystem.emit('canvas:render:complete', {
        canvasType: 'layer',
        renderTime,
        layersRendered: layers.length,
        uiMetrics: this.uiComposite.getMetrics()
      }, this.canvasInstance.id);
    }
  }

  /**
   * ✅ ΦΑΣΗ 7: Unified rendering path
   */
  private renderUnified(
    layers: ColorLayer[],
    transform: ViewTransform,
    viewport: Viewport,
    crosshairSettings: CrosshairSettings,
    cursorSettings: CursorSettings,
    snapSettings: SnapSettings,
    gridSettings: GridSettings,
    rulerSettings: RulerSettings,
    selectionSettings: SelectionSettings,
    options: LayerRenderOptions
  ): void {
    this.renderColorLayers(layers, transform, viewport);

    // ADR-065: Delegated to layer-ui-settings.ts
    const uiSettings = createLayerUISettings({
      crosshairSettings,
      cursorSettings,
      snapSettings,
      gridSettings,
      rulerSettings,
      selectionSettings,
      options
    });

    const extendedViewport = { x: 0, y: 0, width: viewport.width, height: viewport.height };

    this.uiComposite.render(extendedViewport, uiSettings, {
      enableBatching: this.canvasSettings?.getSetting('enableBatching') ?? true,
      enableMetrics: this.canvasSettings?.getSetting('enableMetrics') ?? true
    }, transform);
  }

  /**
   * ✅ ΦΑΣΗ 7: Legacy rendering path
   */
  private renderLegacy(
    layers: ColorLayer[],
    transform: ViewTransform,
    viewport: Viewport,
    crosshairSettings: CrosshairSettings,
    cursorSettings: CursorSettings,
    snapSettings: SnapSettings,
    gridSettings: GridSettings,
    rulerSettings: RulerSettings,
    selectionSettings: SelectionSettings,
    options: LayerRenderOptions
  ): void {
    // 1. ADR-065: Delegated to layer-grid-ruler-renderer.ts
    if (options.showGrid && gridSettings.enabled) {
      renderGrid(this.ctx, transform, viewport, gridSettings);
    }

    // 2. Render color layers with clipping for rulers
    this.ctx.save();
    const left = rulerSettings.width || 0;
    const bottom = rulerSettings.height || 0;
    this.ctx.beginPath();
    this.ctx.rect(left, 0, viewport.width - left, viewport.height - bottom);
    this.ctx.clip();
    this.renderColorLayers(layers, transform, viewport);
    this.ctx.restore();

    // 3. Render snap indicators
    if (options.showSnapIndicators && snapSettings.enabled && options.snapResults.length) {
      if (typeof window !== 'undefined') {
        window.__debugSnapResults = options.snapResults as unknown as typeof window.__debugSnapResults;
        (window as Window & { __debugViewport?: Viewport }).__debugViewport = viewport;
      }
      this.snapRenderer.render(options.snapResults, viewport, snapSettings, transform);
    } else {
      if (typeof window !== 'undefined') {
        window.__debugSnapResults = [];
        (window as Window & { __debugViewport?: Viewport }).__debugViewport = viewport;
      }
    }

    // 4. Render selection box
    if (options.showSelectionBox && options.selectionBox) {
      const selectionContext = createUIRenderContext(this.ctx, viewport, DEFAULT_UI_TRANSFORM);
      this.selectionRenderer.render(
        selectionContext,
        viewport,
        { ...selectionSettings, enabled: true, visible: true, opacity: 1.0 } as UIElementSettings
      );
    }

    // 5. Debug: Ruler calibration grid (enterprise calibration & verification)
    interface RulerDebugOverlay {
      getStatus: () => { enabled: boolean; settings: Record<string, unknown>; features: { calibrationGrid?: boolean } };
    }
    const debugWin = window as Window & { rulerDebugOverlay?: RulerDebugOverlay };
    if (typeof window !== 'undefined' && debugWin.rulerDebugOverlay) {
      const rulerDebug = debugWin.rulerDebugOverlay;
      const rulerStatus = rulerDebug.getStatus();

      if (rulerStatus.enabled && rulerStatus.settings) {
        const baseContext = createUIRenderContext(this.ctx, viewport, DEFAULT_UI_TRANSFORM);
        const uiContext: import('../../rendering/ui/core/UIRenderer').ExtendedUIRenderContext = {
          ...baseContext,
          worldTransform: transform
        };

        const renderSettings = { ...rulerStatus.settings, visible: true };

        if (rulerStatus.features.calibrationGrid) {
          const { CalibrationGridRenderer } = require('../../debug/CalibrationGridRenderer');
          const gridRenderer = new CalibrationGridRenderer();
          gridRenderer.render(uiContext, viewport, renderSettings);
        }
      }
    }
  }

  /**
   * Render color layers — delegates polygon rendering to layer-polygon-renderer.ts
   */
  private renderColorLayers(
    layers: ColorLayer[],
    transform: ViewTransform,
    viewport: Viewport
  ): void {
    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

    for (const layer of sortedLayers) {
      if (!layer.visible) continue;

      this.ctx.save();
      this.ctx.globalAlpha = layer.opacity;

      for (const polygon of layer.polygons) {
        // ADR-065: Delegated to layer-polygon-renderer.ts
        renderPolygonToCanvas({
          ctx: this.ctx,
          polygon,
          layer,
          transform,
          viewport,
          gripSettings: this.currentGripSettings,
          storedTransform: this.transform,
          storedViewport: this.viewport,
          worldToScreenFn: this.worldToScreen.bind(this)
        });
      }

      this.ctx.restore();
    }
  }

  /**
   * Hit test - find layer near point
   * 🏢 ADR-105: Use centralized fallback tolerance
   */
  hitTest(
    layers: ColorLayer[],
    screenPoint: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
    tolerance: number = TOLERANCE_CONFIG.HIT_TEST_FALLBACK
  ): string | null {
    const worldPoint = CoordinateTransforms.screenToWorld(screenPoint, transform, viewport);

    const sortedLayers = [...layers]
      .sort((a, b) => b.zIndex - a.zIndex)
      .filter(layer => layer.visible);

    for (const layer of sortedLayers) {
      for (const polygon of layer.polygons) {
        const screenVertices = polygon.vertices.map(v =>
          CoordinateTransforms.worldToScreen(v, transform, viewport)
        );
        const isInside = isPointInPolygon(screenPoint, screenVertices);
        if (isInside) {
          return layer.id;
        }
      }
    }
    return null;
  }

  /**
   * ✅ ΦΑΣΗ 6: Enable/disable unified rendering system
   */
  enableUnifiedRendering(enabled: boolean = true): void {
    this.useUnifiedRendering = enabled;
  }

  /**
   * ✅ ΦΑΣΗ 6: Get performance metrics
   */
  getUIMetrics(): UIRenderMetrics[] {
    return this.uiComposite.getMetrics();
  }
}
