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
import { LegacyCrosshairAdapter } from '../../rendering/ui/crosshair/LegacyCrosshairAdapter';
import { LegacyCursorAdapter } from '../../rendering/ui/cursor/LegacyCursorAdapter';
import { SelectionRenderer } from '../layer-canvas/selection/SelectionRenderer';
import type { ViewTransform, Viewport, Point2D, CanvasConfig } from '../../rendering/types/Types';
import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';
import { getCursorSettings } from '../../systems/cursor/config';
import type { DxfScene, DxfRenderOptions } from './dxf-types';
// ✅ ENTERPRISE MIGRATION: Using ServiceRegistry for all services
import { serviceRegistry } from '../../services';
// ✅ ADD: Grid and Ruler types για UI rendering
import type { GridSettings, RulerSettings, ColorLayer } from '../layer-canvas/layer-types';
// ✅ ADD: Grid and Ruler renderers για independent UI rendering
import { GridRenderer } from '../../rendering/ui/grid/GridRenderer';
import { RulerRenderer } from '../../rendering/ui/ruler/RulerRenderer';

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
  crosshairSettings?: CrosshairSettings; // ✅ ADD: Connect to existing cursor system
  gridSettings?: GridSettings; // ✅ ADD: Grid UI rendering
  rulerSettings?: RulerSettings; // ✅ ADD: Ruler UI rendering
  renderOptions?: DxfRenderOptions;
  className?: string;
  activeTool?: string; // ✅ ADD: Tool context για pan/select behavior
  colorLayers?: ColorLayer[]; // ✅ ADD: Color layers για fit to view bounds calculation
  onTransformChange?: (transform: ViewTransform) => void;
  onEntitySelect?: (entityId: string | null) => void;
  onMouseMove?: (screenPos: Point2D, worldPos: Point2D) => void;
  onWheelZoom?: (wheelDelta: number, center: Point2D) => void; // ✅ ZOOM SYSTEM INTEGRATION
}

export interface DxfCanvasRef {
  getCanvas: () => HTMLCanvasElement | null;
  getTransform: () => ViewTransform;
  fitToView: () => void;
  zoomAtScreenPoint: (factor: number, screenPoint: Point2D) => void;
}

export const DxfCanvas = React.forwardRef<DxfCanvasRef, DxfCanvasProps>(({
  scene,
  transform,
  crosshairSettings,
  gridSettings, // ✅ ADD: Grid settings for UI rendering
  rulerSettings, // ✅ ADD: Ruler settings for UI rendering
  renderOptions = DEFAULT_RENDER_OPTIONS,
  className = '',
  activeTool,
  colorLayers = [], // ✅ ADD: Color layers for fit to view
  onTransformChange,
  onEntitySelect,
  onMouseMove,
  onWheelZoom,
  ...props // 🎯 PASS THROUGH: Περνάω όλα τα extra props (όπως data-canvas-type)
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DxfRenderer | null>(null);
  const crosshairRendererRef = useRef<LegacyCrosshairAdapter | null>(null);
  const cursorRendererRef = useRef<LegacyCursorAdapter | null>(null);
  const selectionRendererRef = useRef<SelectionRenderer | null>(null);
  // ✅ ADD: Grid and Ruler renderer refs για independent UI
  const gridRendererRef = useRef<GridRenderer | null>(null);
  const rulerRendererRef = useRef<RulerRenderer | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 }); // ✅ DYNAMIC SIZE

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
    onTransformChange,
    onEntitySelect,
    onMouseMove,
    onWheelZoom,
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

  // Canvas config
  const canvasConfig: CanvasConfig = {
    devicePixelRatio: window.devicePixelRatio || 1,
    enableHiDPI: true,
    backgroundColor: 'transparent'
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
        crosshairRendererRef.current = new LegacyCrosshairAdapter(ctx);
        cursorRendererRef.current = new LegacyCursorAdapter(ctx);
        selectionRendererRef.current = new SelectionRenderer(ctx);
        // ✅ ADD: Initialize Grid and Ruler renderers για independent UI
        gridRendererRef.current = new GridRenderer(ctx);
        rulerRendererRef.current = new RulerRenderer(ctx);
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
      setViewport({ width: rect.width, height: rect.height });
    } catch (error) {
      console.error('Failed to setup DXF canvas:', error);
    }
  }, []); // Removed canvasConfig dependency to prevent infinite loops

  // Setup canvas on mount and resize
  useEffect(() => {
    setupCanvas();

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

      console.log('🎯 DxfCanvas: Setting initial transform for world (0,0) at ruler corner', {
        viewport,
        transform: initialTransform
      });

      onTransformChange(initialTransform);
    }
  }, [viewport.width, viewport.height]); // Run when viewport is established

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
      console.log('🎨 DxfCanvas: 1️⃣ Rendering SCENE...');
      renderer.render(scene, transform, viewport, renderOptions);

      // 2️⃣ RENDER GRID (after scene, so it's on top)
      if (gridRendererRef.current && gridSettings?.enabled) {
        console.log('🎨 DxfCanvas: 2️⃣ Rendering GRID...', { enabled: gridSettings.enabled, visible: gridSettings.visible });
        const canvas = canvasRef.current;
        if (canvas) {
          const context = {
            ctx: canvas.getContext('2d'),
            canvas: canvas,
            transform: transform
          };

          if (context.ctx) {
            gridRendererRef.current.render(context as any, viewport, gridSettings);
            console.log('✅ DxfCanvas: GRID rendered successfully');
          }
        }
      }

      // 3️⃣ RENDER RULERS (after grid, so it's on top of grid)
      if (rulerRendererRef.current && rulerSettings?.enabled) {
        console.log('🎨 DxfCanvas: 3️⃣ Rendering RULERS...', { enabled: rulerSettings.enabled, visible: rulerSettings.visible });
        const canvas = canvasRef.current;
        if (canvas) {
          const context = {
            ctx: canvas.getContext('2d'),
            canvas: canvas,
            transform: transform
          };

          if (context.ctx) {
            rulerRendererRef.current.render(context as any, viewport, rulerSettings);
            console.log('✅ DxfCanvas: RULERS rendered successfully');

            // 🛠️ DEBUG: Ruler Debug System (Enterprise Calibration & Verification)
            if (typeof window !== 'undefined' && (window as any).rulerDebugOverlay) {
              const rulerDebug = (window as any).rulerDebugOverlay;
              const rulerStatus = rulerDebug.getStatus();

              if (rulerStatus.enabled && rulerStatus.settings) {
                // Create minimal UIRenderContext
                const { createUIRenderContext, DEFAULT_UI_TRANSFORM } = require('../../rendering/ui/core/UIRenderContext');
                const uiContext = createUIRenderContext(context.ctx, viewport, DEFAULT_UI_TRANSFORM);
                (uiContext as any).worldTransform = transform;

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
          }
        }
      }
    } catch (error) {
      console.error('Failed to render DXF scene:', error);
    }
  }, [scene, transform, viewport.width, viewport.height, renderOptions, gridSettings, rulerSettings]);

  // 🚀 SEPARATE UI RENDERING - Independent of scene rendering for better performance
  useEffect(() => {
    const crosshairRenderer = crosshairRendererRef.current;
    const cursorRenderer = cursorRendererRef.current;
    const selectionRenderer = selectionRendererRef.current;

    if (!viewport.width || !viewport.height) return;

    try {
      // Use centralized cursor position from CursorSystem
      const centralizedPosition = cursor.position;
      const cursorSystemSettings = getCursorSettings();

      // 🔥 PAN TOOL: Skip UI rendering in pan mode
      const isPanToolActive = activeTool === 'pan';

      // ✅ RENDER SELECTION BOX FIRST (behind crosshair/cursor) - disable in pan mode
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

      // ✅ RENDER CROSSHAIR (middle layer) - disable in pan mode
      if (crosshairRenderer && !isPanToolActive && crosshairSettings?.enabled && centralizedPosition) {
        crosshairRenderer.renderWithGap(
          centralizedPosition,
          viewport,
          crosshairSettings,
          10 // gap size για pickbox
        );
      }

      // ✅ RENDER CURSOR (top layer) - disable in pan mode
      if (cursorRenderer && !isPanToolActive && centralizedPosition) {
        cursorRenderer.render(
          centralizedPosition,
          viewport,
          cursorSystemSettings // ✅ ΧΡΗΣΗ ΥΠΑΡΧΟΝΤΟΣ SYSTEM - όχι hardcoded values!
        );
      }
    } catch (error) {
      console.error('Failed to render UI elements:', error);
    }
  }, [cursor.position, cursor.isSelecting, cursor.selectionStart, cursor.selectionCurrent, crosshairSettings, activeTool, viewport]);

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Όλα τα mouse events τώρα διαχειρίζονται από τους centralized handlers
  // Απλά wrapper functions που καλούν τους κεντρικοποιημένους handlers

  return (
    <canvas
      ref={canvasRef}
      className={`dxf-canvas ${className}`}
      {...props} // 🎯 SPREAD: Περνάω τα extra props (data-canvas-type κ.λπ.)
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        zIndex: 0, // 🎯 ΚΡΙΣΙΜΟ: Inline z-index για DxfCanvas κάτω
        touchAction: 'none', // 🎯 ENTERPRISE: Prevent browser touch gestures (pinch-zoom, pan)
        cursor: activeTool === 'pan' ? 'grab' : (crosshairSettings?.enabled ? 'none' : 'crosshair') // 🔥 Pan tool has priority over crosshair
      }}
      onMouseDown={(e) => mouseHandlers.handleMouseDown(e, canvasRef.current!)}
      onMouseMove={(e) => mouseHandlers.handleMouseMove(e, canvasRef.current!)}
      onMouseUp={mouseHandlers.handleMouseUp}
      onMouseLeave={(e) => mouseHandlers.handleMouseLeave(e, canvasRef.current!)}
      onWheel={(e) => mouseHandlers.handleWheel(e, canvasRef.current!)}
    />
  );
});