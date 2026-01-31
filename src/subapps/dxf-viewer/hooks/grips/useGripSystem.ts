'use client';

/**
 * 🏢 ENTERPRISE: useGripSystem Hook
 *
 * @description Manages grip hover, selection, and drag states for overlay polygons
 * @see ADR-XXX: CanvasSection Decomposition
 * @see ADR-031: Multi-Grip Selection System
 *
 * Responsibilities:
 * - Manage vertex/edge hover state (WARM grips)
 * - Manage multi-grip selection state (HOT grips - Autodesk pattern)
 * - Manage vertex/edge midpoint drag states
 * - Manage overlay body drag state (move tool)
 * - Provide drag preview position for visual feedback
 * - Provide throttling refs for performance optimization
 *
 * Pattern: Single Responsibility Principle - Grip State Management
 * Extracted from: CanvasSection.tsx
 */

import { useState, useRef, useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';
// 🏢 ENTERPRISE: Centralized spacing tokens (ADR-013) for drag timing
import { PANEL_LAYOUT } from '../../config/panel-tokens';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Vertex hover information
 */
export interface VertexHoverInfo {
  overlayId: string;
  vertexIndex: number;
}

/**
 * Edge hover information
 */
export interface EdgeHoverInfo {
  overlayId: string;
  edgeIndex: number;
}

/**
 * Selected grip information (vertex or edge midpoint)
 * ADR-031: Multi-Grip Selection System
 */
export interface SelectedGrip {
  type: 'vertex' | 'edge-midpoint';
  overlayId: string;
  index: number; // vertexIndex for vertex, edgeIndex for edge-midpoint
}

/**
 * Vertex drag state for multi-vertex movement
 * ADR-031: Multi-Grip Selection System - supports moving multiple grips together
 */
export interface DraggingVertexState {
  overlayId: string;
  vertexIndex: number;
  startPoint: Point2D;
  originalPosition: Point2D; // Original vertex position for delta calculation
}

/**
 * Edge midpoint drag state (for vertex insertion)
 */
export interface DraggingEdgeMidpointState {
  overlayId: string;
  edgeIndex: number;
  insertIndex: number;
  startPoint: Point2D;
  newVertexCreated: boolean; // True after vertex has been inserted
}

/**
 * Overlay body drag state (move tool)
 * ADR-032: Move entire overlay with Command Pattern for undo/redo support
 */
export interface DraggingOverlayBodyState {
  overlayId: string;
  startPoint: Point2D;    // Mouse start position in world coordinates
  startPolygon: Array<[number, number]>; // Original polygon for delta calculation
}

/**
 * Grip hover throttle ref type for performance optimization
 */
export interface GripHoverThrottle {
  lastCheckTime: number;
  lastWorldPoint: Point2D | null;
}

/**
 * Return type of useGripSystem hook
 */
export interface UseGripSystemReturn {
  // ============================================================================
  // HOVER STATES (WARM grips)
  // ============================================================================
  /** Currently hovered vertex info */
  hoveredVertexInfo: VertexHoverInfo | null;
  /** Set hovered vertex info */
  setHoveredVertexInfo: React.Dispatch<React.SetStateAction<VertexHoverInfo | null>>;
  /** Currently hovered edge info */
  hoveredEdgeInfo: EdgeHoverInfo | null;
  /** Set hovered edge info */
  setHoveredEdgeInfo: React.Dispatch<React.SetStateAction<EdgeHoverInfo | null>>;

  // ============================================================================
  // SELECTION STATES (HOT grips - Autodesk pattern)
  // ============================================================================
  /** Array of selected grips (multi-selection supported) */
  selectedGrips: SelectedGrip[];
  /** Set selected grips */
  setSelectedGrips: React.Dispatch<React.SetStateAction<SelectedGrip[]>>;
  /** Single selected grip (backwards compatibility) */
  selectedGrip: SelectedGrip | null;

  // ============================================================================
  // DRAG STATES
  // ============================================================================
  /** Array of vertices being dragged (multi-vertex movement) */
  draggingVertices: DraggingVertexState[] | null;
  /** Set dragging vertices */
  setDraggingVertices: React.Dispatch<React.SetStateAction<DraggingVertexState[] | null>>;
  /** Single dragging vertex (backwards compatibility) */
  draggingVertex: { overlayId: string; vertexIndex: number; startPoint: Point2D } | null;
  /** Edge midpoint being dragged (vertex insertion) */
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
  /** Set dragging edge midpoint */
  setDraggingEdgeMidpoint: React.Dispatch<React.SetStateAction<DraggingEdgeMidpointState | null>>;
  /** Overlay body being dragged (move tool) */
  draggingOverlayBody: DraggingOverlayBodyState | null;
  /** Set dragging overlay body */
  setDraggingOverlayBody: React.Dispatch<React.SetStateAction<DraggingOverlayBodyState | null>>;
  /** Current drag preview position for visual feedback */
  dragPreviewPosition: Point2D | null;
  /** Set drag preview position */
  setDragPreviewPosition: React.Dispatch<React.SetStateAction<Point2D | null>>;

  // ============================================================================
  // REFS
  // ============================================================================
  /** Throttle ref for grip hover detection performance */
  gripHoverThrottleRef: React.MutableRefObject<GripHoverThrottle>;
  /** Flag to prevent click event immediately after drag */
  justFinishedDragRef: React.MutableRefObject<boolean>;

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  /** Check if any grip is being dragged */
  isDragging: boolean;
  /** Clear all hover states */
  clearHoverStates: () => void;
  /** Clear all drag states */
  clearDragStates: () => void;
  /** Clear all selection */
  clearSelection: () => void;
  /** Reset all grip system state */
  resetAll: () => void;
  /** Mark drag as just finished (sets flag for 50ms) */
  markDragFinished: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * 🏢 ENTERPRISE: Grip system state management hook
 *
 * This hook manages all grip-related state for overlay polygon editing:
 * - Vertex/edge hover detection (WARM state)
 * - Multi-grip selection (HOT state - Autodesk pattern)
 * - Vertex/edge midpoint drag operations
 * - Overlay body movement (move tool)
 *
 * @example
 * ```tsx
 * const {
 *   hoveredVertexInfo, setHoveredVertexInfo,
 *   hoveredEdgeInfo, setHoveredEdgeInfo,
 *   selectedGrips, setSelectedGrips, selectedGrip,
 *   draggingVertices, setDraggingVertices, draggingVertex,
 *   draggingEdgeMidpoint, setDraggingEdgeMidpoint,
 *   draggingOverlayBody, setDraggingOverlayBody,
 *   dragPreviewPosition, setDragPreviewPosition,
 *   gripHoverThrottleRef, justFinishedDragRef,
 *   isDragging, clearHoverStates, clearDragStates, clearSelection, resetAll,
 * } = useGripSystem();
 * ```
 */
export function useGripSystem(): UseGripSystemReturn {
  // ============================================================================
  // HOVER STATES (WARM grips)
  // ============================================================================

  /**
   * Currently hovered vertex info
   * Used for visual feedback (WARM grip highlighting)
   */
  const [hoveredVertexInfo, setHoveredVertexInfo] = useState<VertexHoverInfo | null>(null);

  /**
   * Currently hovered edge info
   * Used for edge midpoint grip display and visual feedback
   */
  const [hoveredEdgeInfo, setHoveredEdgeInfo] = useState<EdgeHoverInfo | null>(null);

  // ============================================================================
  // SELECTION STATES (HOT grips - Autodesk pattern)
  // ============================================================================

  /**
   * Array of selected grips (multi-selection supported)
   * Shift+Click: Add/remove grips to selection
   * Drag: Move all selected grips together
   * ADR-031: Multi-Grip Selection System
   */
  const [selectedGrips, setSelectedGrips] = useState<SelectedGrip[]>([]);

  /**
   * Single selected grip (backwards compatibility)
   * Returns first selected grip or null
   */
  const selectedGrip = selectedGrips.length > 0 ? selectedGrips[0] : null;

  // ============================================================================
  // DRAG STATES
  // ============================================================================

  /**
   * Array of vertices being dragged
   * Supports multi-vertex movement (ADR-031)
   */
  const [draggingVertices, setDraggingVertices] = useState<DraggingVertexState[] | null>(null);

  /**
   * Single dragging vertex (backwards compatibility)
   */
  const draggingVertex = draggingVertices && draggingVertices.length > 0 ? {
    overlayId: draggingVertices[0].overlayId,
    vertexIndex: draggingVertices[0].vertexIndex,
    startPoint: draggingVertices[0].startPoint
  } : null;

  /**
   * Edge midpoint being dragged (for vertex insertion)
   */
  const [draggingEdgeMidpoint, setDraggingEdgeMidpoint] = useState<DraggingEdgeMidpointState | null>(null);

  /**
   * Overlay body being dragged (move tool)
   * ADR-032: Move entire overlay with Command Pattern for undo/redo support
   */
  const [draggingOverlayBody, setDraggingOverlayBody] = useState<DraggingOverlayBodyState | null>(null);

  /**
   * Current drag preview position for visual feedback
   * Updates on every mouse move during drag for smooth visual feedback
   */
  const [dragPreviewPosition, setDragPreviewPosition] = useState<Point2D | null>(null);

  // ============================================================================
  // REFS
  // ============================================================================

  /**
   * Throttle ref for grip hover detection performance
   * Grip hover detection is O(selectedOverlays × vertices) - expensive on every mouse move
   */
  const gripHoverThrottleRef = useRef<GripHoverThrottle>({
    lastCheckTime: 0,
    lastWorldPoint: null
  });

  /**
   * Flag to prevent click event immediately after drag
   * Prevents overlay deselection when releasing mouse after drag
   */
  const justFinishedDragRef = useRef(false);

  // ============================================================================
  // DERIVED VALUES
  // ============================================================================

  /**
   * Check if any grip is being dragged
   */
  const isDragging = draggingVertices !== null || draggingEdgeMidpoint !== null || draggingOverlayBody !== null;

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Clear all hover states
   */
  const clearHoverStates = useCallback(() => {
    setHoveredVertexInfo(null);
    setHoveredEdgeInfo(null);
  }, []);

  /**
   * Clear all drag states
   */
  const clearDragStates = useCallback(() => {
    setDraggingVertices(null);
    setDraggingEdgeMidpoint(null);
    setDraggingOverlayBody(null);
    setDragPreviewPosition(null);
  }, []);

  /**
   * Clear all selection
   */
  const clearSelection = useCallback(() => {
    setSelectedGrips([]);
  }, []);

  /**
   * Reset all grip system state
   */
  const resetAll = useCallback(() => {
    clearHoverStates();
    clearDragStates();
    clearSelection();
  }, [clearHoverStates, clearDragStates, clearSelection]);

  /**
   * Mark drag as just finished (sets flag for reset after timeout)
   * Uses PANEL_LAYOUT.TIMING.DRAG_FINISH_RESET timeout from centralized config
   */
  const markDragFinished = useCallback(() => {
    justFinishedDragRef.current = true;
    setTimeout(() => { justFinishedDragRef.current = false; }, PANEL_LAYOUT.TIMING.DRAG_FINISH_RESET);
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Hover states
    hoveredVertexInfo,
    setHoveredVertexInfo,
    hoveredEdgeInfo,
    setHoveredEdgeInfo,

    // Selection states
    selectedGrips,
    setSelectedGrips,
    selectedGrip,

    // Drag states
    draggingVertices,
    setDraggingVertices,
    draggingVertex,
    draggingEdgeMidpoint,
    setDraggingEdgeMidpoint,
    draggingOverlayBody,
    setDraggingOverlayBody,
    dragPreviewPosition,
    setDragPreviewPosition,

    // Refs
    gripHoverThrottleRef,
    justFinishedDragRef,

    // Helpers
    isDragging,
    clearHoverStates,
    clearDragStates,
    clearSelection,
    resetAll,
    markDragFinished,
  };
}

export default useGripSystem;
