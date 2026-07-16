/**
 * Types and interfaces for useCanvasMouse hook
 * Extracted per ADR-065 (file size limit: max 500 lines)
 *
 * SSoT (ADR-183/584): οι overlay grip types (hover/select/drag) **ΔΕΝ** δηλώνονται
 * εδώ — ζουν στο `hooks/grips/unified-grip-types.ts`, που είναι ο αυτο-ανακηρυγμένος
 * canonical SSoT τους. Αυτό το module τους **re-export-άρει** ώστε τα υπάρχοντα
 * `import { ... } from './canvas-mouse-types'` call-sites να μένουν αμετάβλητα
 * (ίδιο μοτίβο με το `grip-kinds.ts`). Type-only → μηδέν runtime coupling.
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { UniversalSelectionHook } from '../../systems/selection';
import type { GridAxis } from '../../ai-assistant/grid-types';
import type {
  VertexHoverInfo,
  EdgeHoverInfo,
  SelectedGrip,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
} from '../grips/unified-grip-types';

// ============================================================================
// OVERLAY GRIP TYPES — re-exported from the canonical SSoT (ADR-183)
// ============================================================================

export type {
  VertexHoverInfo,
  EdgeHoverInfo,
  SelectedGrip,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
} from '../grips/unified-grip-types';

// ============================================================================
// TYPES & INTERFACES — canvas-mouse specific
// ============================================================================

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
 *
 * 🚀 PERF (2026-05-09): mouseCss / mouseWorld React state REMOVED.
 * Position SSoT lives in `ImmediatePositionStore`. Consumers re-rendering on
 * position change use `useCursorPosition()` / `useCursorWorldPosition()`
 * (useSyncExternalStore) directly — no prop drilling, no parent re-render.
 */
export interface UseCanvasMouseReturn {
  // Event handlers
  handleContainerMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleContainerMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleContainerMouseUp: (e: React.MouseEvent<HTMLDivElement>) => Promise<void>;
  handleContainerMouseEnter: () => void;
  handleContainerMouseLeave: () => void;
}
