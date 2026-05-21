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

// ── DXF Projection Builders ──

export function buildDxfDragPreview(
  phase: UnifiedGripPhase,
  activeGrip: UnifiedGripInfo | null,
  anchorPos: Point2D | null,
  currentWorldPos: Point2D | null,
): DxfGripDragPreview | null {
  if (phase !== 'dragging' || !activeGrip || activeGrip.source !== 'dxf' || !anchorPos || !currentWorldPos) {
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
