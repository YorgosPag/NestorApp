/**
 * CANVAS V2 - LAYER RENDERER
 * ✅ ΦΑΣΗ 7: Ενοποιημένος με unified canvas system
 * Καθαρό Layer rendering + unified UI rendering
 */

import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type {
  ColorLayer,
  LayerRenderOptions,
  // CrosshairSettings μεταφέρθηκε στο rendering/ui/crosshair/
  SnapSettings,
  GridSettings,
  RulerSettings,
  SelectionSettings
} from './layer-types';
import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';
import type { CursorSettings } from '../../systems/cursor/config';
import { CoordinateTransforms, COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
import { getStatusColors } from '../../config/color-mapping';
import { UI_COLORS } from '../../config/color-config';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';

// ✅ ΦΑΣΗ 7: Import unified canvas system
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';
import type { CanvasInstance } from '../../rendering/canvas/core/CanvasManager';
import type { CanvasEventSystem } from '../../rendering/canvas/core/CanvasEventSystem';
import type { CanvasSettings } from '../../rendering/canvas/core/CanvasSettings';

// ✅ REMOVED: LegacyCrosshairAdapter, LegacyCursorAdapter - now handled in DxfCanvas
import { LegacySnapAdapter } from '../../rendering/ui/snap/LegacySnapAdapter';
import { SelectionRenderer } from './selection/SelectionRenderer';
import { UIRendererComposite, type UICategory } from '../../rendering/ui/core/UIRendererComposite';
import { createUIRenderContext, DEFAULT_UI_TRANSFORM } from '../../rendering/ui/core/UIRenderContext';
import type { UIRenderOptions, UIElementSettings } from '../../rendering/ui/core/UIRenderer';

export class LayerRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  // ✅ REMOVED: crosshairRenderer, cursorRenderer - now handled in DxfCanvas
  private snapRenderer: LegacySnapAdapter;
  private selectionRenderer: SelectionRenderer;
  private debugged: boolean = false;  // One-time debug flag
  private renderDebugShown: boolean = false;  // One-time render debug flag
  private lastDebugTime: number = 0;  // Timestamp για controlled debug
  private debuggedCoords: boolean = false;  // One-time coordinates debug flag

  // ✅ ΦΑΣΗ 6: Centralized UI Rendering System
  private uiComposite: UIRendererComposite;
  private useUnifiedRendering: boolean = false; // Feature flag για smooth transition

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

    // console.log('🔍 LayerRenderer: Initialized successfully');

    // Legacy adapters για backward compatibility
    // ✅ REMOVED: crosshairRenderer, cursorRenderer - now handled in DxfCanvas
    this.snapRenderer = new LegacySnapAdapter(ctx);
    this.selectionRenderer = new SelectionRenderer(ctx);

    // ✅ ΦΑΣΗ 6+7: Initialize centralized UI rendering system με unified canvas support
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
   * 🧹 CLEANUP: Grid, Rulers, Crosshair, Cursor are now rendered ONLY in DxfCanvas
   * LayerCanvas handles ONLY: Snap and Selection for overlay interactions
   */
  private initializeUIRenderers(): void {
    // Register all UI renderers with proper priorities and categories
    try {
      // 🧹 REMOVED: Grid and Rulers - now handled exclusively by DxfCanvas
      // this.uiComposite.register('grid', ...) - DEAD CODE REMOVED
      // this.uiComposite.register('rulers', ...) - DEAD CODE REMOVED

      // 🧹 REMOVED: Crosshair and Cursor - now handled exclusively by DxfCanvas
      // this.uiComposite.register('crosshair', ...) - DEAD CODE REMOVED
      // this.uiComposite.register('cursor', ...) - DEAD CODE REMOVED

      // ✅ KEEP: Snap and selection (feedback layer) - needed for overlay interactions
      this.uiComposite.register('snap', () => new (require('../../rendering/ui/snap/SnapRenderer')).SnapRenderer(), 30, 'feedback');
      this.uiComposite.register('selection', () => this.selectionRenderer, 35, 'feedback'); // Use existing instance

      // 🎯 DEBUG: Origin markers overlay (top-most z-index for debugging)
      this.uiComposite.register('origin-markers', () => new (require('../../rendering/ui/origin/OriginMarkersRenderer')).OriginMarkersRenderer(), 1000, 'overlay');
    } catch (error) {
      console.error('🔥 LayerRenderer: Error initializing UI renderers:', error);
      // Continue with basic initialization even if UI renderers fail
    }
  }

  /**
   * ✅ ΦΑΣΗ 7: Setup unified canvas event listeners
   */
  private setupEventListeners(): void {
    if (!this.eventSystem) return;

    // Subscribe to canvas render events
    this.eventSystem.subscribe('canvas:render:start', (event) => {
      // Emit layer render start if this is our canvas
      if (event.canvasId === this.canvasInstance?.id) {
        // Debug disabled: LayerRenderer: Starting render
      }
    });

    this.eventSystem.subscribe('canvas:render:complete', (event) => {
      // Handle render completion metrics
      if (event.canvasId === this.canvasInstance?.id) {
        // Debug disabled: LayerRenderer: Render completed
      }
    });

    // Subscribe to settings changes
    if (this.canvasSettings) {
      this.canvasSettings.subscribeToChanges((settings) => {
        // Update UI composite settings when canvas settings change
        this.uiComposite.updateOptions({
          enableBatching: settings.enableBatching,
          enableMetrics: settings.enableMetrics,
          enableCaching: settings.enableCaching
        });
      });
    }
  }

  /**
   * ✅ ΦΑΣΗ 7: Unified render method με canvas event integration
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

    const startTime = performance.now();

    // Clear canvas using unified utils
    CanvasUtils.clearCanvas(this.ctx, this.canvas, 'transparent');

    // 🎨 DEBUG: Draw LayerCanvas origin marker (BLUE) - BOTTOM + RIGHT half
    // ✅ CORRECT: Calculate screen position of ACTUAL world (0,0) using CoordinateTransforms
    const worldOrigin = { x: 0, y: 0 };
    const screenOrigin = CoordinateTransforms.worldToScreen(worldOrigin, transform, viewport);
    const px = (v: number) => Math.round(v) + 0.5;
    const originX = px(screenOrigin.x);
    const originY = px(screenOrigin.y);

    // Debug disabled: origin marker values
    this.ctx.save();
    this.ctx.strokeStyle = UI_COLORS.BUTTON_PRIMARY; // ✅ CENTRALIZED: Blue για LayerRenderer origin marker
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    // BOTTOM vertical line (down from origin)
    this.ctx.moveTo(originX, originY);
    this.ctx.lineTo(originX, originY + 20);
    // RIGHT horizontal line (right from origin)
    this.ctx.moveTo(originX, originY);
    this.ctx.lineTo(originX + 20, originY);
    this.ctx.stroke();
    // Label
    this.ctx.fillStyle = UI_COLORS.BUTTON_PRIMARY; // ✅ CENTRALIZED: Blue text για LayerRenderer label
    this.ctx.font = 'bold 12px monospace';
    this.ctx.fillText('LAYER', originX + 5, originY + 30);
    this.ctx.restore();

    this.ctx.save();

    // Choose rendering path based on unified settings
    const useUnified = this.canvasSettings?.getSetting('useUnifiedRendering') ?? this.useUnifiedRendering;
    // Debug disabled: Rendering path selection

    if (useUnified) {
      // ✅ ΦΑΣΗ 7: Use unified rendering path
      this.renderUnified(layers, transform, viewport, crosshairSettings, cursorSettings,
                        snapSettings, gridSettings, rulerSettings, selectionSettings, options);
    } else {
      // Legacy rendering path
      this.renderLegacy(layers, transform, viewport, crosshairSettings, cursorSettings,
                       snapSettings, gridSettings, rulerSettings, selectionSettings, options);
    }

    this.ctx.restore();

    // ✅ ΦΑΣΗ 7: Emit render complete event με metrics
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
    // 1. Render color layers (entity content)
    this.renderColorLayers(layers, transform, viewport);

    // 2. ✅ ΦΑΣΗ 7: Render ALL UI elements using centralized system
    const uiSettings = this.createUISettings({
      crosshairSettings,
      cursorSettings,
      snapSettings,
      gridSettings,
      rulerSettings,
      selectionSettings,
      options
    });

    const extendedViewport = {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height
    };

    // Render all UI elements through centralized system
    this.uiComposite.render(extendedViewport, uiSettings, {
      enableBatching: this.canvasSettings?.getSetting('enableBatching') ?? true,
      enableMetrics: this.canvasSettings?.getSetting('enableMetrics') ?? true
    }, transform); // 🎯 Pass world transform για Origin Markers

    // 🛠️ DEBUG: Ruler Debug System moved to DxfCanvas (renders on same canvas as rulers)
  }

  /**
   * ✅ ΦΑΣΗ 7: Legacy rendering path για backward compatibility
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
    // 1. Render grid (πίσω από όλα)
    if (options.showGrid && gridSettings.enabled) {
      this.renderGrid(transform, viewport, gridSettings);
    }

    // 2. ✅ REMOVED: Legacy ruler rendering - replaced by unified RulerRenderer
    // Rulers are now rendered by the centralized RulerRenderer in rendering/ui/ruler/
    // if (options.showRulers && rulerSettings.enabled) {
    //   this.renderRulers(transform, viewport, rulerSettings);
    // }

    // 3. Render color layers με clipping για rulers (σύμφωνα με ChatGPT-5 πρόταση)
    this.ctx.save();

    // 🚀 CLIP στο "content area" χωρίς rulers - αποφυγή εισβολής στη ζώνη χαράκων
    const left = rulerSettings.width || 0;
    const bottom = rulerSettings.height || 0;

    this.ctx.beginPath();
    this.ctx.rect(left, 0, viewport.width - left, viewport.height - bottom);
    this.ctx.clip();

    this.renderColorLayers(layers, transform, viewport);

    this.ctx.restore();

    // 4. Render snap indicators
    if (options.showSnapIndicators && snapSettings.enabled && options.snapResults.length) {
      // Expose snap results AND viewport for debug overlay
      if (typeof window !== 'undefined') {
        // 🏢 ENTERPRISE: Using type assertion for window globals (debugging only)
        const win = window as Window & { __debugSnapResults?: unknown[]; __debugViewport?: Viewport };
        win.__debugSnapResults = options.snapResults;
        win.__debugViewport = viewport;
      }
      // ✅ FIX: Pass actual transform to snapRenderer for correct alignment
      this.snapRenderer.render(options.snapResults, viewport, snapSettings, transform);
    } else {
      // Clear snap results when no snaps active
      if (typeof window !== 'undefined') {
        // 🏢 ENTERPRISE: Using type assertion for window globals (debugging only)
        const win = window as Window & { __debugSnapResults?: unknown[]; __debugViewport?: Viewport };
        win.__debugSnapResults = [];
        win.__debugViewport = viewport; // Still expose viewport for cursor tracking
      }
    }

    // 5. Render selection box
    if (options.showSelectionBox && options.selectionBox) {
      const selectionContext = createUIRenderContext(this.ctx, viewport, DEFAULT_UI_TRANSFORM);
      this.selectionRenderer.render(
        selectionContext,
        viewport,
        { ...selectionSettings, enabled: true, visible: true, opacity: 1.0 } as UIElementSettings
      );
    }

    // ✅ REMOVED: Manual OriginMarkersRenderer rendering
    // Origin markers are now handled exclusively by UI Composite (line 110)
    // This prevents duplicate rendering when using legacy path

    // 🛠️ DEBUG: Ruler Debug System (Enterprise Calibration & Verification)
    // 🏢 ENTERPRISE: Type assertion for debug overlay window global
    interface RulerDebugOverlay {
      getStatus: () => { enabled: boolean; settings: Record<string, unknown>; features: { calibrationGrid?: boolean } };
    }
    const debugWin = window as Window & { rulerDebugOverlay?: RulerDebugOverlay };
    if (typeof window !== 'undefined' && debugWin.rulerDebugOverlay) {
      const rulerDebug = debugWin.rulerDebugOverlay;
      const rulerStatus = rulerDebug.getStatus();

      if (rulerStatus.enabled && rulerStatus.settings) {
        // Create minimal UIRenderContext
        // 🎯 TYPE-SAFE: Use ExtendedUIRenderContext for worldTransform
        const baseContext = createUIRenderContext(this.ctx, viewport, DEFAULT_UI_TRANSFORM);
        const uiContext: import('../../rendering/ui/core/UIRenderer').ExtendedUIRenderContext = {
          ...baseContext,
          worldTransform: transform
        };

        const renderSettings = {
          ...rulerStatus.settings,
          visible: true // ✅ Ensure visible is set
        };

        // ✅ REMOVED: RulerTickMarkersRenderer (debug tool) - replaced by unified RulerRenderer
        // RulerRenderer is now the single source of truth for ruler rendering

        // 📐 RENDER CALIBRATION GRID (if enabled)
        if (rulerStatus.features.calibrationGrid) {
          const { CalibrationGridRenderer } = require('../../debug/CalibrationGridRenderer');
          const gridRenderer = new CalibrationGridRenderer();
          gridRenderer.render(uiContext, viewport, renderSettings);
        }
      }
    }

    // ✅ REMOVED: cursor & crosshair rendering - now handled in DxfCanvas for unified approach
  }

  /**
   * Render color layers
   */
  private renderColorLayers(
    layers: ColorLayer[],
    transform: ViewTransform,
    viewport: Viewport
  ): void {
    // Debug logging disabled for performance

    // Sort layers by z-index
    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

    for (const layer of sortedLayers) {
      if (!layer.visible) continue;

      this.ctx.save();
      this.ctx.globalAlpha = layer.opacity;

      for (const polygon of layer.polygons) {
        // Render polygon - debug disabled for performance
        this.renderPolygon(polygon, layer, transform, viewport);
      }

      this.ctx.restore();
    }
  }

  /**
   * Render single polygon
   */
  private renderPolygon(
    polygon: {
      vertices: Point2D[];
      fillColor?: string;
      strokeColor?: string;
      strokeWidth: number;
      selected?: boolean;
    },
    layer: ColorLayer,
    transform: ViewTransform,
    viewport: Viewport
  ): void {
    if (polygon.vertices.length < 3) {
      // console.log('🔍 Skipping polygon - not enough vertices:', polygon.vertices.length);
      return;
    }

    // Convert world coordinates to screen coordinates
    const screenVertices = polygon.vertices.map((vertex: Point2D) =>
      CoordinateTransforms.worldToScreen(vertex, transform, viewport)
    );

    // Debug disabled: Margins check for layer rendering

    // Debug logs disabled to prevent infinite re-render
    // console.log('🔍 Rendering polygon:', { layerId: layer.id, polygonId: polygon.id });

    // Check if any vertices are in viewport (for debugging only - not skipping)
    const verticesInViewport = screenVertices.filter((v: Point2D) =>
      v.x >= -50 && v.x <= viewport.width + 50 &&
      v.y >= -50 && v.y <= viewport.height + 50
    );

    // Debug logs disabled to prevent infinite re-render
    // console.log('🔍 Vertices in viewport:', { total: screenVertices.length, inViewport: verticesInViewport.length });

    // 🔧 OVERLAYS ALWAYS RENDER - Don't skip polygons that are outside viewport
    // Overlays should be visible even if they're off-screen

    this.ctx.beginPath();

    // Draw polygon path
    const firstVertex = screenVertices[0];
    this.ctx.moveTo(firstVertex.x, firstVertex.y);

    for (let i = 1; i < screenVertices.length; i++) {
      const vertex = screenVertices[i];
      this.ctx.lineTo(vertex.x, vertex.y);
    }

    this.ctx.closePath();

    // Fill με κεντρικά STATUS_COLORS_MAPPING (ελληνικά ή αγγλικά)
    let fillColor = polygon.fillColor; // Default fallback

    if (layer.status) {
      // Χρησιμοποίησε την κεντρική function που υποστηρίζει ελληνικά & αγγλικά
      const statusColors = getStatusColors(layer.status);
      if (statusColors) {
        fillColor = statusColors.fill; // Χρησιμοποίησε το fill color από mapping
      }
    }

    // Fallback στο layer color αν δεν υπάρχει valid status
    fillColor = fillColor || layer.color;

    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
      // Debug disabled: console.log('🔍 Applied fill:', fillColor, 'from status:', layer.status);
    }

    // Stroke με consistent STATUS_COLORS_MAPPING
    if (polygon.strokeWidth > 0) {
      let strokeColor = polygon.strokeColor; // Default fallback

      if (layer.status) {
        // Χρησιμοποίησε την κεντρική function για consistency
        const statusColors = getStatusColors(layer.status);
        if (statusColors) {
          strokeColor = statusColors.stroke; // Χρησιμοποίησε το stroke color από mapping
        }
      }

      // Fallback στο layer color αν δεν υπάρχει valid stroke
      strokeColor = strokeColor || layer.color || UI_COLORS.BLACK;

      this.ctx.strokeStyle = polygon.selected ? UI_COLORS.SELECTED_RED : strokeColor;
      this.ctx.lineWidth = polygon.strokeWidth;
      this.ctx.stroke();
      // Debug disabled: console.log('🔍 Applied stroke:', strokeColor);
    }

    // Selection highlight
    if (polygon.selected) {
      this.ctx.strokeStyle = UI_COLORS.BRIGHT_GREEN;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      // Debug disabled: console.log('🔍 Applied selection highlight');
    }

    // 🔧 DRAFT POLYGON GRIPS (2026-01-24): Render grips at each vertex for draft polygons
    if (layer.showGrips && polygon.vertices.length >= 1) {
      const GRIP_SIZE = 10; // pixels
      const GRIP_COLOR_NORMAL = UI_COLORS.GRIP_DEFAULT || '#3b82f6'; // Blue
      const GRIP_COLOR_CLOSE = UI_COLORS.SUCCESS_BRIGHT || '#22c55e'; // Green for close highlight

      for (let i = 0; i < screenVertices.length; i++) {
        const vertex = screenVertices[i];
        const isFirstGrip = i === 0;
        const isHighlighted = isFirstGrip && layer.isNearFirstPoint;

        // Draw grip square
        this.ctx.save();
        this.ctx.fillStyle = isHighlighted ? GRIP_COLOR_CLOSE : GRIP_COLOR_NORMAL;
        this.ctx.strokeStyle = UI_COLORS.BLACK || '#000000';
        this.ctx.lineWidth = 1;

        // Draw filled square grip
        const halfSize = GRIP_SIZE / 2;
        this.ctx.fillRect(vertex.x - halfSize, vertex.y - halfSize, GRIP_SIZE, GRIP_SIZE);
        this.ctx.strokeRect(vertex.x - halfSize, vertex.y - halfSize, GRIP_SIZE, GRIP_SIZE);

        // Draw "close" indicator for first grip when highlighted
        if (isHighlighted) {
          // Draw a slightly larger outer ring to indicate "click to close"
          this.ctx.strokeStyle = GRIP_COLOR_CLOSE;
          this.ctx.lineWidth = 2;
          const outerSize = GRIP_SIZE + 6;
          const outerHalf = outerSize / 2;
          this.ctx.strokeRect(vertex.x - outerHalf, vertex.y - outerHalf, outerSize, outerSize);
        }

        this.ctx.restore();
      }
    }
  }

  /**
   * Render grid
   */
  private renderGrid(
    transform: ViewTransform,
    viewport: Viewport,
    settings: GridSettings
  ): void {
    this.ctx.save();

    this.ctx.strokeStyle = settings.color;
    this.ctx.globalAlpha = settings.opacity;
    this.ctx.lineWidth = 1;

    const gridSize = settings.size * transform.scale;

    if (gridSize < 5) {
      this.ctx.restore();
      return; // Skip rendering very small grids
    }

    if (settings.style === 'lines') {
      // Grid lines
      this.ctx.beginPath();

      // Vertical lines
      const startX = (transform.offsetX % gridSize);
      for (let x = startX; x <= viewport.width; x += gridSize) {
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, viewport.height);
      }

      // Horizontal lines - ✅ UNIFIED WITH COORDINATETRANSFORMS
      const baseY = viewport.height - COORDINATE_LAYOUT.MARGINS.top;
      const startY = ((baseY - transform.offsetY) % gridSize);
      for (let y = startY; y <= viewport.height; y += gridSize) {
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(viewport.width, y);
      }

      this.ctx.stroke();
    } else {
      // Grid dots - ✅ UNIFIED WITH COORDINATETRANSFORMS
      this.ctx.fillStyle = settings.color || UI_COLORS.BLACK;

      const startX = (transform.offsetX % gridSize);
      const baseY = viewport.height - COORDINATE_LAYOUT.MARGINS.top;
      const startY = ((baseY - transform.offsetY) % gridSize);

      for (let x = startX; x <= viewport.width; x += gridSize) {
        for (let y = startY; y <= viewport.height; y += gridSize) {
          this.ctx.beginPath();
          this.ctx.arc(x, y, 1, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }

    this.ctx.restore();
  }

  // ✅ REMOVED: Legacy ruler rendering methods - replaced by unified RulerRenderer
  // This eliminates ~180 lines of duplicate code
  /**
   * @deprecated Use RulerRenderer from rendering/ui/ruler/ instead
   */
  private renderRulers(
    transform: ViewTransform,
    viewport: Viewport,
    settings: RulerSettings
  ): void {
    const rulerHeight = settings.height ?? 30;
    const rulerWidth = settings.width ?? 30;
    const horizontalRulerY = viewport.height - rulerHeight; // Κάτω από τον καμβά, πάνω από toolbar

    this.ctx.save();

    // Background για rulers (αν είναι enabled)
    if (settings.showBackground !== false) {
      this.ctx.fillStyle = settings.backgroundColor ?? UI_COLORS.WHITE;
      this.ctx.fillRect(0, horizontalRulerY, viewport.width, rulerHeight); // Bottom horizontal ruler
      this.ctx.fillRect(0, 0, rulerWidth, viewport.height); // Left ruler
    }

    // Text styling
    this.ctx.fillStyle = settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
    this.ctx.font = `${settings.fontSize}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Bottom horizontal ruler
    this.renderHorizontalRuler(transform, viewport, settings, rulerHeight, horizontalRulerY);

    // Left ruler (vertical)
    this.renderVerticalRuler(transform, viewport, settings, rulerWidth);

    this.ctx.restore();
  }

  /**
   * Render horizontal ruler με υποστήριξη για advanced ρυθμίσεις
   */
  private renderHorizontalRuler(
    transform: ViewTransform,
    viewport: Viewport,
    settings: RulerSettings,
    rulerHeight: number,
    yPosition: number = 0
  ): void {
    const step = 100 * transform.scale; // 100 units steps
    if (step < 20) return;

    const startX = -(transform.offsetX % step);
    const majorTickLength = settings.majorTickLength ?? 10;
    const minorTickLength = settings.minorTickLength ?? 5;

    for (let x = startX; x <= viewport.width; x += step) {
      const worldX = (x - transform.offsetX) / transform.scale;

      // Major ticks
      if (settings.showMajorTicks !== false) {
        // ✅ ENTERPRISE: Ensure non-undefined value for Canvas API
        this.ctx.strokeStyle = settings.majorTickColor ?? settings.color ?? UI_COLORS.BLACK;
        this.ctx.beginPath();
        this.ctx.moveTo(x, yPosition + rulerHeight - majorTickLength);
        this.ctx.lineTo(x, yPosition + rulerHeight);
        this.ctx.stroke();
      }

      // Labels (αν είναι enabled)
      if (settings.showLabels !== false) {
        const numberText = worldX.toFixed(0);

        // Numbers με το κανονικό fontSize και textColor
        this.ctx.fillStyle = settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
        this.ctx.font = `${settings.fontSize}px Arial`;
        this.ctx.fillText(numberText, x, yPosition + rulerHeight / 2);

        // Units με ξεχωριστό fontSize και color (αν είναι enabled)
        if (settings.showUnits !== false) {
          // Υπολογισμός width του number text για σωστό positioning
          const numberWidth = this.ctx.measureText(numberText).width;

          // 🔺 UNITS SPECIFIC STYLING - Σύνδεση με floating panel
          this.ctx.fillStyle = settings.unitsColor ?? settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
          this.ctx.font = `${settings.unitsFontSize ?? settings.fontSize}px Arial`;

          // Render units ΜΕΤΑ από τον αριθμό (δεξιά του)
          this.ctx.fillText(settings.unit ?? '', x + numberWidth / 2 + 5, yPosition + rulerHeight / 2);
        }
      }

      // Minor ticks (κάθε 1/5 του major step)
      if (settings.showMinorTicks !== false && step > 50) {
        const minorStep = step / 5;
        for (let i = 1; i < 5; i++) {
          const minorX = x + (i * minorStep);
          if (minorX <= viewport.width) {
            // ✅ ENTERPRISE: Ensure non-undefined value for Canvas API
            this.ctx.strokeStyle = settings.minorTickColor ?? settings.color ?? UI_COLORS.BLACK;
            this.ctx.beginPath();
            this.ctx.moveTo(minorX, yPosition + rulerHeight - minorTickLength);
            this.ctx.lineTo(minorX, yPosition + rulerHeight);
            this.ctx.stroke();
          }
        }
      }
    }
  }

  /**
   * Render vertical ruler με υποστήριξη για advanced ρυθμίσεις
   */
  private renderVerticalRuler(
    transform: ViewTransform,
    viewport: Viewport,
    settings: RulerSettings,
    rulerWidth: number
  ): void {
    const step = 100 * transform.scale; // 100 units steps
    if (step < 20) return;

    // ✅ UNIFIED WITH COORDINATETRANSFORMS
    const baseY = viewport.height - COORDINATE_LAYOUT.MARGINS.top;
    const startY = ((baseY - transform.offsetY) % step);
    const majorTickLength = settings.majorTickLength ?? 10;
    const minorTickLength = settings.minorTickLength ?? 5;

    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    for (let y = startY + rulerWidth; y <= viewport.height; y += step) {
      const worldY = ((baseY - y + transform.offsetY) / transform.scale);

      // Major ticks
      if (settings.showMajorTicks !== false) {
        // ✅ ENTERPRISE: Ensure non-undefined value for Canvas API
        this.ctx.strokeStyle = settings.majorTickColor ?? settings.color ?? UI_COLORS.BLACK;
        this.ctx.beginPath();
        this.ctx.moveTo(rulerWidth - majorTickLength, y);
        this.ctx.lineTo(rulerWidth, y);
        this.ctx.stroke();
      }

      // Labels (αν είναι enabled)
      if (settings.showLabels !== false) {
        const numberText = worldY.toFixed(0);

        this.ctx.save();
        this.ctx.translate(rulerWidth / 2, y);
        this.ctx.rotate(-Math.PI / 2);

        // Numbers με το κανονικό fontSize και textColor
        this.ctx.fillStyle = settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
        this.ctx.font = `${settings.fontSize}px Arial`;
        this.ctx.fillText(numberText, 0, 0);

        // Units με ξεχωριστό fontSize και color (αν είναι enabled)
        if (settings.showUnits !== false) {
          // Υπολογισμός width του number text για σωστό positioning
          const numberWidth = this.ctx.measureText(numberText).width;

          // 🔺 UNITS SPECIFIC STYLING - Σύνδεση με floating panel
          this.ctx.fillStyle = settings.unitsColor ?? settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
          this.ctx.font = `${settings.unitsFontSize ?? settings.fontSize}px Arial`;

          // Render units ΜΕΤΑ από τον αριθμό (δεξιά του στο rotated coordinate system)
          this.ctx.fillText(settings.unit ?? '', numberWidth / 2 + 5, 0);
        }

        this.ctx.restore();
      }

      // Minor ticks (κάθε 1/5 του major step)
      if (settings.showMinorTicks !== false && step > 50) {
        const minorStep = step / 5;
        for (let i = 1; i < 5; i++) {
          const minorY = y + (i * minorStep);
          if (minorY <= viewport.height) {
            // ✅ ENTERPRISE: Ensure non-undefined value for Canvas API
            this.ctx.strokeStyle = settings.minorTickColor ?? settings.color ?? UI_COLORS.BLACK;
            this.ctx.beginPath();
            this.ctx.moveTo(rulerWidth - minorTickLength, minorY);
            this.ctx.lineTo(rulerWidth, minorY);
            this.ctx.stroke();
          }
        }
      }
    }

    this.ctx.restore();
  }

  /**
   * Hit test - βρίσκει layer κοντά σε point
   */
  hitTest(
    layers: ColorLayer[],
    screenPoint: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
    tolerance = 5
  ): string | null {
    const worldPoint = CoordinateTransforms.screenToWorld(screenPoint, transform, viewport);
    // Hit test debug disabled for performance

    // Check layers in reverse z-index order (top to bottom)
    const sortedLayers = [...layers]
      .sort((a, b) => b.zIndex - a.zIndex)
      .filter(layer => layer.visible);

    // Debug: sortedLayers disabled for performance

    for (const layer of sortedLayers) {
      // Debug: layer checking disabled for performance
      for (const polygon of layer.polygons) {
        // 🔥 FIX: Use screen space hit-test instead of world space
        const screenVertices = polygon.vertices.map(v =>
          CoordinateTransforms.worldToScreen(v, transform, viewport)
        );
        const isInside = isPointInPolygon(screenPoint, screenVertices);
        // Debug: polygon check disabled for performance
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
   * ✅ ΦΑΣΗ 6: Get performance metrics από centralized system
   */
  getUIMetrics(): Array<{ name: string; renderTime?: number; lastRender?: number }> {
    return this.uiComposite.getMetrics();
  }

  /**
   * ✅ ΦΑΣΗ 6: Create UI settings για centralized rendering
   */
  private createUISettings(params: {
    crosshairSettings: CrosshairSettings;
    cursorSettings: CursorSettings;
    snapSettings: SnapSettings;
    gridSettings: GridSettings;
    rulerSettings: RulerSettings;
    selectionSettings: SelectionSettings;
    options: LayerRenderOptions;
  }): Map<string, UIElementSettings> {
    const {
      crosshairSettings,
      cursorSettings,
      snapSettings,
      gridSettings,
      rulerSettings,
      selectionSettings,
      options
    } = params;

    const settings = new Map<string, UIElementSettings>();

    // Grid settings
    if (options.showGrid && gridSettings.enabled) {
      settings.set('grid', {
        ...gridSettings,
        enabled: true,
        visible: true,
        opacity: 1.0
      } as UIElementSettings);
    }

    // Ruler settings
    if (options.showRulers && rulerSettings.enabled) {
      settings.set('rulers', {
        ...rulerSettings,
        enabled: true,
        visible: true,
        opacity: 1.0
      } as UIElementSettings);
    }

    // Crosshair settings
    if (options.showCrosshair && crosshairSettings.enabled && options.crosshairPosition) {
      settings.set('crosshair', {
        ...crosshairSettings,
        enabled: true,
        visible: true,
        opacity: 1.0
      } as UIElementSettings);
    }

    // Cursor settings
    if (options.showCursor && cursorSettings.cursor.enabled && options.cursorPosition) {
      settings.set('cursor', {
        ...cursorSettings,
        enabled: true,
        visible: true,
        opacity: 1.0
      } as UIElementSettings);
    }

    // Snap settings
    if (options.showSnapIndicators && snapSettings.enabled && options.snapResults?.length) {
      settings.set('snap', {
        ...snapSettings,
        enabled: true,
        visible: true,
        opacity: 1.0
      } as UIElementSettings);
    }

    // Selection settings
    if (options.showSelectionBox && options.selectionBox) {
      settings.set('selection', {
        enabled: true,
        visible: true,
        opacity: 1.0,
        ...selectionSettings
      } as UIElementSettings);
    }

    // 🎯 DEBUG: Origin Markers (always check global state)
    // Read from global singleton to get current debug state
    // 🏢 ENTERPRISE: Type assertion for debug overlay window global
    interface OriginMarkersDebug {
      getStatus: () => { enabled: boolean };
    }
    const originWin = window as Window & { originMarkersDebug?: OriginMarkersDebug };
    if (typeof window !== 'undefined' && originWin.originMarkersDebug) {
      const debugOverlay = originWin.originMarkersDebug;
      const debugStatus = debugOverlay.getStatus();

      if (debugStatus.enabled) {
        // Import default settings
        const { DEFAULT_ORIGIN_MARKERS_SETTINGS } = require('../../rendering/ui/origin/OriginMarkersTypes');

        settings.set('origin-markers', {
          ...DEFAULT_ORIGIN_MARKERS_SETTINGS,
          enabled: true,
          visible: true
        } as UIElementSettings);
      }
    }

    return settings;
  }

  // 🗑️ REMOVED: isPointInPolygon method - now using centralized version from GeometryUtils
}