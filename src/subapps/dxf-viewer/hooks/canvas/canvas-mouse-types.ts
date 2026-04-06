/**
 * Types and interfaces for useCanvasMouse hook
 * Extracted per ADR-065 (file size limit: max 500 lines)
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { UniversalSelectionHook } from '../../systems/selection';
import type { GridAxis } from '../../ai-assistant/grid-types';

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
 * Grip hover throttle ref type for performance optimization
 * SHARED TYPE: Same as in useGripSystem - refs are injected, NOT created here
 */
export interface GripHoverThrottle {
  lastCheckTime: number;
  lastWorldPoint: Point2D | null;
}

/**
 * Props για useCanvasMouse hook
 */
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
