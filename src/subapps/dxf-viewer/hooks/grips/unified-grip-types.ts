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
