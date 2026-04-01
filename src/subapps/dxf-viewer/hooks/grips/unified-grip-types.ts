/**
 * ADR-183: Unified Grip System — Type Definitions
 *
 * Single type system for BOTH DXF entity grips and overlay polygon grips.
 * Extends the existing GripInfo (useGripMovement.ts) with overlay support.
 *
 * @see useDxfGripInteraction.ts — DXF grip state machine (being unified)
 * @see useGripSystem.ts — Overlay grip state management (being unified)
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  VertexHoverInfo,
  EdgeHoverInfo,
  SelectedGrip,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
  GripHoverThrottle,
} from './useGripSystem';
import type {
  DxfGripDragPreview,
  DxfGripInteractionState,
} from '../useDxfGripInteraction';

// ============================================================================
// RE-EXPORTS from existing types (backward compatibility)
// ============================================================================

export type {
  VertexHoverInfo,
  EdgeHoverInfo,
  SelectedGrip,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
  GripHoverThrottle,
} from './useGripSystem';

export type {
  DxfGripDragPreview,
  DxfGripInteractionState,
  GripIdentifier,
} from '../useDxfGripInteraction';

// ============================================================================
// UNIFIED TYPES
// ============================================================================

/** Visual temperature of a grip (cold → warm → hot) */
export type GripTemperature = 'cold' | 'warm' | 'hot';

/** Source system that owns this grip */
export type GripSource = 'dxf' | 'overlay';

/** Grip type aligned with existing GripType from useGripMovement */
export type UnifiedGripType = 'vertex' | 'center' | 'edge';

/**
 * Unified grip descriptor — one shape that covers both DXF and overlay grips.
 *
 * ID format:
 * - DXF:     `dxf_${entityId}_${gripIndex}`
 * - Overlay: `overlay_${overlayId}_v${index}` (vertex) or `overlay_${overlayId}_e${index}` (edge)
 */
export interface UnifiedGripInfo {
  /** Stable unique key: `dxf_<entityId>_<gripIndex>` | `overlay_<overlayId>_v<i>` | `overlay_<overlayId>_e<i>` */
  readonly id: string;
  /** Which system owns this grip */
  readonly source: GripSource;
  /** DXF entity ID (present when source='dxf') */
  readonly entityId?: string;
  /** Overlay ID (present when source='overlay') */
  readonly overlayId?: string;
  /** Index within the owning entity/overlay */
  readonly gripIndex: number;
  /** Grip semantic type */
  readonly type: UnifiedGripType;
  /** Current world-space position */
  readonly position: Point2D;
  /** True if dragging this grip translates the WHOLE entity/overlay */
  readonly movesEntity: boolean;
  /** For DXF edge grips: which 2 vertex indices to move together */
  readonly edgeVertexIndices?: [number, number];
  /** For overlay edge grips: vertex insertion index (edgeIndex + 1) */
  readonly edgeInsertIndex?: number;
}

/**
 * State machine phases — superset of both systems.
 * idle → hovering (cursor near grip) → warm (timer) → dragging (mouseDown) → commit/cancel → idle
 */
export type UnifiedGripPhase = 'idle' | 'hovering' | 'warm' | 'dragging';

/**
 * Internal state of the unified grip state machine.
 * Consumers never see this directly — they get projected outputs.
 */
export interface UnifiedGripState {
  readonly phase: UnifiedGripPhase;
  /** Grip under the cursor (hovering/warm) */
  readonly hoveredGrip: UnifiedGripInfo | null;
  /** Grip being dragged */
  readonly activeGrip: UnifiedGripInfo | null;
  /** World position when drag started */
  readonly anchorPos: Point2D | null;
  /** Current world position during drag */
  readonly currentPos: Point2D | null;
  /** All grips selected via Shift+Click (overlay multi-select) */
  readonly selectedGrips: UnifiedGripInfo[];
}

// ============================================================================
// HOOK INTERFACE TYPES (extracted from useUnifiedGripInteraction)
// ============================================================================

import type { ViewTransform } from '../../rendering/types/Types';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Overlay } from '../../overlays/types';
import type { ICommand } from '../../core/commands/interfaces';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { UniversalSelectionHook } from '../../systems/selection';

export interface UseUnifiedGripInteractionParams {
  selectedEntityIds: string[];
  dxfScene: DxfScene | null;
  transform: ViewTransform;
  currentOverlays: Overlay[];
  universalSelection: UniversalSelectionHook;
  overlayStore: ReturnType<typeof useOverlayStore>;
  overlayStoreRef: React.MutableRefObject<ReturnType<typeof useOverlayStore>>;
  activeTool: string;
  gripSettings: { gripSize?: number; dpiScale?: number };
  executeCommand: (command: ICommand) => void;
  movementDetectionThreshold: number;
}

/** DXF projection — backward-compatible with UseDxfGripInteractionReturn */
export interface DxfProjection {
  gripInteractionState: DxfGripInteractionState;
  isDraggingGrip: boolean;
  isFollowingGrip: boolean;
  handleGripMouseMove: (worldPos: Point2D, screenPos: Point2D) => boolean;
  handleGripMouseDown: (worldPos: Point2D) => boolean;
  handleGripMouseUp: (worldPos: Point2D) => boolean;
  handleGripClick: (worldPos: Point2D) => boolean;
  handleGripEscape: () => boolean;
  handleGripRightClick: () => boolean;
  dragPreview: DxfGripDragPreview | null;
}

/** Overlay projection — backward-compatible with useGripSystem + useLayerCanvasMouseMove */
export interface OverlayProjection {
  hoveredVertexInfo: VertexHoverInfo | null;
  hoveredEdgeInfo: EdgeHoverInfo | null;
  selectedGrips: SelectedGrip[];
  selectedGrip: SelectedGrip | null;
  draggingVertex: DraggingVertexState | null;
  draggingVertices: DraggingVertexState[] | null;
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
  draggingOverlayBody: DraggingOverlayBodyState | null;
  dragPreviewPosition: Point2D | null;
}

export interface UseUnifiedGripInteractionReturn {
  handleMouseMove: (worldPos: Point2D, screenPos: Point2D) => void;
  handleMouseDown: (worldPos: Point2D, isShift: boolean) => boolean;
  handleMouseUp: (worldPos: Point2D) => Promise<boolean>;
  handleEscape: () => boolean;
  dxfProjection: DxfProjection;
  overlayProjection: OverlayProjection;
  gripStateForStack: {
    draggingVertex: DraggingVertexState | null;
    draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
    hoveredVertexInfo: VertexHoverInfo | null;
    hoveredEdgeInfo: EdgeHoverInfo | null;
    draggingOverlayBody: DraggingOverlayBodyState | null;
    dragPreviewPosition: Point2D | null;
  };
  selectedGrips: SelectedGrip[];
  setSelectedGrips: React.Dispatch<React.SetStateAction<SelectedGrip[]>>;
  setDragPreviewPosition: React.Dispatch<React.SetStateAction<Point2D | null>>;
  isDragging: boolean;
  gripHoverThrottleRef: React.MutableRefObject<GripHoverThrottle>;
  justFinishedDragRef: React.MutableRefObject<boolean>;
  markDragFinished: () => void;
  setDraggingOverlayBody: React.Dispatch<React.SetStateAction<DraggingOverlayBodyState | null>>;
  draggingOverlayBody: DraggingOverlayBodyState | null;
  draggingVertices: DraggingVertexState[] | null;
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
}
