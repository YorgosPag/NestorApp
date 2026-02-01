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
// 🏢 ADR-042: Centralized UI Fonts, ADR-044: Centralized Line Widths
// 🏢 ADR-091: Centralized UI Fonts (buildUIFont for dynamic sizes)
// 🏢 ADR-097: Centralized Line Dash Patterns
// 🏢 ADR-107: Centralized UI Size Defaults
import { UI_FONTS, RENDER_LINE_WIDTHS, buildUIFont, LINE_DASH_PATTERNS, UI_SIZE_DEFAULTS } from '../../config/text-rendering-config';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
// 🏢 ADR-073: Centralized Midpoint Calculation
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-rendering-utils';
// 🏢 ADR-102: Centralized Origin Markers
import { renderOriginMarker } from '../../rendering/ui/origin/OriginMarkerUtils';
// 🏢 ADR-075: Centralized Grip Size Multipliers
// 🏢 ADR-106: Centralized Edge Grip Size Multipliers
import { GRIP_SIZE_MULTIPLIERS, EDGE_GRIP_SIZE_MULTIPLIERS } from '../../rendering/grips/constants';
// 🏢 ADR-077: Centralized TAU Constant
import { TAU } from '../../rendering/primitives/canvasPaths';
// 🏢 ADR-XXX: Centralized Angular Constants
import { RIGHT_ANGLE } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';

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
// 🏢 ENTERPRISE: Centralized GripSettings type
import type { GripSettings } from '../../types/gripSettings';

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

  // 🏢 ENTERPRISE (2026-01-25): Centralized grip settings for rendering
  private currentGripSettings: GripSettings | null = null;

  // 🏢 ENTERPRISE (2026-01-25): Store transform/viewport for real-time drag preview
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
   * 🏢 ENTERPRISE (2026-01-25): Convert world coordinates to screen coordinates
   * Helper method for real-time drag preview
   */
  private worldToScreen(point: Point2D, transform: ViewTransform, viewport: Viewport | null): Point2D {
    if (!viewport) {
      return { x: point.x * transform.scale + transform.offsetX, y: point.y * transform.scale + transform.offsetY };
    }
    return CoordinateTransforms.worldToScreen(point, transform, viewport);
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

    // 🏢 ENTERPRISE: Store grip settings for use in polygon rendering
    this.currentGripSettings = options.gripSettings ?? null;

    // 🏢 ENTERPRISE (2026-01-25): Store transform/viewport for real-time drag preview
    this.transform = transform;
    this.viewport = viewport;

    const startTime = performance.now();

    // Clear canvas using unified utils
    CanvasUtils.clearCanvas(this.ctx, this.canvas, 'transparent');

    // 🏢 ADR-102: Centralized Origin Marker (Blue inverted L-shape: BOTTOM + RIGHT)
    renderOriginMarker(this.ctx, transform, viewport, { variant: 'layer' });

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
    // 🏢 ENTERPRISE (2026-01-26): Handle real-time drag preview for MULTI-GRIP vertices
    // Pattern: Autodesk Inventor - Uses IMMUTABLE original positions + computed delta
    // This ensures preview is always accurate, even if Firestore updates during drag
    const selectedVertexIndices = layer.selectedGripIndices ??
      (layer.selectedGripType === 'vertex' && layer.selectedGripIndex !== undefined ? [layer.selectedGripIndex] : []);

    // 🏢 ENTERPRISE: Get drag state with original positions
    const dragState = layer.isDragging ? layer.dragState : null;

    let screenVertices = polygon.vertices.map((vertex: Point2D, index: number) => {
      // Check if this vertex is being dragged (for multi-grip vertex drag preview)
      if (dragState && selectedVertexIndices.includes(index)) {
        // 🏢 CRITICAL: Use ORIGINAL position (immutable) + delta, NOT current vertex position
        // This prevents visual jumping when Firestore updates during drag
        const originalPosition = dragState.originalPositions.get(index);
        if (originalPosition) {
          const previewPosition: Point2D = {
            x: originalPosition.x + dragState.delta.x,
            y: originalPosition.y + dragState.delta.y
          };
          return CoordinateTransforms.worldToScreen(previewPosition, transform, viewport);
        }
        // Fallback: use current vertex + delta (legacy behavior)
        const previewPosition: Point2D = {
          x: vertex.x + dragState.delta.x,
          y: vertex.y + dragState.delta.y
        };
        return CoordinateTransforms.worldToScreen(previewPosition, transform, viewport);
      }
      return CoordinateTransforms.worldToScreen(vertex, transform, viewport);
    });

    // 🏢 ENTERPRISE (2026-01-26): Handle edge midpoint drag (vertex insertion preview)
    // Note: Edge midpoint drag is always single-grip (creates new vertex)
    const selectedEdgeMidpointIndex = layer.selectedEdgeMidpointIndices?.[0] ??
      (layer.selectedGripType === 'edge-midpoint' ? layer.selectedGripIndex : undefined);

    if (layer.isDragging && layer.dragPreviewPosition && selectedEdgeMidpointIndex !== undefined) {
      const insertIndex = selectedEdgeMidpointIndex + 1;
      const previewVertex = CoordinateTransforms.worldToScreen(layer.dragPreviewPosition, transform, viewport);
      // Insert the preview vertex into the array
      screenVertices = [
        ...screenVertices.slice(0, insertIndex),
        previewVertex,
        ...screenVertices.slice(insertIndex)
      ];
    }

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
      this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL; // 🏢 ADR-044
      this.ctx.setLineDash([...LINE_DASH_PATTERNS.SELECTION]); // 🏢 ADR-097: Centralized selection pattern
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      // Debug disabled: console.log('🔍 Applied selection highlight');
    }

    // 🏢 ENTERPRISE (2026-01-25): Vertex grips using CENTRALIZED GripSettings
    // Pattern: Autodesk/SAP - Single Source of Truth for grip appearance
    if (layer.showGrips && polygon.vertices.length >= 1) {
      // 🎯 CENTRALIZED: Get grip settings from instance (passed via render options)
      const gripSettings = this.currentGripSettings;
      const dpiScale = gripSettings?.dpiScale ?? 1.0;
      const baseSize = (gripSettings?.gripSize ?? 5) * dpiScale;

      // 🏢 ADR-075: Calculate sizes using centralized multipliers (cold→warm→hot)
      const GRIP_SIZE_COLD = Math.round(baseSize * GRIP_SIZE_MULTIPLIERS.COLD);
      const GRIP_SIZE_WARM = Math.round(baseSize * GRIP_SIZE_MULTIPLIERS.WARM);
      const GRIP_SIZE_HOT = Math.round(baseSize * GRIP_SIZE_MULTIPLIERS.HOT);

      // Get colors from centralized settings
      // 🏢 ADR-115: Using centralized UI_COLORS - no hardcoded fallbacks needed
      const GRIP_COLOR_COLD = gripSettings?.colors?.cold ?? UI_COLORS.GRIP_DEFAULT;
      const GRIP_COLOR_WARM = gripSettings?.colors?.warm ?? UI_COLORS.GRIP_HOVER;
      const GRIP_COLOR_HOT = gripSettings?.colors?.hot ?? UI_COLORS.SUCCESS_BRIGHT;
      const GRIP_COLOR_CONTOUR = gripSettings?.colors?.contour ?? UI_COLORS.BLACK;

      // 🏢 ENTERPRISE (2026-01-26): Get selected grip indices for multi-grip support
      const selectedVertexGripIndices = layer.selectedGripIndices ??
        (layer.selectedGripType === 'vertex' && layer.selectedGripIndex !== undefined ? [layer.selectedGripIndex] : []);

      for (let i = 0; i < screenVertices.length; i++) {
        let vertex = screenVertices[i];
        const isFirstGrip = i === 0;
        const isCloseHighlighted = isFirstGrip && layer.isNearFirstPoint;
        const isHovered = layer.hoveredVertexIndex === i;

        // 🏢 ENTERPRISE (2026-01-26): Check if this grip is SELECTED (HOT) - Multi-grip support
        // ADR-031: Multi-Grip Selection System - uses array of selected indices
        const isSelected = selectedVertexGripIndices.includes(i);

        // 🏢 ENTERPRISE (2026-01-26): Real-time drag preview - handled earlier in screenVertices mapping
        // The vertex position is already updated if this grip is being dragged

        // Determine grip state: hot (selected/close) > warm (hover) > cold (normal)
        // 🏢 ENTERPRISE: Selected grips are HOT even when not close to first point
        const gripState: 'cold' | 'warm' | 'hot' = (isCloseHighlighted || isSelected) ? 'hot' : isHovered ? 'warm' : 'cold';
        const gripSize = gripState === 'hot' ? GRIP_SIZE_HOT : gripState === 'warm' ? GRIP_SIZE_WARM : GRIP_SIZE_COLD;
        const fillColor = gripState === 'hot' ? GRIP_COLOR_HOT : gripState === 'warm' ? GRIP_COLOR_WARM : GRIP_COLOR_COLD;

        // Draw grip square
        this.ctx.save();
        this.ctx.fillStyle = fillColor;
        this.ctx.strokeStyle = GRIP_COLOR_CONTOUR;
        this.ctx.lineWidth = gripState !== 'cold' ? 2 : 1;

        // Draw filled square grip
        const halfSize = gripSize / 2;
        this.ctx.fillRect(vertex.x - halfSize, vertex.y - halfSize, gripSize, gripSize);
        this.ctx.strokeRect(vertex.x - halfSize, vertex.y - halfSize, gripSize, gripSize);

        // Draw "close" indicator for first grip when highlighted (hot state)
        if (isCloseHighlighted) {
          this.ctx.strokeStyle = GRIP_COLOR_HOT;
          this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL; // 🏢 ADR-044
          const outerSize = gripSize + 6;
          const outerHalf = outerSize / 2;
          this.ctx.strokeRect(vertex.x - outerHalf, vertex.y - outerHalf, outerSize, outerSize);
        }

        // 🏢 ENTERPRISE (2026-01-25): Draw selection indicator for HOT grip (without close)
        if (isSelected && !isCloseHighlighted) {
          this.ctx.strokeStyle = GRIP_COLOR_HOT;
          this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL; // 🏢 ADR-044
          const outerSize = gripSize + 4;
          const outerHalf = outerSize / 2;
          this.ctx.strokeRect(vertex.x - outerHalf, vertex.y - outerHalf, outerSize, outerSize);
        }

        this.ctx.restore();
      }
    }

    // 🏢 ENTERPRISE (2026-01-25): Edge midpoint grips using CENTRALIZED settings (Autodesk pattern)
    // ◇ = Diamond/rhombus grip - click to add new vertex at this position
    if (layer.showEdgeMidpoints && polygon.vertices.length >= 2) {
      const gripSettings = this.currentGripSettings;
      const dpiScale = gripSettings?.dpiScale ?? 1.0;

      // Edge grips are smaller than vertex grips (60% of base size)
      const baseEdgeSize = ((gripSettings?.gripSize ?? 5) * 0.6) * dpiScale;
      // 🏢 ADR-106: Use centralized edge grip multipliers
      const EDGE_GRIP_SIZE_COLD = Math.round(baseEdgeSize * EDGE_GRIP_SIZE_MULTIPLIERS.COLD);
      const EDGE_GRIP_SIZE_WARM = Math.round(baseEdgeSize * EDGE_GRIP_SIZE_MULTIPLIERS.WARM);

      // 🏢 ADR-115: Colors using centralized UI_COLORS - no hardcoded fallbacks needed
      const EDGE_GRIP_COLOR_COLD = UI_COLORS.GRIP_EDGE;
      const EDGE_GRIP_COLOR_WARM = gripSettings?.colors?.warm ?? UI_COLORS.GRIP_HOVER;
      const GRIP_COLOR_CONTOUR = gripSettings?.colors?.contour ?? UI_COLORS.BLACK;

      // Iterate through edges (including closing edge for closed polygons)
      const edgeCount = screenVertices.length;
      for (let i = 0; i < edgeCount; i++) {
        const startVertex = screenVertices[i];
        const endVertex = screenVertices[(i + 1) % screenVertices.length];

        // 🏢 ADR-073: Use centralized midpoint calculation
        const mid = calculateMidpoint(startVertex, endVertex);

        // Check if this edge is hovered
        const isHovered = layer.hoveredEdgeIndex === i;

        // 🏢 ENTERPRISE (2026-01-26): Check if this edge midpoint is SELECTED (HOT)
        // ADR-031: Multi-Grip Selection System - edge midpoints use array for consistency
        const selectedEdgeMidpointIdx = layer.selectedEdgeMidpointIndices ??
          (layer.selectedGripType === 'edge-midpoint' && layer.selectedGripIndex !== undefined ? [layer.selectedGripIndex] : []);
        const isSelected = selectedEdgeMidpointIdx.includes(i);

        // 🏢 ADR-106: HOT grip size using centralized multiplier
        const EDGE_GRIP_SIZE_HOT = Math.round(baseEdgeSize * EDGE_GRIP_SIZE_MULTIPLIERS.HOT);
        // 🏢 ADR-115: Using centralized UI_COLORS - no hardcoded fallback needed
        const EDGE_GRIP_COLOR_HOT = gripSettings?.colors?.hot ?? UI_COLORS.SUCCESS_BRIGHT;

        // 🏢 ENTERPRISE (2026-01-25): Real-time drag preview for edge midpoint
        let drawMidX = mid.x;
        let drawMidY = mid.y;
        if (isSelected && layer.isDragging && layer.dragPreviewPosition && this.transform) {
          // Convert dragPreviewPosition from world to screen coordinates
          const previewScreen = this.worldToScreen(layer.dragPreviewPosition, this.transform, this.viewport);
          drawMidX = previewScreen.x;
          drawMidY = previewScreen.y;
        }

        // Determine grip state: hot (selected) > warm (hover) > cold (normal)
        const gripState: 'cold' | 'warm' | 'hot' = isSelected ? 'hot' : isHovered ? 'warm' : 'cold';
        const gripSize = gripState === 'hot' ? EDGE_GRIP_SIZE_HOT : gripState === 'warm' ? EDGE_GRIP_SIZE_WARM : EDGE_GRIP_SIZE_COLD;
        const fillColor = gripState === 'hot' ? EDGE_GRIP_COLOR_HOT : gripState === 'warm' ? EDGE_GRIP_COLOR_WARM : EDGE_GRIP_COLOR_COLD;

        // Draw diamond/rhombus grip at midpoint ◇
        this.ctx.save();
        this.ctx.fillStyle = fillColor;
        this.ctx.strokeStyle = gripState !== 'cold' ? fillColor : GRIP_COLOR_CONTOUR;
        this.ctx.lineWidth = gripState !== 'cold' ? 2 : 1;

        // Draw diamond shape (rotated square)
        this.ctx.beginPath();
        this.ctx.moveTo(drawMidX, drawMidY - gripSize);        // Top
        this.ctx.lineTo(drawMidX + gripSize, drawMidY);        // Right
        this.ctx.lineTo(drawMidX, drawMidY + gripSize);        // Bottom
        this.ctx.lineTo(drawMidX - gripSize, drawMidY);        // Left
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Draw highlight for WARM or HOT grips
        if (gripState !== 'cold') {
          this.ctx.strokeStyle = fillColor;
          this.ctx.lineWidth = RENDER_LINE_WIDTHS.NORMAL; // 🏢 ADR-044
          const outerSize = gripSize + 4;
          this.ctx.beginPath();
          this.ctx.moveTo(drawMidX, drawMidY - outerSize);
          this.ctx.lineTo(drawMidX + outerSize, drawMidY);
          this.ctx.lineTo(drawMidX, drawMidY + outerSize);
          this.ctx.lineTo(drawMidX - outerSize, drawMidY);
          this.ctx.closePath();
          this.ctx.stroke();
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
    this.ctx.lineWidth = RENDER_LINE_WIDTHS.THIN; // 🏢 ADR-044

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
          this.ctx.arc(x, y, 1, 0, TAU);
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
    this.ctx.font = buildUIFont(settings.fontSize ?? UI_SIZE_DEFAULTS.RULER_FONT_SIZE, 'arial');
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
    const majorTickLength = settings.majorTickLength ?? UI_SIZE_DEFAULTS.MAJOR_TICK_LENGTH;
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
        this.ctx.font = buildUIFont(settings.fontSize ?? UI_SIZE_DEFAULTS.RULER_FONT_SIZE, 'arial');
        this.ctx.fillText(numberText, x, yPosition + rulerHeight / 2);

        // Units με ξεχωριστό fontSize και color (αν είναι enabled)
        if (settings.showUnits !== false) {
          // Υπολογισμός width του number text για σωστό positioning
          const numberWidth = this.ctx.measureText(numberText).width;

          // 🔺 UNITS SPECIFIC STYLING - Σύνδεση με floating panel
          this.ctx.fillStyle = settings.unitsColor ?? settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
          this.ctx.font = buildUIFont(settings.unitsFontSize ?? settings.fontSize ?? UI_SIZE_DEFAULTS.RULER_UNITS_FONT_SIZE, 'arial');

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
    const majorTickLength = settings.majorTickLength ?? UI_SIZE_DEFAULTS.MAJOR_TICK_LENGTH;
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

        // 🏢 ADR-XXX: Use centralized RIGHT_ANGLE constant (90° = π/2)
        this.ctx.save();
        this.ctx.translate(rulerWidth / 2, y);
        this.ctx.rotate(-RIGHT_ANGLE);

        // Numbers με το κανονικό fontSize και textColor
        this.ctx.fillStyle = settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
        this.ctx.font = buildUIFont(settings.fontSize ?? UI_SIZE_DEFAULTS.RULER_FONT_SIZE, 'arial');
        this.ctx.fillText(numberText, 0, 0);

        // Units με ξεχωριστό fontSize και color (αν είναι enabled)
        if (settings.showUnits !== false) {
          // Υπολογισμός width του number text για σωστό positioning
          const numberWidth = this.ctx.measureText(numberText).width;

          // 🔺 UNITS SPECIFIC STYLING - Σύνδεση με floating panel
          this.ctx.fillStyle = settings.unitsColor ?? settings.textColor ?? settings.color ?? UI_COLORS.BLACK;
          this.ctx.font = buildUIFont(settings.unitsFontSize ?? settings.fontSize ?? UI_SIZE_DEFAULTS.RULER_UNITS_FONT_SIZE, 'arial');

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
   * 🏢 ADR-105: Use centralized fallback tolerance
   */
  hitTest(
    layers: ColorLayer[],
    screenPoint: Point2D,
    transform: ViewTransform,
    viewport: Viewport,
    tolerance = TOLERANCE_CONFIG.HIT_TEST_FALLBACK
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