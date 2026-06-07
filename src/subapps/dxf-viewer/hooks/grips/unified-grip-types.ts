/**
 * ADR-183: Unified Grip System — Type Definitions
 *
 * Single type system for BOTH DXF entity grips and overlay polygon grips.
 * Extends the existing GripInfo (useGripMovement.ts) with overlay support.
 *
 * Canonical SSoT for all grip types. Overlay hover/drag/select types live here
 * inline (migrated from the now-deleted useGripSystem.ts). DXF state-machine
 * types are re-exported from grip-computation.ts (pure-function module).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { StairGripKind, DimensionGripKind, WallGripKind, OpeningGripKind, SlabGripKind, SlabOpeningGripKind, RoofGripKind, FloorFinishGripKind, MepUnderfloorGripKind, BeamGripKind, ColumnGripKind, MepFixtureGripKind, ElectricalPanelGripKind, MepManifoldGripKind, MepRadiatorGripKind, MepBoilerGripKind, FurnitureGripKind, FloorplanSymbolGripKind, XLineGripKind, RayGripKind } from '../useGripMovement';
import type {
  DxfGripDragPreview,
  DxfGripInteractionState,
} from '../grip-computation';

// ============================================================================
// OVERLAY GRIP TYPES (canonical SSoT — moved from useGripSystem.ts on delete)
// ============================================================================

/** Vertex hover information */
export interface VertexHoverInfo {
  overlayId: string;
  vertexIndex: number;
}

/** Edge hover information */
export interface EdgeHoverInfo {
  overlayId: string;
  edgeIndex: number;
}

/**
 * Selected grip information (vertex or edge midpoint).
 * ADR-031: Multi-Grip Selection System.
 */
export interface SelectedGrip {
  type: 'vertex' | 'edge-midpoint';
  overlayId: string;
  /** vertexIndex for vertex, edgeIndex for edge-midpoint */
  index: number;
}

/**
 * Vertex drag state for multi-vertex movement.
 * ADR-031: Multi-Grip Selection System — supports moving multiple grips together.
 */
export interface DraggingVertexState {
  overlayId: string;
  vertexIndex: number;
  startPoint: Point2D;
  /** Original vertex position for delta calculation */
  originalPosition: Point2D;
}

/** Edge midpoint drag state (for vertex insertion) */
export interface DraggingEdgeMidpointState {
  overlayId: string;
  edgeIndex: number;
  insertIndex: number;
  startPoint: Point2D;
  /** True after vertex has been inserted */
  newVertexCreated: boolean;
}

/**
 * Overlay body drag state (move tool).
 * ADR-032: Move entire overlay with Command Pattern for undo/redo support.
 */
export interface DraggingOverlayBodyState {
  overlayId: string;
  /** Mouse start position in world coordinates */
  startPoint: Point2D;
  /** Original polygon for delta calculation */
  startPolygon: Array<[number, number]>;
}

/** Grip hover throttle ref type for performance optimization */
export interface GripHoverThrottle {
  lastCheckTime: number;
  lastWorldPoint: Point2D | null;
}

// ============================================================================
// RE-EXPORTS — DXF state machine types live in grip-computation.ts
// ============================================================================

export type {
  DxfGripDragPreview,
  DxfGripInteractionState,
  GripIdentifier,
} from '../grip-computation';

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
  /**
   * ADR-358 Phase 5b — parametric stair grip discriminator (forwarded from
   * `GripInfo.stairGripKind` in `grip-registry.wrapDxfGrip`). Routes commit
   * through `UpdateStairParamsCommand` instead of `StretchEntityCommand`.
   */
  readonly stairGripKind?: StairGripKind;
  /**
   * ADR-362 Phase I2 — dimension grip discriminator (forwarded from
   * `GripInfo.dimGripKind` in `grip-registry.wrapDxfGrip`). Routes commit
   * through `applyDimensionGripDrag` + direct scene patch.
   */
  readonly dimGripKind?: DimensionGripKind;
  /**
   * ADR-363 Phase 1C — parametric wall grip discriminator (forwarded from
   * `GripInfo.wallGripKind`). Routes commit through `applyWallGripDrag()` +
   * `UpdateWallParamsCommand` instead of the standard `StretchEntityCommand`
   * vertex path.
   */
  readonly wallGripKind?: WallGripKind;
  /**
   * ADR-363 Phase 2.5 — parametric opening grip discriminator (forwarded from
   * `GripInfo.openingGripKind`). Routes commit through
   * `applyOpeningGripDrag()` + `UpdateOpeningParamsCommand` (drag-along-wall).
   */
  readonly openingGripKind?: OpeningGripKind;
  /**
   * ADR-363 Phase 3.5 — parametric slab grip discriminator (forwarded from
   * `GripInfo.slabGripKind`). Routes commit through `applySlabGripDrag()` +
   * `UpdateSlabParamsCommand` (per-vertex translate).
   */
  readonly slabGripKind?: SlabGripKind;
  /**
   * ADR-363 Phase 3.7a — parametric slab-opening grip discriminator
   * (forwarded from `GripInfo.slabOpeningGripKind`). Routes commit through
   * `applySlabOpeningGripDrag()` + `UpdateSlabOpeningParamsCommand`
   * (per-vertex translate + edge-midpoint insertion).
   */
  readonly slabOpeningGripKind?: SlabOpeningGripKind;
  /**
   * ADR-417 Φ1-part-2 #2 — parametric roof grip discriminator (forwarded from
   * `GripInfo.roofGripKind`). Routes commit through `applyRoofGripDrag()` +
   * `UpdateRoofParamsCommand` (per-vertex translate + edge-midpoint insertion).
   */
  readonly roofGripKind?: RoofGripKind;
  /**
   * ADR-363 Phase 5.5a — parametric beam grip discriminator (forwarded from
   * `GripInfo.beamGripKind`). Routes commit through `applyBeamGripDrag()` +
   * `UpdateBeamParamsCommand` (start/end/midpoint translate + curve control
   * move).
   */
  readonly beamGripKind?: BeamGripKind;
  /**
   * ADR-363 Phase 4.5 — parametric column grip discriminator (forwarded from
   * `GripInfo.columnGripKind`). Routes commit through `applyColumnGripDrag()` +
   * `UpdateColumnParamsCommand` (center translate + rotation + width/depth
   * resize).
   */
  readonly columnGripKind?: ColumnGripKind;
  /**
   * ADR-406 — parametric MEP fixture grip discriminator (forwarded from
   * `GripInfo.mepFixtureGripKind`). Routes commit through
   * `applyMepFixtureGripDrag()` + `UpdateMepFixtureParamsCommand` (center
   * translate + rotation + opposite-corner-anchored width/length resize).
   */
  readonly mepFixtureGripKind?: MepFixtureGripKind;
  /**
   * ADR-408 Φ3 — parametric electrical panel grip discriminator (forwarded from
   * `GripInfo.electricalPanelGripKind`). Routes commit through
   * `applyElectricalPanelGripDrag()` + `UpdateElectricalPanelParamsCommand`
   * (center translate + rotation + opposite-corner-anchored width/length resize).
   */
  readonly electricalPanelGripKind?: ElectricalPanelGripKind;
  /**
   * ADR-408 Φ12 — parametric MEP manifold grip discriminator (forwarded from
   * `GripInfo.mepManifoldGripKind`). Routes commit through
   * `applyMepManifoldGripDrag()` + `UpdateMepManifoldParamsCommand`
   * (center translate + rotation + opposite-corner-anchored width/length resize).
   */
  readonly mepManifoldGripKind?: MepManifoldGripKind;
  /**
   * ADR-408 Εύρος Β — parametric heating radiator grip discriminator (forwarded
   * from `GripInfo.mepRadiatorGripKind`). Routes commit through
   * `applyMepRadiatorGripDrag()` + `UpdateMepRadiatorParamsCommand` (center
   * translate + rotation + opposite-corner-anchored width/length resize).
   */
  readonly mepRadiatorGripKind?: MepRadiatorGripKind;
  /**
   * ADR-408 Εύρος Β #2 — parametric heating boiler grip discriminator (forwarded
   * from `GripInfo.mepBoilerGripKind`). Routes commit through
   * `applyMepBoilerGripDrag()` + `UpdateMepBoilerParamsCommand` (center
   * translate + rotation + opposite-corner-anchored width/length resize).
   */
  readonly mepBoilerGripKind?: MepBoilerGripKind;
  /**
   * ADR-410 — parametric furniture grip discriminator (forwarded from
   * `GripInfo.furnitureGripKind`). Routes commit through
   * `applyFurnitureGripDrag()` + `UpdateFurnitureParamsCommand` (center
   * translate + rotation + opposite-corner-anchored width/depth resize).
   */
  readonly furnitureGripKind?: FurnitureGripKind;
  /**
   * ADR-415 — parametric floorplan-symbol grip discriminator (forwarded from
   * `GripInfo.floorplanSymbolGripKind`). Routes commit through
   * `applyFloorplanSymbolGripDrag()` + `UpdateFloorplanSymbolParamsCommand`.
   */
  readonly floorplanSymbolGripKind?: FloorplanSymbolGripKind;
  /**
   * ADR-419 — parametric floor-finish grip discriminator (forwarded from
   * `GripInfo.floorFinishGripKind`). Routes commit through
   * `applyFloorFinishGripDrag()` + `UpdateFloorFinishParamsCommand`
   * (per-vertex translate + edge-midpoint insertion, mirrors slab/roof).
   */
  readonly floorFinishGripKind?: FloorFinishGripKind;
  /**
   * ADR-408 Εύρος Β #3 — parametric underfloor heating loop grip discriminator
   * (forwarded from `GripInfo.mepUnderfloorGripKind`). Routes commit through
   * `applyMepUnderfloorGripDrag()` + `UpdateMepUnderfloorParamsCommand`
   * (per-vertex translate + edge-midpoint insertion, mirrors floor-finish/slab).
   */
  readonly mepUnderfloorGripKind?: MepUnderfloorGripKind;
  /**
   * ADR-359 Phase 11 — XLine grip discriminator (forwarded from
   * `GripInfo.xlineGripKind`). Routes commit through `applyXLineGripDrag()` +
   * direct scene patch (translate basePoint or rotate direction).
   */
  readonly xlineGripKind?: XLineGripKind;
  /**
   * ADR-359 Phase 11 — Ray grip discriminator (forwarded from
   * `GripInfo.rayGripKind`). Routes commit through `applyRayGripDrag()` +
   * direct scene patch (translate basePoint or rotate direction).
   */
  readonly rayGripKind?: RayGripKind;
}

/**
 * State machine phases — superset of both systems.
 * idle → hovering (cursor near grip) → warm (timer) → dragging (mouseDown) → commit/cancel → idle
 *
 * ADR-363 Phase 1G — `hotGrip` is the AutoCAD click-click move state for the 4
 * wall corner grips: 1st click enters (no drag), cursor moves live, 2nd click
 * commits. Distinct from `dragging` so the press-drag-release mouseup-commit
 * logic does not fire for corners.
 */
export type UnifiedGripPhase = 'idle' | 'hovering' | 'warm' | 'dragging' | 'hotGrip';

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
  /** Switch active tool — used by rotate/scale/mirror grip handoff (ADR-349 Phase 1c-B2). */
  onToolChange?: (tool: string) => void;
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
  /** Currently hovered grip (cold/hovering/warm phases) — null in idle/dragging. ADR-349 Phase 1b.2. */
  hoveredGrip: UnifiedGripInfo | null;
  /** Currently dragging grip (`dragging` phase) — null otherwise. ADR-357 Phase 11 (right-click context menu needs the active grip during drag). */
  activeGrip: UnifiedGripInfo | null;
  /** Current state machine phase — needed by grip menu controller to skip during drags. ADR-349 Phase 1b.2. */
  phase: UnifiedGripPhase;
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

/** Dependencies needed for DXF grip commits */
export interface DxfCommitDeps {
  moveEntities: (ids: string[], delta: Point2D, opts: { isDragging: boolean }) => void;
  execute: (command: ICommand) => void;
  currentLevelId: string | null;
  getLevelScene: (levelId: string) => import('../../types/scene').SceneModel | null;
  setLevelScene: (levelId: string, scene: import('../../types/scene').SceneModel) => void;
  /** Switch active tool — required for rotate/scale/mirror grip handoff (ADR-349 Phase 1c-B2). */
  onToolChange: (tool: string) => void;
}

/** Dependencies needed for overlay grip commits */
export interface OverlayCommitDeps {
  overlayStore: ReturnType<typeof useOverlayStore>;
  executeCommand: (command: ICommand) => void;
  movementDetectionThreshold: number;
}
