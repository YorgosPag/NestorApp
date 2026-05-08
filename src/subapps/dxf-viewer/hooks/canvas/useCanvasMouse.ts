'use client';

/**
 * 🏢 ENTERPRISE: useCanvasMouse Hook
 *
 * @description Centralized mouse event handling for canvas interactions
 * @see ADR-XXX: CanvasSection Decomposition
 *
 * Responsibilities:
 * - Mouse position tracking (CSS and World coordinates)
 * - Container mouse event handlers (move, down, up, enter, leave)
 * - Coordinate transforms (screen ↔ world)
 * - Performance optimization with throttling
 *
 * Pattern: Single Responsibility Principle
 * Extracted from: CanvasSection.tsx (2,463 lines → ~800 lines target)
 */

import { useRef, useState, useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { setImmediatePosition } from '../../systems/cursor/ImmediatePositionStore';
import {
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot
} from '../../rendering/core/CoordinateTransforms';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
// 🏢 ADR-065: Extracted types and drag handlers
import type { UseCanvasMouseProps, UseCanvasMouseReturn, SelectedGrip, DraggingVertexState } from './canvas-mouse-types';
import { handleVertexDragEnd, handleEdgeMidpointDragEnd, handleOverlayBodyDragEnd } from './canvas-mouse-drag-handlers';
// Re-export all types for backward compatibility (86+ importers)
export type {
  VertexHoverInfo, EdgeHoverInfo, SelectedGrip,
  DraggingVertexState, DraggingEdgeMidpointState, DraggingOverlayBodyState,
  DraggingGuideState, GripHoverThrottle,
  UseCanvasMouseProps, UseCanvasMouseReturn,
} from './canvas-mouse-types';

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Centralized mouse event handling hook
 *
 * @example
 * ```tsx
 * const {
 *   mouseCss,
 *   mouseWorld,
 *   handleContainerMouseMove,
 *   handleContainerMouseDown,
 *   handleContainerMouseUp,
 *   handleContainerMouseEnter,
 *   handleContainerMouseLeave,
 * } = useCanvasMouse({
 *   transform,
 *   viewport,
 *   activeTool,
 *   updatePosition,
 *   setActive,
 *   containerRef,
 *   // ... other props
 * });
 * ```
 */
export function useCanvasMouse(props: UseCanvasMouseProps): UseCanvasMouseReturn {
  const {
    transform,
    activeTool,
    updatePosition,
    setActive,
    containerRef,
    // 🏢 ENTERPRISE (2026-02-02): onMouseCoordinatesChange REMOVED - using CursorContext (SSoT)
    hoveredVertexInfo,
    hoveredEdgeInfo,
    selectedGrips,
    setSelectedGrips,
    draggingVertices,
    setDraggingVertices,
    draggingEdgeMidpoint,
    setDraggingEdgeMidpoint,
    draggingOverlayBody,
    setDraggingOverlayBody,
    setDragPreviewPosition,
    universalSelectionRef,
    overlayStoreRef,
    executeCommand,
    movementDetectionThreshold,
    // ADR-189 B5: Guide drag & drop
    draggingGuide,
    setDraggingGuide,
    onGuideDragComplete,
    // 🏢 ENTERPRISE: Refs INJECTED from useGripSystem (Single Source of Truth)
    gripHoverThrottleRef,
    justFinishedDragRef,
    markDragFinished,
  } = props;

  // ============================================================================
  // STATE
  // ============================================================================

  const [mouseCss, setMouseCss] = useState<Point2D | null>(null);
  const [mouseWorld, setMouseWorld] = useState<Point2D | null>(null);

  // ============================================================================
  // REFS (mouse-specific only - grip refs come from useGripSystem)
  // ============================================================================

  // 🚀 PERFORMANCE: Refs to skip unnecessary state updates
  const lastMouseCssRef = useRef<Point2D | null>(null);
  const lastMouseWorldRef = useRef<Point2D | null>(null);

  // 🏢 ENTERPRISE: gripHoverThrottleRef and justFinishedDragRef are now INJECTED
  // from useGripSystem via props - NO duplicates here!

  // ============================================================================
  // MEMOIZED UPDATE FUNCTIONS
  // ============================================================================

  /**
   * 🚀 PERFORMANCE: Update CSS mouse position only when changed significantly
   * Mouse position updates only when changed by more than 0.5 pixels
   */
  const updateMouseCss = useCallback((point: Point2D) => {
    const last = lastMouseCssRef.current;
    if (!last || Math.abs(point.x - last.x) > 0.5 || Math.abs(point.y - last.y) > 0.5) {
      lastMouseCssRef.current = point;
      setMouseCss(point);
    }
  }, []);

  /**
   * 🚀 PERFORMANCE: Update World mouse position only when changed significantly
   * World position updates only when changed by more than 0.1 world units
   *
   * 🏢 ENTERPRISE (2026-02-02): onMouseCoordinatesChange REMOVED
   * ToolbarStatusBar now uses CursorContext.worldPosition directly (SSoT)
   * The worldPosition is updated by useCentralizedMouseHandlers → cursor.updateWorldPosition()
   */
  const updateMouseWorld = useCallback((point: Point2D) => {
    const last = lastMouseWorldRef.current;
    if (!last || Math.abs(point.x - last.x) > 0.1 || Math.abs(point.y - last.y) > 0.1) {
      lastMouseWorldRef.current = point;
      setMouseWorld(point);
      // 🏢 ENTERPRISE (2026-02-02): onMouseCoordinatesChange REMOVED - using CursorContext (SSoT)
    }
  }, []);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * 🏢 ENTERPRISE: Container mouse move handler
   * Updates CursorSystem position for all overlays (CrosshairOverlay, etc.)
   * 🏢 FIX (2026-02-01): Also calculates world coordinates for status bar display
   */
  const handleContainerMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const screenPos: Point2D = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // 🏢 SSoT FIX (2026-02-15): setImmediatePosition REMOVED from container handler.
    // The DxfCanvas handler (useCentralizedMouseHandlers:304) already calls setImmediatePosition.
    // Due to event bubbling, container's handler fires AFTER DxfCanvas's handler, overwriting
    // the position with container-relative coords.
    //
    // 🚀 PERF FIX (2026-05-08): updatePosition(screenPos) REMOVED here too. The DxfCanvas
    // handler in `mouse-handler-move.ts:60` already dispatches UPDATE_POSITION through
    // `useCentralizedMouseHandlers`, throttled to 50ms (CURSOR_UPDATE_THROTTLE). Calling
    // it again unthrottled from this container-level handler doubled the dispatch
    // frequency and caused a render cascade through the entire CursorSystem subtree on
    // every mousemove → visible crosshair lag. Container handler now only updates DOM
    // CSS vars (cheap) and handles drag-preview / guide-drag world-coord work.
    // Update CSS coordinates
    updateMouseCss(screenPos);

    // 🏢 ENTERPRISE (2026-02-02): World coordinates calculation REMOVED for status bar (SSoT in CursorContext)
    // 🔧 FIX (2026-02-13): BUT we still need world coords for drag preview updates.
    // LayerCanvas.onMouseMove (which had the drag preview logic) never fires because
    // DxfCanvas (z-10) intercepts all pointer events. Container's mousemove is the only
    // reliable handler that fires during mouse movement, so drag preview updates go here.
    if (draggingOverlayBody || draggingVertices || draggingEdgeMidpoint) {
      const snap = getPointerSnapshotFromElement(container);
      if (snap) {
        const worldPoint = screenToWorldWithSnapshot(screenPos, transform, snap);
        setDragPreviewPosition(worldPoint);
      }
    }

    // ADR-189 B5: Live guide drag — move guide directly (no ghost, real-time feedback)
    if (draggingGuide) {
      const snap = getPointerSnapshotFromElement(container);
      if (snap) {
        const worldPoint = screenToWorldWithSnapshot(screenPos, transform, snap);
        const store = getGlobalGuideStore();
        const deltaX = worldPoint.x - draggingGuide.startMouseWorld.x;
        const deltaY = worldPoint.y - draggingGuide.startMouseWorld.y;

        if (draggingGuide.axis === 'XZ' && draggingGuide.originalStartPoint && draggingGuide.originalEndPoint) {
          // Translate entire diagonal segment
          const newStart = { x: draggingGuide.originalStartPoint.x + deltaX, y: draggingGuide.originalStartPoint.y + deltaY };
          const newEnd = { x: draggingGuide.originalEndPoint.x + deltaX, y: draggingGuide.originalEndPoint.y + deltaY };
          store.moveDiagonalGuideById(draggingGuide.guideId, newStart, newEnd);
        } else if (draggingGuide.axis === 'X') {
          store.moveGuideById(draggingGuide.guideId, draggingGuide.originalOffset + deltaX);
        } else {
          // Y axis
          store.moveGuideById(draggingGuide.guideId, draggingGuide.originalOffset + deltaY);
        }
      }
    }
  }, [containerRef, updateMouseCss, draggingOverlayBody, draggingVertices, draggingEdgeMidpoint, draggingGuide, transform, setDragPreviewPosition]);

  /**
   * 🏢 ENTERPRISE: Container mouse enter handler
   */
  const handleContainerMouseEnter = useCallback(() => {
    setActive(true);
  }, [setActive]);

  /**
   * 🏢 ENTERPRISE: Container mouse leave handler
   */
  const handleContainerMouseLeave = useCallback(() => {
    setActive(false);
    // 🚀 IMMEDIATE: Clear immediate position for zero-latency crosshair
    setImmediatePosition(null);
    updatePosition(null);
  }, [setActive, updatePosition]);

  /**
   * 🏢 ENTERPRISE: Mouse down handler for MULTI-GRIP selection and drag
   * ADR-031: Multi-Grip Selection System
   *
   * Patterns:
   * - Single click: Select single grip (replaces selection)
   * - Shift+Click: Add/remove grip to/from selection (toggle)
   * - Click+Drag: Start dragging ALL selected grips together
   */
  const handleContainerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle left click
    if (e.button !== 0) return;

    // ADR-189 B5: Guide drag is initiated in CanvasSection.handleContainerMouseDown
    // (useCanvasMouse.handleContainerMouseDown is NOT used for guide-move)

    // Only in select/layering/move mode
    if (activeTool !== 'select' && activeTool !== 'layering' && activeTool !== 'move') return;

    const isShiftPressed = e.shiftKey;

    // Check if hovered overlay is in multi-selection
    const hoveredOverlayId = hoveredVertexInfo?.overlayId || hoveredEdgeInfo?.overlayId;
    if (!hoveredOverlayId) {
      // Clicked elsewhere → Deselect ALL grips (unless Shift is pressed)
      if (!isShiftPressed && selectedGrips.length > 0) {
        setSelectedGrips([]);
      }
      return;
    }

    // Check if the hovered overlay is selected (part of multi-selection)
    if (!universalSelectionRef.current?.isSelected(hoveredOverlayId)) {
      // Clicked on grip of non-selected overlay → Deselect grips
      if (!isShiftPressed && selectedGrips.length > 0) {
        setSelectedGrips([]);
      }
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Unified Pointer Snapshot
    const snap = getPointerSnapshotFromElement(container);
    if (!snap) return; // Fail-fast: Cannot transform without valid snapshot
    const screenPos = getScreenPosFromEvent(e, snap);
    const worldPos = screenToWorldWithSnapshot(screenPos, transform, snap);

    // === VERTEX GRIP CLICK ===
    if (hoveredVertexInfo) {
      e.preventDefault();
      e.stopPropagation();

      const clickedGrip: SelectedGrip = {
        type: 'vertex',
        overlayId: hoveredVertexInfo.overlayId,
        index: hoveredVertexInfo.vertexIndex
      };

      // Check if this grip is already selected
      const isGripAlreadySelected = selectedGrips.some(
        g => g.type === 'vertex' && g.overlayId === clickedGrip.overlayId && g.index === clickedGrip.index
      );

      if (isShiftPressed) {
        // Shift+Click = ONLY toggle selection, NO drag
        if (isGripAlreadySelected) {
          // Remove from selection
          setSelectedGrips(selectedGrips.filter(
            g => !(g.type === 'vertex' && g.overlayId === clickedGrip.overlayId && g.index === clickedGrip.index)
          ));
        } else {
          // Add to selection
          setSelectedGrips([...selectedGrips, clickedGrip]);
        }
        // CRITICAL: Do NOT start dragging on Shift+Click
        return;
      }

      // Regular click (no Shift)
      // If clicking on already-selected grip: drag ALL selected grips
      // If clicking on non-selected grip: replace selection and drag single grip
      const gripsToMove = isGripAlreadySelected
        ? selectedGrips.filter(g => g.type === 'vertex')
        : [clickedGrip];

      // Update selection if clicking on non-selected grip
      if (!isGripAlreadySelected) {
        setSelectedGrips([clickedGrip]);
      }

      // Start dragging selected vertex grips
      if (gripsToMove.length > 0) {
        const overlayStore = overlayStoreRef.current;
        if (!overlayStore) return;

        const draggingData: DraggingVertexState[] = gripsToMove.map(grip => {
          // Get original vertex position from overlay
          const overlay = overlayStore.overlays[grip.overlayId];
          const originalPosition = overlay?.polygon?.[grip.index]
            ? { x: overlay.polygon[grip.index][0], y: overlay.polygon[grip.index][1] }
            : worldPos;

          return {
            overlayId: grip.overlayId,
            vertexIndex: grip.index,
            startPoint: worldPos,
            originalPosition
          };
        });

        setDraggingVertices(draggingData);
        setDragPreviewPosition(worldPos);
      }
      return;
    }

    // === EDGE MIDPOINT GRIP CLICK → IMMEDIATE DRAG (single grip only) ===
    if (hoveredEdgeInfo) {
      e.preventDefault();
      e.stopPropagation();

      const clickedGrip: SelectedGrip = {
        type: 'edge-midpoint',
        overlayId: hoveredEdgeInfo.overlayId,
        index: hoveredEdgeInfo.edgeIndex
      };

      // Edge midpoints always replace selection
      setSelectedGrips([clickedGrip]);
      setDraggingEdgeMidpoint({
        overlayId: hoveredEdgeInfo.overlayId,
        edgeIndex: hoveredEdgeInfo.edgeIndex,
        insertIndex: hoveredEdgeInfo.edgeIndex + 1,
        startPoint: worldPos,
        newVertexCreated: false
      });
      setDragPreviewPosition(worldPos);
      return;
    }
  }, [
    activeTool,
    hoveredVertexInfo,
    hoveredEdgeInfo,
    selectedGrips,
    transform,
    containerRef,
    setSelectedGrips,
    setDraggingVertices,
    setDraggingEdgeMidpoint,
    setDragPreviewPosition,
    universalSelectionRef,
    overlayStoreRef,
  ]);

  /**
   * 🏢 ENTERPRISE: Mouse up handler for MULTI-grip drag end
   * ADR-031: Multi-Grip Selection System - updates all dragged vertices
   * 🏢 ADR-065: Handler bodies delegated to canvas-mouse-drag-handlers.ts
   */
  const handleContainerMouseUp = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const dragCtx = {
      e, transform, containerRef, overlayStoreRef, executeCommand,
      setDragPreviewPosition, markDragFinished, movementDetectionThreshold,
    };

    // Handle MULTI-vertex drag end
    if (draggingVertices && draggingVertices.length > 0 && overlayStoreRef.current) {
      await handleVertexDragEnd(dragCtx, draggingVertices, setDraggingVertices);
    }

    // Handle edge midpoint drag end
    if (draggingEdgeMidpoint && overlayStoreRef.current) {
      await handleEdgeMidpointDragEnd(dragCtx, draggingEdgeMidpoint, setDraggingEdgeMidpoint);
    }

    // Handle overlay body drag end (move tool)
    if (draggingOverlayBody && overlayStoreRef.current) {
      await handleOverlayBodyDragEnd(dragCtx, draggingOverlayBody, setDraggingOverlayBody);
    }

    // ADR-189 B5: Guide drag end is handled in CanvasSection.handleContainerMouseUp
  }, [
    draggingVertices,
    draggingEdgeMidpoint,
    draggingOverlayBody,
    transform,
    containerRef,
    executeCommand,
    setDraggingVertices,
    setDraggingEdgeMidpoint,
    setDraggingOverlayBody,
    setDragPreviewPosition,
    overlayStoreRef,
    movementDetectionThreshold,
    markDragFinished,
  ]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Mouse position states
    mouseCss,
    mouseWorld,

    // Update functions
    updateMouseCss,
    updateMouseWorld,

    // Refs (mouse-specific only - grip refs come from useGripSystem)
    lastMouseCssRef,
    lastMouseWorldRef,

    // Event handlers
    handleContainerMouseMove,
    handleContainerMouseDown,
    handleContainerMouseUp,
    handleContainerMouseEnter,
    handleContainerMouseLeave,
  };
}

export default useCanvasMouse;
