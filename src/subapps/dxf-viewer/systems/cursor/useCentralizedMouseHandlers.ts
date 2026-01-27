/**
 * CENTRALIZED MOUSE HANDLERS
 * Professional CAD-style mouse handling using the CursorSystem
 * Κεντρικοποιημένη διαχείριση mouse events ακολουθώντας CAD standards
 * 🚀 OPTIMIZED FOR HIGH PERFORMANCE PANNING - uses requestAnimationFrame
 */

import { useCallback, useRef, useState } from 'react';
import { useCursor } from './CursorSystem';
import { isPointInRulerArea } from './utils';
import { CoordinateTransforms, COORDINATE_LAYOUT } from '../../rendering/core/CoordinateTransforms';
import { canvasEventBus, CANVAS_EVENTS } from '../../rendering/canvas/core/CanvasEventSystem';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';
import { UniversalMarqueeSelector } from '../selection/UniversalMarqueeSelection';
// 🏢 ENTERPRISE (2026-01-26): ADR-038 - Centralized tool & mode detection (Single Source of Truth)
import { isInDrawingMode } from '../tools/ToolStateManager';

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
// ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Canvas bounds service για performance optimization
import { canvasBoundsService } from '../../services/CanvasBoundsService';
// ✅ SNAP DETECTION: Import snap context and manager
import { useSnapContext } from '../../snapping/context/SnapContext';
import { useSnapManager } from '../../snapping/hooks/useSnapManager';
// 🚀 PERFORMANCE (2026-01-27): ImmediatePositionStore for zero-latency crosshair updates
import { setImmediatePosition } from './ImmediatePositionStore';

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
  onCanvasClick?: (point: Point2D) => void; // 🎯 DRAWING TOOLS: Click handler for drawing entities
  // 🏢 ENTERPRISE (2026-01-25): Flag to prevent selection start during grip drag
  isGripDragging?: boolean;
  // 🏢 ENTERPRISE (2026-01-26): Drawing preview callback for measurement/drawing tools
  // Called on every mouse move during drawing mode to update preview line
  onDrawingHover?: (worldPos: Point2D) => void;
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
  onDrawingHover // 🏢 ENTERPRISE (2026-01-26): Drawing preview callback
}: CentralizedMouseHandlersProps) {
  const cursor = useCursor();

  // ✅ SNAP DETECTION: Create safe canvas ref (fallback if not provided)
  const safeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCanvasRef = canvasRef || safeCanvasRef;

  // ✅ SNAP DETECTION: Get snap context and manager
  const { snapEnabled, setCurrentSnapResult } = useSnapContext();
  const { findSnapPoint } = useSnapManager(activeCanvasRef, {
    // 🏢 ENTERPRISE: DxfScene extends SceneModel - safe cast
    scene: scene as import('../../types/scene').SceneModel | null,
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

  // 🚀 PERFORMANCE: Throttle snap detection to max 60fps (16ms interval)
  const snapThrottleRef = useRef<{
    lastSnapTime: number;
    pendingWorldPos: Point2D | null;
    rafId: number | null;
    lastSnapFound: boolean; // 🚀 PERFORMANCE (2026-01-27): Track last snap state to avoid unnecessary state updates
  }>({
    lastSnapTime: 0,
    pendingWorldPos: null,
    rafId: null,
    lastSnapFound: false
  });

  // 🚀 PERFORMANCE (2026-01-27): Separate throttle for cursor context updates
  // This reduces React re-renders from CursorSystem context consumers
  const cursorThrottleRef = useRef<{ lastUpdateTime: number }>({ lastUpdateTime: 0 });

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
    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση κεντρικής υπηρεσίας bounds caching
    const rect = canvasBoundsService.getBounds(e.currentTarget);
    // Canvas-relative coordinates (CoordinateTransforms handles margins internally)
    const screenPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // ✅ UPDATE CENTRALIZED STATE
    cursor.updatePosition(screenPos);
    cursor.setMouseDown(true, e.button);
    cursor.setActive(true);

    // 🎯 MIDDLE BUTTON DOUBLE-CLICK DETECTION για Fit to View
    if (e.button === 1) {
      const now = Date.now();
      const timeSinceLastClick = now - middleClickRef.current.lastClickTime;
      const DOUBLE_CLICK_THRESHOLD = 300; // ms

      if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD) {
        // 🎯 DOUBLE CLICK DETECTED! Trigger Fit to View
        // Dispatch fit-to-view event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('canvas-fit-to-view', {
            detail: { source: 'middle-double-click' }
          }));
        }

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

    // Calculate world position
    const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, viewport);
    cursor.updateWorldPosition(worldPos);

    // Hit test for entity selection using provided callback
    if (hitTestCallback && onEntitySelect) {
      const hitEntityId = hitTestCallback(scene, screenPos, transform, viewport);
      onEntitySelect(hitEntityId);
    }

    // Handle selection start (left button ONLY) - disable in pan mode AND drawing tools
    // 🎯 BUG #2 FIX: Skip selection when drawing tools are active
    // 🏢 ENTERPRISE: Middle button (button === 1) NEVER starts selection - it's for pan only!
    // 🏢 ENTERPRISE (2026-01-25): Skip selection when grip drag is in progress
    // 🏢 ENTERPRISE (2026-01-26): ADR-036 - Using centralized isToolInteractive
    if (e.button === 0 && !e.shiftKey && activeTool !== 'pan' && !isToolInteractive && !shouldStartPan && !isGripDragging) {
      cursor.startSelection(screenPos);
    }
  }, [scene, transform, viewport, onEntitySelect, hitTestCallback, cursor, activeTool, overlayMode, isGripDragging]);

  // 🚀 MOUSE MOVE HANDLER - HIGH PERFORMANCE CAD-style tracking
  // 🏢 ENTERPRISE (2026-01-27): Optimized to reduce React re-renders
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση κεντρικής υπηρεσίας bounds caching
    const rect = canvasBoundsService.getBounds(e.currentTarget);
    // Canvas-relative coordinates (CoordinateTransforms handles margins internally)
    const screenPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // 🏢 ENTERPRISE FIX (2026-01-27): ADR-045 - Use FRESH viewport from canvas rect
    // PROBLEM: The `viewport` prop may be stale on first interactions after mount.
    // SOLUTION: Derive viewport from the fresh `rect` we already fetched.
    // PATTERN: Autodesk/Bentley - Always use current canvas dimensions for transforms
    const freshViewport = { width: rect.width, height: rect.height };

    // 🚀 PERFORMANCE (2026-01-27): Update ImmediatePositionStore for zero-latency crosshair
    // This triggers direct crosshair render WITHOUT React re-render
    setImmediatePosition(screenPos);

    // 🚀 PERFORMANCE (2026-01-27): Throttle React Context updates to reduce re-renders
    // CursorSystem context updates trigger re-renders in ALL consumers
    // Throttle to 50ms (20fps) - sufficient for UI feedback, reduces re-render overhead
    const CURSOR_UPDATE_THROTTLE_MS = 50;
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

    // Call parent callback (pass through - let parent decide throttling)
    onMouseMove?.(screenPos, worldPos);

    // 🏢 ENTERPRISE (2026-01-26): ADR-038 - Call drawing hover for preview line
    // Uses centralized isInDrawingMode (Single Source of Truth)
    if (onDrawingHover && isInDrawingMode(activeTool, overlayMode)) {
      onDrawingHover(worldPos);
    }

    // 🚀 PERFORMANCE: Throttled snap detection (max 60fps)
    // Snap detection is expensive - only run every 16ms
    const SNAP_THROTTLE_MS = 16;
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
            // 🚀 PERFORMANCE (2026-01-27): Always update on snap found
            setSnapResults([{
              point: snap.snappedPoint,
              type: snap.activeMode || 'default',
              entityId: snap.snapPoint?.entityId || null,
              distance: snap.snapPoint?.distance || 0,
              priority: 0
            }]);
            setCurrentSnapResult(snap);
            snapThrottle.lastSnapFound = true;
          } else {
            // 🚀 PERFORMANCE (2026-01-27): Only clear state if we previously had a snap
            // This avoids unnecessary re-renders when continuously moving without snap
            if (snapThrottle.lastSnapFound) {
              setSnapResults([]);
              setCurrentSnapResult(null);
              snapThrottle.lastSnapFound = false;
            }
          }
        } catch {
          if (snapThrottle.lastSnapFound) {
            setSnapResults([]);
            setCurrentSnapResult(null);
            snapThrottle.lastSnapFound = false;
          }
        }
      }
    } else {
      // 🚀 PERFORMANCE (2026-01-27): Only clear state if we previously had a snap
      if (snapThrottle.lastSnapFound) {
        setSnapResults([]);
        setCurrentSnapResult(null);
        snapThrottle.lastSnapFound = false;
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
  }, [transform, viewport, onMouseMove, onTransformChange, cursor, activeTool, overlayMode, applyPendingTransform, snapEnabled, findSnapPoint, onDrawingHover]);

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

    // 🎯 DRAWING TOOLS: Call onCanvasClick if provided (for drawing tools like Line, Circle, etc.)
    // 🏢 ENTERPRISE FIX (2026-01-06): Apply snap to click position for accurate drawing
    // 🏢 ENTERPRISE FIX (2026-01-25): Only LEFT click (button === 0) triggers drawing
    // Middle button (button === 1) is for pan only, not for adding polygon points
    // Also skip if we just finished panning (wasPanning check)
    const isLeftClick = e.button === 0;

    // 🔍 DEBUG (2026-01-27): Log conditions for ADR-046 flow
    console.log(`🔍 [handleMouseUp] CONDITIONS: onCanvasClick=${!!onCanvasClick}, isLeftClick=${isLeftClick}, isSelecting=${cursor.isSelecting}, wasPanning=${wasPanning}, hasPosition=${!!cursor.position}`);

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

      // 🏢 CRITICAL FIX: Calculate FRESH screen coordinates from e.currentTarget
      // Don't use cursor.position which may have been calculated from a DIFFERENT element!
      // This fixes the ~80px offset bug where cursor.position was relative to one canvas
      // but the mouseUp event arrived on a different canvas with different dimensions.
      const eventTarget = e.currentTarget;
      const rect = canvasBoundsService.getBounds(eventTarget);
      const freshScreenPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      const freshViewport = { width: rect.width, height: rect.height };

      // Validate viewport before any coordinate conversion
      const viewportValid = freshViewport.width > 0 && freshViewport.height > 0;

      if (!viewportValid) {
        console.warn('🚫 [handleMouseUp] Click blocked: viewport not ready', freshViewport);
        return;
      }

      // Convert screen → world ONCE using FRESH coordinates from the same element
      let worldPoint = CoordinateTransforms.screenToWorld(freshScreenPos, transform, freshViewport);

      // Apply snap detection (in world coordinates)
      if (snapEnabled && findSnapPoint) {
        const snapResult = findSnapPoint(worldPoint.x, worldPoint.y);
        if (snapResult && snapResult.found && snapResult.snappedPoint) {
          worldPoint = snapResult.snappedPoint; // Use snapped WORLD coordinates
        }
      }

      // Pass WORLD coordinates directly - no more double conversion!
      // 🔍 DEBUG (2026-01-27): Diagnostic logging for coordinate offset issue
      console.log(
        `🎯 [handleMouseUp] ADR-046 WORLD coords:\n` +
        `  freshScreenPos: x=${freshScreenPos.x.toFixed(2)}, y=${freshScreenPos.y.toFixed(2)}\n` +
        `  worldPoint: x=${worldPoint.x.toFixed(2)}, y=${worldPoint.y.toFixed(2)}\n` +
        `  freshViewport: w=${freshViewport.width.toFixed(0)}, h=${freshViewport.height.toFixed(0)}\n` +
        `  transform: scale=${transform.scale.toFixed(4)}, offsetX=${transform.offsetX.toFixed(2)}, offsetY=${transform.offsetY.toFixed(2)}\n` +
        `  eventTargetSize: w=${rect.width.toFixed(0)}, h=${rect.height.toFixed(0)}\n` +
        `  cursorPosition: ${cursor.position ? `x=${cursor.position.x.toFixed(2)}, y=${cursor.position.y.toFixed(2)}` : 'null'}\n` +
        `  clientXY: clientX=${e.clientX}, clientY=${e.clientY}\n` +
        `  rectLeftTop: left=${rect.left.toFixed(2)}, top=${rect.top.toFixed(2)}`
      );
      onCanvasClick(worldPoint);
    }

    // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ MARQUEE SELECTION - Χρήση UniversalMarqueeSelector
    if (cursor.isSelecting && cursor.selectionStart && cursor.position) {
      // Χρήση canvas reference για getBoundingClientRect()
      const canvas = canvasRef?.current;

      // 🏢 ENTERPRISE (2026-01-25): Support both multi-selection and single selection callbacks
      const hasMultiCallback = !!onMultiLayerSelected;
      const hasSingleCallback = !!onLayerSelected;

      if (canvas && colorLayers && colorLayers.length > 0 && (hasMultiCallback || hasSingleCallback)) {
        // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση CanvasBoundsService αντί για άμεση κλήση (performance optimization)
        const selectionResult = UniversalMarqueeSelector.performSelection(
          cursor.selectionStart,
          cursor.position,
          transform,
          canvasBoundsService.getBounds(canvas),
          {
            colorLayers: colorLayers,
            tolerance: 5,
            enableDebugLogs: false,
            // 🏢 ENTERPRISE: Don't use individual callbacks in selector - we handle it below
            onLayerSelected: undefined,
            currentPosition: cursor.position
          }
        );

        if (selectionResult.selectedIds.length > 0) {
          if (hasMultiCallback) {
            // Preferred: Call multi-selection callback with all IDs at once
            onMultiLayerSelected(selectionResult.selectedIds);
          } else if (hasSingleCallback) {
            // Fallback: Call single selection callback for each ID (legacy behavior)
            selectionResult.selectedIds.forEach(layerId => {
              onLayerSelected(layerId, cursor.position!);
            });
          }
        } else {
          // 🏢 ENTERPRISE (2026-01-25): Check if this was a "click" (small drag) vs actual marquee
          // If the selection box is very small (< 5px), treat as single-click and do point hit-test
          const selectionWidth = Math.abs(cursor.position.x - cursor.selectionStart.x);
          const selectionHeight = Math.abs(cursor.position.y - cursor.selectionStart.y);
          const MIN_MARQUEE_SIZE = 5; // pixels

          const isSmallSelection = selectionWidth < MIN_MARQUEE_SIZE && selectionHeight < MIN_MARQUEE_SIZE;

          if (isSmallSelection && colorLayers && colorLayers.length > 0) {
            // 🎯 SINGLE CLICK: Do point-in-polygon hit-test for layer selection
            // Convert screen point to world coordinates for hit-testing
            const worldPoint = CoordinateTransforms.screenToWorld(cursor.position, transform, viewport);

            // Check each layer for point containment
            let hitLayerId: string | null = null;
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

            if (hitLayerId) {
              if (hasMultiCallback) {
                onMultiLayerSelected([hitLayerId]);
              } else if (hasSingleCallback) {
                onLayerSelected(hitLayerId, cursor.position);
              }
            } else {
              // 🏢 ADR-046: Pass WORLD coordinates to onCanvasClick
              if (onCanvasClick && cursor.position) {
                onCanvasClick(worldPoint); // worldPoint already calculated above (line 534)
              }
            }
          } else {
            // 🏢 ENTERPRISE (2026-01-25): When marquee selects nothing, trigger canvas click for deselection
            // 🏢 ADR-046: Convert to WORLD coordinates before calling onCanvasClick
            if (onCanvasClick && cursor.position) {
              const canvas = canvasRef?.current;
              const freshViewport = canvas
                ? { width: canvas.clientWidth, height: canvas.clientHeight }
                : viewport;
              const worldPt = CoordinateTransforms.screenToWorld(cursor.position, transform, freshViewport);
              onCanvasClick(worldPt);
            }
          }
        }
      }

      cursor.endSelection();
    } else if (cursor.position && hitTestCallback) {
      // Single point hit-test for entity/layer selection (only when no marquee)
      const hitResult = hitTestCallback(scene, cursor.position, transform, viewport);
      // Hit-test debug disabled for performance

      if (onEntitySelect) {
        onEntitySelect(hitResult);
      }
    } else {
      // Selection debug disabled for performance
    }
  }, [cursor, onTransformChange, viewport, hitTestCallback, scene, transform, onEntitySelect, colorLayers, onLayerSelected, onMultiLayerSelected, canvasRef, onCanvasClick, activeTool, snapEnabled, findSnapPoint]);

  // 🚀 MOUSE LEAVE HANDLER - CAD-style area detection with pan cleanup
  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const screenPoint = { x: e.clientX, y: e.clientY };

    // Only deactivate if mouse is NOT in ruler area
    if (!isPointInRulerArea(screenPoint, e.currentTarget)) {
      cursor.setActive(false);
    }

    cursor.setMouseDown(false);

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
  }, [cursor]);

  // ✅ WHEEL HANDLER - CAD-style zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση κεντρικής υπηρεσίας bounds caching
    const rect = canvasBoundsService.getBounds(e.currentTarget);
    // ✅ FIXED: Canvas-relative coordinates που θα μετατραπούν σωστά από CoordinateTransforms
    const zoomCenter = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

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
      const newScale = Math.max(0.1, Math.min(50, transform.scale * zoomFactor));

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