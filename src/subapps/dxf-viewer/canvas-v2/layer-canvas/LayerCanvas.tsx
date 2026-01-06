/**
 * CANVAS V2 - LAYER CANVAS COMPONENT
 * Καθαρό Layer canvas για έγχρωμα layers + crosshair + snap indicators
 *
 * 🎯 ΚΡΙΣΙΜΟ: LAYER SELECTION DOCUMENTATION
 *
 * Για να δουλεύει το layer clicking (σταυρόνημα επιλέγει έγχρωμο layer):
 *
 * 1. ✅ COORDINATE CONVERSION: CanvasUtils.screenToCanvas() (όχι manual rect.left)
 * 2. ✅ HIT TESTING: LayerRenderer.hitTest() (όχι HitTestingService)
 * 3. ✅ COORDINATE SYSTEMS: CoordinateTransforms από rendering/core/
 *
 * ❌ ΣΥΧΝΑ ΛΑΘΗ:
 * - Χρήση HitTestingService αντί LayerRenderer.hitTest()
 * - Manual coordinate conversion αντί CanvasUtils.screenToCanvas()
 * - Duplicate coordinate functions αντί κεντρικό CoordinateTransforms
 */

'use client';

// ✅ USE EXISTING DEBUG SYSTEM: OptimizedLogger instead of duplicate flags

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LayerRenderer } from './LayerRenderer';
// ✅ SIMPLE DEBUG: Use console.log for reliable debugging like other components
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Mouse handlers και marquee selection από το centralized system
import { useCentralizedMouseHandlers } from '../../systems/cursor/useCentralizedMouseHandlers';
import { useCursor } from '../../systems/cursor/CursorSystem';

// ✅ ΦΑΣΗ 7: Import unified canvas system
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';
import { createUnifiedCanvasSystem } from '../../rendering/canvas';
import type { CanvasManager, CanvasInstance } from '../../rendering/canvas/core/CanvasManager';
import type { CanvasEventSystem } from '../../rendering/canvas/core/CanvasEventSystem';
import type { CanvasSettings } from '../../rendering/canvas/core/CanvasSettings';
// Enterprise Canvas UI Migration - Phase B
import { canvasUI } from '@/styles/design-tokens/canvas';
// ✅ ADR-002: Centralized canvas theme
import { CANVAS_THEME } from '../../config/color-config';

// ✅ ΦΑΣΗ 7: Event system κεντρικοποιημένο στο rendering/canvas/core/CanvasEventSystem
import { canvasEventBus, CANVAS_EVENTS, subscribeToTransformChanges } from '../../rendering/canvas/core/CanvasEventSystem';
import type { ViewTransform, Viewport, Point2D, CanvasConfig } from '../../rendering/types/Types';
import type { DxfScene } from '../dxf-canvas/dxf-types';
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
// ✅ ENTERPRISE MIGRATION: Using ServiceRegistry
import { serviceRegistry } from '../../services';

interface LayerCanvasProps {
  layers: ColorLayer[];
  transform: ViewTransform;
  viewport?: Viewport; // ✅ CENTRALIZED: Optional viewport prop (if not provided, will calculate internally)
  activeTool?: string; // 🔥 ADD: Tool context για pan/select behavior
  layersVisible?: boolean; // ✅ LAYER PERSISTENCE: Independent layer visibility state
  dxfScene?: DxfScene | null; // 🎯 SNAP FIX: DXF scene for snap engine initialization
  crosshairSettings: CrosshairSettings;
  cursorSettings: CursorSettings;
  snapSettings: SnapSettings;
  gridSettings: GridSettings;
  rulerSettings: RulerSettings;
  selectionSettings: SelectionSettings;
  renderOptions?: LayerRenderOptions;
  className?: string;
  style?: React.CSSProperties;
  onLayerClick?: (layerId: string, point: Point2D) => void;
  onCanvasClick?: (point: Point2D) => void;
  onMouseMove?: (screenPos: Point2D, worldPos: Point2D) => void;
  onTransformChange?: (transform: ViewTransform) => void;
  onWheelZoom?: (wheelDelta: number, center: Point2D) => void; // ✅ ZOOM SYSTEM INTEGRATION

  // ✅ ΦΑΣΗ 6: Feature flag για centralized UI rendering
  useUnifiedUIRendering?: boolean;

  // ✅ ΦΑΣΗ 7: Unified canvas system integration
  enableUnifiedCanvas?: boolean;
}

export const LayerCanvas = React.forwardRef<HTMLCanvasElement, LayerCanvasProps>(({
  layers,
  transform,
  viewport: viewportProp, // ✅ CENTRALIZED: Accept viewport prop
  activeTool, // 🔥 ADD: Tool context για pan/select behavior
  layersVisible = true, // ✅ LAYER PERSISTENCE: Default true - show colored layers by default
  dxfScene, // 🎯 SNAP FIX: DXF scene for snap engine initialization
  crosshairSettings,
  cursorSettings,
  snapSettings,
  gridSettings,
  rulerSettings,
  selectionSettings,
  renderOptions = {
    showCrosshair: true,
    showCursor: true,
    showSnapIndicators: true,
    showGrid: true,
    showRulers: true,
    showSelectionBox: true,
    crosshairPosition: null,
    cursorPosition: null,
    snapResults: [],
    selectionBox: null
  },
  className = '',
  style,
  onLayerClick,
  onCanvasClick,
  onMouseMove,
  onTransformChange,
  onWheelZoom,
  useUnifiedUIRendering = false, // ✅ ΦΑΣΗ 6: Default disabled για smooth transition
  enableUnifiedCanvas = false, // ✅ ΦΑΣΗ 7: Default disabled για smooth transition
  ...props // 🎯 PASS THROUGH: Περνάω όλα τα extra props (όπως data-canvas-type)
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LayerRenderer | null>(null);
  // ✅ CENTRALIZED VIEWPORT: Use prop if provided AND valid, otherwise calculate internally
  const [internalViewport, setInternalViewport] = useState<Viewport>({ width: 0, height: 0 });
  // Use prop viewport only if it has valid dimensions (not 0x0)
  const viewport = (viewportProp && viewportProp.width > 0 && viewportProp.height > 0)
    ? viewportProp
    : internalViewport;

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση του CursorSystem αντί για local state
  const cursor = useCursor();

  /**
   * 🎯 ΚΡΙΣΙΜΟ: LAYER SELECTION MECHANISM - ΠΩΣ ΤΟ ΣΤΑΥΡΟΝΗΜΑ ΕΠΙΛΕΓΕΙ ΕΓΧΡΩΜΟ LAYER
   *
   * ❌ ΣΥΧΝΟ ΛΑΘΟΣ: Μη χρησιμοποιείς HitTestingService - είναι για DXF entities!
   * ✅ ΣΩΣΤΗ ΛΥΣΗ: Χρήση LayerRenderer.hitTest() για layer polygons
   *
   * ΔΙΑΔΙΚΑΣΙΑ:
   * 1. CLICK EVENT → onPointerUp
   * 2. DOM coordinates → CanvasUtils.screenToCanvas() → Canvas coordinates
   * 3. Canvas coordinates → LayerRenderer.hitTest()
   * 4. LayerRenderer κάνει point-in-polygon test σε κάθε layer
   * 5. Επιστρέφει layerId ή null
   * 6. layerId → handleLayerSelection() → onLayerClick()
   *
   * COORDINATOR SYSTEMS που χρησιμοποιεί:
   * - DOM pixels → Canvas pixels (CanvasUtils.screenToCanvas)
   * - Canvas pixels → World coordinates (CoordinateTransforms.screenToWorld)
   * - World coordinates → Screen coordinates (CoordinateTransforms.worldToScreen)
   */
  // 🚀 Layer Hit Testing - για επιλογή layers στον καμβά - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ
  const layerHitTestCallback = useCallback((scene: DxfScene | null, screenPos: Point2D, transform: ViewTransform, viewport: Viewport): string | null => {
    // Layer hit-test callback - debug disabled for performance

    if (!layers || layers.length === 0) {
      // No layers available for hit-testing
      return null;
    }

    try {
      /**
       * 🎯 ΚΡΙΣΙΜΟ: ΣΩΣΤΗ ΧΡΗΣΗ HIT TESTING SERVICE
       *
       * ❌ ΠΑΛΙΟ ΛΑΘΟΣ: hitTestingService.hitTest() - είναι για DXF entities
       * ✅ ΝΕΟ ΣΩΣΤΟ: LayerRenderer.hitTest() - είναι για layer polygons
       *
       * Η LayerRenderer.hitTest() κάνει:
       * 1. Point-in-polygon testing για κάθε layer
       * 2. Σωστή coordinate transformation με CoordinateTransforms
       * 3. Screen space hit testing
       */
      const result = rendererRef.current?.hitTest(layers, screenPos, transform, viewport, 5);
      // Hit-test result debug disabled for performance
      // ✅ ENTERPRISE: Ensure non-undefined value for interface compliance
      return result ?? null;
    } catch (error) {
      console.error('🔥 LayerCanvas LayerRenderer hitTest failed:', error);
      return null;
    }
  }, [layers, activeTool]);

  // 🚀 Layer Selection Handler - ξεχωριστή function για αποφυγή circular reference
  const handleLayerSelection = useCallback((layerId: string | null) => {
    // Layer selection handling - debug disabled for performance
    // 🚀 PROFESSIONAL CAD: Όταν επιλέγεται layer, καλούμε το onLayerClick
    if (layerId && onLayerClick && activeTool === 'layering') {
      // Χρήση cursor system για το position
      const currentPos = cursor.position;
      // Calling onLayerClick - debug disabled for performance
      if (currentPos) {
        onLayerClick(layerId, currentPos);
      }
    } else {
      // Layer selection conditions not met - debug disabled for performance
    }
  }, [onLayerClick, activeTool, cursor.position]);

  // 🧹 CLEAN: Removed handleMultiLayerSelection - logic moved to inline handler

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Centralized mouse handlers for layers
  const mouseHandlers = useCentralizedMouseHandlers({
    scene: dxfScene || null, // 🎯 SNAP FIX: Pass DXF scene for snap engine initialization
    transform,
    viewport,
    activeTool, // 🔥 ΚΡΙΣΙΜΟ: Pass activeTool για pan behavior
    onTransformChange,
    onEntitySelect: handleLayerSelection,
    onMouseMove,
    onWheelZoom,
    onCanvasClick, // 🎯 FIX: Pass onCanvasClick για drawing tools!
    hitTestCallback: layerHitTestCallback, // 🚀 Enable layer hit testing
    // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ MARQUEE SELECTION
    colorLayers: layers,
    onLayerSelected: onLayerClick, // 🎯 USE onLayerClick για marquee selection
    canvasRef: canvasRef // 🔧 FIX: Pass canvas ref για getBoundingClientRect
  });

  // ✅ SNAP FIX STEP 5: Extract snap results from mouse handlers
  const { snapResults } = mouseHandlers;

  // ✅ ΦΑΣΗ 7: Unified canvas system state
  const [canvasManager, setCanvasManager] = useState<CanvasManager | null>(null);
  const [canvasInstance, setCanvasInstance] = useState<CanvasInstance | null>(null);
  const [eventSystem, setEventSystem] = useState<CanvasEventSystem | null>(null);
  const [canvasSettings, setCanvasSettings] = useState<CanvasSettings | null>(null);

  // Canvas config - ✅ ADR-002: Using centralized CANVAS_THEME
  const canvasConfig: CanvasConfig = {
    devicePixelRatio: window.devicePixelRatio || 1,
    enableHiDPI: true,
    backgroundColor: CANVAS_THEME.LAYER_CANVAS
  };

  // ✅ ΦΑΣΗ 7: Initialize unified canvas system and renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    try {
      if (enableUnifiedCanvas) {
        // ✅ ΦΑΣΗ 7: Initialize unified canvas system
        const unifiedSystem = createUnifiedCanvasSystem({
          enableCoordination: true,
          enableMetrics: true,
          debugMode: false
        });

        setCanvasManager(unifiedSystem.manager);
        setEventSystem(unifiedSystem.eventSystem);
        setCanvasSettings(unifiedSystem.settings);

        // Register layer canvas with unified system - ✅ ADR-002: Centralized theme
        const instance = unifiedSystem.manager.registerCanvas(
          'layer-canvas',
          'layer',
          canvas,
          {
            enableHiDPI: true,
            backgroundColor: CANVAS_THEME.LAYER_CANVAS,
            devicePixelRatio: window.devicePixelRatio || 1,
            imageSmoothingEnabled: true
          },
          10 // z-index για layer canvas
        );

        setCanvasInstance(instance);

        // Initialize renderer με unified system integration
        rendererRef.current = new LayerRenderer(canvas, instance, unifiedSystem.eventSystem, unifiedSystem.settings);
      } else {
        // Legacy initialization
        rendererRef.current = new LayerRenderer(canvas);
      }

      // Renderer initialized successfully - debug disabled for performance

      // ✅ ΕUΠΆΡΧΟΝ SYSTEM: EventSystem debug mode (disabled for production)
      if (enableUnifiedCanvas && eventSystem) {
        eventSystem.setDebugMode(false); // Set to true only for debugging
      }

    } catch (error) {
      console.error('🔍 LayerCanvas: Failed to initialize renderer:', error);
    }
  }, [enableUnifiedCanvas, activeTool]);

  // Subscribe to transform changes από DXF canvas
  useEffect(() => {
    const unsubscribe = subscribeToTransformChanges((event) => {
      // Sync transform changes από άλλους καμβάδες
      if (rendererRef.current) {
        // Trigger re-render με το νέο transform - DISABLED to prevent infinite loops
        // requestAnimationFrame(() => {
        //   renderLayers();
        // });
      }
    });

    return unsubscribe;
  }, []);

  // 🎯 Subscribe to Origin Markers toggle event
  useEffect(() => {
    const handleOriginMarkersToggle = (event: CustomEvent) => {
      // Force re-render to show/hide origin markers
      if (rendererRef.current) {
        requestAnimationFrame(() => {
          // Use the ref directly to avoid closure issues
          const renderer = rendererRef.current;
          if (!renderer || !viewport.width || !viewport.height) {
            console.warn('🎯 LayerCanvas: Cannot render - missing renderer or viewport', {
              hasRenderer: !!renderer,
              viewport: { width: viewport.width, height: viewport.height }
            });
            return;
          }

          console.log('🎯 LayerCanvas: Triggering render...');
          renderer.render(
            layersVisible ? layers : [],
            transform,
            viewport,
            crosshairSettings,
            cursorSettings,
            snapSettings,
            gridSettings,
            rulerSettings,
            selectionSettings,
            renderOptions
          );
          console.log('🎯 LayerCanvas: Render complete!');
        });
      } else {
        console.warn('🎯 LayerCanvas: No renderer ref available');
      }
    };

    window.addEventListener('origin-markers-toggle', handleOriginMarkersToggle as EventListener);

    return () => {
      window.removeEventListener('origin-markers-toggle', handleOriginMarkersToggle as EventListener);
    };
  }, [layers, transform, viewport, layersVisible, crosshairSettings, cursorSettings, snapSettings, gridSettings, rulerSettings, selectionSettings, renderOptions, useUnifiedUIRendering]);

  // 🛠️ Subscribe to Ruler Debug toggle event
  useEffect(() => {
    const handleRulerDebugToggle = (event: CustomEvent) => {
      console.log('🛠️ LayerCanvas: Ruler Debug toggled, triggering re-render', event.detail);

      // Force re-render to show/hide ruler debug overlays
      if (rendererRef.current) {
        requestAnimationFrame(() => {
          const renderer = rendererRef.current;
          if (!renderer || !viewport.width || !viewport.height) return;

          renderer.render(
            layersVisible ? layers : [],
            transform,
            viewport,
            crosshairSettings,
            cursorSettings,
            snapSettings,
            gridSettings,
            rulerSettings,
            selectionSettings,
            renderOptions
          );
        });
      }
    };

    window.addEventListener('ruler-debug-toggle', handleRulerDebugToggle as EventListener);

    return () => {
      window.removeEventListener('ruler-debug-toggle', handleRulerDebugToggle as EventListener);
    };
  }, [layers, transform, viewport, layersVisible, crosshairSettings, cursorSettings, snapSettings, gridSettings, rulerSettings, selectionSettings, renderOptions, useUnifiedUIRendering]);

  // Setup canvas size and context
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      CanvasUtils.setupCanvasContext(canvas, canvasConfig);

      // ✅ ENTERPRISE MIGRATION: Get service from registry
      const canvasBounds = serviceRegistry.get('canvas-bounds');
      const rect = canvasBounds.getBounds(canvas);
      // ✅ CENTRALIZED: Only update internal viewport if no prop provided
      if (!viewportProp) {
        setInternalViewport({ width: rect.width, height: rect.height });
      }
    } catch (error) {
      console.error('Failed to setup Layer canvas:', error);
    }
  }, []); // Removed canvasConfig dependency to prevent infinite loops

  // Setup canvas on mount and resize
  useEffect(() => {
    setupCanvas();

    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []); // Empty deps - setupCanvas is stable

  // 🔍 DEBUG: Check computed styles after mount
  useEffect(() => {
    if (canvasRef.current) {
      const cs = getComputedStyle(canvasRef.current);
      // Layer canvas computed styles - debug disabled for performance
    }
  }, [viewport.width, viewport.height]); // Check when viewport changes

  // Render layers
  const renderLayers = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer || !viewport.width || !viewport.height) {
      // console.log('🔍 LayerCanvas: Cannot render -', {
      //   hasRenderer: !!renderer,
      //   viewport: { width: viewport.width, height: viewport.height },
      //   layersCount: layers.length
      // });
      return;
    }

    // Debug disabled - was causing infinite re-render
    // console.log('🔍 LayerCanvas: Starting render -', { layersCount: layers.length });

    try {
      // Create selection box if dragging
      // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση centralized selection state
      const currentSelectionBox = (cursor.isSelecting && cursor.selectionStart && cursor.selectionCurrent) ? {
        startPoint: cursor.selectionStart,
        endPoint: cursor.selectionCurrent,
        type: (cursor.selectionCurrent.x > cursor.selectionStart.x) ? 'window' : 'crossing'
      } as const : null;

      // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση centralized cursor position
      const centralizedPosition = cursor.position;

      // 🔥 PAN TOOL: Απενεργοποίηση UI elements όταν είναι ενεργό το pan tool
      const isPanToolActive = activeTool === 'pan';

      // ✅ LAYER PERSISTENCE: Show colored layers βασει persistent state
      const filteredLayers = layersVisible ? layers : []; // Layers βασει persistent visibility

      // Layer filtering logic - debug disabled for performance

      const finalRenderOptions = {
        ...renderOptions,
        showCrosshair: renderOptions.showCrosshair && !isPanToolActive, // 🔥 Hide crosshair in pan mode
        showCursor: renderOptions.showCursor && !isPanToolActive, // 🔥 Hide cursor in pan mode
        crosshairPosition: isPanToolActive ? null : centralizedPosition,
        cursorPosition: isPanToolActive ? null : centralizedPosition,
        showSelectionBox: !isPanToolActive && cursor.isSelecting && currentSelectionBox !== null, // 🔥 Hide selection in pan mode
        selectionBox: isPanToolActive ? null : currentSelectionBox,
        // ✅ SNAP FIX STEP 5: Pass real snap results from mouse handlers
        snapResults: snapResults || []
      };

      renderer.render(
        filteredLayers, // ✅ FILTERED: Κενά layers αν δεν είναι layering active
        transform,
        viewport,
        crosshairSettings,
        cursorSettings,
        snapSettings,
        gridSettings,
        rulerSettings,
        selectionSettings,
        finalRenderOptions
      );
    } catch (error) {
      console.error('Failed to render Layer canvas:', error);
    }
  }, [
    layers,
    transform,
    viewport,
    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Use centralized cursor state
    cursor.position,
    cursor.isSelecting,
    cursor.selectionStart,
    cursor.selectionCurrent,
    useUnifiedUIRendering, // ✅ ΦΑΣΗ 6: Include feature flag in dependencies
    snapResults // ✅ SNAP FIX STEP 5: Include snap results in dependencies
  ]);

  // Render όταν αλλάζουν τα data - RE-ENABLED with stable dependencies
  useEffect(() => {
    // Only render if we have valid viewport dimensions AND renderer
    if (viewport.width > 0 && viewport.height > 0 && rendererRef.current) {
      // Small delay to ensure DOM is fully settled
      const timeoutId = setTimeout(() => {
        renderLayers();
      }, 10); // 10ms delay

      return () => clearTimeout(timeoutId);
    }
  }, [renderLayers, viewport.width, viewport.height]); // Also depend on viewport changes

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Mouse handlers πλέον στο CursorSystem

  // ✅ ΚΑΘΑΡΙΣΜΟΣ: Όλοι οι παλιοί mouse handlers αφαιρέθηκαν - χρησιμοποιούμε τους centralized

  return (
    <canvas
      ref={(el) => {
        // ✅ ENTERPRISE FIX: Proper mutable ref assignment
        if (canvasRef.current !== el) {
          (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
        }
        if (typeof ref === 'function') {
          ref(el);
        } else if (ref && 'current' in ref) {
          // ✅ ENTERPRISE FIX: Type-safe ref assignment
          (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
        }
      }}
      className={`layer-canvas ${className}`}
      {...props} // 🎯 SPREAD: Περνάω τα extra props (data-canvas-type κ.λπ.)
      style={{
        ...canvasUI.positioning.layers.layerCanvasWithTools(activeTool, crosshairSettings.enabled),
        // 🔥 FORCE EVENTS: Ensure this canvas captures all mouse events
        touchAction: 'none', // 🎯 ENTERPRISE: Prevent browser touch gestures (pinch-zoom, pan)
        userSelect: 'none',
        ...style // 🎯 MERGE: Existing style last to override if needed
      }}
      // 🔥 POINTER EVENTS - Higher priority than mouse events
      onPointerDown={(e) => {
        // Pointer down event - debug disabled for performance
        // ✅ ALLOW EVENTS: Let mouse events flow to centralized handler for selection
        // Removed preventDefault/stopPropagation to enable marquee selection
      }}
      onPointerUp={(e) => {
        // Pointer up event - debug disabled for performance

        // 🔥 LAYER SELECTION: Perform hit-test on pointer up for layering tool
        if (activeTool === 'layering') {
          e.preventDefault();
          e.stopPropagation();

          /**
           * 🎯 ΚΡΙΣΙΜΟ: COORDINATE CONVERSION ΓΙΑ LAYER SELECTION
           *
           * ❌ ΛΑΘΟΣ: const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top }
           * ✅ ΣΩΣΤΟ: CanvasUtils.screenToCanvas() - λαμβάνει υπόψη HiDPI scaling
           *
           * Αυτή η μετατροπή είναι ΚΡΙΣΙΜΗ για να δουλεύει το layer clicking!
           */
          if (canvasRef.current) {
            const canvasPos = CanvasUtils.screenToCanvas(
              { x: e.clientX, y: e.clientY },
              canvasRef.current
            );

            // Performing layer hit-test - debug disabled for performance

            // Call hit-test directly with safety checks
            if (layerHitTestCallback) {
              try {
                const hitResult = layerHitTestCallback(null, canvasPos, transform, viewport);
                // Hit-test result debug disabled for performance

                if (hitResult && handleLayerSelection) {
                  // Calling layer selection - debug disabled for performance
                  handleLayerSelection(hitResult);
                }
              } catch (error) {
                console.error('🔥 POINTER UP: Hit-test failed:', error);
              }
            } else {
              // No layerHitTestCallback available - debug disabled for performance
            }
          }
        }
      }}
      onMouseEnter={(e) => {
        // Mouse enter event handled by mouse handlers
      }}
      onMouseMove={(e) => {
        mouseHandlers.handleMouseMove(e);
      }}
      onMouseLeave={(e) => {
        mouseHandlers.handleMouseLeave(e);
      }}
      onClick={(e) => {
        // Click event - handled by mouse handlers
      }}
      onMouseDown={(e) => {
        // ✅ ALLOW EVENTS: Let events flow for marquee selection
        mouseHandlers.handleMouseDown(e);
      }}
      onMouseUp={(e) => {
        // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση ΜΟΝΟ των centralized mouse handlers
        mouseHandlers.handleMouseUp(e);
      }}
      onWheel={(e) => mouseHandlers.handleWheel(e)}
    />
  );
});