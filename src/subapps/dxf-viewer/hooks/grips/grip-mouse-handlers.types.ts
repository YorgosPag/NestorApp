/**
 * Grip mouse-handler context types.
 * Extracted from `grip-mouse-handlers.ts` for file-size compliance (<500 lines);
 * behavior-preserving. Re-exported from `grip-mouse-handlers.ts` for callers.
 *
 * @module hooks/grips/grip-mouse-handlers.types
 * @see ./grip-mouse-handlers.ts
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { WallHotGripOp, HotGripStep } from './wall-hot-grip-fsm';
import type { DxfCommitDeps, OverlayCommitDeps } from './grip-commit-adapters';
import type {
  UnifiedGripInfo,
  UnifiedGripPhase,
  UseUnifiedGripInteractionParams,
  SelectedGrip,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
} from './unified-grip-types';

export interface GripMouseDownCtx {
  mouseDownInProgressRef: MutableRefObject<boolean>;
  activeGrip: UnifiedGripInfo | null;
  anchorRef: MutableRefObject<Point2D | null>;
  onToolChangeRef: MutableRefObject<UseUnifiedGripInteractionParams['onToolChange']>;
  resetToIdle: () => void;
  isGripMode: boolean;
  allGrips: UnifiedGripInfo[];
  phase: UnifiedGripPhase;
  effectiveTolerance: number;
  hoveredGrip: UnifiedGripInfo | null;
  selectedGrips: SelectedGrip[];
  setSelectedGrips: Dispatch<SetStateAction<SelectedGrip[]>>;
  setActiveGrip: Dispatch<SetStateAction<UnifiedGripInfo | null>>;
  setPhase: Dispatch<SetStateAction<UnifiedGripPhase>>;
  setCurrentWorldPos: Dispatch<SetStateAction<Point2D | null>>;
  hotGripOpRef: MutableRefObject<WallHotGripOp | null>;
  hotGripStepRef: MutableRefObject<HotGripStep>;
  hotGripAwaitingFirstReleaseRef: MutableRefObject<boolean>;
  hotGripMovedRef: MutableRefObject<boolean>;
  hotGripBaseRef: MutableRefObject<Point2D | null>;
  // ADR-363 Phase 1G.3 — rotate-reference (6-click) line points.
  hotGripRefStartRef: MutableRefObject<Point2D | null>;
  hotGripRefEndRef: MutableRefObject<Point2D | null>;
  hotGripAlignStartRef: MutableRefObject<Point2D | null>;
  // ADR-397 — FREE rotate baseline (cursor at the first move after the centre).
  hotGripRotateBaseRef: MutableRefObject<Point2D | null>;
  warmTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  universalSelection: UseUnifiedGripInteractionParams['universalSelection'];
  setDraggingVertices: Dispatch<SetStateAction<DraggingVertexState[] | null>>;
  setDragPreviewPosition: Dispatch<SetStateAction<Point2D | null>>;
  overlayStoreRef: UseUnifiedGripInteractionParams['overlayStoreRef'];
  currentOverlays: UseUnifiedGripInteractionParams['currentOverlays'];
  setDraggingEdgeMidpoint: Dispatch<SetStateAction<DraggingEdgeMidpointState | null>>;
  // ADR-397 Φ2 — directional move-by-value (click a MOVE arm → distance prompt →
  // translate along that local axis). `dxfCommitDeps` reuses the standard move
  // commit; `gripSizePx` matches the hover-zone classification; `markDragFinished`
  // suppresses the trailing click so the entity is not deselected.
  dxfCommitDeps: DxfCommitDeps;
  gripSizePx: number;
  markDragFinished: () => void;
}

export interface GripMouseUpCtx {
  mouseUpInProgressRef: MutableRefObject<boolean>;
  phase: UnifiedGripPhase;
  hotGripAwaitingFirstReleaseRef: MutableRefObject<boolean>;
  hotGripStepRef: MutableRefObject<HotGripStep>;
  hotGripMovedRef: MutableRefObject<boolean>;
  hotGripBaseRef: MutableRefObject<Point2D | null>;
  hotGripOpRef: MutableRefObject<WallHotGripOp | null>;
  // ADR-363 Phase 1G.3 — rotate-reference (6-click) line points.
  hotGripRefStartRef: MutableRefObject<Point2D | null>;
  hotGripRefEndRef: MutableRefObject<Point2D | null>;
  hotGripAlignStartRef: MutableRefObject<Point2D | null>;
  // ADR-397 — FREE rotate baseline (cursor at the first move after the centre).
  hotGripRotateBaseRef: MutableRefObject<Point2D | null>;
  activeGrip: UnifiedGripInfo | null;
  anchorRef: MutableRefObject<Point2D | null>;
  dxfCommitDeps: DxfCommitDeps;
  overlayCommitDeps: OverlayCommitDeps;
  resetToIdle: () => void;
  setCurrentWorldPos: Dispatch<SetStateAction<Point2D | null>>;
  markDragFinished: () => void;
  draggingVertices: DraggingVertexState[] | null;
  setDraggingVertices: Dispatch<SetStateAction<DraggingVertexState[] | null>>;
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
  setDraggingEdgeMidpoint: Dispatch<SetStateAction<DraggingEdgeMidpointState | null>>;
  draggingOverlayBody: DraggingOverlayBodyState | null;
  setDraggingOverlayBody: Dispatch<SetStateAction<DraggingOverlayBodyState | null>>;
  setSelectedGrips: Dispatch<SetStateAction<SelectedGrip[]>>;
  setDragPreviewPosition: Dispatch<SetStateAction<Point2D | null>>;
  // ADR-397 — rotating entity's grip world-points provider, consumed by
  // advanceHotGripPick to arm the rotation snap targets at centre-pick.
  rotatingEntityGripsWorld?: () => ReadonlyArray<{ entityId: string; gripIndex: number; point: Point2D }>;
  // ADR-363 Slice G.6 — resolve the free-rotate reference baseline along the active
  // entity's major axis (toward its body); consumed by advanceHotGripPick to seed
  // `hotGripRotateBaseRef` at centre-pick. Null → legacy first-move baseline.
  resolveRotateBaselineAnchor?: (pivot: Point2D) => Point2D | null;
  // ADR-397 Σ3 — typed rotation angle (signed deg) so a terminal click commits the
  // keyed-in value (parity with Enter). Null → cursor free rotate.
  typedRotateDeg?: number | null;
}
