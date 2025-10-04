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
  onTransformChange?: (transform: ViewTransform) => void;
  onEntitySelect?: (entityId: string | null) => void;
  onMouseMove?: (screenPos: Point2D, worldPos: Point2D) => void;
  onWheelZoom?: (wheelDelta: number, center: Point2D, constraints?: any, modifiers?: { ctrlKey?: boolean; shiftKey?: boolean }) => void;
  hitTestCallback?: (scene: DxfScene | null, screenPos: Point2D, transform: ViewTransform, viewport: Viewport) => string | null;
  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Marquee selection support για layers
  colorLayers?: ColorLayer[];
  onLayerSelected?: (layerId: string, position: Point2D) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement>; // ✅ ADD: Canvas reference για getBoundingClientRect
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
  onTransformChange,
  onEntitySelect,
  onMouseMove,
  onWheelZoom,
  hitTestCallback,
  colorLayers,
  onLayerSelected,
  canvasRef
}: CentralizedMouseHandlersProps) {
  const cursor = useCursor();

  // ✅ SNAP DETECTION: Create safe canvas ref (fallback if not provided)
  const safeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCanvasRef = canvasRef || safeCanvasRef;

  // ✅ SNAP DETECTION: Get snap context and manager
  const { snapEnabled } = useSnapContext();
  const { findSnapPoint } = useSnapManager(activeCanvasRef, {
    scene,
    onSnapPoint: () => {
      // TODO: Use this callback in next steps if needed
    }
  });

  // ✅ SNAP RESULTS STATE: Store snap detection results
  const [snapResults, setSnapResults] = useState<any[]>([]);

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
    if ((e.button === 1) || (activeTool === 'pan' && e.button === 0)) {
      panStateRef.current.isPanning = true;
      panStateRef.current.lastMousePos = screenPos;
      panStateRef.current.pendingTransform = { ...transform };
      e.preventDefault(); // Prevent default middle-click behavior (scroll)
    }

    // Calculate world position
    const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, viewport);
    cursor.updateWorldPosition(worldPos);

    // Hit test for entity selection using provided callback
    if (hitTestCallback && onEntitySelect) {
      const hitEntityId = hitTestCallback(scene, screenPos, transform, viewport);
      onEntitySelect(hitEntityId);
    }

    // Handle selection start (left button) - disable in pan mode
    if (e.button === 0 && !e.shiftKey && activeTool !== 'pan') { // 🔥 No selection in pan mode
      cursor.startSelection(screenPos);
    }
  }, [scene, transform, viewport, onEntitySelect, hitTestCallback, cursor, activeTool]);

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
          // ✅ FIX: snappedPoint is in WORLD coordinates - convert to SCREEN for rendering
          const snappedScreenPos = CoordinateTransforms.worldToScreen(
            snap.snappedPoint,
            transform,
            viewport
          );

          setSnapResults([{
            point: snappedScreenPos, // ✅ Store SCREEN coordinates for rendering
            type: snap.activeMode || 'default',
            entityId: snap.entityId,
            distance: snap.distance || 0,
            priority: 0
          }]);
        } else {
          setSnapResults([]);
        }
      } catch (err) {
        console.warn('⚠️ Snap detection error:', err);
        setSnapResults([]);
      }
    } else {
      setSnapResults([]);
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
    } else {
      // 🔥 LEGACY PANNING for non-pan tools (φάλμπακ για backwards compatibility)
      const shouldPan = cursor.isDown && cursor.button === 0 && (
        (!cursor.isSelecting && activeTool !== 'select') // Non-selection tools
      );

      if (shouldPan) {
        const previousPos = cursor.position;
        if (previousPos) {
          const deltaX = screenPos.x - previousPos.x;
          const deltaY = screenPos.y - previousPos.y;

          const newTransform = {
            scale: transform.scale,
            offsetX: transform.offsetX + deltaX,
            offsetY: transform.offsetY - deltaY // ✅ CORRECTED: Mouse up → deltaY negative → offsetY increases → Drawing moves UP
          };

          onTransformChange?.(newTransform);

          // ✅ EMIT CENTRALIZED TRANSFORM EVENT
          canvasEventBus.emitTransformChange(
            newTransform,
            viewport,
            'dxf-canvas'
          );
        }
      }
    }
  }, [transform, viewport, onMouseMove, onTransformChange, cursor, activeTool, applyPendingTransform, snapEnabled, findSnapPoint]);

  // 🚀 MOUSE UP HANDLER - CAD-style release with pan cleanup
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // ✅ UPDATE CENTRALIZED STATE
    cursor.setMouseDown(false);

    // 🚀 CLEANUP PAN STATE for high-performance panning
    const panState = panStateRef.current;
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

    // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ MARQUEE SELECTION - Χρήση UniversalMarqueeSelector
    if (cursor.isSelecting && cursor.selectionStart && cursor.position) {
      console.log('🎯 CENTRALIZED: Performing marquee selection:', {
        selectionStart: cursor.selectionStart,
        selectionEnd: cursor.position,
        hasColorLayers: !!(colorLayers && colorLayers.length > 0),
        layersCount: colorLayers?.length || 0
      });

      // Χρήση canvas reference για getBoundingClientRect()
      const canvas = canvasRef?.current;
      if (canvas && colorLayers && colorLayers.length > 0 && onLayerSelected) {
        // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Χρήση CanvasBoundsService αντί για άμεση κλήση (performance optimization)
        const selectionResult = UniversalMarqueeSelector.performSelection(
          cursor.selectionStart,
          cursor.position,
          transform,
          canvasBoundsService.getBounds(canvas),
          {
            colorLayers: colorLayers,
            tolerance: 5,
            enableDebugLogs: true,
            onLayerSelected: onLayerSelected,
            currentPosition: cursor.position
          }
        );

        console.log('🎯 CENTRALIZED: Marquee selection completed:', {
          selectedIds: selectionResult.selectedIds,
          selectionType: selectionResult.selectionType,
          callbacksExecuted: selectionResult.callbacksExecuted
        });
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
  }, [cursor, onTransformChange, viewport, hitTestCallback, scene, transform, onEntitySelect, colorLayers, onLayerSelected, canvasRef]);

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