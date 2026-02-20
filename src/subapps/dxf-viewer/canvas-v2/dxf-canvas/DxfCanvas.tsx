/**
 * CANVAS V2 - DXF CANVAS COMPONENT
 * Καθαρό DXF canvas χωρίς legacy κώδικα
 */

'use client';

import React, { useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { DxfRenderer } from './DxfRenderer';
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Mouse handlers τώρα από το centralized system
import { useCentralizedMouseHandlers } from '../../systems/cursor/useCentralizedMouseHandlers';
import { useCursor } from '../../systems/cursor/CursorSystem';
// ✅ ADR-006: LegacyCrosshairAdapter REMOVED - Crosshair now rendered by CrosshairOverlay component
// ✅ ADR-007: LegacyCursorAdapter REMOVED - Only CrosshairOverlay renders cursor now
import { SelectionRenderer } from '../layer-canvas/selection/SelectionRenderer';
import type { ViewTransform, Viewport, Point2D, CanvasConfig } from '../../rendering/types/Types';
// ✅ ADR-006: CrosshairSettings type inlined - legacy import removed
import { getCursorSettings } from '../../systems/cursor/config';
import type { DxfScene, DxfRenderOptions } from './dxf-types';
// ✅ ENTERPRISE MIGRATION: Using ServiceRegistry for all services
import { serviceRegistry } from '../../services';
// ✅ ADD: Grid and Ruler types για UI rendering
import type { GridSettings, RulerSettings, ColorLayer } from '../layer-canvas/layer-types';
// ✅ ADD: Grid and Ruler renderers για independent UI rendering
import { GridRenderer } from '../../rendering/ui/grid/GridRenderer';
import { RulerRenderer } from '../../rendering/ui/ruler/RulerRenderer';
import { createUIRenderContext } from '../../rendering/ui/core/UIRenderContext';
// ADR-189: Construction Guide Renderer
import { GuideRenderer } from '../../systems/guides/guide-renderer';
import type { Guide } from '../../systems/guides/guide-types';
import type { GridAxis } from '../../ai-assistant/grid-types';
// Enterprise Canvas UI Migration - Phase B
import { canvasUI } from '@/styles/design-tokens/canvas';
// ✅ ADR-002: Centralized canvas theme
import { CANVAS_THEME } from '../../config/color-config';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
// 🏢 ADR-094: Centralized Device Pixel Ratio
import { getDevicePixelRatio } from '../../systems/cursor/utils';
// 🏢 ADR-118: Centralized Canvas Resize Hook
import { useCanvasResize } from '../../hooks/canvas';
// 🏢 ADR-119: Centralized RAF via UnifiedFrameScheduler
import { registerRenderCallback, RENDER_PRIORITIES } from '../../rendering';
// 🏢 ADR-127: Centralized Ruler Dimensions
import { RULERS_GRID_CONFIG } from '../../systems/rulers-grid/config';

// ✅ MOVED OUTSIDE COMPONENT - Prevents re-render loop
const DEFAULT_RENDER_OPTIONS: DxfRenderOptions = {
  showGrid: false,
  showLayerNames: false,
  wireframeMode: false,
  selectedEntityIds: []
};

interface DxfCanvasProps {
  scene: DxfScene | null;
  transform: ViewTransform;
  viewport?: Viewport; // ✅ CENTRALIZED: Optional viewport prop (if not provided, will calculate internally)
  crosshairSettings?: { enabled?: boolean }; // ✅ ADR-006: Simplified - only enabled flag needed for cursor style
  gridSettings?: GridSettings; // ✅ ADD: Grid UI rendering
  rulerSettings?: RulerSettings; // ✅ ADD: Ruler UI rendering
  renderOptions?: DxfRenderOptions;
  className?: string;
  activeTool?: string; // ✅ ADD: Tool context για pan/select behavior
  overlayMode?: 'select' | 'draw' | 'edit'; // 🎯 OVERLAY MODE: Pass overlay mode for drawing detection
  colorLayers?: ColorLayer[]; // ✅ ADD: Color layers για fit to view bounds calculation
  // ADR-189: Construction Guide System
  guides?: readonly Guide[];
  guidesVisible?: boolean;
  ghostGuide?: { axis: GridAxis; offset: number } | null;
  ghostDiagonalGuide?: { start: Point2D; end: Point2D } | null;
  highlightedGuideId?: string | null;
  onTransformChange?: (transform: ViewTransform) => void;
  onEntitySelect?: (entityId: string | null) => void;
  onMouseMove?: (screenPos: Point2D, worldPos: Point2D) => void;
  onWheelZoom?: (wheelDelta: number, center: Point2D) => void; // ✅ ZOOM SYSTEM INTEGRATION
  onCanvasClick?: (point: Point2D) => void; // 🎯 DRAWING TOOLS: Click handler for entity drawing
  onContextMenu?: (e: React.MouseEvent) => void; // 🏢 ADR-053: Right-click context menu for drawing tools
  // 🏢 ENTERPRISE (2026-02-13): Marquee selection support — forwarded to useCentralizedMouseHandlers
  onLayerSelected?: (layerId: string, position: Point2D) => void;
  onMultiLayerSelected?: (layerIds: string[]) => void;
  onEntitiesSelected?: (entityIds: string[]) => void;
  // 🏢 ENTERPRISE (2026-02-19): Unified marquee result — AutoCAD-style combined selection
  onUnifiedMarqueeResult?: (result: { layerIds: string[]; entityIds: string[] }) => void;
  isGripDragging?: boolean;
  onHoverEntity?: (entityId: string | null) => void;
  // 🏢 ENTERPRISE (2026-02-15): Overlay hover highlighting callback
  onHoverOverlay?: (overlayId: string | null) => void;
  // 🏢 ENTERPRISE (2026-02-15): Grip drag-release callbacks
  onGripMouseDown?: (worldPos: Point2D) => boolean;
  onGripMouseUp?: (worldPos: Point2D) => boolean;
  /** Entity-picking mode active (angle measurement tools) — enables hover highlighting */
  entityPickingActive?: boolean;
}

export interface DxfCanvasRef {
  getCanvas: () => HTMLCanvasElement | null;
  getTransform: () => ViewTransform;
  fitToView: () => void;
  zoomAtScreenPoint: (factor: number, screenPoint: Point2D) => void;
}

// 🚀 PERFORMANCE (2026-01-27): Wrap forwardRef with memo to prevent unnecessary re-renders
// Parent state changes (mouseCss, mouseWorld, dragPreviewPosition) should NOT trigger canvas re-render
export const DxfCanvas = React.memo(React.forwardRef<DxfCanvasRef, DxfCanvasProps>(({
  scene,
  transform,
  viewport: viewportProp, // ✅ CENTRALIZED: Accept viewport prop
  crosshairSettings,
  gridSettings, // ✅ ADD: Grid settings for UI rendering
  rulerSettings, // ✅ ADD: Ruler settings for UI rendering
  renderOptions = DEFAULT_RENDER_OPTIONS,
  className = '',
  activeTool,
  overlayMode, // 🎯 OVERLAY MODE: Destructure overlay mode
  colorLayers = [], // ✅ ADD: Color layers for fit to view
  // ADR-189: Construction guides
  guides,
  guidesVisible = true,
  ghostGuide,
  ghostDiagonalGuide,
  highlightedGuideId,
  onTransformChange,
  onEntitySelect,
  onMouseMove,
  onWheelZoom,
  onCanvasClick, // 🎯 DRAWING TOOLS: Click handler
  onContextMenu, // 🏢 ADR-053: Right-click context menu for drawing tools
  // 🏢 ENTERPRISE (2026-02-13): Marquee selection support — forwarded to useCentralizedMouseHandlers
  onLayerSelected,
  onMultiLayerSelected,
  onEntitiesSelected,
  onUnifiedMarqueeResult,
  isGripDragging = false,
  onHoverEntity,
  onHoverOverlay,
  onGripMouseDown,
  onGripMouseUp,
  entityPickingActive,
  ...props // 🎯 PASS THROUGH: Περνάω όλα τα extra props (όπως data-canvas-type)
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DxfRenderer | null>(null);
  // ✅ ADR-006: crosshairRendererRef REMOVED - Crosshair now in CrosshairOverlay
  // ✅ ADR-007: cursorRendererRef REMOVED - Only CrosshairOverlay renders cursor now
  const selectionRendererRef = useRef<SelectionRenderer | null>(null);
  // ✅ ADD: Grid and Ruler renderer refs για independent UI
  const gridRendererRef = useRef<GridRenderer | null>(null);
  const rulerRendererRef = useRef<RulerRenderer | null>(null);
  // ADR-189: Guide renderer ref
  const guideRendererRef = useRef<GuideRenderer | null>(null);

  // 🏢 ADR-118: Centralized canvas resize hook
  // Handles viewport priority resolution (viewportProp > ref > state) and ResizeObserver
  // Note: setupCanvas callback is passed via useEffect below (after setupCanvas is defined)
  const { viewport, viewportRef, setInternalViewport } = useCanvasResize({
    canvasRef,
    viewportProp,
  });

  // 🏢 FIX (2026-02-01): Transform and viewport refs for RAF callback - prevents stale closures
  // PROBLEM: ResizeObserver → setTransform (async) → RAF fires before useEffect registers new callback
  //          The OLD callback has OLD closured values → origin marker misaligned!
  // SOLUTION: Use refs that are ALWAYS current, updated synchronously before render
  const transformRef = useRef(transform);
  transformRef.current = transform; // Always keep in sync

  // 🏢 FIX (2026-02-01): Viewport ref - useCanvasResize's viewportRef doesn't update when viewportProp exists!
  const resolvedViewportRef = useRef(viewport);
  resolvedViewportRef.current = viewport; // Always keep in sync

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση του CursorSystem αντί για local state
  const cursor = useCursor();

  // 🏢 FIX (2026-02-13): Selection state refs for RAF-synchronized rendering
  // PROBLEM: Selection box was rendered in a separate useEffect OUTSIDE the RAF loop.
  // The RAF loop clears the canvas and re-renders the scene, wiping the selection box.
  // SOLUTION: Render selection box INSIDE the RAF loop, after scene/grid/rulers.
  // Use refs so the RAF callback always reads the latest cursor state without React dependencies.
  const selectionStateRef = useRef<{
    isSelecting: boolean;
    selectionStart: Point2D | null;
    selectionCurrent: Point2D | null;
  }>({ isSelecting: false, selectionStart: null, selectionCurrent: null });
  selectionStateRef.current = {
    isSelecting: cursor.isSelecting,
    selectionStart: cursor.selectionStart ?? null,
    selectionCurrent: cursor.selectionCurrent ?? null
  };

  // 🏢 FIX (2026-02-13): ActiveTool ref for RAF callback — avoids stale closure
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  // ADR-189: Guide refs for RAF callback — avoids stale closure
  const guidesRef = useRef(guides);
  guidesRef.current = guides;
  const guidesVisibleRef = useRef(guidesVisible);
  guidesVisibleRef.current = guidesVisible;
  const highlightedGuideIdRef = useRef(highlightedGuideId);
  highlightedGuideIdRef.current = highlightedGuideId;
  const ghostGuideRef = useRef(ghostGuide);
  ghostGuideRef.current = ghostGuide;
  const ghostDiagonalGuideRef = useRef(ghostDiagonalGuide);
  ghostDiagonalGuideRef.current = ghostDiagonalGuide;

  // ✅ IMPERATIVE HANDLE: Expose methods για external controls
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    getTransform: () => transform,
    fitToView: () => {
      // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση κεντρικής υπηρεσίας αντί για διάσπαρτο κώδικα
      if (!onTransformChange) {
        console.warn('🎯 DxfCanvas.fitToView: No onTransformChange callback provided');
        return;
      }

      // ✅ ENTERPRISE MIGRATION: Get service from registry
      const fitToViewService = serviceRegistry.get('fit-to-view');
      const success = fitToViewService.performFitToView(
        scene,
        colorLayers,
        viewport,
        onTransformChange,
        { padding: 0.1, maxScale: 20, alignToOrigin: true }
      );

      if (!success) {
        console.warn('🎯 DxfCanvas.fitToView: FitToViewService failed');
      }
    },
    zoomAtScreenPoint: (factor: number, screenPoint: Point2D) => {
      // ✅ ΣΩΣΤΗ ΥΛΟΠΟΙΗΣΗ: Χρήση onWheelZoom callback που συνδέεται με ZoomSystem
      if (onWheelZoom) {
        // ✅ ΣΩΣΤΑ: screenPoint είναι ήδη canvas-relative coordinates από lastMouseRef
        // Convert factor to wheelDelta (wheelDelta < 0 = zoom in, > 0 = zoom out)
        const wheelDelta = factor > 1 ? -120 : 120;
        onWheelZoom(wheelDelta, screenPoint);
      }
    }
  }), [scene, colorLayers, viewport, onTransformChange, onWheelZoom]);

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Centralized mouse handlers
  const mouseHandlers = useCentralizedMouseHandlers({
    scene,
    transform,
    viewport,
    activeTool, // ✅ ADD: Pass activeTool για pan behavior
    overlayMode, // 🎯 OVERLAY MODE: Pass overlay mode for drawing detection
    onTransformChange,
    onEntitySelect,
    onMouseMove,
    onWheelZoom,
    onCanvasClick, // 🎯 DRAWING TOOLS: Pass click handler
    // 🏢 ENTERPRISE (2026-02-13): Marquee selection props — enables AutoCAD-style Window/Crossing selection
    colorLayers,
    onLayerSelected,
    onMultiLayerSelected,
    onEntitiesSelected,
    onUnifiedMarqueeResult,
    canvasRef: canvasRef,
    isGripDragging,
    onHoverEntity,
    onHoverOverlay,
    onGripMouseDown,
    onGripMouseUp,
    entityPickingActive,
    hitTestCallback: (scene, screenPos, transform, viewport) => {
      try {
        // ✅ ENTERPRISE MIGRATION: Get service from registry
        const hitTesting = serviceRegistry.get('hit-testing');
        // 🏢 AutoCAD standard: Pass pixel tolerance (HitTestingService converts to world units)
        const result = hitTesting.hitTest(screenPos, transform, viewport, {
          tolerance: TOLERANCE_CONFIG.ENTITY_HOVER_PIXELS,
          maxResults: 1
        });

        // DxfCanvas hit-test debug disabled for performance

        return result.entityId;
      } catch (error) {
        console.error('🔥 DxfCanvas ΚΕΝΤΡΙΚΟ hitTest failed:', error);
        return null;
      }
    }
  });

  // ✅ SNAP RESULTS: Get snap detection results from mouse handlers (Step 4)
  const { snapResults } = mouseHandlers;

  // Canvas config - ✅ ADR-002: Centralized canvas theme
  const canvasConfig: CanvasConfig = {
    devicePixelRatio: getDevicePixelRatio(), // 🏢 ADR-094
    enableHiDPI: true,
    backgroundColor: CANVAS_THEME.CONTAINER
  };

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      rendererRef.current = new DxfRenderer(canvas);

      // ✅ INITIALIZE UI RENDERERS - Using centralized UI system
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // ✅ ADR-006: LegacyCrosshairAdapter initialization REMOVED
        // ✅ ADR-007: LegacyCursorAdapter initialization REMOVED - Only CrosshairOverlay renders cursor
        selectionRendererRef.current = new SelectionRenderer(ctx);
        // ✅ ADD: Initialize Grid and Ruler renderers για independent UI
        gridRendererRef.current = new GridRenderer();
        rulerRendererRef.current = new RulerRenderer();
        // ADR-189: Initialize Guide renderer
        guideRendererRef.current = new GuideRenderer();
      }
    } catch (error) {
      console.error('Failed to initialize DXF renderer:', error);
    }
  }, []);

  // Setup canvas size and context
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('🚨 DxfCanvas.setupCanvas: canvas ref is null');
      return;
    }

    // ✅ DEFENSIVE: Validate canvas is HTMLCanvasElement
    if (!(canvas instanceof HTMLCanvasElement)) {
      console.error('🚨 DxfCanvas.setupCanvas: canvas ref is not HTMLCanvasElement:', typeof canvas, canvas);
      return;
    }

    try {
      CanvasUtils.setupCanvasContext(canvas, canvasConfig);

      // 🏢 ENTERPRISE (2026-01-30): Fresh DOM read - no caching!
      // Use getBoundingClientRect directly for SSoT viewport
      const rect = canvas.getBoundingClientRect();
      const newViewport = { width: rect.width, height: rect.height };

      // 🎯 CRITICAL: Update ref SYNCHRONOUSLY (no React batching)
      // This ensures render loop ALWAYS has fresh viewport
      viewportRef.current = newViewport;

      // ✅ ALSO update state for React dependencies (UI re-renders)
      // But coordinate transforms use viewportRef, not this state
      setInternalViewport(newViewport);
    } catch (error) {
      console.error('Failed to setup DXF canvas:', error);
    }
  }, []); // Removed canvasConfig dependency to prevent infinite loops

  // 🏢 ADR-119: Dirty flag ref for UnifiedFrameScheduler optimization
  const isDirtyRef = useRef(true);

  // 🏢 ADR-118: Setup canvas on mount
  // 🏢 ADR-119: Initial render now handled by UnifiedFrameScheduler
  useEffect(() => {
    setupCanvas();
    isDirtyRef.current = true; // Mark dirty for initial render
  }, [setupCanvas]);

  // 🏢 ENTERPRISE FIX (2026-02-01): Sync backing store when viewport changes
  // PROBLEM: When OverlayToolbarSection opens, CSS size changes but backing store stays the same
  // This causes the old ruler to persist in the larger backing store area (ghost/double ruler bug)
  // SOLUTION: Re-run setupCanvas when viewport dimensions change to synchronize backing store with CSS size
  // REF: Canvas backing store (canvas.width/height) MUST match CSS size for proper clearRect behavior
  const prevViewportRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    // Skip if viewport not yet established
    if (!viewport.width || !viewport.height) return;

    // Check if viewport actually changed (not just React re-render)
    const prevViewport = prevViewportRef.current;
    if (prevViewport.width === viewport.width && prevViewport.height === viewport.height) {
      return;
    }

    // Update previous viewport ref
    prevViewportRef.current = { width: viewport.width, height: viewport.height };

    // Skip initial setup (already handled by mount effect above)
    if (prevViewport.width === 0 && prevViewport.height === 0) {
      return;
    }

    // 🎯 CRITICAL: Re-setup canvas to sync backing store with new CSS dimensions
    // This ensures clearRect operates on the correct area and prevents ghost rulers
    setupCanvas();
    isDirtyRef.current = true; // Mark dirty for re-render
  }, [viewport.width, viewport.height, setupCanvas]);

  // 🎯 INITIAL TRANSFORM: Set world (0,0) at bottom-left ruler corner
  useEffect(() => {
    // Only run once when viewport is first established
    if (!viewport.width || !viewport.height || !onTransformChange) return;

    // Check if transform is still at default (0,0,0) - meaning not yet initialized
    if (transform.offsetX === 0 && transform.offsetY === 0 && transform.scale === 1) {
      // 🏢 ADR-127: Use centralized ruler dimensions
      const RULER_WIDTH = RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH;
      const RULER_HEIGHT = RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT;

      // Set world (0,0) at bottom-left ruler corner
      const initialTransform: ViewTransform = {
        scale: 1,
        offsetX: RULER_WIDTH,  // ruler width from left
        offsetY: viewport.height - RULER_HEIGHT  // viewport height - ruler height
      };

      onTransformChange(initialTransform);
    }
  }, [viewport.width, viewport.height, transform.offsetX, transform.offsetY, transform.scale, onTransformChange]); // 🏢 ENTERPRISE FIX: Include transform in deps to avoid stale closure

  // Computed styles check disabled for performance

  // 🏢 ADR-119: Memoized render function for UnifiedFrameScheduler
  // 🏢 FIX (2026-02-01): Use refs for transform/viewport - prevents RAF stale closure issue
  const renderScene = useCallback(() => {
    const renderer = rendererRef.current;
    // Use refs for viewport check - always current!
    const currentViewport = resolvedViewportRef.current;
    if (!renderer || !currentViewport.width || !currentViewport.height) return;

    // Get current values from refs
    const currentTransform = transformRef.current;

    try {
      // ✅ ENTERPRISE MIGRATION: Get service from registry
      const hitTesting = serviceRegistry.get('hit-testing');
      hitTesting.updateScene(scene);

      // 1️⃣ RENDER SCENE FIRST - using refs for transform/viewport
      renderer.render(scene, currentTransform, currentViewport, renderOptions);

      // 2️⃣ RENDER GRID (after scene, so it's on top)
      if (gridRendererRef.current && gridSettings?.enabled) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          // 🎯 TYPE-SAFE: Create proper UIRenderContext
          const uiTransform = {
            scale: currentTransform.scale,
            offsetX: currentTransform.offsetX,
            offsetY: currentTransform.offsetY,
            rotation: 0
          };
          const context = createUIRenderContext(ctx, currentViewport, uiTransform);
          // 🏢 ENTERPRISE: Type-safe UIElementSettings cast for GridRenderer
          gridRendererRef.current.render(context, currentViewport, gridSettings as import('../../rendering/ui/core/UIRenderer').UIElementSettings);
        }
      }

      // 2.5️⃣ RENDER GUIDES (ADR-189: construction reference lines — between grid and rulers)
      if (guideRendererRef.current && guidesVisibleRef.current) {
        const currentGuides = guidesRef.current;
        if (currentGuides && currentGuides.length > 0) {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (ctx) {
            guideRendererRef.current.renderGuides(
              ctx, currentGuides, currentTransform, currentViewport,
              highlightedGuideIdRef.current,
            );
          }
        }
        // Ghost guide preview (during placement)
        const currentGhost = ghostGuideRef.current;
        if (currentGhost) {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (ctx) {
            guideRendererRef.current.renderGhostGuide(ctx, currentGhost.axis, currentGhost.offset, currentTransform, currentViewport);
          }
        }
        // Ghost diagonal guide preview (3-click placement — ADR-189 §3.3)
        const currentGhostDiagonal = ghostDiagonalGuideRef.current;
        if (currentGhostDiagonal) {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (ctx) {
            guideRendererRef.current.renderGhostDiagonalGuide(
              ctx, currentGhostDiagonal.start, currentGhostDiagonal.end, currentTransform, currentViewport,
            );
          }
        }
      }

      // 3️⃣ RENDER RULERS (after grid, so it's on top of grid)
      if (rulerRendererRef.current && rulerSettings?.enabled) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          // 🎯 TYPE-SAFE: Create proper UIRenderContext
          const uiTransform = {
            scale: currentTransform.scale,
            offsetX: currentTransform.offsetX,
            offsetY: currentTransform.offsetY,
            rotation: 0
          };
          const context = createUIRenderContext(ctx, currentViewport, uiTransform);
          // 🏢 ENTERPRISE: Type-safe UIElementSettings cast for RulerRenderer
          rulerRendererRef.current.render(context, currentViewport, rulerSettings as import('../../rendering/ui/core/UIRenderer').UIElementSettings);
        }
      }

      // 4️⃣ RENDER SELECTION BOX (after everything, so it's on top — AutoCAD-style Window/Crossing)
      // 🏢 FIX (2026-02-13): Selection rendering is now INSIDE the RAF loop.
      // Previously it was in a separate useEffect that ran OUTSIDE the loop, so the
      // RAF's canvas clear would wipe the selection box before the browser could display it.
      const selState = selectionStateRef.current;
      const currentActiveTool = activeToolRef.current;
      if (selectionRendererRef.current && currentActiveTool !== 'pan' &&
          selState.isSelecting && selState.selectionStart && selState.selectionCurrent) {
        const cursorSettings = getCursorSettings();
        const selectionBox = {
          startPoint: selState.selectionStart,
          endPoint: selState.selectionCurrent,
          type: (selState.selectionCurrent.x > selState.selectionStart.x) ? 'window' : 'crossing'
        } as const;
        selectionRendererRef.current.renderSelection(
          selectionBox,
          currentViewport,
          cursorSettings.selection
        );
      }
    } catch (error) {
      console.error('Failed to render DXF scene:', error);
    }
  // 🏢 FIX (2026-02-01): REMOVED transform, viewport from dependencies - using refs instead
  // ADR-189: guides/ghostGuide use refs, no need in deps
  }, [scene, renderOptions, gridSettings, rulerSettings]);

  // 🏢 ADR-119: Register with UnifiedFrameScheduler for centralized RAF
  useEffect(() => {
    if (viewport.width > 0 && viewport.height > 0 && rendererRef.current) {
      const unsubscribe = registerRenderCallback(
        'dxf-canvas',
        'DXF Entity Renderer',
        RENDER_PRIORITIES.NORMAL,
        () => {
          renderScene();
          isDirtyRef.current = false;
        },
        () => isDirtyRef.current
      );

      return unsubscribe;
    }
  }, [renderScene, viewport.width, viewport.height]);

  // 🏢 ADR-119: Mark dirty when dependencies change
  useEffect(() => {
    isDirtyRef.current = true;
  }, [scene, transform, viewport, renderOptions, gridSettings, rulerSettings, guides, guidesVisible, ghostGuide, ghostDiagonalGuide, highlightedGuideId]);

  // 🏢 FIX (2026-02-13): Mark dirty when selection state changes so RAF loop re-renders
  // The actual selection box rendering now happens inside renderScene (step 4️⃣)
  useEffect(() => {
    isDirtyRef.current = true;
  }, [
    cursor.isSelecting,
    cursor.selectionStart?.x,
    cursor.selectionStart?.y,
    cursor.selectionCurrent?.x,
    cursor.selectionCurrent?.y
  ]);

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Όλα τα mouse events τώρα διαχειρίζονται από τους centralized handlers
  // Απλά wrapper functions που καλούν τους κεντρικοποιημένους handlers

  return (
    <canvas
      ref={canvasRef}
      className={`dxf-canvas ${className}`}
      {...props} // 🎯 SPREAD: Περνάω τα extra props (data-canvas-type κ.λπ.)
      style={canvasUI.positioning.layers.dxfCanvasWithTools(activeTool, crosshairSettings?.enabled)}
      onMouseDown={(e) => mouseHandlers.handleMouseDown(e)}
      onMouseMove={(e) => mouseHandlers.handleMouseMove(e)}
      onMouseUp={mouseHandlers.handleMouseUp}
      onMouseLeave={(e) => mouseHandlers.handleMouseLeave(e)}
      onWheel={(e) => mouseHandlers.handleWheel(e)}
      // 🏢 ENTERPRISE: Prevent browser auto-scroll on middle-click
      onAuxClick={(e) => e.preventDefault()}
      // 🏢 ADR-053: Right-click context menu for drawing tools
      onContextMenu={onContextMenu}
    />
  );
}));

// 🚀 PERFORMANCE (2026-01-27): Display name for React DevTools debugging
DxfCanvas.displayName = 'DxfCanvas';