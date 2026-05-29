/**
 * ADR-183: Grip Projections — Pure builders for backward-compatible projections
 *
 * Converts unified grip state → DXF projection + Overlay projection.
 * Extracted from useUnifiedGripInteraction (Google SRP).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Overlay } from '../../overlays/types';
import type {
  UnifiedGripInfo,
  UnifiedGripPhase,
  DxfGripDragPreview,
  DxfGripInteractionState,
  VertexHoverInfo,
  EdgeHoverInfo,
  SelectedGrip,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
  OverlayProjection,
} from './unified-grip-types';
import type { HotGripStep } from './wall-hot-grip-fsm';

// ── DXF Projection Builders ──

export function buildDxfDragPreview(
  phase: UnifiedGripPhase,
  activeGrip: UnifiedGripInfo | null,
  anchorPos: Point2D | null,
  currentWorldPos: Point2D | null,
): DxfGripDragPreview | null {
  // ADR-363 Phase 1G — `hotGrip` reuses the same preview pipeline as `dragging`
  // (live ghost + delta) so the corner click-click move shows the same wall ghost.
  if ((phase !== 'dragging' && phase !== 'hotGrip') || !activeGrip || activeGrip.source !== 'dxf' || !anchorPos || !currentWorldPos) {
    return null;
  }
  return {
    entityId: activeGrip.entityId!,
    gripIndex: activeGrip.gripIndex,
    delta: {
      x: currentWorldPos.x - anchorPos.x,
      y: currentWorldPos.y - anchorPos.y,
    },
    movesEntity: activeGrip.movesEntity,
    edgeVertexIndices: activeGrip.edgeVertexIndices,
    // ADR-363 Phase 1G — flag the dashed rubber-band leader for the corner hot-grip.
    ...(phase === 'hotGrip' ? { hotGrip: true } : {}),
    // ADR-358 Phase 5d — propagate parametric stair discriminator + anchor
    // so `applyEntityPreview` can reach `applyStairGripDrag` with the same
    // inputs the commit adapter uses (origin/delta/currentPos).
    ...(activeGrip.stairGripKind ? { stairGripKind: activeGrip.stairGripKind } : {}),
    ...(activeGrip.stairGripKind ? { anchorPos } : {}),
    // ADR-363 Phase 1C — parametric wall grip discriminator + anchor.
    ...(activeGrip.wallGripKind ? { wallGripKind: activeGrip.wallGripKind, anchorPos } : {}),
    // ADR-363 Phase 4.5c.5 — propagate column/beam grip kind so the dim-annotation
    // leaf can compute live "w=350mm" labels without re-subscribing to scene state.
    ...(activeGrip.columnGripKind ? { columnGripKind: activeGrip.columnGripKind } : {}),
    ...(activeGrip.beamGripKind   ? { beamGripKind:   activeGrip.beamGripKind }   : {}),
    ...((activeGrip.columnGripKind ?? activeGrip.beamGripKind) ? { anchorPos } : {}),
    // ADR-363 Phase 3.5 / 3.7a / 2.5 — slab / slab-opening / opening grip kinds.
    ...(activeGrip.slabGripKind        ? { slabGripKind:        activeGrip.slabGripKind,        anchorPos } : {}),
    ...(activeGrip.slabOpeningGripKind ? { slabOpeningGripKind: activeGrip.slabOpeningGripKind, anchorPos } : {}),
    ...(activeGrip.openingGripKind     ? { openingGripKind:     activeGrip.openingGripKind,     anchorPos } : {}),
  };
}

/**
 * ADR-363 Phase 1G.3 — live preview for the wall-rotation 6-click reference flow.
 *
 * Drives two things off the hot-grip refs:
 *  - dashed guide segments (`rotateRefLine` / `rotateAlignLine`) drawn on the
 *    preview canvas so the user sees the reference + alignment lines being traced;
 *  - the rotating wall ghost (during the final `await-align-end` step only), by
 *    re-using the existing delta+pivot ghost pipeline via the identity
 *    `anchor = pivot + refDir`, `currentPos = pivot + alignDir` so
 *    `applyWallGripDrag('wall-rotation', …)` sweeps `angle(align) − angle(ref)`.
 *
 * Returns null until the centre is picked and there is a segment to show (the
 * `await-base` / `await-ref-start` steps draw nothing).
 */
export function buildRotateReferencePreview(
  activeGrip: UnifiedGripInfo | null,
  step: HotGripStep,
  pivot: Point2D | null,
  refStart: Point2D | null,
  refEnd: Point2D | null,
  alignStart: Point2D | null,
  cursor: Point2D | null,
): DxfGripDragPreview | null {
  if (!activeGrip || activeGrip.source !== 'dxf' || !pivot) return null;
  const base = {
    entityId: activeGrip.entityId!,
    gripIndex: activeGrip.gripIndex,
    movesEntity: activeGrip.movesEntity,
    // ADR-397 — forward whichever parametric kind owns the rotation handle so the
    // live ghost reaches the right `apply*GripDrag` (wall OR column 6-click rotate).
    ...(activeGrip.wallGripKind ? { wallGripKind: activeGrip.wallGripKind } : {}),
    ...(activeGrip.columnGripKind ? { columnGripKind: activeGrip.columnGripKind } : {}),
    hotGrip: true as const,
    rotatePivot: pivot,
    delta: { x: 0, y: 0 },
    anchorPos: pivot,
  };
  if (step === 'await-ref-end' && refStart && cursor) {
    return { ...base, rotateRefLine: { from: refStart, to: cursor } };
  }
  if (step === 'await-align-start' && refStart && refEnd) {
    return { ...base, rotateRefLine: { from: refStart, to: refEnd } };
  }
  if (step === 'await-align-end' && refStart && refEnd && alignStart && cursor) {
    const refDir = { x: refEnd.x - refStart.x, y: refEnd.y - refStart.y };
    const alignDir = { x: cursor.x - alignStart.x, y: cursor.y - alignStart.y };
    return {
      ...base,
      anchorPos: { x: pivot.x + refDir.x, y: pivot.y + refDir.y },
      delta: { x: alignDir.x - refDir.x, y: alignDir.y - refDir.y },
      rotateRefLine: { from: refStart, to: refEnd },
      rotateAlignLine: { from: alignStart, to: cursor },
    };
  }
  return null; // await-base / await-ref-start — centre picked but no line yet.
}

export function buildGripInteractionState(
  hoveredGrip: UnifiedGripInfo | null,
  activeGrip: UnifiedGripInfo | null,
  phase: UnifiedGripPhase,
): DxfGripInteractionState {
  const state: DxfGripInteractionState = {};

  if (hoveredGrip?.source === 'dxf' && (phase === 'hovering' || phase === 'warm')) {
    state.hoveredGrip = {
      entityId: hoveredGrip.entityId!,
      gripIndex: hoveredGrip.gripIndex,
    };
  }
  if (activeGrip?.source === 'dxf' && phase === 'dragging') {
    state.activeGrip = {
      entityId: activeGrip.entityId!,
      gripIndex: activeGrip.gripIndex,
    };
  }
  return state;
}

// ── Overlay Projection Builders ──

export function buildOverlayHoveredVertex(
  hoveredGrip: UnifiedGripInfo | null,
): VertexHoverInfo | null {
  if (!hoveredGrip || hoveredGrip.source !== 'overlay' || hoveredGrip.type !== 'vertex') return null;
  return {
    overlayId: hoveredGrip.overlayId!,
    vertexIndex: hoveredGrip.gripIndex,
  };
}

export function buildOverlayHoveredEdge(
  hoveredGrip: UnifiedGripInfo | null,
  currentOverlays: Overlay[],
): EdgeHoverInfo | null {
  if (!hoveredGrip || hoveredGrip.source !== 'overlay' || hoveredGrip.type !== 'edge') return null;
  const overlay = currentOverlays.find((o) => o.id === hoveredGrip.overlayId);
  const polygonLen = overlay?.polygon?.length ?? 0;
  const edgeIndex = hoveredGrip.gripIndex - polygonLen;
  if (edgeIndex < 0) return null;
  return {
    overlayId: hoveredGrip.overlayId!,
    edgeIndex,
  };
}

export function buildOverlayProjection(
  overlayHoveredVertex: VertexHoverInfo | null,
  overlayHoveredEdge: EdgeHoverInfo | null,
  selectedGrips: SelectedGrip[],
  selectedGrip: SelectedGrip | null,
  draggingVertex: DraggingVertexState | null,
  draggingVertices: DraggingVertexState[] | null,
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null,
  draggingOverlayBody: DraggingOverlayBodyState | null,
  dragPreviewPosition: Point2D | null,
): OverlayProjection {
  return {
    hoveredVertexInfo: overlayHoveredVertex,
    hoveredEdgeInfo: overlayHoveredEdge,
    selectedGrips,
    selectedGrip,
    draggingVertex,
    draggingVertices,
    draggingEdgeMidpoint,
    draggingOverlayBody,
    dragPreviewPosition,
  };
}

export interface GripStateForStack {
  draggingVertex: DraggingVertexState | null;
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
  hoveredVertexInfo: VertexHoverInfo | null;
  hoveredEdgeInfo: EdgeHoverInfo | null;
  draggingOverlayBody: DraggingOverlayBodyState | null;
  dragPreviewPosition: Point2D | null;
}

export function buildGripStateForStack(
  draggingVertex: DraggingVertexState | null,
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null,
  overlayHoveredVertex: VertexHoverInfo | null,
  overlayHoveredEdge: EdgeHoverInfo | null,
  draggingOverlayBody: DraggingOverlayBodyState | null,
  dragPreviewPosition: Point2D | null,
): GripStateForStack {
  return {
    draggingVertex,
    draggingEdgeMidpoint,
    hoveredVertexInfo: overlayHoveredVertex,
    hoveredEdgeInfo: overlayHoveredEdge,
    draggingOverlayBody,
    dragPreviewPosition,
  };
}
