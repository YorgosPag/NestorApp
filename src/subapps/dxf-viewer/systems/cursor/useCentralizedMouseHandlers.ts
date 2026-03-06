/**
 * CENTRALIZED MOUSE HANDLERS
 * Professional CAD-style mouse handling using the CursorSystem
 * Κεντρικοποιημένη διαχείριση mouse events ακολουθώντας CAD standards
 * 🚀 OPTIMIZED FOR HIGH PERFORMANCE PANNING - uses requestAnimationFrame
 */

// 🔍 STOP 1 DEBUG FLAG (2026-02-01): Enable for tracing coordinate flow
const DEBUG_MOUSE_HANDLERS = false; // 🔧 DISABLED (2026-02-02) - z-index fix complete

import { useCallback, useRef, useState, useMemo } from 'react';
import { useCursor } from './CursorSystem';
import { isPointInRulerArea } from './utils';
import {
  CoordinateTransforms,
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot
} from '../../rendering/core/CoordinateTransforms';
import { canvasEventBus, CANVAS_EVENTS } from '../../rendering/canvas/core/CanvasEventSystem';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';
import type { Entity } from '../../types/entities';
import { UniversalMarqueeSelector } from '../selection/UniversalMarqueeSelection';
// 🏢 ENTERPRISE (2026-01-26): ADR-038 - Centralized tool & mode detection (Single Source of Truth)
import { isInDrawingMode } from '../tools/ToolStateManager';
// 🏢 ADR: Centralized Clamp Function
import { clamp } from '../../rendering/entities/shared/geometry-utils';
// 🏢 ADR-105: Centralized Hit Test Fallback Tolerance
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
// 🏢 ENTERPRISE (2026-02-18): Centralized scale limits for fallback zoom
import { TRANSFORM_SCALE_LIMITS } from '../../config/transform-config';
// 🏢 ENTERPRISE (2026-02-15): Point-in-polygon for overlay hover detection
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
// 🏢 ENTERPRISE: Unified EventBus for type-safe event dispatch
import { EventBus } from '../../systems/events';

// 🏢 ENTERPRISE: Type-safe snap result interface
export interface SnapResultItem {
  point: Point2D;
  type: string;
  entityId: string | null;
  distance: number;
  priority: number;
}

// 🏢 ENTERPRISE: Type-safe zoom constraints interface
export interface ZoomConstraints {
  minScale?: number;
  maxScale?: number;
  stepSize?: number;
}
// 🏢 ENTERPRISE (2026-01-30): canvasBoundsService REMOVED from transform path
// Reason: Caching caused stale bounds on DevTools toggle. Using getPointerSnapshotFromElement instead.
// ✅ SNAP DETECTION: Import snap context and manager
import { useSnapContext } from '../../snapping/context/SnapContext';
import { useSnapManager } from '../../snapping/hooks/useSnapManager';
// 🚀 PERFORMANCE (2026-01-27): ImmediatePositionStore for zero-latency crosshair updates
import { setImmediatePosition } from './ImmediatePositionStore';
// 🚀 PERF (2026-02-20): ImmediateSnapStore — bypass React re-renders for snap results
import { setImmediateSnap, clearImmediateSnap, setFullSnapResult } from './ImmediateSnapStore';
// 🏢 ADR-096: Centralized Interaction Timing Constants
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { dperf } from '../../debug';

interface CentralizedMouseHandlersProps {
  scene: DxfScene | null;
  transform: ViewTransform;
  viewport: Viewport;
  activeTool?: string; // ✅ ADD: Tool context για pan/select behavior
  overlayMode?: 'select' | 'draw' | 'edit'; // 🎯 OVERLAY MODE: Pass overlay mode for drawing detection
  onTransformChange?: (transform: ViewTransform) => void;
  onEntitySelect?: (entityId: string | null) => void;
  onMouseMove?: (screenPos: Point2D, worldPos: Point2D) => void;
  onWheelZoom?: (wheelDelta: number, center: Point2D, constraints?: ZoomConstraints, modifiers?: { ctrlKey?: boolean; shiftKey?: boolean }) => void;
  hitTestCallback?: (scene: DxfScene | null, screenPos: Point2D, transform: ViewTransform, viewport: Viewport) => string | null;
  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Marquee selection support για layers
  colorLayers?: ColorLayer[];
  onLayerSelected?: (layerId: string, position: Point2D) => void;
  // 🏢 ENTERPRISE (2026-01-25): Multi-selection callback for marquee selection
  onMultiLayerSelected?: (layerIds: string[]) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement>; // ✅ ADD: Canvas reference για getBoundingClientRect
  onCanvasClick?: (point: Point2D, shiftKey?: boolean) => void; // 🎯 DRAWING TOOLS: Click handler for drawing entities
  // 🏢 ENTERPRISE (2026-01-25): Flag to prevent selection start during grip drag
  isGripDragging?: boolean;
  // 🏢 ENTERPRISE (2026-01-26): Drawing preview callback for measurement/drawing tools
  // Called on every mouse move during drawing mode to update preview line
  onDrawingHover?: (worldPos: Point2D) => void;
  // 🏢 ENTERPRISE (2026-02-13): Callback for marquee-selected DXF entities (separate from layers)
  onEntitiesSelected?: (entityIds: string[]) => void;
  // 🏢 ENTERPRISE (2026-02-19): Unified marquee result — AutoCAD-style combined selection
  // When provided, replaces separate onMultiLayerSelected/onEntitiesSelected for marquee selection.
  // Ensures both entity types are selected in ONE atomic operation (no overwrite race).
  onUnifiedMarqueeResult?: (result: { layerIds: string[]; entityIds: string[] }) => void;
  // 🏢 ENTERPRISE (2026-02-14): AutoCAD-style hover entity highlighting
  onHoverEntity?: (entityId: string | null) => void;
  // 🏢 ENTERPRISE (2026-02-15): Overlay polygon hover highlighting (unified pipeline)
  onHoverOverlay?: (overlayId: string | null) => void;
  // 🏢 ENTERPRISE (2026-02-15): Grip drag-release callbacks
  // Return true = consumed (skip default behavior like marquee start or click processing)
  onGripMouseDown?: (worldPos: Point2D) => boolean;
  onGripMouseUp?: (worldPos: Point2D) => boolean;
  // Entity-picking hover mode: when true, hover highlighting works during entity-picking tools
  entityPickingActive?: boolean;
}

/**
 * ✅ PROFESSIONAL CAD MOUSE HANDLERS
 * Χρησιμοποιεί το κεντρικό CursorSystem για όλες τις mouse operations
 */
export function useCentralizedMouseHandlers({
  scene,
  transform,
  viewport,
  activeTool,
  overlayMode, // 🎯 OVERLAY MODE: Include in destructuring
  onTransformChange,
  onEntitySelect,
  onMouseMove,
  onWheelZoom,
  hitTestCallback,
  colorLayers,
  onLayerSelected,
  onMultiLayerSelected, // 🏢 ENTERPRISE (2026-01-25): Multi-selection callback
  canvasRef,
  onCanvasClick,
  isGripDragging = false, // 🏢 ENTERPRISE (2026-01-25): Prevent selection during grip drag
  onDrawingHover, // 🏢 ENTERPRISE (2026-01-26): Drawing preview callback
  onEntitiesSelected, // 🏢 ENTERPRISE (2026-02-13): DXF entity marquee selection callback
  onUnifiedMarqueeResult, // 🏢 ENTERPRISE (2026-02-19): Unified marquee result (AutoCAD-style)
  onHoverEntity, // 🏢 ENTERPRISE (2026-02-14): AutoCAD-style hover highlighting
  onHoverOverlay, // 🏢 ENTERPRISE (2026-02-15): Overlay hover highlighting
  onGripMouseDown, // 🏢 ENTERPRISE (2026-02-15): Grip drag-release — mouseDown
  onGripMouseUp, // 🏢 ENTERPRISE (2026-02-15): Grip drag-release — mouseUp
  entityPickingActive = false, // Entity-picking hover mode
}: CentralizedMouseHandlersProps) {
  const cursor = useCursor();

  // ✅ SNAP DETECTION: Create safe canvas ref (fallback if not provided)
  const safeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCanvasRef = canvasRef || safeCanvasRef;

  // ✅ SNAP DETECTION: Get snap context and manager
  const { snapEnabled } = useSnapContext();

  // 🏢 ENTERPRISE (2026-02-19): Convert color layer polygons to snap-compatible entities
  // so overlay vertices appear as snap targets (endpoint, midpoint, etc.)
  const overlaySnapEntities = useMemo<Entity[]>(() => {
    if (!colorLayers || colorLayers.length === 0) return [];
    const entities: Entity[] = [];
    for (const layer of colorLayers) {
      if (!layer.visible || layer.isDraft) continue;
      for (const polygon of layer.polygons) {
        if (polygon.vertices.length < 2) continue;
        entities.push({
          id: `overlay_${layer.id}_${polygon.id}`,
          type: 'lwpolyline' as const,
          vertices: polygon.vertices,
          closed: true,
          layer: layer.name,
          color: layer.color,
        } satisfies Entity);
      }
    }
    return entities;
  }, [colorLayers]);

  const { findSnapPoint } = useSnapManager(activeCanvasRef, {
    // 🏢 ENTERPRISE: DxfScene extends SceneModel - safe cast
    scene: scene as import('../../types/scene').SceneModel | null,
    overlayEntities: overlaySnapEntities,
    // 🏢 FIX (2026-02-20): Pass current zoom scale for correct pixel→world tolerance conversion
    scale: transform.scale,
    onSnapPoint: () => {
      // TODO: Use this callback in next steps if needed
    }
  });

  // ✅ SNAP RESULTS STATE: Store snap detection results
  const [snapResults, setSnapResults] = useState<SnapResultItem[]>([]);

  // 🚀 HIGH PERFORMANCE PANNING - requestAnimationFrame approach
  const panStateRef = useRef<{
    isPanning: boolean;
    lastMousePos: Point2D | null;
    pendingTransform: ViewTransform | null;
    animationId: number | null;
  }>({
    isPanning: false,
    lastMousePos: null,
    pendingTransform: null,
    animationId: null
  });

  // 🎯 MIDDLE BUTTON DOUBLE-CLICK DETECTION για Fit to View
  const middleClickRef = useRef<{
    lastClickTime: number;
    clickCount: number;
  }>({
    lastClickTime: 0,
    clickCount: 0
  });

  // 🚀 PERFORMANCE: Throttle snap detection (max 30fps for heavy scenes)
  const snapThrottleRef = useRef<{
    lastSnapTime: number;
    pendingWorldPos: Point2D | null;
    rafId: number | null;
    lastSnapFound: boolean; // 🚀 PERFORMANCE (2026-01-27): Track last snap state to avoid unnecessary state updates
    lastSnapX: number; // 🚀 PERF (2026-02-20): Cache last snap point to skip redundant setState
    lastSnapY: number;
  }>({
    lastSnapTime: 0,
    pendingWorldPos: null,
    rafId: null,
    lastSnapFound: false,
    lastSnapX: NaN,
    lastSnapY: NaN
  });

  // 🚀 PERFORMANCE (2026-01-27): Separate throttle for cursor context updates
  // This reduces React re-renders from CursorSystem context consumers
  const cursorThrottleRef = useRef<{ lastUpdateTime: number }>({ lastUpdateTime: 0 });

  // 🏢 ENTERPRISE (2026-02-14): Throttle ref for hover highlighting (~30fps)
  const hoverThrottleRef = useRef<number>(0);

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση κεντρικής υπηρεσίας αντί για local caching

  // 🚀 OPTIMIZED PAN ANIMATION FRAME
  const applyPendingTransform = useCallback(() => {
    const panState = panStateRef.current;
    if (panState.pendingTransform && onTransformChange) {
      onTransformChange(panState.pendingTransform);

      // ✅ EMIT CENTRALIZED TRANSFORM EVENT
      canvasEventBus.emitTransformChange(
        panState.pendingTransform,
        viewport,
        'dxf-canvas'
      );

      panState.pendingTransform = null;
    }
    panState.animationId = null;
  }, [onTransformChange, viewport]);

  // ✅ MOUSE DOWN HANDLER - Professional CAD style
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // 🏢 ENTERPRISE (2026-01-30): Unified Pointer Snapshot (rect + viewport from SAME element)
    // Pattern: Autodesk/Bentley - Single snapshot per event, no caching for transforms
    const snap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
    if (!snap) return; // 🏢 Fail-fast: Cannot transform without valid snapshot

    // Canvas-relative coordinates (CoordinateTransforms handles margins internally)
    const screenPos = getScreenPosFromEvent(e, snap);

    // ✅ UPDATE CENTRALIZED STATE
    cursor.updatePosition(screenPos);
    cursor.setMouseDown(true, e.button);
    cursor.setActive(true);

    // 🎯 MIDDLE BUTTON DOUBLE-CLICK DETECTION για Fit to View
    if (e.button === 1) {
      const now = Date.now();
      const timeSinceLastClick = now - middleClickRef.current.lastClickTime;
      // 🏢 ADR-096: Centralized Interaction Timing Constants
      const DOUBLE_CLICK_THRESHOLD = PANEL_LAYOUT.TIMING.DOUBLE_CLICK_MS;

      if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD) {
        // 🎯 DOUBLE CLICK DETECTED! Trigger Fit to View
        // 🏢 ENTERPRISE: Unified EventBus — reaches both EventBus.on AND window CustomEvent listeners
        EventBus.emit('canvas-fit-to-view', { source: 'middle-double-click' });

        // Reset click count
        middleClickRef.current.clickCount = 0;
        middleClickRef.current.lastClickTime = 0;
        e.preventDefault();
        return; // Don't start panning on double-click
      } else {
        // First click or too long since last click
        middleClickRef.current.clickCount = 1;
        middleClickRef.current.lastClickTime = now;
      }
    }

    // 🚀 INITIALIZE PAN STATE for high-performance panning
    // ✅ CAD STANDARD: Middle mouse button (wheel click) OR pan tool with left button
    //
    // 🏢 ENTERPRISE FIX (2026-01-25): Middle button ALWAYS pans, regardless of active tool!
    // This is the CAD industry standard (AutoCAD, Revit, MicroStation, etc.)
    // Drawing tools only affect LEFT button behavior, not middle button.
    //
    // 🏢 ENTERPRISE (2026-01-26): ADR-038 - Using centralized isInDrawingMode (Single Source of Truth)
    const isToolInteractive = isInDrawingMode(activeTool, overlayMode);

    // 🏢 ENTERPRISE: Middle button (button === 1) ALWAYS starts pan - CAD industry standard!
    // Left button (button === 0) only pans when pan tool is active
    const shouldStartPan = (e.button === 1) || (activeTool === 'pan' && e.button === 0);

    if (shouldStartPan) {
      panStateRef.current.isPanning = true;
      panStateRef.current.lastMousePos = screenPos;
      panStateRef.current.pendingTransform = { ...transform };
      e.preventDefault(); // Prevent default middle-click behavior (scroll)
      e.stopPropagation(); // 🏢 ENTERPRISE: Stop event bubbling to prevent browser auto-scroll
    }

    // Calculate world position using unified snapshot (rect + viewport from SAME element)
    const worldPos = screenToWorldWithSnapshot(screenPos, transform, snap);
    cursor.updateWorldPosition(worldPos);

    // 🏢 ENTERPRISE (2026-02-15): Grip drag-release — mouseDown on a hovering/warm grip
    // If consumed, skip entity select + marquee start (grip drag takes priority)
    // 🏢 AutoCAD standard: Skip grip drag during drawing mode — grips are for select mode only
    if (e.button === 0 && !isToolInteractive && onGripMouseDown && onGripMouseDown(worldPos)) {
      return; // Grip drag started — skip all further processing
    }

    // Hit test for entity selection using provided callback
    // 🏢 AutoCAD standard: SKIP entity selection during drawing mode — only select in 'select' tool
    if (hitTestCallback && onEntitySelect && !isToolInteractive && activeTool === 'select') {
      const hitEntityId = hitTestCallback(scene, screenPos, transform, snap.viewport);
      onEntitySelect(hitEntityId);
    }

    // Handle selection start (left button ONLY) - disable in pan mode AND drawing tools
    // 🎯 BUG #2 FIX: Skip selection when drawing tools are active
    // 🏢 ENTERPRISE: Middle button (button === 1) NEVER starts selection - it's for pan only!
    // 🏢 ENTERPRISE (2026-01-25): Skip selection when grip drag is in progress
    // 🏢 ENTERPRISE (2026-01-26): ADR-036 - Using centralized isToolInteractive
    // 🏢 FIX (2026-02-19): Skip marquee start when rotation tool is active — rotation needs
    // direct clicks (Path A) not marquee fallback (Path B), to ensure snap is applied and
    // to avoid entity re-selection interference that can cause pivot point offset
    const isRotationActive = activeTool === 'rotate';
    // ADR-189: Guide tools handle their own click logic — skip marquee for all guide-* tools
    const isGuideToolActive = activeTool?.startsWith('guide-') ?? false;
    if (e.button === 0 && !e.shiftKey && activeTool !== 'pan' && !isToolInteractive && !shouldStartPan && !isGripDragging && !isRotationActive && !isGuideToolActive) {
      cursor.startSelection(screenPos);
    }
  }, [scene, transform, viewport, onEntitySelect, hitTestCallback, cursor, activeTool, overlayMode, isGripDragging, onGripMouseDown]);

  // 🚀 MOUSE MOVE HANDLER - HIGH PERFORMANCE CAD-style tracking
  // 🏢 ENTERPRISE (2026-01-27): Optimized to reduce React re-renders
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // 🔍 PERF DEBUG (2026-02-02): Log ONLY when debug is enabled to avoid console noise
    if (DEBUG_MOUSE_HANDLERS) {
      dperf('Performance', 'NATIVE_MOUSEMOVE');
    }

    // 🏢 ENTERPRISE (2026-01-30): Unified Pointer Snapshot (rect + viewport from SAME element)
    // Pattern: Autodesk/Bentley - Single snapshot per event, no caching for transforms
    const snap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
    if (!snap) return; // 🏢 Fail-fast: Cannot transform without valid snapshot

    // Canvas-relative coordinates using unified snapshot
    const screenPos = getScreenPosFromEvent(e, snap);

    // 🏢 ENTERPRISE (2026-01-30): Use unified snapshot viewport (1:1 with rect)
    const freshViewport = snap.viewport;

    // 🚀 PERFORMANCE (2026-01-27): Update ImmediatePositionStore for zero-latency crosshair
    // This triggers direct crosshair render WITHOUT React re-render
    setImmediatePosition(screenPos);

    // 🚀 PERFORMANCE (2026-01-27): Throttle React Context updates to reduce re-renders
    // CursorSystem context updates trigger re-renders in ALL consumers
    // Throttle to 50ms (20fps) - sufficient for UI feedback, reduces re-render overhead
    // 🏢 ADR-096: Centralized Interaction Timing Constants
    const CURSOR_UPDATE_THROTTLE_MS = PANEL_LAYOUT.TIMING.CURSOR_UPDATE_THROTTLE;
    const now = performance.now();

    if (now - cursorThrottleRef.current.lastUpdateTime >= CURSOR_UPDATE_THROTTLE_MS) {
      cursorThrottleRef.current.lastUpdateTime = now;
      // ✅ UPDATE CENTRALIZED POSITION (React Context - for other consumers)
      cursor.updatePosition(screenPos);

      // Calculate world position using FRESH viewport (not stale prop!)
      const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, freshViewport);
      cursor.updateWorldPosition(worldPos);

      // Update cursor context viewport with fresh dimensions
      if (freshViewport.width !== cursor.viewport.width || freshViewport.height !== cursor.viewport.height) {
        cursor.updateViewport(freshViewport);
      }

      // Emit centralized mouse move event (throttled)
      canvasEventBus.emit(CANVAS_EVENTS.MOUSE_MOVE, {
        screenPos,
        worldPos,
        canvas: 'dxf'
      });
    }

    // Calculate world position using FRESH viewport (needed for callbacks even when throttled)
    const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, freshViewport);

    // 🔍 STOP 1 DEBUG TRACE (2026-02-01): Log coordinate transformation
    if (DEBUG_MOUSE_HANDLERS) {
      console.log('🔍 [MouseHandlers] COORDS', {
        screenPos: `(${screenPos.x.toFixed(1)}, ${screenPos.y.toFixed(1)})`,
        worldPos: `(${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)})`,
        viewport: `${freshViewport.width}x${freshViewport.height}`,
        transform: `scale=${transform.scale.toFixed(2)}, offset=(${transform.offsetX.toFixed(1)}, ${transform.offsetY.toFixed(1)})`,
        activeTool,
        isDrawingMode: isInDrawingMode(activeTool, overlayMode),
        timestamp: performance.now().toFixed(1)
      });
    }

    // 🏢 ENTERPRISE (2026-02-19): During grip drag, apply snap to preview position
    // so the drag preview aligns with the snap indicator (ADR-183 snap integration)
    let moveWorldPos = worldPos;
    if (isGripDragging && snapEnabled && findSnapPoint) {
      const gripSnapResult = findSnapPoint(worldPos.x, worldPos.y);
      if (gripSnapResult && gripSnapResult.found && gripSnapResult.snappedPoint) {
        moveWorldPos = gripSnapResult.snappedPoint;
      }
    }

    // Call parent callback (pass through - let parent decide throttling)
    onMouseMove?.(screenPos, moveWorldPos);

    // 🏢 ENTERPRISE (2026-01-26): ADR-038 - Call drawing hover for preview line
    // Uses centralized isInDrawingMode (Single Source of Truth)
    // 🔍 PERF DEBUG (2026-02-02): Log ONLY when debug is enabled to avoid console noise
    const inDrawingMode = isInDrawingMode(activeTool, overlayMode);
    if (DEBUG_MOUSE_HANDLERS) {
      dperf('Performance', `MOUSEMOVE tool=${activeTool} drawing=${inDrawingMode} cb=${!!onDrawingHover}`);
    }

    if (onDrawingHover && inDrawingMode) {
      if (DEBUG_MOUSE_HANDLERS) {
        console.log('🔍 [MouseHandlers] CALLING onDrawingHover', { worldX: worldPos.x, worldY: worldPos.y });
      }
      onDrawingHover(worldPos);
    }

    // 🚀 PERFORMANCE: Throttled snap detection (max 60fps)
    // Snap detection is expensive - only run every 16ms
    // 🏢 ADR-096: Centralized Interaction Timing Constants
    const SNAP_THROTTLE_MS = PANEL_LAYOUT.TIMING.SNAP_DETECTION_THROTTLE;
    const snapThrottle = snapThrottleRef.current;
    const snapNow = performance.now();

    if (snapEnabled && findSnapPoint) {
      // Store the latest position
      snapThrottle.pendingWorldPos = worldPos;

      // Only run snap detection if enough time has passed
      if (snapNow - snapThrottle.lastSnapTime >= SNAP_THROTTLE_MS) {
        snapThrottle.lastSnapTime = snapNow;

        try {
          const snap = findSnapPoint(worldPos.x, worldPos.y);

          if (snap && snap.found && snap.snappedPoint) {
            // 🚀 PERF (2026-02-20): Skip React setState if snap point unchanged.
            // With dense drawings (3000+ entities), snap finds a point on nearly every
            // mouse move. Without this check, 60 setState/sec → 60 re-renders/sec.
            // Compare in screen pixels (scale × world) to ignore sub-pixel noise.
            const sx = snap.snappedPoint.x;
            const sy = snap.snappedPoint.y;
            const snapMoved = Math.abs(sx - snapThrottle.lastSnapX) > 0.001
              || Math.abs(sy - snapThrottle.lastSnapY) > 0.001;

            if (snapMoved || !snapThrottle.lastSnapFound) {
              snapThrottle.lastSnapX = sx;
              snapThrottle.lastSnapY = sy;
              setSnapResults([{
                point: snap.snappedPoint,
                type: snap.activeMode || 'default',
                entityId: snap.snapPoint?.entityId || null,
                distance: snap.snapPoint?.distance || 0,
                priority: 0
              }]);
              setFullSnapResult(snap);
              // 🚀 PERF (2026-02-20): Write to imperative store — CanvasSection reads
              // from here instead of SnapContext to avoid expensive re-renders.
              setImmediateSnap({
                found: true,
                point: snap.snappedPoint,
                mode: snap.activeMode || 'endpoint',
                entityId: snap.snapPoint?.entityId,
              });
            }
            snapThrottle.lastSnapFound = true;
          } else {
            // 🚀 PERFORMANCE (2026-01-27): Only clear state if we previously had a snap
            if (snapThrottle.lastSnapFound) {
              setSnapResults([]);
              setFullSnapResult(null);
              clearImmediateSnap();
              snapThrottle.lastSnapFound = false;
              snapThrottle.lastSnapX = NaN;
              snapThrottle.lastSnapY = NaN;
            }
          }
        } catch {
          if (snapThrottle.lastSnapFound) {
            setSnapResults([]);
            setFullSnapResult(null);
            clearImmediateSnap();
            snapThrottle.lastSnapFound = false;
            snapThrottle.lastSnapX = NaN;
            snapThrottle.lastSnapY = NaN;
          }
        }
      }
    } else {
      // 🚀 PERFORMANCE (2026-01-27): Only clear state if we previously had a snap
      if (snapThrottle.lastSnapFound) {
        setSnapResults([]);
        setFullSnapResult(null);
        clearImmediateSnap();
        snapThrottle.lastSnapFound = false;
        snapThrottle.lastSnapX = NaN;
        snapThrottle.lastSnapY = NaN;
      }
    }

    // 🏢 ENTERPRISE (2026-02-14/15): Unified hover highlighting — DXF entities > overlay priority
    // Also active during entity-picking mode (angle measurement, perpendicular, etc.)
    if ((activeTool === 'select' || entityPickingActive) && !panStateRef.current.isPanning && !cursor.isSelecting) {
      const HOVER_THROTTLE_MS = 32; // ~30fps — smooth enough for visual hover feedback
      const hoverNow = performance.now();
      if (hoverNow - hoverThrottleRef.current >= HOVER_THROTTLE_MS) {
        hoverThrottleRef.current = hoverNow;

        // Step 1: Test DXF entities first (highest priority)
        let hitEntityId: string | null = null;
        if (onHoverEntity && hitTestCallback) {
          hitEntityId = hitTestCallback(scene, screenPos, transform, freshViewport);
          onHoverEntity(hitEntityId);
        }

        // Step 2: If no DXF hit, test overlay polygons (lower priority)
        if (onHoverOverlay && colorLayers && colorLayers.length > 0) {
          if (hitEntityId) {
            // DXF entity takes priority — clear overlay hover
            onHoverOverlay(null);
          } else {
            // Convert screen → world for polygon intersection test
            const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, freshViewport);
            let hitOverlayId: string | null = null;

            // Iterate in reverse zIndex order (top layer first)
            for (let i = colorLayers.length - 1; i >= 0; i--) {
              const layer = colorLayers[i];
              if (!layer.visible || layer.polygons.length === 0) continue;
              for (const polygon of layer.polygons) {
                if (polygon.vertices.length >= 3 && isPointInPolygon(worldPos, polygon.vertices)) {
                  hitOverlayId = layer.id;
                  break;
                }
              }
              if (hitOverlayId) break;
            }

            onHoverOverlay(hitOverlayId);
          }
        }
      }
    }

    // Handle selection update - disable in pan mode
    if (cursor.isSelecting && activeTool !== 'pan') { // 🔥 No selection update in pan mode
      cursor.updateSelection(screenPos);
    }

    // 🚀 HIGH PERFORMANCE PANNING - Use requestAnimationFrame approach
    // ✅ CAD STANDARD: Pan works with middle button OR pan tool
    const panState = panStateRef.current;
    if (panState.isPanning && panState.lastMousePos) {
      const deltaX = screenPos.x - panState.lastMousePos.x;
      const deltaY = screenPos.y - panState.lastMousePos.y;

      // Update pending transform (no immediate render)
      panState.pendingTransform = {
        scale: transform.scale,
        offsetX: transform.offsetX + deltaX,
        offsetY: transform.offsetY - deltaY // ✅ CORRECTED: Mouse up → deltaY negative → offsetY increases → Drawing moves UP
      };

      panState.lastMousePos = screenPos;

      // Schedule single render update per frame
      if (!panState.animationId) {
        panState.animationId = requestAnimationFrame(applyPendingTransform);
      }
    }
    // 🏢 ENTERPRISE (2026-01-26): LEGACY PANNING REMOVED - ADR-035
    // Left click should execute the active tool (measure, draw, etc.), NOT pan!
    // Pan with left click is ONLY allowed when activeTool === 'pan'
    // Pan with MIDDLE button (handled above) or WHEEL (ZoomManager) is the CAD standard
    // The old code was: shouldPan = cursor.isDown && button === 0 && activeTool !== 'select'
    // This incorrectly made ALL tools except 'select' pan instead of executing their function
  }, [transform, viewport, onMouseMove, onTransformChange, cursor, activeTool, overlayMode, applyPendingTransform, snapEnabled, findSnapPoint, onDrawingHover, onHoverEntity, onHoverOverlay, hitTestCallback, scene, colorLayers, isGripDragging, entityPickingActive]);

  // 🚀 MOUSE UP HANDLER - CAD-style release with pan cleanup
  // 🏢 ENTERPRISE FIX (2026-01-27): ADR-046 - Use e.currentTarget for consistent viewport
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // ✅ UPDATE CENTRALIZED STATE
    cursor.setMouseDown(false);

    // 🚀 CLEANUP PAN STATE for high-performance panning
    const panState = panStateRef.current;
    // 🏢 ENTERPRISE (2026-01-25): Track if we were panning BEFORE resetting the flag
    // This prevents onCanvasClick from being called after pan ends
    const wasPanning = panState.isPanning;

    if (panState.isPanning) {
      panState.isPanning = false;
      panState.lastMousePos = null;

      // Apply any pending transform immediately on mouse up
      if (panState.pendingTransform && onTransformChange) {
        onTransformChange(panState.pendingTransform);
        canvasEventBus.emitTransformChange(
          panState.pendingTransform,
          viewport,
          'dxf-canvas'
        );
        panState.pendingTransform = null;
      }

      // Cancel any pending animation frame
      if (panState.animationId) {
        cancelAnimationFrame(panState.animationId);
        panState.animationId = null;
      }
    }

    // 🏢 ENTERPRISE (2026-02-15): Grip drag-release — mouseUp commits grip drag
    // Must be checked BEFORE all click/selection logic
    // 🏢 ENTERPRISE (2026-02-19): Apply snap to grip release position (ADR-183 snap integration)
    if (e.button === 0 && onGripMouseUp) {
      const upSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (upSnap) {
        const upScreenPos = getScreenPosFromEvent(e, upSnap);
        let upWorldPos = screenToWorldWithSnapshot(upScreenPos, transform, upSnap);

        // Apply snap detection so grip endpoint aligns with target snap point
        if (snapEnabled && findSnapPoint) {
          const snapResult = findSnapPoint(upWorldPos.x, upWorldPos.y);
          if (snapResult && snapResult.found && snapResult.snappedPoint) {
            upWorldPos = snapResult.snappedPoint;
          }
        }

        if (onGripMouseUp(upWorldPos)) {
          // Grip drag committed — skip all further processing
          cursor.endSelection();
          return;
        }
      }
    }

    // 🎯 DRAWING TOOLS: Call onCanvasClick if provided (for drawing tools like Line, Circle, etc.)
    // 🏢 ENTERPRISE FIX (2026-01-06): Apply snap to click position for accurate drawing
    // 🏢 ENTERPRISE FIX (2026-01-25): Only LEFT click (button === 0) triggers drawing
    // Middle button (button === 1) is for pan only, not for adding polygon points
    // Also skip if we just finished panning (wasPanning check)
    const isLeftClick = e.button === 0;

    if (onCanvasClick && isLeftClick && !cursor.isSelecting && !wasPanning) {
      // 🏢 ENTERPRISE FIX (2026-01-27): ADR-046 - Pass WORLD coordinates directly to onCanvasClick
      // PROBLEM (ROOT CAUSE IDENTIFIED):
      //   - cursor.position is calculated in handleMouseMove using e.currentTarget's bounding rect
      //   - But handleMouseUp was using canvasRef?.current for viewport (POTENTIALLY DIFFERENT!)
      //   - If the event target canvas differs from canvasRef, coordinates become inconsistent
      //   - Opening DevTools triggers resize which syncs both canvas dimensions, "fixing" the bug
      //
      // SOLUTION (ENTERPRISE - Autodesk/Bentley pattern):
      //   - Calculate FRESH screen coordinates from e.currentTarget in handleMouseUp
      //   - Use e.currentTarget (the canvas that received the event) for CONSISTENT viewport
      //   - This ensures screen coordinates and viewport come from the SAME element
      //   - Eliminate the unnecessary double conversion (world→screen→world)
      //   - Pass WORLD coordinates directly to onCanvasClick
      //
      // PATTERN: Single coordinate transform per operation (CAD industry standard)

      // 🏢 ENTERPRISE (2026-01-30): Unified Pointer Snapshot (rect + viewport from SAME element)
      // Pattern: Autodesk/Bentley - Single snapshot per event, no caching for transforms
      const snap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (!snap) return; // 🏢 Fail-fast: Cannot transform without valid snapshot

      // Calculate screen position using unified snapshot
      const freshScreenPos = getScreenPosFromEvent(e, snap);

      // Convert screen → world using unified snapshot
      let worldPoint = screenToWorldWithSnapshot(freshScreenPos, transform, snap);

      // Apply snap detection (in world coordinates)
      if (snapEnabled && findSnapPoint) {
        const snapResult = findSnapPoint(worldPoint.x, worldPoint.y);
        if (snapResult && snapResult.found && snapResult.snappedPoint) {
          worldPoint = snapResult.snappedPoint; // Use snapped WORLD coordinates
        }
      }

      // Pass WORLD coordinates directly - no more double conversion!
      onCanvasClick(worldPoint, e.shiftKey);
    }

    // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ MARQUEE SELECTION - Χρήση UniversalMarqueeSelector
    if (cursor.isSelecting && cursor.selectionStart && cursor.position) {
      // 🏢 ENTERPRISE (2026-01-30): Use unified snapshot for marquee selection
      const canvas = canvasRef?.current ?? null;
      const marqueeSnap = getPointerSnapshotFromElement(canvas);

      // 🏢 ENTERPRISE (2026-01-25): Support both multi-selection and single selection callbacks
      const hasMultiCallback = !!onMultiLayerSelected;
      const hasSingleCallback = !!onLayerSelected;

      // 🔧 FIX (2026-02-13): Removed `colorLayers.length > 0` guard — marquee must also work
      // for DXF entities even when no overlays exist. The UniversalMarqueeSelector handles
      // both entity and color layer selection independently.
      const hasEntityCallback = !!onEntitiesSelected;
      const hasUnifiedCallback = !!onUnifiedMarqueeResult;
      if (marqueeSnap && (hasUnifiedCallback || hasMultiCallback || hasSingleCallback || hasEntityCallback)) {
        // 🏢 ENTERPRISE (2026-01-30): Use fresh rect from unified snapshot
        // 🏢 ADR-105: Use centralized fallback tolerance
        const selectionResult = UniversalMarqueeSelector.performSelection(
          cursor.selectionStart,
          cursor.position,
          transform,
          marqueeSnap.rect,
          {
            colorLayers: colorLayers ?? [],
            entities: scene?.entities ?? [],
            tolerance: TOLERANCE_CONFIG.HIT_TEST_FALLBACK,
            enableDebugLogs: false,
            // 🏢 ENTERPRISE: Don't use individual callbacks in selector - we handle it below
            onLayerSelected: undefined,
            currentPosition: cursor.position
          }
        );

        if (selectionResult.selectedIds.length > 0) {
          const breakdown = selectionResult.breakdown;
          const layerAndOverlayIds = [
            ...(breakdown?.layerIds ?? []),
            ...(breakdown?.overlayIds ?? [])
          ];
          const entityIds = breakdown?.entityIds ?? [];

          // 🏢 ENTERPRISE (2026-02-19): AutoCAD-style unified marquee result
          // One marquee → one atomic selection update for ALL types (layers + entities).
          // Eliminates race condition where separate selectMultiple() calls overwrote each other.
          if (hasUnifiedCallback) {
            onUnifiedMarqueeResult({ layerIds: layerAndOverlayIds, entityIds });
          } else {
            // Legacy: separate callbacks (kept for backward compatibility)
            if (layerAndOverlayIds.length > 0) {
              if (hasMultiCallback) {
                onMultiLayerSelected(layerAndOverlayIds);
              } else if (hasSingleCallback) {
                layerAndOverlayIds.forEach(layerId => {
                  onLayerSelected(layerId, cursor.position!);
                });
              }
            }

            if (entityIds.length > 0 && hasEntityCallback) {
              onEntitiesSelected(entityIds);
            }
          }
        } else {
          // 🏢 ENTERPRISE (2026-01-25): Check if this was a "click" (small drag) vs actual marquee
          // If the selection box is very small (< 5px), treat as single-click and do point hit-test
          const selectionWidth = Math.abs(cursor.position.x - cursor.selectionStart.x);
          const selectionHeight = Math.abs(cursor.position.y - cursor.selectionStart.y);
          const MIN_MARQUEE_SIZE = 5; // pixels

          const isSmallSelection = selectionWidth < MIN_MARQUEE_SIZE && selectionHeight < MIN_MARQUEE_SIZE;

          if (isSmallSelection) {
            // 🏢 SSoT (2026-02-15): Unified point-click pipeline
            // Priority: overlay polygon → DXF entity (via HitTester) → fallback canvasClick
            // 🏢 FIX (2026-02-15): Use fresh event coordinates — cursor.position is ~50ms stale (React throttled)
            // Same pattern as direct-click path (line 559): snapshot from the element that produced the event
            const hitTestSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
            if (!hitTestSnap) return; // 🏢 Fail-fast: Cannot transform without valid snapshot
            const freshScreenPos = getScreenPosFromEvent(e, hitTestSnap);
            const worldPoint = screenToWorldWithSnapshot(freshScreenPos, transform, hitTestSnap);

            // Step 1: Check overlay polygons (point-in-polygon)
            let hitLayerId: string | null = null;
            if (colorLayers && colorLayers.length > 0) {
              for (const layer of colorLayers) {
                if (!layer.polygons || layer.polygons.length === 0) continue;

                for (const polygon of layer.polygons) {
                  if (!polygon.vertices || polygon.vertices.length < 3) continue;

                  // Point-in-polygon test using ray casting algorithm
                  const vertices = polygon.vertices;
                  let inside = false;
                  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
                    const xi = vertices[i].x, yi = vertices[i].y;
                    const xj = vertices[j].x, yj = vertices[j].y;

                    if (((yi > worldPoint.y) !== (yj > worldPoint.y)) &&
                        (worldPoint.x < (xj - xi) * (worldPoint.y - yi) / (yj - yi) + xi)) {
                      inside = !inside;
                    }
                  }

                  if (inside) {
                    hitLayerId = layer.id;
                    break;
                  }
                }
                if (hitLayerId) break;
              }
            }

            if (hitLayerId) {
              // Overlay hit — route to overlay selection callbacks
              if (hasMultiCallback) {
                onMultiLayerSelected([hitLayerId]);
              } else if (hasSingleCallback) {
                onLayerSelected(hitLayerId, freshScreenPos);
              }
            } else if (hitTestCallback && onEntitySelect) {
              // Step 2: SSoT entity hit-test via HitTester (same pipeline as hover)
              // 🏢 AutoCAD standard: SKIP entity selection during drawing mode
              const isDrawing = isInDrawingMode(activeTool, overlayMode);
              if (!isDrawing) {
                const hitResult = hitTestCallback(scene, freshScreenPos, transform, hitTestSnap.viewport);
                if (hitResult) {
                  onEntitySelect(hitResult);
                }
              }
              // 🏢 ENTERPRISE (2026-02-15): ALWAYS route to onCanvasClick so grip handlers
              // and drawing handlers get a chance to fire.
              if (onCanvasClick) {
                onCanvasClick(worldPoint, e.shiftKey);
              }
            } else if (onCanvasClick) {
              // Fallback: No hit-test available — route to canvasClick
              onCanvasClick(worldPoint, e.shiftKey);
            }
          } else {
            // 🏢 ENTERPRISE (2026-01-25): When marquee selects nothing, trigger canvas click for deselection
            // 🏢 ADR-046: Convert to WORLD coordinates before calling onCanvasClick
            // 🏢 FIX (2026-02-15): Use fresh event coordinates — cursor.position is ~50ms stale
            if (onCanvasClick) {
              const emptySnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
              if (!emptySnap) return;
              const emptyScreenPos = getScreenPosFromEvent(e, emptySnap);
              const worldPt = screenToWorldWithSnapshot(emptyScreenPos, transform, emptySnap);
              onCanvasClick(worldPt, e.shiftKey);
            }
          }
        }
      }

      cursor.endSelection();
    } else if (cursor.position && hitTestCallback) {
      // Single point hit-test for entity/layer selection (only when no marquee)
      // 🏢 AutoCAD standard: SKIP entity selection during drawing mode
      const isDrawing = isInDrawingMode(activeTool, overlayMode);
      if (!isDrawing) {
        // 🏢 ENTERPRISE (2026-01-30): Unified Pointer Snapshot for consistent transforms
        const canvasForHit = canvasRef?.current ?? null;
        const hitSnap = getPointerSnapshotFromElement(canvasForHit);
        if (!hitSnap) return; // 🏢 Fail-fast: Cannot transform without valid snapshot
        const hitResult = hitTestCallback(scene, cursor.position, transform, hitSnap.viewport);

        if (onEntitySelect) {
          onEntitySelect(hitResult);
        }
      }
    } else {
      // Selection debug disabled for performance
    }
  }, [cursor, onTransformChange, viewport, hitTestCallback, scene, transform, onEntitySelect, colorLayers, onLayerSelected, onMultiLayerSelected, canvasRef, onCanvasClick, activeTool, overlayMode, snapEnabled, findSnapPoint, onGripMouseUp]);

  // 🚀 MOUSE LEAVE HANDLER - CAD-style area detection with pan cleanup
  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const screenPoint = { x: e.clientX, y: e.clientY };

    // Only deactivate if mouse is NOT in ruler area
    if (!isPointInRulerArea(screenPoint, e.currentTarget)) {
      cursor.setActive(false);
    }

    cursor.setMouseDown(false);

    // 🏢 ENTERPRISE (2026-02-14): Clear hover on mouse leave
    onHoverEntity?.(null);

    // 🚀 CLEANUP PAN STATE on mouse leave
    const panState = panStateRef.current;
    if (panState.isPanning) {
      panState.isPanning = false;
      panState.lastMousePos = null;
      if (panState.animationId) {
        cancelAnimationFrame(panState.animationId);
        panState.animationId = null;
      }
    }
  }, [cursor, onHoverEntity]);

  // ✅ WHEEL HANDLER - CAD-style zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    // 🏢 ENTERPRISE (2026-01-30): Unified Pointer Snapshot (rect + viewport from SAME element)
    const snap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
    if (!snap) return; // 🏢 Fail-fast: Cannot zoom without valid snapshot

    // ✅ FIXED: Canvas-relative coordinates using unified snapshot
    const zoomCenter = getScreenPosFromEvent(e, snap);

    // 🏢 ENTERPRISE: Capture modifier keys (Ctrl = faster zoom, Shift = pan)
    const modifiers = {
      ctrlKey: e.ctrlKey || e.metaKey, // Support both Ctrl (Win/Linux) and Cmd (Mac)
      shiftKey: e.shiftKey
    };

    // 🏢 ENTERPRISE: Shift+Wheel = Horizontal Pan (AutoCAD standard)
    if (modifiers.shiftKey) {
      e.preventDefault();
      // Convert wheel delta to horizontal pan
      // Positive deltaY = scroll down = pan right
      // Negative deltaY = scroll up = pan left
      const panSpeed = 2; // Pixels per wheel unit
      const panDeltaX = e.deltaY * panSpeed;

      const newTransform = {
        ...transform,
        offsetX: transform.offsetX - panDeltaX
      };

      onTransformChange?.(newTransform);

      // ✅ EMIT CENTRALIZED TRANSFORM EVENT
      canvasEventBus.emitTransformChange(
        { scale: newTransform.scale, offsetX: newTransform.offsetX, offsetY: newTransform.offsetY },
        { width: viewport.width, height: viewport.height },
        'dxf-canvas'
      );
      return; // Skip zoom logic
    }

    // ✅ USE ZOOM SYSTEM if available, fallback to primitive zoom
    if (onWheelZoom) {
      onWheelZoom(e.deltaY, zoomCenter, undefined, modifiers);
    } else {
      // ⚠️ FALLBACK: Basic wheel zoom for backwards compatibility
      // 🏢 ENTERPRISE (2025-10-04): Use centralized CoordinateTransforms instead of duplicate formula
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = clamp(transform.scale * zoomFactor, TRANSFORM_SCALE_LIMITS.MIN_SCALE, TRANSFORM_SCALE_LIMITS.MAX_SCALE);

      // ✅ CENTRALIZED: CoordinateTransforms handles margins adjustment automatically
      const canvas = e.currentTarget;
      const newTransform = CoordinateTransforms.calculateZoomTransform(
        transform,
        zoomFactor,
        zoomCenter,
        { width: canvas?.width || 0, height: canvas?.height || 0 }
      );

      onTransformChange?.(newTransform);

      // ✅ EMIT CENTRALIZED TRANSFORM EVENT
      canvasEventBus.emitTransformChange(
        { scale: newTransform.scale, offsetX: newTransform.offsetX, offsetY: newTransform.offsetY },
        { width: canvas?.width || 0, height: canvas?.height || 0 },
        'dxf-canvas'
      );
    }
  }, [transform, onTransformChange, onWheelZoom]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleWheel,
    // ✅ EXPOSE CENTRALIZED STATE για components που το χρειάζονται
    cursorState: cursor,
    // ✅ SNAP RESULTS: Expose snap detection results (empty for now, populated in Step 3)
    snapResults
  };
}
