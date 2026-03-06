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
// 🏢 ADR-118: Centralized Canvas Resize Hook
import { useCanvasResize } from '../../hooks/canvas';
import { LayerRenderer } from './LayerRenderer';
// ✅ SIMPLE DEBUG: Use console.log for reliable debugging like other components
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Mouse handlers και marquee selection από το centralized system
import { useCentralizedMouseHandlers } from '../../systems/cursor/useCentralizedMouseHandlers';
import { useCursor } from '../../systems/cursor/CursorSystem';
// 🏢 ADR-119: Centralized RAF via UnifiedFrameScheduler
import { registerRenderCallback, RENDER_PRIORITIES } from '../../rendering';

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
// 🏢 ADR-094: Centralized Device Pixel Ratio
import { getDevicePixelRatio } from '../../systems/cursor/utils';

// ✅ ΦΑΣΗ 7: Event system κεντρικοποιημένο στο rendering/canvas/core/CanvasEventSystem
import { subscribeToTransformChanges } from '../../rendering/canvas/core/CanvasEventSystem';
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

interface LayerCanvasProps {
  layers: ColorLayer[];
  transform: ViewTransform;
  viewport?: Viewport; // ✅ CENTRALIZED: Optional viewport prop (if not provided, will calculate internally)
  activeTool?: string; // 🔥 ADD: Tool context για pan/select behavior
  overlayMode?: 'select' | 'draw' | 'edit'; // 🎯 OVERLAY MODE: Pass overlay mode for drawing detection
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
  // 🏢 ENTERPRISE (2026-01-25): Multi-selection callback for marquee selection
  onMultiLayerClick?: (layerIds: string[]) => void;
  onCanvasClick?: (point: Point2D, shiftKey?: boolean) => void;
  // 🏢 ENTERPRISE (2026-01-25): Flag to prevent selection start during grip drag
  isGripDragging?: boolean;
  onMouseMove?: (screenPos: Point2D, worldPos: Point2D) => void;
  onTransformChange?: (transform: ViewTransform) => void;
  onWheelZoom?: (wheelDelta: number, center: Point2D) => void; // ✅ ZOOM SYSTEM INTEGRATION

  // 🏢 ENTERPRISE (2026-01-26): Drawing preview callback for measurement/drawing tools
  onDrawingHover?: (worldPos: Point2D) => void;

  // 🏢 ENTERPRISE (2027-01-27): Overlay body drag preview - Unified Toolbar Integration
  // Pass dragging state for real-time ghost rendering during move tool drag
  draggingOverlay?: {
    overlayId: string;
    delta: Point2D; // Movement delta for ghost rendering
  } | null;

  // ✅ ΦΑΣΗ 6: Feature flag για centralized UI rendering
  useUnifiedUIRendering?: boolean;

  // ✅ ΦΑΣΗ 7: Unified canvas system integration
  enableUnifiedCanvas?: boolean;

  // 🏢 ADR-053: Right-click context menu for drawing tools
  onContextMenu?: (e: React.MouseEvent) => void;
}

// 🚀 PERFORMANCE (2026-01-27): Wrap forwardRef with memo to prevent unnecessary re-renders
// Parent state changes (mouseCss, mouseWorld) should NOT trigger canvas re-render
export const LayerCanvas = React.memo(React.forwardRef<HTMLCanvasElement, LayerCanvasProps>(({
  layers,
  transform,
  viewport: viewportProp, // ✅ CENTRALIZED: Accept viewport prop
  activeTool, // 🔥 ADD: Tool context για pan/select behavior
  overlayMode, // 🎯 OVERLAY MODE: Destructure overlay mode
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
  onMultiLayerClick, // 🏢 ENTERPRISE (2026-01-25): Multi-selection callback
  onCanvasClick,
  isGripDragging = false, // 🏢 ENTERPRISE (2026-01-25): Prevent selection during grip drag
  onMouseMove,
  onTransformChange,
  onWheelZoom,
  onDrawingHover, // 🏢 ENTERPRISE (2026-01-26): Drawing preview callback
  draggingOverlay = null, // 🏢 ENTERPRISE (2027-01-27): Ghost rendering during move tool drag
  useUnifiedUIRendering = false, // ✅ ΦΑΣΗ 6: Default disabled για smooth transition
  enableUnifiedCanvas = false, // ✅ ΦΑΣΗ 7: Default disabled για smooth transition
  onContextMenu, // 🏢 ADR-053: Right-click context menu for drawing tools
  ...props // 🎯 PASS THROUGH: Περνάω όλα τα extra props (όπως data-canvas-type)
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LayerRenderer | null>(null);

  // 🏢 ADR-118: Centralized canvas resize hook
  // Handles viewport priority resolution (viewportProp > ref > state) and ResizeObserver
  const { viewport, viewportRef, setInternalViewport } = useCanvasResize({
    canvasRef,
    viewportProp,
  });

  // 🏢 FIX (2026-02-01): Transform ref for RAF callback - prevents stale closures
  // PROBLEM: ResizeObserver → setTransform (async) → RAF fires before useEffect registers new callback
  //          The OLD callback has OLD closured transform → origin marker misaligned!
  // SOLUTION: Use ref that is ALWAYS current, updated synchronously before render
  const transformRef = useRef(transform);
  transformRef.current = transform; // Always keep in sync

  // 🏢 FIX (2026-02-01): Viewport ref for RAF callback - useCanvasResize's viewportRef doesn't update when viewportProp exists!
  // PROBLEM: viewportRef from hook stays {0,0} when viewportProp is provided (ResizeObserver skipped)
  // SOLUTION: Keep our own viewport ref that is ALWAYS synced with resolved viewport
  const resolvedViewportRef = useRef(viewport);
  resolvedViewportRef.current = viewport; // Always keep in sync

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
    // 🏢 ENTERPRISE (2026-01-25): Επιλογή layer με 'select' ή 'layering' tool
    // 🏢 ENTERPRISE (2027-01-27): Add 'move' tool support for overlay drag - Unified Toolbar Integration
    if (layerId && onLayerClick && (activeTool === 'select' || activeTool === 'layering' || activeTool === 'move')) {
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
    overlayMode, // 🎯 OVERLAY FIX: Pass overlayMode for drawing detection
    onTransformChange,
    onEntitySelect: handleLayerSelection,
    onMouseMove,
    onWheelZoom,
    onCanvasClick, // 🎯 FIX: Pass onCanvasClick για drawing tools!
    hitTestCallback: layerHitTestCallback, // 🚀 Enable layer hit testing
    // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ MARQUEE SELECTION
    colorLayers: layers,
    onLayerSelected: onLayerClick, // 🎯 USE onLayerClick για single selection
    onMultiLayerSelected: onMultiLayerClick, // 🏢 ENTERPRISE (2026-01-25): Multi-selection
    canvasRef: canvasRef, // 🔧 FIX: Pass canvas ref για getBoundingClientRect
    isGripDragging, // 🏢 ENTERPRISE (2026-01-25): Prevent selection during grip drag
    onDrawingHover // 🏢 ENTERPRISE (2026-01-26): Drawing preview callback
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
    devicePixelRatio: getDevicePixelRatio(), // 🏢 ADR-094
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
            devicePixelRatio: getDevicePixelRatio(), // 🏢 ADR-094
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

  // 🏢 ADR-119: Dirty flag ref for UnifiedFrameScheduler optimization
  const isDirtyRef = useRef(true);

  // 🎯 Subscribe to Origin Markers toggle event
  useEffect(() => {
    const handleOriginMarkersToggle = () => {
      // 🏢 ADR-119: Mark dirty for next frame instead of direct RAF
      isDirtyRef.current = true;
    };

    window.addEventListener('origin-markers-toggle', handleOriginMarkersToggle as EventListener);

    return () => {
      window.removeEventListener('origin-markers-toggle', handleOriginMarkersToggle as EventListener);
    };
  }, []);

  // 🛠️ Subscribe to Ruler Debug toggle event
  useEffect(() => {
    const handleRulerDebugToggle = () => {
      // 🏢 ADR-119: Mark dirty for next frame instead of direct RAF
      isDirtyRef.current = true;
    };

    window.addEventListener('ruler-debug-toggle', handleRulerDebugToggle as EventListener);

    return () => {
      window.removeEventListener('ruler-debug-toggle', handleRulerDebugToggle as EventListener);
    };
  }, []);

  // Setup canvas size and context
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
      console.error('Failed to setup Layer canvas:', error);
    }
  }, []); // Removed canvasConfig dependency to prevent infinite loops

  // 🏢 ADR-118: Setup canvas on mount
  // ResizeObserver logic is now handled by useCanvasResize hook
  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]); // 🏢 ADR-118: Only depend on setupCanvas (ResizeObserver handled by hook)

  // 🏢 FIX (2026-02-15): Sync backing store when viewport changes
  // PROBLEM: CSS size changes but canvas.width/height (backing store) stays the same.
  // clearRect uses fresh CSS dimensions → only clears partial backing store → ghost artifacts.
  // SOLUTION: Re-run setupCanvas when viewport dimensions change (same fix as DxfCanvas).
  const prevViewportRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    if (!viewport.width || !viewport.height) return;

    const prevViewport = prevViewportRef.current;
    if (prevViewport.width === viewport.width && prevViewport.height === viewport.height) {
      return;
    }

    prevViewportRef.current = { width: viewport.width, height: viewport.height };

    // Skip initial setup (already handled by mount effect above)
    if (prevViewport.width === 0 && prevViewport.height === 0) {
      return;
    }

    setupCanvas();
    isDirtyRef.current = true;
  }, [viewport.width, viewport.height, setupCanvas]);

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
      // 🏢 ENTERPRISE (2026-02-15): Draft layers always visible even when layersVisible=false
      // This ensures the draw preview (grips, rubber-band) is never hidden by the layers toggle
      let filteredLayers = layersVisible ? layers : layers.filter(l => l.isDraft);

      // 🏢 ENTERPRISE (2027-01-27): Apply drag delta for ghost rendering - Unified Toolbar Integration
      // When move tool is active and user is dragging, render overlay at new position
      if (draggingOverlay && draggingOverlay.delta) {
        filteredLayers = filteredLayers.map(layer => {
          if (layer.id === draggingOverlay.overlayId) {
            // Create ghost layer with shifted polygons
            return {
              ...layer,
              polygons: layer.polygons.map(poly => ({
                ...poly,
                vertices: poly.vertices.map((vertex: Point2D) => ({
                  x: vertex.x + draggingOverlay.delta.x,
                  y: vertex.y + draggingOverlay.delta.y
                }))
              }))
            };
          }
          return layer;
        });
      }

      // Layer filtering logic - debug disabled for performance

      const layerSnapResults: LayerRenderOptions['snapResults'] = snapResults.map((snap) => ({
        point: snap.point,
        type: snap.type as LayerRenderOptions['snapResults'][number]['type'],
        entityId: snap.entityId ?? undefined
      }));

      const finalRenderOptions = {
        ...renderOptions,
        showCrosshair: renderOptions.showCrosshair && !isPanToolActive, // 🔥 Hide crosshair in pan mode
        showCursor: renderOptions.showCursor && !isPanToolActive, // 🔥 Hide cursor in pan mode
        crosshairPosition: isPanToolActive ? null : centralizedPosition,
        cursorPosition: isPanToolActive ? null : centralizedPosition,
        showSelectionBox: !isPanToolActive && cursor.isSelecting && currentSelectionBox !== null, // 🔥 Hide selection in pan mode
        selectionBox: isPanToolActive ? null : currentSelectionBox,
        // ✅ SNAP FIX STEP 5: Pass real snap results from mouse handlers
        snapResults: layerSnapResults
      };

      // 🏢 FIX (2026-02-01): Use refs for transform/viewport - prevents RAF stale closure issue
      // CRITICAL: transformRef.current and resolvedViewportRef.current are ALWAYS current
      //           even when RAF callback fires before useEffect re-registers
      renderer.render(
        filteredLayers, // ✅ FILTERED: Κενά layers αν δεν είναι layering active
        transformRef.current,        // 🏢 FIX: Use ref - always current!
        resolvedViewportRef.current, // 🏢 FIX: Use ref - always current!
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
    // 🏢 FIX (2026-02-01): REMOVED transform, viewport from dependencies
    // These are now accessed via refs (transformRef.current, viewportRef.current)
    // which are ALWAYS current - no need to recreate callback on every transform change
    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Use centralized cursor state
    cursor.position,
    cursor.isSelecting,
    cursor.selectionStart,
    cursor.selectionCurrent,
    useUnifiedUIRendering, // ✅ ΦΑΣΗ 6: Include feature flag in dependencies
    snapResults // ✅ SNAP FIX STEP 5: Include snap results in dependencies
  ]);

  // 🏢 ADR-119: Register with UnifiedFrameScheduler for centralized RAF
  // This replaces scattered requestAnimationFrame calls with a single coordinated loop
  useEffect(() => {
    // Only register if we have valid viewport dimensions AND renderer
    if (viewport.width > 0 && viewport.height > 0 && rendererRef.current) {
      const unsubscribe = registerRenderCallback(
        'layer-canvas',
        'Layer Canvas Renderer',
        RENDER_PRIORITIES.NORMAL,
        () => {
          renderLayers();
          isDirtyRef.current = false; // Reset dirty flag after render
        },
        () => isDirtyRef.current // Dirty check - skip if not dirty
      );

      return unsubscribe;
    }
  }, [renderLayers, viewport.width, viewport.height]);

  // 🏢 ADR-119: Mark dirty when dependencies change (replaces direct RAF calls)
  useEffect(() => {
    isDirtyRef.current = true;
  }, [
    layers,
    transform,
    viewport,
    cursor.position,
    cursor.isSelecting,
    cursor.selectionStart,
    cursor.selectionCurrent,
    snapResults,
    layersVisible,
    activeTool,
    draggingOverlay
  ]);

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
      // 🏢 ENTERPRISE: Prevent browser auto-scroll on middle-click
      onAuxClick={(e) => e.preventDefault()}
      // 🏢 ADR-053: Right-click context menu for drawing tools
      onContextMenu={onContextMenu}
    />
  );
}));

// 🚀 PERFORMANCE (2026-01-27): Display name for React DevTools debugging
LayerCanvas.displayName = 'LayerCanvas';
