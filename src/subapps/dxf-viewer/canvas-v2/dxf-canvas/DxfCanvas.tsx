/**
 * CANVAS V2 - DXF CANVAS COMPONENT
 * Καθαρό DXF canvas χωρίς legacy κώδικα
 */

'use client';

import React, { useRef, useEffect, useState, useCallback, useImperativeHandle } from 'react';
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
import { createUIRenderContext, DEFAULT_UI_TRANSFORM } from '../../rendering/ui/core/UIRenderContext';
// Enterprise Canvas UI Migration - Phase B
import { canvasUI } from '@/styles/design-tokens/canvas';
// ✅ ADR-002: Centralized canvas theme
import { CANVAS_THEME } from '../../config/color-config';

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
  onTransformChange?: (transform: ViewTransform) => void;
  onEntitySelect?: (entityId: string | null) => void;
  onMouseMove?: (screenPos: Point2D, worldPos: Point2D) => void;
  onWheelZoom?: (wheelDelta: number, center: Point2D) => void; // ✅ ZOOM SYSTEM INTEGRATION
  onCanvasClick?: (point: Point2D) => void; // 🎯 DRAWING TOOLS: Click handler for entity drawing
  onContextMenu?: (e: React.MouseEvent) => void; // 🏢 ADR-053: Right-click context menu for drawing tools
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
  onTransformChange,
  onEntitySelect,
  onMouseMove,
  onWheelZoom,
  onCanvasClick, // 🎯 DRAWING TOOLS: Click handler
  onContextMenu, // 🏢 ADR-053: Right-click context menu for drawing tools
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
  // ✅ CENTRALIZED VIEWPORT: Use prop if provided AND valid, otherwise calculate internally
  const [internalViewport, setInternalViewport] = useState<Viewport>({ width: 0, height: 0 });
  // Use prop viewport only if it has valid dimensions (not 0x0)
  const viewport = (viewportProp && viewportProp.width > 0 && viewportProp.height > 0)
    ? viewportProp
    : internalViewport;

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση του CursorSystem αντί για local state
  const cursor = useCursor();

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
    hitTestCallback: (scene, screenPos, transform, viewport) => {
      try {
        // ✅ ENTERPRISE MIGRATION: Get service from registry
        const hitTesting = serviceRegistry.get('hit-testing');
        const result = hitTesting.hitTest(screenPos, transform, viewport, {
          tolerance: 5,
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
    devicePixelRatio: window.devicePixelRatio || 1,
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

      // ✅ ENTERPRISE MIGRATION: Get service from registry
      const canvasBounds = serviceRegistry.get('canvas-bounds');
      const rect = canvasBounds.getBounds(canvas);
      // ✅ Always update internal viewport (as fallback if prop is 0x0)
      setInternalViewport({ width: rect.width, height: rect.height });
    } catch (error) {
      console.error('Failed to setup DXF canvas:', error);
    }
  }, []); // Removed canvasConfig dependency to prevent infinite loops

  // Setup canvas on mount and resize
  useEffect(() => {
    setupCanvas();

    // 🔧 FIX (2026-01-27): Force initial render after setup
    // Without this, the canvas may not render until a resize event occurs (e.g., opening DevTools)
    // This ensures the scene is rendered immediately on mount
    requestAnimationFrame(() => {
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      if (renderer && canvas) {
        const rect = canvas.getBoundingClientRect();
        const currentViewport = { width: rect.width, height: rect.height };
        if (currentViewport.width > 0 && currentViewport.height > 0) {
          try {
            renderer.render(scene, transform, currentViewport, renderOptions);
          } catch (error) {
            console.error('🚨 [DxfCanvas] Force render failed:', error);
          }
        }
      }
    });

    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []); // Empty deps - setupCanvas is stable

  // 🎯 INITIAL TRANSFORM: Set world (0,0) at bottom-left ruler corner
  useEffect(() => {
    // Only run once when viewport is first established
    if (!viewport.width || !viewport.height || !onTransformChange) return;

    // Check if transform is still at default (0,0,0) - meaning not yet initialized
    if (transform.offsetX === 0 && transform.offsetY === 0 && transform.scale === 1) {
      const RULER_WIDTH = 30;
      const RULER_HEIGHT = 30;

      // Set world (0,0) at bottom-left ruler corner
      const initialTransform: ViewTransform = {
        scale: 1,
        offsetX: RULER_WIDTH,  // 30px from left (ruler width)
        offsetY: viewport.height - RULER_HEIGHT  // viewport height - 30px (ruler height)
      };

      onTransformChange(initialTransform);
    }
  }, [viewport.width, viewport.height, transform.offsetX, transform.offsetY, transform.scale, onTransformChange]); // 🏢 ENTERPRISE FIX: Include transform in deps to avoid stale closure

  // Computed styles check disabled for performance

  // 🚀 IMMEDIATE SCENE RENDERING - No delays for professional CAD performance
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !viewport.width || !viewport.height) return;

    try {
      // ✅ ENTERPRISE MIGRATION: Get service from registry
      const hitTesting = serviceRegistry.get('hit-testing');
      hitTesting.updateScene(scene);

      // 1️⃣ RENDER SCENE FIRST
      renderer.render(scene, transform, viewport, renderOptions);

      // 2️⃣ RENDER GRID (after scene, so it's on top)
      if (gridRendererRef.current && gridSettings?.enabled) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          // 🎯 TYPE-SAFE: Create proper UIRenderContext
          const uiTransform = {
            scale: transform.scale,
            offsetX: transform.offsetX,
            offsetY: transform.offsetY,
            rotation: 0
          };
          const context = createUIRenderContext(ctx, viewport, uiTransform);
          // 🏢 ENTERPRISE: Type-safe UIElementSettings cast for GridRenderer
          gridRendererRef.current.render(context, viewport, gridSettings as import('../../rendering/ui/core/UIRenderer').UIElementSettings);
        }
      } else {
        console.log('🚫 [DxfCanvas] Grid NOT rendered:', {
          hasRenderer: !!gridRendererRef.current,
          enabled: gridSettings?.enabled,
          gridSettings
        });
      }

      // 3️⃣ RENDER RULERS (after grid, so it's on top of grid)
      if (rulerRendererRef.current && rulerSettings?.enabled) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          // 🎯 TYPE-SAFE: Create proper UIRenderContext
          const uiTransform = {
            scale: transform.scale,
            offsetX: transform.offsetX,
            offsetY: transform.offsetY,
            rotation: 0
          };
          const context = createUIRenderContext(ctx, viewport, uiTransform);
          // 🏢 ENTERPRISE: Type-safe UIElementSettings cast for RulerRenderer
          rulerRendererRef.current.render(context, viewport, rulerSettings as import('../../rendering/ui/core/UIRenderer').UIElementSettings);
        }
      }
    } catch (error) {
      console.error('Failed to render DXF scene:', error);
    }
  }, [scene, transform, viewport.width, viewport.height, renderOptions, gridSettings, rulerSettings]);

  // 🚀 SEPARATE UI RENDERING - Independent of scene rendering for better performance
  useEffect(() => {
    // ✅ ADR-006: crosshairRenderer REMOVED - Now rendered by CrosshairOverlay component
    // ✅ ADR-007: cursorRenderer REMOVED - Only CrosshairOverlay renders cursor now
    const selectionRenderer = selectionRendererRef.current;

    if (!viewport.width || !viewport.height) return;

    try {
      // Use centralized cursor position from CursorSystem
      const cursorSystemSettings = getCursorSettings();

      // 🔥 PAN TOOL: Skip UI rendering in pan mode
      const isPanToolActive = activeTool === 'pan';

      // ✅ RENDER SELECTION BOX FIRST (behind cursor) - disable in pan mode
      if (selectionRenderer && !isPanToolActive && cursor.isSelecting && cursor.selectionStart && cursor.selectionCurrent) {
        const selectionBox = {
          startPoint: cursor.selectionStart,
          endPoint: cursor.selectionCurrent,
          type: (cursor.selectionCurrent.x > cursor.selectionStart.x) ? 'window' : 'crossing'
        } as const;

        selectionRenderer.renderSelection(
          selectionBox,
          viewport,
          cursorSystemSettings.selection // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση centralized selection settings
        );
      }

      // ✅ ADR-006: CROSSHAIR RENDERING REMOVED - Now in CrosshairOverlay (canvas-v2/overlays/)
      // ✅ ADR-007: CURSOR RENDERING REMOVED - Only CrosshairOverlay renders cursor now
      // CrosshairOverlay is the ONLY cursor renderer (no more χεράκι/hand cursor from LegacyCursorAdapter)
    } catch (error) {
      console.error('Failed to render UI elements:', error);
    }
  }, [
    cursor.isSelecting,
    cursor.selectionStart?.x,
    cursor.selectionStart?.y,
    cursor.selectionCurrent?.x,
    cursor.selectionCurrent?.y,
    // ✅ ADR-006: crosshairSettings removed from deps - no longer used for rendering
    // ✅ ADR-007: cursor.position removed from deps - no longer used for cursor rendering
    activeTool,
    viewport
  ]);

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Όλα τα mouse events τώρα διαχειρίζονται από τους centralized handlers
  // Απλά wrapper functions που καλούν τους κεντρικοποιημένους handlers

  return (
    <canvas
      ref={canvasRef}
      className={`dxf-canvas ${className}`}
      {...props} // 🎯 SPREAD: Περνάω τα extra props (data-canvas-type κ.λπ.)
      style={{
        ...canvasUI.positioning.layers.dxfCanvasWithTools(activeTool, crosshairSettings?.enabled),
        backgroundColor: CANVAS_THEME.DXF_CANVAS // ✅ ADR-004: Centralized canvas background
      }}
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