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
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { setImmediatePosition } from '../../systems/cursor/ImmediatePositionStore';
import {
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot
} from '../../rendering/core/CoordinateTransforms';
import type { ICommand } from '../../core/commands/interfaces';
import type { VertexMovement } from '../../core/commands';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { UniversalSelectionHook } from '../../systems/selection';
import type { GridAxis } from '../../ai-assistant/grid-types';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Hover information for vertex grips
 */
export interface VertexHoverInfo {
  overlayId: string;
  vertexIndex: number;
}

/**
 * Hover information for edge midpoint grips
 */
export interface EdgeHoverInfo {
  overlayId: string;
  edgeIndex: number;
}

/**
 * Selected grip state
 */
export interface SelectedGrip {
  type: 'vertex' | 'edge-midpoint';
  overlayId: string;
  index: number; // vertexIndex for vertex, edgeIndex for edge-midpoint
}

/**
 * Dragging vertex state
 */
export interface DraggingVertexState {
  overlayId: string;
  vertexIndex: number;
  startPoint: Point2D;
  originalPosition: Point2D; // Original vertex position for delta calculation
}

/**
 * Dragging edge midpoint state
 */
export interface DraggingEdgeMidpointState {
  overlayId: string;
  edgeIndex: number;
  insertIndex: number;
  startPoint: Point2D;
  newVertexCreated: boolean; // True after vertex has been inserted
}

/**
 * Dragging overlay body state (for move tool)
 */
export interface DraggingOverlayBodyState {
  overlayId: string;
  startPoint: Point2D;    // Mouse start position in world coordinates
  startPolygon: Array<[number, number]>; // Original polygon for delta calculation
}

/**
 * Dragging guide state (for guide-move tool) — ADR-189 B5
 */
export interface DraggingGuideState {
  guideId: string;
  axis: GridAxis;
  startMouseWorld: Point2D;    // Mouse world pos at drag start
  // X/Y: original offset
  originalOffset: number;
  // XZ: original endpoints
  originalStartPoint?: Point2D;
  originalEndPoint?: Point2D;
}

/**
 * Props για useCanvasMouse hook
 */
/**
 * Grip hover throttle ref type for performance optimization
 * SHARED TYPE: Same as in useGripSystem - refs are injected, NOT created here
 */
export interface GripHoverThrottle {
  lastCheckTime: number;
  lastWorldPoint: Point2D | null;
}

export interface UseCanvasMouseProps {
  /** Current view transform (scale, offset) */
  transform: ViewTransform;
  /** Current viewport dimensions */
  viewport: { width: number; height: number };
  /** Current active tool */
  activeTool: string;
  /** Callback when cursor position should update */
  updatePosition: (pos: Point2D | null) => void;
  /** Callback when cursor active state should update */
  setActive: (active: boolean) => void;
  /** Container element ref */
  containerRef: React.RefObject<HTMLDivElement>;
  // 🏢 ENTERPRISE (2026-02-02): onMouseCoordinatesChange REMOVED - ToolbarStatusBar uses CursorContext (SSoT)
  /** Hovered vertex info (for grip system) */
  hoveredVertexInfo: VertexHoverInfo | null;
  /** Hovered edge info (for grip system) */
  hoveredEdgeInfo: EdgeHoverInfo | null;
  /** Selected grips array */
  selectedGrips: SelectedGrip[];
  /** Callback to set selected grips */
  setSelectedGrips: (grips: SelectedGrip[]) => void;
  /** Dragging vertices state */
  draggingVertices: DraggingVertexState[] | null;
  /** Callback to set dragging vertices */
  setDraggingVertices: (state: DraggingVertexState[] | null) => void;
  /** Dragging edge midpoint state */
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
  /** Callback to set dragging edge midpoint */
  setDraggingEdgeMidpoint: (state: DraggingEdgeMidpointState | null) => void;
  /** Dragging overlay body state */
  draggingOverlayBody: DraggingOverlayBodyState | null;
  /** Callback to set dragging overlay body */
  setDraggingOverlayBody: (state: DraggingOverlayBodyState | null) => void;
  /** Drag preview position */
  dragPreviewPosition: Point2D | null;
  /** Callback to set drag preview position */
  setDragPreviewPosition: (pos: Point2D | null) => void;
  /** Universal selection ref for checking selection
   * Note: Uses MutableRefObject to be compatible with useRef pattern in CanvasSection
   */
  universalSelectionRef: React.MutableRefObject<UniversalSelectionHook>;
  /** Overlay store ref for getting overlay data
   * Note: Uses generic Record type to be compatible with command interfaces
   */
  overlayStoreRef: React.MutableRefObject<ReturnType<typeof useOverlayStore>>;
  /** Command execution function
   * Note: Uses broader type to be compatible with ICommand pattern
   */
  executeCommand: (command: ICommand) => void;
  /** Movement detection threshold */
  movementDetectionThreshold: number;

  // ============================================================================
  // ADR-189 B5: Guide drag & drop
  // ============================================================================
  /** Dragging guide state (for guide-move tool) */
  draggingGuide: DraggingGuideState | null;
  /** Callback to set dragging guide state */
  setDraggingGuide: (state: DraggingGuideState | null) => void;
  /** Callback when guide drag completes (CanvasSection creates MoveGuideCommand) */
  onGuideDragComplete: (guideId: string, axis: GridAxis, oldOffset: number, newOffset: number, oldStart?: Point2D, oldEnd?: Point2D, newStart?: Point2D, newEnd?: Point2D) => void;

  // ============================================================================
  // 🏢 ENTERPRISE: Refs από useGripSystem (INJECTED - NOT created here)
  // Pattern: Dependency Injection - refs are CANONICAL in useGripSystem
  // ============================================================================
  /** Throttle ref for grip hover detection (from useGripSystem) */
  gripHoverThrottleRef: React.MutableRefObject<GripHoverThrottle>;
  /** Flag to prevent click event immediately after drag (from useGripSystem) */
  justFinishedDragRef: React.MutableRefObject<boolean>;
  /** Function to mark drag as finished (from useGripSystem) */
  markDragFinished: () => void;
}

/**
 * Return type of useCanvasMouse hook
 */
export interface UseCanvasMouseReturn {
  // Mouse position states
  mouseCss: Point2D | null;
  mouseWorld: Point2D | null;

  // Update functions
  updateMouseCss: (point: Point2D) => void;
  updateMouseWorld: (point: Point2D) => void;

  // Refs (mouse-specific only - grip refs come from useGripSystem)
  lastMouseCssRef: React.RefObject<Point2D | null>;
  lastMouseWorldRef: React.RefObject<Point2D | null>;

  // Event handlers
  handleContainerMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleContainerMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleContainerMouseUp: (e: React.MouseEvent<HTMLDivElement>) => Promise<void>;
  handleContainerMouseEnter: () => void;
  handleContainerMouseLeave: () => void;
}

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
    // the position with container-relative coords. Since click (handleMouseUp) uses DxfCanvas
    // element (e.currentTarget), crosshair must also use DxfCanvas coords for alignment.
    // React state update (for components that need it)
    updatePosition(screenPos);
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
  }, [containerRef, updatePosition, updateMouseCss, draggingOverlayBody, draggingVertices, draggingEdgeMidpoint, draggingGuide, transform, setDragPreviewPosition]);

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

    // ADR-189 B5: Guide drag initiation — before other tool checks
    if (activeTool === 'guide-move') {
      const container = containerRef.current;
      if (!container) return;
      const snap = getPointerSnapshotFromElement(container);
      if (!snap) return;
      const screenPos = getScreenPosFromEvent(e, snap);
      const worldPos = screenToWorldWithSnapshot(screenPos, transform, snap);

      const store = getGlobalGuideStore();
      const hitTolerance = 30 / transform.scale;
      const nearest = store.findNearestGuide(worldPos.x, worldPos.y, hitTolerance);

      if (nearest && !nearest.locked) {
        e.preventDefault();
        e.stopPropagation();
        setDraggingGuide({
          guideId: nearest.id,
          axis: nearest.axis,
          startMouseWorld: worldPos,
          originalOffset: nearest.offset,
          originalStartPoint: nearest.startPoint ? { x: nearest.startPoint.x, y: nearest.startPoint.y } : undefined,
          originalEndPoint: nearest.endPoint ? { x: nearest.endPoint.x, y: nearest.endPoint.y } : undefined,
        });
      }
      return;
    }

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
    setDraggingGuide,
  ]);

  /**
   * 🏢 ENTERPRISE: Mouse up handler for MULTI-grip drag end
   * ADR-031: Multi-Grip Selection System - updates all dragged vertices
   */
  const handleContainerMouseUp = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const overlayStore = overlayStoreRef.current;

    // Handle MULTI-vertex drag end
    if (draggingVertices && draggingVertices.length > 0 && overlayStore) {
      const container = containerRef.current;
      if (container) {
        const snap = getPointerSnapshotFromElement(container);
        if (!snap) return;
        const screenPos = getScreenPosFromEvent(e, snap);
        const worldPos = screenToWorldWithSnapshot(screenPos, transform, snap);

        // Calculate delta from first grip's start point
        const delta = {
          x: worldPos.x - draggingVertices[0].startPoint.x,
          y: worldPos.y - draggingVertices[0].startPoint.y
        };

        // Command Pattern for multi-grip movement (imported dynamically to avoid circular deps)
        const movements: VertexMovement[] = draggingVertices.map(drag => ({
          overlayId: drag.overlayId,
          vertexIndex: drag.vertexIndex,
          oldPosition: [drag.originalPosition.x, drag.originalPosition.y] as [number, number],
          newPosition: [
            drag.originalPosition.x + delta.x,
            drag.originalPosition.y + delta.y
          ] as [number, number]
        }));

        // Execute through command history
        const { MoveMultipleOverlayVerticesCommand } = await import('../../core/commands');
        const command = new MoveMultipleOverlayVerticesCommand(movements, overlayStore);
        executeCommand(command);
      }

      // Clear drag states but NOT selectedGrips
      setDraggingVertices(null);
      setDragPreviewPosition(null);
      // 🏢 ENTERPRISE: Use injected markDragFinished from useGripSystem
      markDragFinished();
    }

    // Handle edge midpoint drag end
    if (draggingEdgeMidpoint && overlayStore) {
      const container = containerRef.current;
      if (container) {
        const snap = getPointerSnapshotFromElement(container);
        if (!snap) return;
        const screenPos = getScreenPosFromEvent(e, snap);
        const worldPos = screenToWorldWithSnapshot(screenPos, transform, snap);

        if (!draggingEdgeMidpoint.newVertexCreated) {
          // First time - insert new vertex
          await overlayStore.addVertex(
            draggingEdgeMidpoint.overlayId,
            draggingEdgeMidpoint.insertIndex,
            [worldPos.x, worldPos.y]
          );
        } else {
          // Vertex already created - just update position
          await overlayStore.updateVertex(
            draggingEdgeMidpoint.overlayId,
            draggingEdgeMidpoint.insertIndex,
            [worldPos.x, worldPos.y]
          );
        }
      }

      setDraggingEdgeMidpoint(null);
      setDragPreviewPosition(null);
      // 🏢 ENTERPRISE: Use injected markDragFinished from useGripSystem
      markDragFinished();
    }

    // Handle overlay body drag end (move tool)
    if (draggingOverlayBody && overlayStore) {
      const container = containerRef.current;
      if (container) {
        const snap = getPointerSnapshotFromElement(container);
        if (!snap) return;
        const screenPos = getScreenPosFromEvent(e, snap);
        const worldPos = screenToWorldWithSnapshot(screenPos, transform, snap);

        // Calculate delta from start position
        const delta = {
          x: worldPos.x - draggingOverlayBody.startPoint.x,
          y: worldPos.y - draggingOverlayBody.startPoint.y
        };

        // Only execute if there was actual movement
        const hasMovement = Math.abs(delta.x) > movementDetectionThreshold ||
                           Math.abs(delta.y) > movementDetectionThreshold;

        if (hasMovement) {
          const { MoveOverlayCommand } = await import('../../core/commands');
          const command = new MoveOverlayCommand(
            draggingOverlayBody.overlayId,
            delta,
            overlayStore,
            true // isDragging = true
          );
          executeCommand(command);
        }
      }

      setDraggingOverlayBody(null);
      setDragPreviewPosition(null);
      // 🏢 ENTERPRISE: Use injected markDragFinished from useGripSystem
      markDragFinished();
    }

    // ADR-189 B5: Handle guide drag end
    if (draggingGuide) {
      const container = containerRef.current;
      if (container) {
        const snap = getPointerSnapshotFromElement(container);
        if (snap) {
          const screenPos = getScreenPosFromEvent(e, snap);
          const worldPos = screenToWorldWithSnapshot(screenPos, transform, snap);
          const deltaX = worldPos.x - draggingGuide.startMouseWorld.x;
          const deltaY = worldPos.y - draggingGuide.startMouseWorld.y;
          const hasMovement = Math.abs(deltaX) > movementDetectionThreshold ||
                              Math.abs(deltaY) > movementDetectionThreshold;

          if (hasMovement) {
            if (draggingGuide.axis === 'XZ' && draggingGuide.originalStartPoint && draggingGuide.originalEndPoint) {
              const newStart = { x: draggingGuide.originalStartPoint.x + deltaX, y: draggingGuide.originalStartPoint.y + deltaY };
              const newEnd = { x: draggingGuide.originalEndPoint.x + deltaX, y: draggingGuide.originalEndPoint.y + deltaY };
              onGuideDragComplete(
                draggingGuide.guideId, draggingGuide.axis,
                draggingGuide.originalOffset, draggingGuide.originalOffset,
                draggingGuide.originalStartPoint, draggingGuide.originalEndPoint,
                newStart, newEnd,
              );
            } else {
              const delta1D = draggingGuide.axis === 'X' ? deltaX : deltaY;
              const newOffset = draggingGuide.originalOffset + delta1D;
              onGuideDragComplete(
                draggingGuide.guideId, draggingGuide.axis,
                draggingGuide.originalOffset, newOffset,
              );
            }
          } else {
            // No movement — revert the live store mutation
            const store = getGlobalGuideStore();
            if (draggingGuide.axis === 'XZ' && draggingGuide.originalStartPoint && draggingGuide.originalEndPoint) {
              store.moveDiagonalGuideById(draggingGuide.guideId, draggingGuide.originalStartPoint, draggingGuide.originalEndPoint);
            } else {
              store.moveGuideById(draggingGuide.guideId, draggingGuide.originalOffset);
            }
          }
        }
      }
      setDraggingGuide(null);
    }
  }, [
    draggingVertices,
    draggingEdgeMidpoint,
    draggingOverlayBody,
    draggingGuide,
    transform,
    containerRef,
    executeCommand,
    setDraggingVertices,
    setDraggingEdgeMidpoint,
    setDraggingOverlayBody,
    setDragPreviewPosition,
    overlayStoreRef,
    movementDetectionThreshold,
    markDragFinished, // 🏢 ENTERPRISE: Injected from useGripSystem
    setDraggingGuide,
    onGuideDragComplete,
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
