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
  isGripDragging = false // 🏢 ENTERPRISE (2026-01-25): Prevent selection during grip drag
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
    // 🔍 DEBUG: Log ALL mouse down events
    console.log('🔍 MOUSE DOWN EVENT:', {
      button: e.button,
      buttons: e.buttons,
      type: e.type,
      activeTool,
      target: (e.target as HTMLElement).tagName
    });

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
        console.log('🎯 MIDDLE BUTTON DOUBLE-CLICK DETECTED - Triggering Fit to View');

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
    const isDrawingTool = activeTool === 'line' || activeTool === 'polyline' ||
                          activeTool === 'polygon' || activeTool === 'circle' ||
                          activeTool === 'rectangle' || activeTool === 'arc' ||
                          activeTool === 'circle-diameter' || activeTool === 'circle-2p-diameter' ||
                          activeTool === 'measure-distance' || activeTool === 'measure-area' ||
                          activeTool === 'measure-angle' ||
                          overlayMode === 'draw';

    console.log('🔍 handleMouseDown:', {
      button: e.button,
      activeTool,
      overlayMode,
      isDrawingTool,
      isGripDragging // 🏢 ENTERPRISE (2026-01-25): Check if grip drag prevents selection
    });

    // 🏢 ENTERPRISE: Middle button (button === 1) ALWAYS starts pan - CAD industry standard!
    // Left button (button === 0) only pans when pan tool is active
    const shouldStartPan = (e.button === 1) || (activeTool === 'pan' && e.button === 0);

    if (shouldStartPan) {
      console.log('🖱️ PAN STARTED with button:', e.button);
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
    // 🎯 BUG #2 FIX: Skip selection when drawing tools are active (reuse isDrawingTool from above)
    // 🏢 ENTERPRISE: Middle button (button === 1) NEVER starts selection - it's for pan only!
    // 🏢 ENTERPRISE (2026-01-25): Skip selection when grip drag is in progress
    if (e.button === 0 && !e.shiftKey && activeTool !== 'pan' && !isDrawingTool && !shouldStartPan && !isGripDragging) {
      cursor.startSelection(screenPos);
    }
  }, [scene, transform, viewport, onEntitySelect, hitTestCallback, cursor, activeTool, isGripDragging]);

  // 🚀 MOUSE MOVE HANDLER - HIGH PERFORMANCE CAD-style tracking
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση κεντρικής υπηρεσίας bounds caching
    const rect = canvasBoundsService.getBounds(e.currentTarget);
    // Canvas-relative coordinates (CoordinateTransforms handles margins internally)
    const screenPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // ✅ CACHED BOUNDS: High performance automatic invalidation

    // ✅ UPDATE CENTRALIZED POSITION
    cursor.updatePosition(screenPos);

    // Selection position updates - debug disabled for performance

    // Calculate world position using proper coordinate transforms
    const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, viewport);
    cursor.updateWorldPosition(worldPos);

    // Update viewport if changed
    if (viewport.width !== cursor.viewport.width || viewport.height !== cursor.viewport.height) {
      cursor.updateViewport(viewport);
    }

    // Emit centralized mouse move event
    canvasEventBus.emit(CANVAS_EVENTS.MOUSE_MOVE, {
      screenPos,
      worldPos,
      canvas: 'dxf'
    });

    // Call parent callback
    onMouseMove?.(screenPos, worldPos);

    // ✅ SNAP DETECTION: Find snap points near cursor (Step 3)
    if (snapEnabled && findSnapPoint) {
      try {
        // ✅ FIX: Use WORLD coordinates for snap detection (not screen coordinates)
        const snap = findSnapPoint(worldPos.x, worldPos.y);

        if (snap && snap.found && snap.snappedPoint) {
          // 🏢 ENTERPRISE FIX (2026-01-06): Store WORLD coordinates in context
          // The overlay will convert to screen coords on each render (handles zoom correctly)
          setSnapResults([{
            point: snap.snappedPoint, // ✅ Store WORLD coordinates (overlay converts to screen)
            type: snap.activeMode || 'default',
            entityId: snap.snapPoint?.entityId || null,
            distance: snap.snapPoint?.distance || 0,
            priority: 0
          }]);

          // 🎯 ENTERPRISE FIX: Update SnapContext for visual feedback (SnapIndicatorOverlay)
          // Keep WORLD coordinates - overlay will convert to screen on each render
          setCurrentSnapResult(snap); // ✅ Keep original snap result with WORLD coords
        } else {
          setSnapResults([]);
          setCurrentSnapResult(null); // 🎯 Clear snap result when no snap found
        }
      } catch (err) {
        console.warn('⚠️ Snap detection error:', err);
        setSnapResults([]);
        setCurrentSnapResult(null); // 🎯 Clear snap result on error
      }
    } else {
      setSnapResults([]);
      setCurrentSnapResult(null); // 🎯 Clear snap result when snap disabled
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
  }, [transform, viewport, onMouseMove, onTransformChange, cursor, activeTool, applyPendingTransform, snapEnabled, findSnapPoint]);

  // 🚀 MOUSE UP HANDLER - CAD-style release with pan cleanup
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
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

    console.log('🔍 handleMouseUp check:', {
      hasOnCanvasClick: !!onCanvasClick,
      isSelecting: cursor.isSelecting,
      wasPanning,
      hasPosition: !!cursor.position,
      overlayMode,
      button: e.button,
      isLeftClick
    });

    if (onCanvasClick && isLeftClick && !cursor.isSelecting && !wasPanning && cursor.position) {
      let clickPoint = cursor.position; // Default: screen coordinates

      // ✅ SNAP FIX: Convert screen→world, apply snap, convert back to screen
      // NOTE: cursor.position is SCREEN coords, findSnapPoint expects WORLD coords,
      //       onCanvasClick expects SCREEN coords (it converts to world internally)
      if (snapEnabled && findSnapPoint) {
        // 1. Convert screen → world for snap detection
        const worldPos = CoordinateTransforms.screenToWorld(cursor.position, transform, viewport);

        // 2. Find snap point (in world coordinates)
        const snapResult = findSnapPoint(worldPos.x, worldPos.y);

        // 3. If snap found, convert snapped world point back to screen
        if (snapResult && snapResult.found && snapResult.snappedPoint) {
          clickPoint = CoordinateTransforms.worldToScreen(snapResult.snappedPoint, transform, viewport);
        }
      }

      onCanvasClick(clickPoint);
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

        // 🏢 ENTERPRISE (2026-01-25): Call appropriate callback based on what's available
        console.log('🔍 MARQUEE RESULT:', {
          selectedCount: selectionResult.selectedIds.length,
          selectedIds: selectionResult.selectedIds,
          hasMultiCallback,
          hasSingleCallback
        });

        if (selectionResult.selectedIds.length > 0) {
          if (hasMultiCallback) {
            // Preferred: Call multi-selection callback with all IDs at once
            console.log('✅ Calling onMultiLayerSelected with', selectionResult.selectedIds.length, 'IDs');
            onMultiLayerSelected(selectionResult.selectedIds);
          } else if (hasSingleCallback) {
            // Fallback: Call single selection callback for each ID (legacy behavior)
            // Note: This will only keep the last one selected due to store limitations
            console.log('⚠️ Using LEGACY single callback');
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
            console.log('🎯 Small selection detected - performing point hit-test for layer click');

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
              console.log('✅ Layer hit detected:', hitLayerId);
              if (hasMultiCallback) {
                onMultiLayerSelected([hitLayerId]);
              } else if (hasSingleCallback) {
                onLayerSelected(hitLayerId, cursor.position);
              }
            } else {
              console.log('⚠️ No layer hit - calling onCanvasClick for deselection');
              if (onCanvasClick && cursor.position) {
                onCanvasClick(cursor.position);
              }
            }
          } else {
            console.log('⚠️ No layers selected in marquee - calling onCanvasClick for deselection');
            // 🏢 ENTERPRISE (2026-01-25): When marquee selects nothing, trigger canvas click for deselection
            if (onCanvasClick && cursor.position) {
              onCanvasClick(cursor.position);
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